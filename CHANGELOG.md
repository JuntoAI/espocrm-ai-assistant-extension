# Changelog

All notable changes to the AI Assistant Extension are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning follows [Semantic Versioning](https://semver.org/).

## [1.5.4] - 2026-05-20

### Changed
- Model dropdown is now **dynamic** — fetches available models from the backend at runtime via `GET /api/v1/AiAssistant/models`.
- No more hardcoded model list in the frontend. To add/remove models, update the `GEMINI_AVAILABLE_MODELS` env var on the backend container and restart.

### Added
- `GET /api/v1/AiAssistant/models` PHP proxy endpoint that forwards to the AI Backend's `GET /models`.
- `GET /models` endpoint on the AI Backend returning `{ models: [...], defaultModel: "..." }`.
- `MODEL_LABELS` lookup in `ai-panel-init.js` for friendly display names of known models.

## [1.5.3] - 2026-05-20

### Fixed
- Model dropdown in `ai-panel-init.js` (the actual bootstrap script) now shows Gemini 3.5 Flash as default. Previous 1.5.2 only updated the unused `ai-panel.js` view file.

## [1.5.2] - 2026-05-20

### Added
- Gemini 3.5 Flash model (`gemini-3.5-flash`) — Google's latest and fastest frontier model, now the default.

### Changed
- Default model switched from `gemini-3.1-flash-lite-preview` to `gemini-3.5-flash`.
- Model selector relabeled: "Gemini Pro" → "Gemini Pro", "Gemini Flash" → "Gemini Flash Lite", new "Gemini 3.5 Flash" at top.

## [1.5.1] - 2026-04-23

### Fixed
- PHP proxy cURL timeout increased from 65s to 130s to support PDF analysis requests that take longer with Gemini.

## [1.5.0] - 2026-04-23

### Changed
- Backend architecture: removed CRMExecutor duplicate REST layer, all CRM tool calls now route through MCP server via stdio bridge with per-user API key override. Single source of truth for PATCH/PUT, field unwrapping, validation.
- Fixes silent update failures (e.g. billing address not persisting on Silicon Gardens) caused by the old CRMExecutor sending nested `data` wrapper and using PUT instead of PATCH.

## [1.5.0] - 2026-04-23

### Added
- Administration > Integrations > AI Assistant config panel with two fields:
  - **AI Backend URL** — where the AI backend service runs (default: `http://ai-backend:3001`)
  - **API User Name** — which EspoCRM API user to use for CRM operations (default: `mcp-integration`)
- i18n labels and tooltips for both fields

### Changed
- `PostChat.php` now reads config from the Integration entity first, with legacy `config.php` fallback for backward compatibility

## [1.4.4] - 2026-04-23

### Changed
- API user name for proxying browser/OIDC requests is now configurable via EspoCRM config (`aiAssistantApiUserName`), defaults to `mcp-integration`. No longer hardcoded.

## [1.4.3] - 2026-04-23

### Fixed
- AI Assistant actions (create account, etc.) were attributed to `juntoai_ghl` instead of the correct API user. Strategy 2 in `getUserApiKey()` was grabbing any active API user — now explicitly targets the `mcp-integration` API user by userName.

## [1.1.8] - 2026-04-21

### Fixed
- PDF upload in ai-panel-init.js now uses FileReader base64 + Espo.Ajax.postRequest (same as api-client.js) so auth works correctly
- PHP proxy processUpload now accepts both multipart ($_FILES) and base64 JSON (fileData) — supports all frontend upload paths

## [1.1.7] - 2026-04-21

### Changed
- Loading indicator now shows only "Thinking..." instead of fake staged messages ("Querying CRM...", "Fetching data...", "Processing results..."). CRM tool usage is shown accurately via tool badges on the response after it arrives.

### Fixed
- PDF upload permission denied on server — fixed /tmp/uploads directory permissions on the GCE instance

## [1.1.6] - 2026-04-21

### Fixed
- Reverted getUserApiKey Strategy 2 removal — OIDC session tokens don't work with X-Api-Key header on the ai-backend. The shared API user key is required for both chat and upload. Chat was broken in v1.1.5.

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
