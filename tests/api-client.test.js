const fs = require('fs');
const path = require('path');

const API_CLIENT_PATH = path.resolve(
    __dirname,
    '../files/client/custom/modules/ai-assistant/src/helpers/api-client.js'
);

describe('api-client.js', () => {
    let source;

    beforeAll(() => {
        source = fs.readFileSync(API_CLIENT_PATH, 'utf-8');
    });

    // ─── Module structure ───────────────────────────────

    test('uses EspoCRM define() module pattern', () => {
        expect(source).toMatch(/define\s*\(\s*['"]custom:helpers\/api-client['"]/);
    });

    test('has no dependencies (empty array)', () => {
        expect(source).toMatch(/define\s*\(\s*['"]custom:helpers\/api-client['"],\s*\[\s*\]/);
    });

    test('returns a constructor function', () => {
        expect(source).toMatch(/return\s+ApiClient\s*;/);
    });

    // ─── Panel state persistence (Req 2.5) ──────────────

    test('defines sessionStorage key for expanded state', () => {
        expect(source).toMatch(/STORAGE_KEY_EXPANDED\s*=\s*['"]ai-panel-expanded['"]/);
    });

    test('defines sessionStorage key for selected model', () => {
        expect(source).toMatch(/STORAGE_KEY_MODEL\s*=\s*['"]ai-panel-model['"]/);
    });

    test('savePanelState writes to sessionStorage', () => {
        expect(source).toMatch(/savePanelState/);
        expect(source).toMatch(/writeStorage\(STORAGE_KEY_EXPANDED/);
    });

    test('loadPanelState reads from sessionStorage', () => {
        expect(source).toMatch(/loadPanelState/);
        expect(source).toMatch(/readStorage\(STORAGE_KEY_EXPANDED\)/);
    });

    test('saveSelectedModel writes to sessionStorage', () => {
        expect(source).toMatch(/saveSelectedModel/);
        expect(source).toMatch(/writeStorage\(STORAGE_KEY_MODEL/);
    });

    test('loadSelectedModel reads from sessionStorage', () => {
        expect(source).toMatch(/loadSelectedModel/);
        expect(source).toMatch(/readStorage\(STORAGE_KEY_MODEL\)/);
    });

    test('readStorage wraps sessionStorage.getItem with try/catch', () => {
        expect(source).toMatch(/function\s+readStorage/);
        expect(source).toMatch(/sessionStorage\.getItem\(key\)/);
    });

    test('writeStorage wraps sessionStorage.setItem with try/catch', () => {
        expect(source).toMatch(/function\s+writeStorage/);
        expect(source).toMatch(/sessionStorage\.setItem\(key,\s*value\)/);
    });

    // ─── Chat endpoint (Req 6.1) ────────────────────────

    test('defines the chat endpoint constant', () => {
        expect(source).toMatch(/CHAT_ENDPOINT\s*=\s*['"]AiAssistant\/chat['"]/);
    });

    test('sendMessage uses Espo.Ajax.postRequest', () => {
        expect(source).toMatch(/Espo\.Ajax\.postRequest\(CHAT_ENDPOINT/);
    });

    test('sendMessage accepts message, model, sessionId, callback', () => {
        expect(source).toMatch(
            /sendMessage\s*=\s*function\s*\(\s*message\s*,\s*model\s*,\s*sessionId\s*,\s*callback\s*\)/
        );
    });

    test('sendMessage includes model in payload when provided', () => {
        expect(source).toMatch(/payload\.model\s*=\s*model/);
    });

    test('sendMessage includes sessionId in payload when provided', () => {
        expect(source).toMatch(/payload\.sessionId\s*=\s*sessionId/);
    });

    test('sendMessage calls callback with null error on success', () => {
        expect(source).toMatch(/callback\(null,\s*response\)/);
    });

    // ─── File upload endpoint (Req 8.1, 8.2) ───────────

    test('defines the upload endpoint constant', () => {
        expect(source).toMatch(/UPLOAD_ENDPOINT\s*=\s*['"]api\/v1\/AiAssistant\/chat\/upload['"]/);
    });

    test('uploadFile uses XMLHttpRequest for multipart', () => {
        expect(source).toMatch(/new\s+XMLHttpRequest\(\)/);
    });

    test('uploadFile creates FormData with file', () => {
        expect(source).toMatch(/new\s+FormData\(\)/);
        expect(source).toMatch(/formData\.append\(\s*['"]file['"]/);
    });

    test('uploadFile sends POST to upload endpoint', () => {
        expect(source).toMatch(/xhr\.open\(\s*['"]POST['"]\s*,\s*UPLOAD_ENDPOINT/);
    });

    test('uploadFile includes Espo-Authorization header when available', () => {
        expect(source).toMatch(/Espo-Authorization/);
        expect(source).toMatch(/xhr\.setRequestHeader/);
    });

    test('uploadFile accepts file, model, sessionId, callback', () => {
        expect(source).toMatch(
            /uploadFile\s*=\s*function\s*\(\s*file\s*,\s*model\s*,\s*sessionId\s*,\s*callback\s*\)/
        );
    });

    test('uploadFile appends model to FormData when provided', () => {
        expect(source).toMatch(/formData\.append\(\s*['"]model['"]/);
    });

    test('uploadFile appends sessionId to FormData when provided', () => {
        expect(source).toMatch(/formData\.append\(\s*['"]sessionId['"]/);
    });

    // ─── Error handling (Req 10.2, 10.5) ────────────────

    test('maps 429 to rate limit message with wait seconds', () => {
        expect(source).toMatch(/status\s*===\s*429/);
        expect(source).toMatch(/sending messages too quickly/i);
        expect(source).toMatch(/retryAfter/);
    });

    test('maps 401 to session expired message', () => {
        expect(source).toMatch(/status\s*===\s*401/);
        expect(source).toMatch(/session has expired/i);
    });

    test('maps 503 to AI unavailable message', () => {
        expect(source).toMatch(/status\s*===\s*503/);
        expect(source).toMatch(/temporarily unavailable/i);
    });

    test('maps status 0 (network error) to AI unavailable message', () => {
        expect(source).toMatch(/status\s*===\s*0/);
    });

    test('provides generic fallback error message', () => {
        expect(source).toMatch(/Something went wrong\. Please try again\./);
    });

    test('has a dedicated mapErrorMessage function', () => {
        expect(source).toMatch(/function\s+mapErrorMessage\s*\(\s*status/);
    });

    test('xhr onerror handler calls callback with error', () => {
        expect(source).toMatch(/xhr\.onerror\s*=\s*function/);
        expect(source).toMatch(/mapErrorMessage\(0/);
    });

    // ─── Upload response parsing ────────────────────────

    test('parses successful upload response as JSON', () => {
        expect(source).toMatch(/JSON\.parse\(xhr\.responseText\)/);
    });

    test('handles invalid JSON in upload response', () => {
        expect(source).toMatch(/Invalid response from server/);
    });

    // ─── Error mapper exposed for testing ───────────────

    test('exposes mapErrorMessage as a static method', () => {
        expect(source).toMatch(/ApiClient\.mapErrorMessage\s*=\s*mapErrorMessage/);
    });
});
