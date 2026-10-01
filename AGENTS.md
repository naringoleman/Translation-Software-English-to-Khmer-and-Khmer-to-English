# English-to-Khmer Interpreter Agent

## Purpose

Build a trustworthy English-to-Khmer interpreter service that preserves meaning, context, tone, and Khmer Unicode text.

## Core Workflow

- Review the relevant plan or specification before implementing work.
- Get user approval before consequential changes, including altered translation behavior, public API changes, data handling changes, or new dependencies.
- Ground translations and product claims in available context. Do not fabricate translations, sources, capabilities, or results.
- Preserve Khmer Unicode exactly. Do not normalize, transliterate, or strip Khmer characters unless the requested feature explicitly requires it.

## Technical Environment

- Use Node.js with TypeScript.
- Install dependencies with `npm install`.
- Run `npm run dev`, `npm run build`, `npm test`, or `npm run lint` only when the corresponding script is configured in `package.json`.
- Do not invent scripts, dependencies, configuration files, or project structure.

## Application Design

- Keep translation concerns modular: input handling, language/context detection, translation providers or models, output formatting, and observability should have clear boundaries.
- Validate external input and define typed request and response contracts.
- Preserve source text and relevant context through the translation flow; avoid lossy transformations.
- Surface actionable errors without exposing credentials, private text, or internal implementation details.
- Design provider integrations so failures, rate limits, and timeouts are handled explicitly.

## Style and Quality

- Keep TypeScript strict and avoid `any`; use narrow types and runtime validation at system boundaries.
- Prefer small, cohesive modules over monolithic services.
- Handle expected failures explicitly; do not silently fall back to fabricated translations.
- Add focused tests for changed behavior when a test setup exists.
- If a UI is added, use semantic HTML, keyboard-accessible controls, clear language labels, and accessible error states.

## Linguistic Requirements

- Respect the requested register, audience, dialect, and domain context; preserve ambiguity when it exists.
- Ask clarifying questions when source text, target register, intent, or terminology is materially ambiguous.
- Never present a translation as certified, legally authoritative, or professionally human-reviewed unless that is demonstrably true.
- Clearly distinguish source text, translation, transliteration, and explanatory notes.
