# Changelog

All notable changes to the AI Assistant Extension are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning follows [Semantic Versioning](https://semver.org/).

## [1.1.5] - 2026-04-21

### Fixed
- PDF upload silently failing: `getUserApiKey()` Strategy 2 was finding the MCP API user and returning its key instead of the logged-in user's session token. The ai-backend then rejected the request with 500 "no permission". Removed Strategy 2 entirely — the correct key for browser users is always the session AuthToken (Strategy 3).

## [1.1.4] - 2026-04-21

### Fixed
- PDF upload auth completely reworked: dropped XHR multipart approach (which could never get the Espo-Authorization header) in favour of FileReader base64 + Espo.Ajax.postRequest. Espo.Ajax handles EspoCRM auth automatically. PHP proxy now accepts JSON with base64 fileData, decodes to a temp file, and forwards as multipart to the AI backend.

## [1.1.3] - 2026-04-21

### Fixed
- Upload XHR now reads `Espo.Ajax.headers['Espo-Authorization']` and sets it explicitly on the XHR request, fixing the `- -` unauthenticated requests. Also fixed missing route `/AiAssistant/chat/upload` in `routes.json` (was `/AiAssistant/upload`).

## [1.1.2] - 2026-04-21

### Fixed
- PDF upload in `ai-panel-init.js` hitting wrong endpoint (`/AiAssistant/upload` instead of `/AiAssistant/chat/upload`), missing `withCredentials = true`, and using a non-existent auth token lookup — all three issues caused 400 errors

## [1.1.1] - 2026-04-21

### Fixed
- PDF file upload always returning 400 — XHR was missing `withCredentials = true`, so EspoCRM session cookies were not sent and the request was rejected as unauthenticated before reaching the PHP proxy. Removed the non-existent `Espo.Ajax.getHeader` call and replaced with `xhr.withCredentials = true`.

## [1.1.0] - 2025-07-15

### Added
- Markdown rendering in AI responses
- Source attribution for CRM data references
- Panel state persistence across page navigation

### Changed
- Improved API client error handling

## [1.0.0] - 2025-07-15

### Added
- Initial release
- AI chat panel integrated into EspoCRM UI
- Natural language CRM operations via Gemini + MCP
- 47 CRM tool access through AI backend
- PHP API endpoint for chat relay
- CSS panel styling with responsive layout
- Property-based tests with fast-check
