import assert from "node:assert/strict";
import test from "node:test";
import {
  InvalidTranslationRequestError,
  MAX_TEXT_CODE_POINTS,
  validateTranslationRequest,
} from "../src/translation.ts";
import {
  createGoogleTranslationProvider,
  GoogleTranslationProvider,
  ProviderNotConfiguredError,
  ProviderRequestError,
  ProviderTimeoutError,
} from "../server/google-translation.ts";
import {
  ConsentRequiredError,
  translateWithConsent,
} from "../server/translation-service.ts";

const request = {
  text: "  ខ្មែរ\u17C6\n🌏  ",
  sourceLanguage: "km",
  targetLanguage: "en",
};

test("request validation preserves source text and accepts both supported languages", () => {
  assert.deepEqual(validateTranslationRequest(request), request);
  assert.deepEqual(
    validateTranslationRequest({
      text: "Hello",
      sourceLanguage: "en",
      targetLanguage: "km",
    }),
    {
      text: "Hello",
      sourceLanguage: "en",
      targetLanguage: "km",
    },
  );
});

test("request validation rejects empty, oversized, unsupported, and same-language input", () => {
  for (const invalid of [
    { ...request, text: " \n " },
    { ...request, text: "x".repeat(MAX_TEXT_CODE_POINTS + 1) },
    { ...request, sourceLanguage: "fr" },
    { ...request, targetLanguage: "km" },
  ]) {
    assert.throws(
      () => validateTranslationRequest(invalid),
      InvalidTranslationRequestError,
    );
  }
});

test("translation is blocked without explicit consent", async () => {
  let providerCalls = 0;
  const provider = {
    async translate() {
      providerCalls += 1;
      return { text: "unexpected" };
    },
  };

  await assert.rejects(
    translateWithConsent({ ...request, consent: false }, provider),
    ConsentRequiredError,
  );
  await assert.rejects(
    translateWithConsent(request, provider),
    ConsentRequiredError,
  );
  assert.equal(providerCalls, 0);
});

test("missing API key prevents provider creation and all external calls", async () => {
  let fetchCalls = 0;
  const provider = createGoogleTranslationProvider(
    "  ",
    async () => {
      fetchCalls += 1;
      return new Response();
    },
  );

  assert.equal(provider, null);
  await assert.rejects(
    translateWithConsent({ ...request, consent: true }, provider),
    ProviderNotConfiguredError,
  );
  assert.equal(fetchCalls, 0);
});

test("Google provider sends the original request with a server-side API key header", async () => {
  let capturedUrl;
  let capturedOptions;
  const fetchMock = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return new Response(
      JSON.stringify({ data: { translations: [{ translatedText: "Hello" }] } }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const provider = createGoogleTranslationProvider("  server-key  ", fetchMock);

  assert.ok(provider instanceof GoogleTranslationProvider);
  const result = await translateWithConsent(
    { ...request, consent: true },
    provider,
  );

  assert.deepEqual(result, { text: "Hello" });
  assert.equal(
    capturedUrl,
    "https://translation.googleapis.com/language/translate/v2",
  );
  assert.equal(new URL(capturedUrl).search, "");
  assert.equal(capturedOptions.method, "POST");
  assert.equal(capturedOptions.headers["X-Goog-Api-Key"], "server-key");
  assert.ok(capturedOptions.signal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(capturedOptions.body), {
    q: request.text,
    source: "km",
    target: "en",
    format: "text",
  });
});

test("provider failures do not expose Google response details or credentials", async () => {
  const provider = new GoogleTranslationProvider(
    "server-secret",
    async () =>
      new Response("server-secret internal provider detail", { status: 403 }),
  );

  await assert.rejects(provider.translate(request), (error) => {
    assert.ok(error instanceof ProviderRequestError);
    assert.equal(error.message.includes("server-secret"), false);
    assert.equal(error.message.includes("internal provider detail"), false);
    return true;
  });
});

test("provider timeouts are surfaced with a sanitized error", async () => {
  const provider = new GoogleTranslationProvider("server-secret", async () => {
    throw Object.assign(new Error("server-secret internal detail"), {
      name: "TimeoutError",
    });
  });

  await assert.rejects(provider.translate(request), (error) => {
    assert.ok(error instanceof ProviderTimeoutError);
    assert.equal(error.message.includes("server-secret"), false);
    assert.equal(error.message.includes("internal detail"), false);
    return true;
  });
});

test("invalid provider responses are rejected", async () => {
  const provider = new GoogleTranslationProvider(
    "server-secret",
    async () =>
      new Response(JSON.stringify({ data: { translations: [{}] } }), {
        status: 200,
      }),
  );

  await assert.rejects(provider.translate(request), ProviderRequestError);
});
