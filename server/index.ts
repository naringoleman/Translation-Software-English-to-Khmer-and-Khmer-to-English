import { readFile } from "node:fs/promises";
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_REQUEST_BODY_BYTES,
  InvalidTranslationRequestError,
} from "../src/translation.ts";
import {
  createGoogleTranslationProvider,
  ProviderNotConfiguredError,
  ProviderRequestError,
  ProviderTimeoutError,
} from "./google-translation.ts";
import { ConsentRequiredError, translateWithConsent } from "./translation-service.ts";

const development = process.argv.includes("--dev");
const endpointPath = "/api/translate";
const projectDirectory = fileURLToPath(new URL("../", import.meta.url));
const distDirectory = resolve(projectDirectory, "dist");
const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function setSecurityHeaders(response: ServerResponse): void {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self'; style-src 'self'${development ? " 'unsafe-inline'" : ""}; img-src 'self' data:; font-src 'self'; connect-src 'self'${development ? " ws:" : ""}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`,
  );
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: Record<string, string>,
): void {
  response.statusCode = status;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers["content-type"];
  if (
    typeof contentType !== "string" ||
    !/^application\/json(?:\s*;|$)/i.test(contentType)
  ) {
    request.resume();
    throw new HttpError(415, "Send a JSON request.");
  }

  const contentLength = Number(request.headers["content-length"] ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
    request.resume();
    throw new HttpError(413, "The request is too large.");
  }

  const chunks: Buffer[] = [];
  let size = 0;
  let tooLarge = false;

  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.byteLength;
    if (size > MAX_REQUEST_BODY_BYTES) {
      tooLarge = true;
      chunks.length = 0;
    } else if (!tooLarge) {
      chunks.push(bytes);
    }
  }

  if (tooLarge) {
    throw new HttpError(413, "The request is too large.");
  }

  let body: string;
  try {
    body = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
    return JSON.parse(body) as unknown;
  } catch {
    throw new HttpError(400, "The request body is not valid JSON.");
  }
}

function sendApiError(response: ServerResponse, error: unknown): void {
  if (error instanceof HttpError) {
    sendJson(response, error.status, { error: error.message });
  } else if (error instanceof ConsentRequiredError) {
    sendJson(response, 403, {
      error: "Consent is required before sending text to Google Cloud Translation.",
    });
  } else if (error instanceof InvalidTranslationRequestError) {
    sendJson(response, 400, { error: error.message });
  } else if (error instanceof ProviderNotConfiguredError) {
    sendJson(response, 503, {
      error: "Translation is not configured on this server. Your text was not sent to Google.",
    });
  } else if (error instanceof ProviderTimeoutError) {
    sendJson(response, 504, {
      error: "Google Cloud Translation did not respond in time. The request may have been processed and usage charges may apply.",
    });
  } else if (error instanceof ProviderRequestError) {
    sendJson(response, 502, {
      error: "Google Cloud Translation could not complete the request. Provider details are hidden; usage charges may apply.",
    });
  } else {
    sendJson(response, 500, {
      error: "Translation could not be completed. Internal details are not available.",
    });
  }
}

async function handleTranslationApi(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "Use POST to request a translation." });
    return;
  }

  try {
    const payload = await readJsonBody(request);
    const provider = createGoogleTranslationProvider(
      process.env.GOOGLE_CLOUD_TRANSLATE_API_KEY,
    );
    const result = await translateWithConsent(payload, provider);
    sendJson(response, 200, { translation: result.text });
  } catch (error) {
    sendApiError(response, error);
  }
}

async function serveProductionFile(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<void> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.statusCode = 405;
    response.setHeader("Allow", "GET, HEAD");
    response.end("Method not allowed.");
    return;
  }

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    response.statusCode = 400;
    response.end("Invalid path.");
    return;
  }

  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.slice(1);
  const filePath = resolve(distDirectory, relativePath);
  if (
    filePath !== distDirectory &&
    !filePath.startsWith(`${distDirectory}${sep}`)
  ) {
    response.statusCode = 404;
    response.end("Not found.");
    return;
  }

  let content: Buffer;
  let servedPath = filePath;
  try {
    content = await readFile(filePath);
  } catch {
    if (extname(filePath) !== "") {
      response.statusCode = 404;
      response.end("Not found.");
      return;
    }

    servedPath = resolve(distDirectory, "index.html");
    try {
      content = await readFile(servedPath);
    } catch {
      response.statusCode = 500;
      response.end("The application build is unavailable.");
      return;
    }
  }

  response.statusCode = 200;
  response.setHeader(
    "Content-Type",
    mimeTypes[extname(servedPath)] ?? "application/octet-stream",
  );
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Length", content.byteLength);
  response.end(request.method === "HEAD" ? undefined : content);
}

const vite = development
  ? await import("vite").then(({ createServer }) =>
      createServer({
        appType: "spa",
        server: { middlewareMode: true },
      }),
    )
  : null;

const server = createHttpServer((request, response) => {
  setSecurityHeaders(response);
  const requestUrl = new URL(request.url ?? "/", "http://localhost");

  if (requestUrl.pathname === endpointPath) {
    void handleTranslationApi(request, response);
    return;
  }
  if (requestUrl.pathname.startsWith("/api/")) {
    sendJson(response, 404, { error: "API route not found." });
    return;
  }

  if (vite !== null) {
    vite.middlewares(request, response, (error?: Error | null) => {
      if (error !== undefined && error !== null) {
        response.statusCode = 500;
        response.end("The development server encountered an error.");
      } else if (!response.writableEnded) {
        response.statusCode = 404;
        response.end("Not found.");
      }
    });
    return;
  }

  void serveProductionFile(request, response, requestUrl.pathname);
});

server.headersTimeout = 10_000;
server.requestTimeout = 15_000;

const defaultPort = development ? 5173 : 3000;
const port = Number(process.env.PORT ?? defaultPort);
if (!Number.isInteger(port) || port < 0 || port > 65_535) {
  throw new Error("PORT must be a valid TCP port.");
}

const host = process.env.HOST ?? (development ? "127.0.0.1" : "0.0.0.0");
server.listen(port, host, () => {
  process.stdout.write(`App server listening on http://${host}:${port}\n`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void vite?.close().finally(() => {
      server.close();
    });
  });
}
