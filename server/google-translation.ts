import type {
  TranslationProvider,
  TranslationRequest,
  TranslationResult,
} from "../src/translation.ts";

const TRANSLATE_URL =
  "https://translation.googleapis.com/language/translate/v2";
const REQUEST_TIMEOUT_MS = 10_000;

export class ProviderNotConfiguredError extends Error {
  constructor() {
    super("Translation is not configured on this server.");
    this.name = "ProviderNotConfiguredError";
  }
}

export class ProviderTimeoutError extends Error {
  constructor() {
    super("Google Cloud Translation did not respond in time.");
    this.name = "ProviderTimeoutError";
  }
}

export class ProviderRequestError extends Error {
  constructor() {
    super("Google Cloud Translation could not complete the request.");
    this.name = "ProviderRequestError";
  }
}

export class GoogleTranslationProvider implements TranslationProvider {
  private readonly apiKey: string;
  private readonly fetchImplementation: typeof fetch;

  constructor(apiKey: string, fetchImplementation: typeof fetch = fetch) {
    this.apiKey = apiKey.trim();
    this.fetchImplementation = fetchImplementation;
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    let response: Response;
    let payload: unknown;

    try {
      response = await this.fetchImplementation(TRANSLATE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
        },
        body: JSON.stringify({
          q: request.text,
          source: request.sourceLanguage,
          target: request.targetLanguage,
          format: "text",
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new ProviderRequestError();
      }
      payload = await response.json();
    } catch (error) {
      if (error instanceof ProviderRequestError) {
        throw error;
      }
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        throw new ProviderTimeoutError();
      }
      throw new ProviderRequestError();
    }

    if (
      typeof payload !== "object" ||
      payload === null ||
      !("data" in payload) ||
      typeof payload.data !== "object" ||
      payload.data === null ||
      !("translations" in payload.data) ||
      !Array.isArray(payload.data.translations) ||
      payload.data.translations.length === 0
    ) {
      throw new ProviderRequestError();
    }

    const firstTranslation: unknown = payload.data.translations[0];
    if (
      typeof firstTranslation !== "object" ||
      firstTranslation === null ||
      !("translatedText" in firstTranslation) ||
      typeof firstTranslation.translatedText !== "string"
    ) {
      throw new ProviderRequestError();
    }

    return { text: firstTranslation.translatedText };
  }
}

export function createGoogleTranslationProvider(
  apiKey: string | undefined,
  fetchImplementation?: typeof fetch,
): GoogleTranslationProvider | null {
  if (apiKey === undefined || apiKey.trim().length === 0) {
    return null;
  }

  return fetchImplementation === undefined
    ? new GoogleTranslationProvider(apiKey.trim())
    : new GoogleTranslationProvider(apiKey.trim(), fetchImplementation);
}
