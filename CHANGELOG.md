# Changelog

All notable changes to the AI Assistant Extension are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning follows [Semantic Versioning](https://semver.org/).

## [1.11.0] - 2026-05-25

### Added
- **Tool Errors metric** — the AI Usage Statistics dashboard now shows "Tool Errors" (individual MCP tool call failures within successful chat requests). This surfaces silent degradation where Gemini retries failing tools, wasting tokens and latency, without the overall request failing.
- New `tool_errors` column in `ai_usage_log` table (auto-migrated on extension upgrade via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).

### Changed
- AI Backend `_usage` response now includes `toolErrors` count alongside `toolCalls`.
- `UsageLogger.php` extracts and persists `toolErrors` from the backend response.
- `GetUsageStats.php` includes `toolErrors` sum in all period stats (today, 7d, 30d) with period-over-period comparison.
- Dashboard displays "Tool Errors" row with inverted color coding (increase = red, decrease = green).

## [1.10.0] - 2026-05-25

### Added
- **Top Tools period selector** — dropdown on the Top Tools panel to switch between Today, Last 7 Days, and Last 30 Days. Backend now returns `topToolsToday`, `topTools7Days`, and `topTools30Days` separately.
- **Period-over-period comparison** — each summary card (Today / 7 Days / 30 Days) now shows a colored arrow + percentage change next to every metric, comparing against the equivalent previous period (yesterday, previous 7 days, previous 30 days). Green ↑ = growth, red ↓ = decline. Inverted for errors and latency (lower is better).

### Changed
- `GetUsageStats.php` now computes `previousToday`, `previous7Days`, and `previous30Days` stats using a new `getStatsBetween()` method for bounded date-range queries.
- Removed the single `topTools` key from the API response; replaced with three period-specific keys.

## [1.9.3] - 2026-05-22

### Fixed
- UsageLogger ID generation: EspoCRM rebuild sets `id` column to `VARCHAR(17)`, not 24. Fixed to generate 17-char IDs matching EspoCRM's convention.

## [1.9.2] - 2026-05-22

### Fixed
- Chart.js now properly loaded as AMD dependency (`chart-dashlet-chart-js`) in the AI Usage admin page. Charts render correctly when Chart Dashlet extension is installed.

## [1.9.1] - 2026-05-22

### Fixed
- Admin page routing: replaced broken `#Admin/aiUsage` approach with proper `clientRoutes` metadata + dedicated controller. Page now accessible via `#AiUsage` route linked from Administration panel.

## [1.9.0] - 2026-05-22

### Added
- **AI Usage Statistics tracking** — every chat, brief, and upload request now logs token usage (prompt/completion/total), model used, tool calls, latency, and success/failure to a dedicated `ai_usage_log` database table.
- **Admin page (`#Admin/aiUsage`)** — full-page administration view with summary cards (today/7d/30d), daily tokens + tool calls line chart, model breakdown doughnut chart, top tools table, and per-user usage table. Accessible via Administration > AI > AI Usage Statistics.
- **`UsageLogger` service** — extracts `_usage` metadata from AI Backend responses and persists to DB. Fails silently to never break user-facing requests.
- **`GET /api/v1/AiAssistant/usageStats` endpoint** — admin-only API returning aggregated stats for today, 7 days, and 30 days including: tokens by model, tokens by day, top tools used, per-user breakdown, request counts, error rates, and average latency.
- **`AiUsageLog` entity definition** — EspoCRM entity with indexed fields for efficient time-range queries.
- **`AfterInstall.php` script** — creates the `ai_usage_log` table on extension install with proper indexes.

### Changed
- `PostChat.php`, `PostBrief.php`, `PostUpload.php` now measure request duration and call `UsageLogger` after each AI Backend response.

## [1.8.0] - 2026-07-15

### Added
- **Proactive Daily Brief** — on panel open, automatically fetches and displays a collapsible card with 3-5 prioritized action recommendations based on CRM state analysis (overdue opportunities, stalled accounts, overdue tasks).
- **Brief card UI** — distinct blue-accented card (#f0f7ff background, #2196F3 left border) with collapsible body, loading indicator, and clickable command chips that pre-fill the chat input.
- **Client-side brief cache** — in-memory cache with 1-hour TTL prevents redundant API calls on repeated panel opens.
- **Email drafting tool** — new `draft_email` Gemini function declaration allows users to request email drafts via chat. Generates subject + body using contact context from EspoCRM. Never sends email.
- **PostBrief.php proxy endpoint** — `POST /api/v1/AiAssistant/brief` forwards brief requests to the AI Backend with user authentication.
- **10-second fetch timeout** — brief fetch uses AbortController; on timeout/error, displays regular chat state without blocking.

### Changed
- Panel open now triggers non-blocking brief fetch with loading indicator while keeping chat input enabled.
- Brief card renders above existing conversation history without clearing prior messages.

## [1.7.0] - 2026-05-20

### Added
- **Keyboard shortcut (Ctrl+Shift+A)** — instantly toggle the AI panel open/closed without losing conversation state. Works from anywhere in the CRM.
- **Minimize to bubble** — new minimize button (─) in the panel header collapses the panel to a small floating pill showing the last message snippet. Click the bubble to restore. Close (×) on the bubble dismisses it entirely back to the FAB.
- Minimized state persists in sessionStorage across page navigations.

## [1.6.0] - 2026-05-20

### Added
- **Resizable panel** — drag the left edge of the panel to resize freely between 350px and 70% of viewport width. Width persists in sessionStorage.
- **Expand toggle button** — one-click button in the header to toggle between default (400px) and 50% viewport width. Icon rotates to indicate state.
- Resize handle shows a subtle blue grip indicator on hover.

## [1.5.6] - 2026-05-20

### Changed
- PHP proxy cURL timeout increased from 130s to 300s to support complex multi-tool queries that take longer with Gemini 3.5 Flash.

## [1.5.5] - 2026-05-20

### Added
- Prompt history navigation with Arrow Up/Down keys — cycle through previously sent messages, persisted in sessionStorage (max 50 entries).

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
