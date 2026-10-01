# English ↔ Khmer Translator

A browser-based English/Khmer translation app built with TypeScript and Vite. The app uses Google Cloud Translation Basic v2 from a Node.js server; the browser never receives the provider API key.

## Data handling, consent, and cost

Translation sends the text you submit to Google Cloud Translation for external processing. Google Cloud's terms and data-handling practices apply. Translation usage may incur charges on the configured Google Cloud project. Review [Google Cloud Translation pricing](https://cloud.google.com/translate/pricing) before enabling the service.

The consent checkbox is unchecked by default and must be checked for each translation request. Without consent, the browser makes no request. If the server API key is missing, the server does not contact Google and returns an explicit configuration error. Text is not written to logs, browser storage, or server storage. The app preserves submitted text as entered, including Khmer Unicode.

## Configure Google Cloud Translation Basic v2

1. In Google Cloud, select or create a project, enable billing, and enable the Cloud Translation API.
2. Create an API key. Restrict it to the Cloud Translation API and follow Google's recommendations for securing server-side keys. Do not put the key in browser code, a `.env` file committed to Git, or source control.
3. Set `GOOGLE_CLOUD_TRANSLATE_API_KEY` in the server environment.

PowerShell:

```powershell
npm.cmd install
$env:GOOGLE_CLOUD_TRANSLATE_API_KEY = "your-server-side-key"
npm.cmd run dev
```

macOS/Linux:

```sh
export GOOGLE_CLOUD_TRANSLATE_API_KEY="your-server-side-key"
npm run dev
```

`npm run dev` starts the Node API server with Vite middleware. For production, build the client and run the same API/static server.

PowerShell on Windows:

```powershell
npm.cmd run build
npm.cmd start
```

macOS/Linux:

```sh
npm run build
npm start
```

Set `PORT` and `HOST` in the hosting environment as needed. Production runs on port `3000` by default and binds to `0.0.0.0`; development uses port `5173` on `127.0.0.1`. Public deployments should additionally apply platform authentication or rate limiting and configure API key restrictions and budget alerts.

The server sends requests to `https://translation.googleapis.com/language/translate/v2` with the API key in the `X-Goog-Api-Key` header. The source text is sent unchanged in the request body. Supported directions are English (`en`) ↔ Khmer (`km`), per [Google's supported-language list](https://cloud.google.com/translate/docs/languages). The server rejects missing consent, invalid language pairs, empty text, text longer than 5,000 Unicode code points, and request bodies larger than 32 KiB. Provider requests time out after 10 seconds. Errors shown to the browser do not include provider response bodies, internal details, or credentials.

No API key is configured in this repository, so live translation has not been verified. Automated provider tests use a mocked fetch and never contact Google.

## Run checks

Requires Node.js 22.12+.

PowerShell on Windows:

```powershell
npm.cmd install
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

macOS/Linux:

```sh
npm install
npm test
npm run typecheck
npm run build
```

## Repository skills

- **Optional medical interpretation use case**: `.github/skills/medical-interpretation/SKILL.md` gives bidirectional English/Khmer medical interpretation guidance, privacy requirements, and safety boundaries. It is guidance for medical communication requests; it does not make the app a certified interpreter or change ordinary translations.

## Dependencies

Vite and TypeScript provide the browser development/build pipeline; `@types/node` enables strict type checking of the Node server. The API server uses Node built-ins and has no added runtime framework or translation SDK.
