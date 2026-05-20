const fs = require('fs');
const path = require('path');

const AI_PANEL_INIT_PATH = path.resolve(
    __dirname,
    '../files/client/custom/modules/ai-assistant/src/ai-panel-init.js'
);

describe('ai-panel-init.js — brief caching logic', () => {
    let source;

    beforeAll(() => {
        source = fs.readFileSync(AI_PANEL_INIT_PATH, 'utf-8');
    });

    // ─── Cache variable and TTL constant ────────────────

    test('declares _aiBriefCache variable', () => {
        expect(source).toMatch(/var _aiBriefCache\s*=\s*null/);
    });

    test('defines BRIEF_TTL_MS as 1 hour (3600000 ms)', () => {
        expect(source).toMatch(/var BRIEF_TTL_MS\s*=\s*3600000/);
    });

    // ─── getCachedBrief function ────────────────────────

    test('defines getCachedBrief function', () => {
        expect(source).toMatch(/function getCachedBrief\s*\(\)/);
    });

    test('getCachedBrief returns null when cache is empty', () => {
        expect(source).toMatch(/if\s*\(\s*!_aiBriefCache\s*\)\s*return\s*null/);
    });

    test('getCachedBrief checks TTL expiry using Date.now()', () => {
        expect(source).toMatch(/Date\.now\(\)\s*-\s*_aiBriefCache\.cachedAt\s*>=\s*BRIEF_TTL_MS/);
    });

    test('getCachedBrief invalidates expired cache', () => {
        // After TTL check fails, it should set cache to null
        expect(source).toMatch(/_aiBriefCache\s*=\s*null;\s*\n\s*return\s*null/);
    });

    test('getCachedBrief returns brief from valid cache', () => {
        expect(source).toMatch(/return\s*_aiBriefCache\.brief/);
    });

    // ─── fetchBrief function ────────────────────────────

    test('defines fetchBrief function', () => {
        expect(source).toMatch(/function fetchBrief\s*\(\)/);
    });

    test('fetchBrief checks cache first via getCachedBrief()', () => {
        expect(source).toMatch(/var cached\s*=\s*getCachedBrief\(\)/);
    });

    test('fetchBrief returns cached brief immediately via Promise.resolve', () => {
        expect(source).toMatch(/if\s*\(cached\)\s*return\s*Promise\.resolve\(cached\)/);
    });

    test('fetchBrief calls POST /api/v1/AiAssistant/brief', () => {
        expect(source).toMatch(/\/api\/v1\/AiAssistant\/brief/);
    });

    test('fetchBrief uses POST method', () => {
        expect(source).toMatch(/method:\s*['"]POST['"]/);
    });

    test('fetchBrief uses AbortController for timeout', () => {
        expect(source).toMatch(/new AbortController\(\)/);
    });

    test('fetchBrief sets 10-second timeout', () => {
        expect(source).toMatch(/setTimeout\(function\s*\(\)\s*\{\s*controller\.abort\(\);\s*\},\s*10000\)/);
    });

    test('fetchBrief includes credentials for session auth', () => {
        expect(source).toMatch(/credentials:\s*['"]include['"]/);
    });

    test('fetchBrief stores response in _aiBriefCache with cachedAt timestamp', () => {
        expect(source).toMatch(/_aiBriefCache\s*=\s*\{\s*brief:\s*brief,\s*cachedAt:\s*Date\.now\(\)\s*\}/);
    });

    test('fetchBrief returns null on non-ok response', () => {
        expect(source).toMatch(/if\s*\(\s*!response\.ok\s*\)\s*return\s*null/);
    });

    test('fetchBrief catches errors and returns null (non-blocking)', () => {
        expect(source).toMatch(/\.catch\(function\s*\(\)\s*\{[\s\S]*?return\s*null/);
    });

    test('fetchBrief clears timeout on successful response', () => {
        expect(source).toMatch(/clearTimeout\(timeoutId\)/);
    });

    // ─── Integration with panel open ────────────────────

    test('calls fetchBrief() in applyState when panel is expanded', () => {
        // The applyState function should contain fetchBrief().then() in the expanded block
        const applyStateBlock = source.match(/function applyState\(el\)\s*\{[\s\S]*?\n    \}/);
        expect(applyStateBlock).not.toBeNull();
        expect(applyStateBlock[0]).toMatch(/fetchBrief\(\)\.then/);
    });

    test('brief fetch is non-blocking (chat input remains enabled)', () => {
        // The fetchBrief call uses .then() — it's async and doesn't block
        // The input focus happens BEFORE the fetchBrief call
        const applyStateBlock = source.match(/function applyState\(el\)\s*\{[\s\S]*?\n    \}/);
        expect(applyStateBlock).not.toBeNull();
        const focusIdx = applyStateBlock[0].indexOf('focus()');
        const fetchIdx = applyStateBlock[0].indexOf('fetchBrief()');
        expect(focusIdx).toBeGreaterThan(-1);
        expect(fetchIdx).toBeGreaterThan(-1);
        expect(focusIdx).toBeLessThan(fetchIdx);
    });

    test('renderBriefCard is only called when brief is truthy', () => {
        expect(source).toMatch(/if\s*\(brief\)\s*\{\s*\n\s*renderBriefCard\(el,\s*brief\)/);
    });

    // ─── renderBriefCard placeholder ────────────────────

    test('defines renderBriefCard function (placeholder for task 11.2)', () => {
        expect(source).toMatch(/function renderBriefCard\s*\(el,\s*brief\)/);
    });
});
