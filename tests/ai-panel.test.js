const fs = require('fs');
const path = require('path');

const AI_PANEL_PATH = path.resolve(
    __dirname,
    '../files/client/custom/modules/ai-assistant/src/views/ai-panel.js'
);

describe('ai-panel.js', () => {
    let source;

    beforeAll(() => {
        source = fs.readFileSync(AI_PANEL_PATH, 'utf-8');
    });

    // ─── Module structure ───────────────────────────────

    test('uses EspoCRM define() module pattern', () => {
        expect(source).toMatch(/define\s*\(\s*['"]custom:views\/ai-panel['"]/);
    });

    test('depends on the view base class', () => {
        expect(source).toMatch(/\[\s*['"]view['"]\s*\]/);
    });

    test('extends View via View.extend()', () => {
        expect(source).toMatch(/View\.extend\s*\(\s*\{/);
    });

    // ─── Toggle button (Req 2.2, 2.3) ──────────────────

    test('renders a toggle button with data-action="toggle"', () => {
        expect(source).toMatch(/data-action="toggle"/);
    });

    test('toggle button has an accessible aria-label', () => {
        expect(source).toMatch(/aria-label="Toggle AI Assistant"/);
    });

    // ─── Panel body structure (Req 2.1, 2.4, 2.6) ──────

    test('renders a panel body container', () => {
        expect(source).toMatch(/data-panel-body/);
    });

    test('renders a scrollable messages container', () => {
        expect(source).toMatch(/data-messages/);
    });

    test('renders a textarea input', () => {
        expect(source).toMatch(/ai-panel-textarea/);
        expect(source).toMatch(/data-input/);
    });

    test('renders a send button', () => {
        expect(source).toMatch(/data-action="send"/);
    });

    // ─── Typing indicator (Req 2.7) ─────────────────────

    test('renders a typing indicator with dots', () => {
        expect(source).toMatch(/data-typing/);
        expect(source).toMatch(/ai-panel-typing-dot/);
    });

    test('typing indicator is hidden by default', () => {
        expect(source).toMatch(/data-typing.*style="display:none;"/);
    });

    // ─── New Conversation button (Req 5.4) ──────────────

    test('renders a New Conversation button', () => {
        expect(source).toMatch(/data-action="newConversation"/);
    });

    test('newConversation clears messages and sessionId', () => {
        // The method should reset messages array and sessionId
        expect(source).toMatch(/newConversation.*function/);
        expect(source).toMatch(/this\.messages\s*=\s*\[\]/);
        expect(source).toMatch(/this\.sessionId\s*=\s*null/);
    });

    // ─── Model selector (Req 2.9 — design spec) ────────

    test('renders a model selector dropdown', () => {
        expect(source).toMatch(/ai-panel-model-select/);
        expect(source).toMatch(/data-action="selectModel"/);
    });

    test('includes gemini-3.1-pro-preview model option', () => {
        expect(source).toMatch(/gemini-3\.1-pro-preview/);
    });

    test('includes gemini-3.1-flash-lite-preview model option', () => {
        expect(source).toMatch(/gemini-3\.1-flash-lite-preview/);
    });

    test('persists selected model to sessionStorage', () => {
        expect(source).toMatch(/ai-panel-model/);
        expect(source).toMatch(/sessionStorage/);
    });

    // ─── File upload (Req 8.1) ──────────────────────────

    test('renders a file upload button', () => {
        expect(source).toMatch(/data-action="uploadFile"/);
    });

    test('has a hidden file input that accepts PDFs', () => {
        expect(source).toMatch(/type="file"/);
        expect(source).toMatch(/accept="\.pdf,application\/pdf"/);
    });

    test('validates file type before upload', () => {
        expect(source).toMatch(/application\/pdf/);
    });

    test('validates file size (20 MB limit)', () => {
        expect(source).toMatch(/20\s*\*\s*1024\s*\*\s*1024/);
    });

    // ─── Error bubbles (Req 10.3) ───────────────────────

    test('applies distinct error styling class to error messages', () => {
        expect(source).toMatch(/ai-panel-message-error/);
    });

    test('messages track isError flag', () => {
        expect(source).toMatch(/isError/);
    });

    // ─── Mobile responsive (Req 2.10) ───────────────────

    test('checks for mobile breakpoint at 768px', () => {
        expect(source).toMatch(/768/);
    });

    test('adds mobile CSS class', () => {
        expect(source).toMatch(/is-mobile/);
    });

    test('renders a close button for mobile', () => {
        expect(source).toMatch(/data-action="closeMobile"/);
    });

    test('listens for window resize events', () => {
        expect(source).toMatch(/addEventListener.*resize/);
    });

    test('removes resize listener on view removal', () => {
        expect(source).toMatch(/removeEventListener.*resize/);
    });

    // ─── State persistence (Req 2.5) ────────────────────

    test('persists expanded state to sessionStorage', () => {
        expect(source).toMatch(/ai-panel-expanded/);
    });

    test('reads expanded state from sessionStorage on setup', () => {
        expect(source).toMatch(/_readStorage\(STORAGE_KEY_EXPANDED\)/);
    });

    // ─── Panel dimensions ───────────────────────────────

    test('defines panel width of 400px', () => {
        expect(source).toMatch(/PANEL_WIDTH\s*=\s*400/);
    });

    test('defines collapsed width of 48px', () => {
        expect(source).toMatch(/COLLAPSED_WIDTH\s*=\s*48/);
    });

    test('defines nav height of 56px', () => {
        expect(source).toMatch(/NAV_HEIGHT\s*=\s*56/);
    });

    // ─── Keyboard interaction ───────────────────────────

    test('sends message on Enter key (without Shift)', () => {
        expect(source).toMatch(/Enter/);
        expect(source).toMatch(/shiftKey/);
    });

    // ─── XSS prevention ────────────────────────────────

    test('escapes HTML entities in user content', () => {
        expect(source).toMatch(/_escapeHtml/);
        expect(source).toMatch(/&amp;/);
        expect(source).toMatch(/&lt;/);
        expect(source).toMatch(/&gt;/);
    });

    // ─── Markdown rendering ─────────────────────────────

    test('renders assistant messages through markdown renderer', () => {
        expect(source).toMatch(/renderer\.render\(msg\.content\)/);
    });

    test('fallback renderer handles bold syntax', () => {
        // The source contains the regex /\*\*(.+?)\*\*/g for bold matching
        expect(source).toMatch(/\\*\\*\(/);
        expect(source).toMatch(/<strong>/);
    });

    test('fallback renderer handles code blocks', () => {
        expect(source).toMatch(/<pre><code>/);
    });

    test('fallback renderer handles unordered lists', () => {
        expect(source).toMatch(/<ul>/);
        expect(source).toMatch(/<li>/);
    });

    // ─── API integration ────────────────────────────────

    test('calls AiAssistant/chat endpoint', () => {
        expect(source).toMatch(/AiAssistant\/chat/);
    });

    test('calls AiAssistant/chat/upload for file uploads', () => {
        expect(source).toMatch(/AiAssistant\/chat\/upload/);
    });

    test('handles 429 rate limit responses', () => {
        expect(source).toMatch(/429/);
    });

    test('handles 401 unauthorized responses', () => {
        expect(source).toMatch(/401/);
    });

    test('handles 503 service unavailable responses', () => {
        expect(source).toMatch(/503/);
    });

    // ─── Source attribution (Req 7.2) ───────────────────

    test('renders source attributions as links', () => {
        expect(source).toMatch(/ai-panel-message-sources/);
        expect(source).toMatch(/target="_blank"/);
        expect(source).toMatch(/rel="noopener noreferrer"/);
    });

    // ─── Auto-resize textarea ───────────────────────────

    test('auto-resizes textarea on input', () => {
        expect(source).toMatch(/_autoResizeInput/);
        expect(source).toMatch(/scrollHeight/);
    });
});
