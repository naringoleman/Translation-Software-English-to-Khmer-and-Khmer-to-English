export type Language = "en" | "km";

export const MAX_TEXT_CODE_POINTS = 5_000;
export const MAX_REQUEST_BODY_BYTES = 32 * 1024;

export interface TranslationRequest {
  readonly text: string;
  readonly sourceLanguage: Language;
  readonly targetLanguage: Language;
}

export interface TranslationResult {
  readonly text: string;
}

export interface TranslationProvider {
  translate(request: TranslationRequest): Promise<TranslationResult>;
}

export class InvalidTranslationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTranslationRequestError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "km";
}

export function validateTranslationRequest(value: unknown): TranslationRequest {
  if (!isRecord(value)) {
    throw new InvalidTranslationRequestError("Request must be a JSON object.");
  }

  const { text, sourceLanguage, targetLanguage } = value;
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new InvalidTranslationRequestError("Enter text to translate.");
  }
  if (Array.from(text).length > MAX_TEXT_CODE_POINTS) {
    throw new InvalidTranslationRequestError(
      `Text must be ${MAX_TEXT_CODE_POINTS} characters or fewer.`,
    );
  }
  if (!isLanguage(sourceLanguage) || !isLanguage(targetLanguage)) {
    throw new InvalidTranslationRequestError(
      "Choose English or Khmer for both languages.",
    );
  }
  if (sourceLanguage === targetLanguage) {
    throw new InvalidTranslationRequestError(
      "Source and target languages must be different.",
    );
  }

  return { text, sourceLanguage, targetLanguage };
}
