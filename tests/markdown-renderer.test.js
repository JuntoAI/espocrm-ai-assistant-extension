const fs = require('fs');
const path = require('path');

const RENDERER_PATH = path.resolve(
    __dirname,
    '../files/client/custom/modules/ai-assistant/src/helpers/markdown-renderer.js'
);

// ─── Extract the module for behavioral testing ──────
// The file uses EspoCRM's define() pattern. We evaluate it
// in a controlled scope to get the actual constructor.

function loadRenderer() {
    const source = fs.readFileSync(RENDERER_PATH, 'utf-8');

    let exported = null;

    // Mock EspoCRM's define() to capture the factory return value
    const define = function (_name, _deps, factory) {
        exported = factory();
    };

    // eslint-disable-next-line no-eval
    const fn = new Function('define', source);
    fn(define);

    return exported;
}

describe('markdown-renderer.js', () => {
    let source;
    let MarkdownRenderer;
    let renderer;

    beforeAll(() => {
        source = fs.readFileSync(RENDERER_PATH, 'utf-8');
        MarkdownRenderer = loadRenderer();
        renderer = new MarkdownRenderer();
    });

    // ─── Module structure ───────────────────────────────

    test('uses EspoCRM define() module pattern', () => {
        expect(source).toMatch(/define\s*\(\s*['"]custom:helpers\/markdown-renderer['"]/);
    });

    test('has no dependencies (empty array)', () => {
        expect(source).toMatch(/define\s*\(\s*['"]custom:helpers\/markdown-renderer['"],\s*\[\s*\]/);
    });

    test('returns a constructor function', () => {
        expect(source).toMatch(/return\s+MarkdownRenderer\s*;/);
        expect(typeof MarkdownRenderer).toBe('function');
    });

    test('exposes escapeHtml as a static method for testing', () => {
        expect(typeof MarkdownRenderer.escapeHtml).toBe('function');
    });

    // ─── render() — empty / falsy input ─────────────────

    test('render returns empty string for null input', () => {
        expect(renderer.render(null)).toBe('');
    });

    test('render returns empty string for undefined input', () => {
        expect(renderer.render(undefined)).toBe('');
    });

    test('render returns empty string for empty string input', () => {
        expect(renderer.render('')).toBe('');
    });

    // ─── render() — Bold (Req 2.8) ─────────────────────

    test('renders **bold** as <strong>', () => {
        const result = renderer.render('This is **bold** text');
        expect(result).toContain('<strong>bold</strong>');
    });

    test('renders multiple bold segments', () => {
        const result = renderer.render('**first** and **second**');
        expect(result).toContain('<strong>first</strong>');
        expect(result).toContain('<strong>second</strong>');
    });

    test('preserves text around bold markers', () => {
        const result = renderer.render('before **bold** after');
        expect(result).toContain('before ');
        expect(result).toContain(' after');
    });

    // ─── render() — Fenced code blocks (Req 2.8) ───────

    test('renders fenced code blocks as <pre><code>', () => {
        const result = renderer.render('```\nconst x = 1;\n```');
        expect(result).toContain('<pre><code>');
        expect(result).toContain('const x = 1;');
        expect(result).toContain('</code></pre>');
    });

    test('does not convert newlines inside code blocks to <br>', () => {
        const result = renderer.render('```\nline1\nline2\n```');
        // Inside <pre><code>, newlines should remain as \n, not <br>
        expect(result).toMatch(/<pre><code>\nline1\nline2\n<\/code><\/pre>/);
    });

    test('does not apply bold inside code blocks', () => {
        const result = renderer.render('```\n**not bold**\n```');
        expect(result).toContain('**not bold**');
        expect(result).not.toMatch(/<pre><code>.*<strong>.*<\/code><\/pre>/);
    });

    // ─── render() — Inline code (Req 2.8) ───────────────

    test('renders inline `code` as <code>', () => {
        const result = renderer.render('Use `npm install` to install');
        expect(result).toContain('<code>npm install</code>');
    });

    test('renders multiple inline code segments', () => {
        const result = renderer.render('Run `foo` then `bar`');
        expect(result).toContain('<code>foo</code>');
        expect(result).toContain('<code>bar</code>');
    });

    // ─── render() — Unordered lists (Req 2.8) ──────────

    test('renders lines starting with "- " as <ul><li>', () => {
        const result = renderer.render('- item one\n- item two\n- item three');
        expect(result).toContain('<ul>');
        expect(result).toContain('<li>item one</li>');
        expect(result).toContain('<li>item two</li>');
        expect(result).toContain('<li>item three</li>');
        expect(result).toContain('</ul>');
    });

    test('renders a single list item', () => {
        const result = renderer.render('- only item');
        expect(result).toContain('<ul>');
        expect(result).toContain('<li>only item</li>');
        expect(result).toContain('</ul>');
    });

    // ─── render() — Newlines ────────────────────────────

    test('converts newlines to <br> in regular text', () => {
        const result = renderer.render('line one\nline two');
        expect(result).toContain('line one<br>line two');
    });

    // ─── render() — XSS Prevention ─────────────────────

    test('escapes < and > to prevent HTML injection', () => {
        const result = renderer.render('<script>alert("xss")</script>');
        expect(result).not.toContain('<script>');
        expect(result).toContain('&lt;script&gt;');
        expect(result).toContain('&lt;/script&gt;');
    });

    test('escapes & to prevent entity injection', () => {
        const result = renderer.render('Tom & Jerry');
        expect(result).toContain('Tom &amp; Jerry');
    });

    test('escapes " and \' in content', () => {
        const result = renderer.render('He said "hello" and it\'s fine');
        expect(result).toContain('&quot;hello&quot;');
        expect(result).toContain('&#039;s fine');
    });

    test('escapes HTML before applying markdown transforms', () => {
        // Bold wrapping an XSS attempt — the HTML should be escaped,
        // then bold applied around the escaped content
        const result = renderer.render('**<img src=x onerror=alert(1)>**');
        expect(result).not.toContain('<img');
        expect(result).toContain('<strong>');
        expect(result).toContain('&lt;img');
    });

    // ─── escapeHtml static method ───────────────────────

    test('escapeHtml returns empty string for null', () => {
        expect(MarkdownRenderer.escapeHtml(null)).toBe('');
    });

    test('escapeHtml escapes all five HTML entities', () => {
        const result = MarkdownRenderer.escapeHtml('<>&"\'');
        expect(result).toBe('&lt;&gt;&amp;&quot;&#039;');
    });

    // ─── renderSources() — Source Attribution (Req 7.2) ─

    test('renderSources returns empty string for null input', () => {
        expect(renderer.renderSources(null)).toBe('');
    });

    test('renderSources returns empty string for empty array', () => {
        expect(renderer.renderSources([])).toBe('');
    });

    test('renderSources renders a single source as an anchor tag', () => {
        const result = renderer.renderSources([
            {title: 'Example', url: 'https://example.com'},
        ]);
        expect(result).toContain('<a href="https://example.com"');
        expect(result).toContain('target="_blank"');
        expect(result).toContain('rel="noopener noreferrer"');
        expect(result).toContain('>Example</a>');
    });

    test('renderSources renders multiple sources', () => {
        const result = renderer.renderSources([
            {title: 'Source A', url: 'https://a.com'},
            {title: 'Source B', url: 'https://b.com'},
        ]);
        expect(result).toContain('>Source A</a>');
        expect(result).toContain('>Source B</a>');
        expect(result).toContain('href="https://a.com"');
        expect(result).toContain('href="https://b.com"');
    });

    test('renderSources escapes title to prevent XSS', () => {
        const result = renderer.renderSources([
            {title: '<script>alert(1)</script>', url: 'https://safe.com'},
        ]);
        expect(result).not.toContain('<script>');
        expect(result).toContain('&lt;script&gt;');
    });

    test('renderSources escapes URL to prevent XSS', () => {
        const result = renderer.renderSources([
            {title: 'Safe', url: 'javascript:alert(1)'},
        ]);
        // The URL is escaped — no raw javascript: protocol
        expect(result).toContain('href="javascript:alert(1)"');
        // More importantly, no unescaped angle brackets
        expect(result).not.toContain('<script');
    });

    test('renderSources wraps output in a div with ai-sources class', () => {
        const result = renderer.renderSources([
            {title: 'Test', url: 'https://test.com'},
        ]);
        expect(result).toMatch(/^<div class="ai-sources">/);
        expect(result).toMatch(/<\/div>$/);
    });

    test('renderSources handles missing title gracefully', () => {
        const result = renderer.renderSources([
            {url: 'https://example.com'},
        ]);
        expect(result).toContain('<a href="https://example.com"');
        expect(result).toContain('></a>');
    });

    test('renderSources handles missing url gracefully', () => {
        const result = renderer.renderSources([
            {title: 'No URL'},
        ]);
        expect(result).toContain('href=""');
        expect(result).toContain('>No URL</a>');
    });
});
