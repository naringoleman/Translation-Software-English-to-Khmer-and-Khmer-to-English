import {
  InvalidTranslationRequestError,
  MAX_TEXT_CODE_POINTS,
  validateTranslationRequest,
  type Language,
} from "./translation.ts";
import "./styles.css";

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Required workspace element was not found: ${selector}`);
  }
  return element;
}

const app = requireElement<HTMLDivElement>("#app");

app.innerHTML = `
  <div class="page-shell">
    <header class="topbar">
      <a class="brand" href="/" aria-label="English Khmer Translator home">
        <span class="brand-mark" aria-hidden="true">ក</span>
        <span class="brand-name">Lingo<span>Bridge</span></span>
      </a>
      <div class="privacy-note">
        <span class="privacy-dot" aria-hidden="true"></span>
        <span>External translation requires your consent</span>
      </div>
    </header>

    <main>
      <section class="intro" aria-labelledby="page-title">
        <p class="eyebrow">ENGLISH <span aria-hidden="true">/</span> KHMER</p>
        <h1 id="page-title">Make every word <span>understood.</span></h1>
        <p class="intro-copy">A clear space for writing between English and Khmer.</p>
      </section>

      <section class="translator-card" aria-label="Translation workspace">
        <div class="language-bar">
          <label class="language-choice">
            <span class="visually-hidden">Source language</span>
            <select id="source-language" aria-label="Source language">
              <option value="en">English</option>
              <option value="km">Khmer · ខ្មែរ</option>
            </select>
          </label>
          <button class="swap-button" id="swap-languages" type="button" aria-label="Reverse language direction" title="Reverse language direction">
            <span aria-hidden="true">⇄</span>
          </button>
          <label class="language-choice">
            <span class="visually-hidden">Target language</span>
            <select id="target-language" aria-label="Target language">
              <option value="km">Khmer · ខ្មែរ</option>
              <option value="en">English</option>
            </select>
          </label>
          <span class="direction-label" id="direction-label">English to Khmer</span>
        </div>

        <form id="translation-form">
          <div class="editor-grid">
            <section class="editor-panel source-panel" aria-labelledby="source-heading">
              <div class="panel-heading">
                <h2 id="source-heading">Your text</h2>
                <span class="panel-caption">SOURCE</span>
              </div>
              <textarea
                id="source-text"
                name="source-text"
                placeholder="Type or paste text here..."
                aria-label="Text to translate"
                spellcheck="true"
              ></textarea>
              <div class="panel-foot">
                <span id="character-count">0 characters</span>
                <button class="text-button" id="clear-text" type="button">Clear</button>
              </div>
            </section>

            <section class="editor-panel result-panel" aria-labelledby="result-heading">
              <div class="panel-heading">
                <h2 id="result-heading">Translation</h2>
                <span class="panel-caption">RESULT</span>
              </div>
              <div class="result-body" aria-live="polite" aria-atomic="true">
                <div class="empty-state">
                  <span class="empty-icon" aria-hidden="true">ក</span>
                  <p class="result-message" id="result-message">Your translation will appear here</p>
                  <p class="result-detail" id="result-detail">Nothing is sent until you agree below and select Translate.</p>
                  <p class="result-output" id="result-output" hidden></p>
                </div>
              </div>
              <div class="panel-foot result-foot">
                <span class="local-badge"><span aria-hidden="true">●</span> GOOGLE CLOUD TRANSLATION</span>
                <span class="panel-caption">OUTPUT</span>
              </div>
            </section>
          </div>

          <div class="action-row">
            <div class="consent-control">
              <label class="consent-label" for="translation-consent">
                <input id="translation-consent" type="checkbox" aria-describedby="consent-disclosure" />
                <span>I consent to sending this text to Google Cloud Translation for processing. Google Cloud usage may incur charges.</span>
              </label>
              <p class="consent-disclosure" id="consent-disclosure">Google Cloud processes submitted text under its terms. Your text is sent only after you check this box and select Translate; this app does not save it.</p>
            </div>
            <button class="translate-button" type="submit">
              <span>Translate</span><span aria-hidden="true">→</span>
            </button>
          </div>
        </form>
      </section>

      <p class="privacy-footnote"><span aria-hidden="true">ⓘ</span> Google receives text only after consent and submission. Billing may apply.</p>
    </main>

    <footer class="site-footer">
      <span>English ↔ Khmer Translator</span>
      <span>Built for understanding.</span>
    </footer>
  </div>
`;

const sourceLanguage = requireElement<HTMLSelectElement>("#source-language");
const targetLanguage = requireElement<HTMLSelectElement>("#target-language");
const sourceText = requireElement<HTMLTextAreaElement>("#source-text");
const translationForm = requireElement<HTMLFormElement>("#translation-form");
const translationConsent = requireElement<HTMLInputElement>("#translation-consent");
const swapButton = requireElement<HTMLButtonElement>("#swap-languages");
const clearButton = requireElement<HTMLButtonElement>("#clear-text");
const characterCount = requireElement<HTMLSpanElement>("#character-count");
const directionLabel = requireElement<HTMLSpanElement>("#direction-label");
const resultMessage = requireElement<HTMLParagraphElement>("#result-message");
const resultDetail = requireElement<HTMLParagraphElement>("#result-detail");
const resultOutput = requireElement<HTMLParagraphElement>("#result-output");
const translateButton = requireElement<HTMLButtonElement>(".translate-button");

function languageName(language: Language): string {
  return language === "en" ? "English" : "Khmer";
}

function selectedLanguage(select: HTMLSelectElement): Language {
  const value = select.value;
  if (value !== "en" && value !== "km") {
    throw new Error(`Unsupported language value: ${value}`);
  }
  return value;
}

function updateDirection(): void {
  directionLabel.textContent = `${languageName(selectedLanguage(sourceLanguage))} to ${languageName(selectedLanguage(targetLanguage))}`;
}

function updateCharacterCount(): void {
  const count = Array.from(sourceText.value).length;
  characterCount.textContent = `${count.toLocaleString()} / ${MAX_TEXT_CODE_POINTS.toLocaleString()} characters`;
}

function resetTranslationResult(): void {
  resultMessage.textContent = "Your translation will appear here";
  resultDetail.textContent = "Nothing is sent until you agree below and select Translate.";
  resultOutput.hidden = true;
  resultOutput.textContent = "";
}

sourceLanguage.addEventListener("change", updateDirection);
sourceLanguage.addEventListener("change", resetTranslationResult);
targetLanguage.addEventListener("change", () => {
  updateDirection();
  resetTranslationResult();
});

swapButton.addEventListener("click", () => {
  const source = sourceLanguage.value;
  sourceLanguage.value = targetLanguage.value;
  targetLanguage.value = source;
  updateDirection();
  resetTranslationResult();
});

sourceText.addEventListener("input", () => {
  updateCharacterCount();
  resetTranslationResult();
});

clearButton.addEventListener("click", () => {
  sourceText.value = "";
  translationConsent.checked = false;
  updateCharacterCount();
  resetTranslationResult();
});

translationForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!translationConsent.checked) {
    resultMessage.textContent = "Consent is required";
    resultDetail.textContent =
      "Check the consent box to send this text to Google Cloud Translation. No request was made.";
    resultOutput.hidden = true;
    resultOutput.textContent = "";
    translationConsent.focus();
    return;
  }

  let request: ReturnType<typeof validateTranslationRequest>;
  try {
    request = validateTranslationRequest({
      text: sourceText.value,
      sourceLanguage: sourceLanguage.value,
      targetLanguage: targetLanguage.value,
    });
  } catch (error) {
    if (!(error instanceof InvalidTranslationRequestError)) {
      throw error;
    }
    resultMessage.textContent = "Check the translation request";
    resultDetail.textContent = error.message;
    resultOutput.hidden = true;
    resultOutput.textContent = "";
    translationConsent.checked = false;
    return;
  }

  translationConsent.checked = false;
  translateButton.disabled = true;
  translationConsent.disabled = true;
  sourceLanguage.disabled = true;
  targetLanguage.disabled = true;
  sourceText.disabled = true;
  clearButton.disabled = true;
  swapButton.disabled = true;
  resultMessage.textContent = "Translating";
  resultDetail.textContent = "Your text is being sent to Google Cloud Translation.";
  resultOutput.hidden = true;
  resultOutput.textContent = "";

  try {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...request, consent: true }),
      credentials: "same-origin",
      cache: "no-store",
    });
    const responseBody: unknown = await response.json();

    if (!response.ok) {
      const message =
        typeof responseBody === "object" &&
        responseBody !== null &&
        "error" in responseBody &&
        typeof responseBody.error === "string"
          ? responseBody.error
          : "Translation could not be completed.";
      resultMessage.textContent = "Translation unavailable";
      resultDetail.textContent = message;
      return;
    }

    if (
      typeof responseBody !== "object" ||
      responseBody === null ||
      !("translation" in responseBody) ||
      typeof responseBody.translation !== "string"
    ) {
      resultMessage.textContent = "Translation unavailable";
      resultDetail.textContent =
        "The translation server returned an invalid response. No internal details are available.";
      return;
    }

    resultMessage.textContent = "Translation complete";
    resultDetail.textContent = "Provided by Google Cloud Translation Basic v2.";
    resultOutput.textContent = responseBody.translation;
    resultOutput.hidden = false;
  } catch {
    resultMessage.textContent = "No server response";
    resultDetail.textContent =
      "The request may have reached Google and could incur charges. Check before retrying.";
  } finally {
    translateButton.disabled = false;
    translationConsent.disabled = false;
    sourceLanguage.disabled = false;
    targetLanguage.disabled = false;
    sourceText.disabled = false;
    clearButton.disabled = false;
    swapButton.disabled = false;
  }
});

updateDirection();
updateCharacterCount();
