# Changelog

All notable changes to the AI Assistant Extension are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning follows [Semantic Versioning](https://semver.org/).

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
