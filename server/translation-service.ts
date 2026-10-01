import {
  InvalidTranslationRequestError,
  validateTranslationRequest,
  type TranslationProvider,
  type TranslationResult,
} from "../src/translation.ts";
import { ProviderNotConfiguredError } from "./google-translation.ts";

export class ConsentRequiredError extends Error {
  constructor() {
    super("Explicit consent is required before translation.");
    this.name = "ConsentRequiredError";
  }
}

export async function translateWithConsent(
  payload: unknown,
  provider: TranslationProvider | null,
): Promise<TranslationResult> {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("consent" in payload) ||
    payload.consent !== true
  ) {
    throw new ConsentRequiredError();
  }

  const request = validateTranslationRequest(payload);
  if (provider === null) {
    throw new ProviderNotConfiguredError();
  }

  return provider.translate(request);
}

export { InvalidTranslationRequestError };
