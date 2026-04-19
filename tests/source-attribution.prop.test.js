/**
 * Property Test: Source Attribution Rendering (Property 10)
 *
 * Validates: Requirements 7.2
 *
 * For any AI response that includes search grounding sources (with title
 * and URL), the rendered HTML should contain anchor (<a>) tags where each
 * anchor's href matches a source URL and the anchor text contains the
 * source title. All anchors must have target="_blank" and
 * rel="noopener noreferrer" for security.
 */

const fc = require('fast-check');

// ── Load the module under test using AMD shim ───────────────────────

let MarkdownRenderer;
let renderer;

beforeAll(function () {
    let factory;

    global.define = function (_name, _deps, fn) {
        factory = fn;
    };

    require('../files/client/custom/modules/ai-assistant/src/helpers/markdown-renderer.js');

    MarkdownRenderer = factory();
    renderer = new MarkdownRenderer();
});

afterAll(function () {
    delete global.define;
});

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Replicate the renderer's own escapeHtml so we can predict expected output.
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ── Generators ──────────────────────────────────────────────────────

/**
 * Generate a safe title string (non-empty, no control chars).
 * Allows HTML-sensitive chars like <, >, &, " to stress-test escaping.
 */
function titleArb() {
    return fc.string({ minLength: 1, maxLength: 60 }).filter(function (s) {
        return s.trim().length > 0;
    });
}

/**
 * Generate a plausible URL string.
 * Includes chars that need HTML-escaping (&, quotes) to stress-test href encoding.
 */
function urlArb() {
    var pathChars = [
        'a', 'b', 'c', 'd', 'e', 'f', '0', '1', '2', '/',
        '-', '_', '.', '?', '=', '&', '%'
    ];

    var pathArb = fc.array(
        fc.constantFrom.apply(fc, pathChars),
        { minLength: 1, maxLength: 40 }
    ).map(function (chars) {
        return chars.join('');
    });

    return fc.tuple(
        fc.constantFrom('https://example.com', 'https://docs.google.com', 'https://en.wikipedia.org'),
        pathArb
    ).map(function (pair) {
        return pair[0] + '/' + pair[1];
    });
}

/**
 * Generate a single source object with title and url.
 */
function sourceArb() {
    return fc.record({
        title: titleArb(),
        url: urlArb()
    });
}

/**
 * Generate an array of 1-10 source objects.
 */
function sourcesArb() {
    return fc.array(sourceArb(), { minLength: 1, maxLength: 10 });
}

// ── Property Tests ──────────────────────────────────────────────────

describe('Property 10: Source Attribution Rendering', function () {

    /**
     * **Validates: Requirements 7.2**
     *
     * For any array of sources, the rendered HTML must contain an <a> tag
     * for each source.
     */
    it('output contains an <a> tag for each source in the array', function () {
        fc.assert(
            fc.property(sourcesArb(), function (sources) {
                var html = renderer.renderSources(sources);

                // Count <a> opening tags — must be at least sources.length
                var matches = html.match(/<a /g);
                expect(matches).not.toBeNull();
                expect(matches.length).toBe(sources.length);
            }),
            { numRuns: 100 }
        );
    });

    /**
     * **Validates: Requirements 7.2**
     *
     * For each source, the <a> tag's href attribute must match the
     * HTML-escaped source URL.
     */
    it('each <a> tag href matches the HTML-escaped source URL', function () {
        fc.assert(
            fc.property(sourcesArb(), function (sources) {
                var html = renderer.renderSources(sources);

                sources.forEach(function (source) {
                    var escapedUrl = escapeHtml(source.url);
                    var expectedHref = 'href="' + escapedUrl + '"';

                    expect(html).toContain(expectedHref);
                });
            }),
            { numRuns: 100 }
        );
    });

    /**
     * **Validates: Requirements 7.2**
     *
     * For each source, the <a> tag's text content must contain the
     * HTML-escaped source title.
     */
    it('each <a> tag text contains the HTML-escaped source title', function () {
        fc.assert(
            fc.property(sourcesArb(), function (sources) {
                var html = renderer.renderSources(sources);

                sources.forEach(function (source) {
                    var escapedTitle = escapeHtml(source.title);
                    // The title appears between > and </a>
                    expect(html).toContain('>' + escapedTitle + '</a>');
                });
            }),
            { numRuns: 100 }
        );
    });

    /**
     * **Validates: Requirements 7.2**
     *
     * Every <a> tag must have target="_blank" for opening in a new tab.
     */
    it('all <a> tags have target="_blank"', function () {
        fc.assert(
            fc.property(sourcesArb(), function (sources) {
                var html = renderer.renderSources(sources);

                // Every <a> tag must contain target="_blank"
                var anchorPattern = /<a [^>]*>/g;
                var anchor;

                while ((anchor = anchorPattern.exec(html)) !== null) {
                    expect(anchor[0]).toContain('target="_blank"');
                }
            }),
            { numRuns: 100 }
        );
    });

    /**
     * **Validates: Requirements 7.2**
     *
     * Every <a> tag must have rel="noopener noreferrer" for security.
     */
    it('all <a> tags have rel="noopener noreferrer"', function () {
        fc.assert(
            fc.property(sourcesArb(), function (sources) {
                var html = renderer.renderSources(sources);

                var anchorPattern = /<a [^>]*>/g;
                var anchor;

                while ((anchor = anchorPattern.exec(html)) !== null) {
                    expect(anchor[0]).toContain('rel="noopener noreferrer"');
                }
            }),
            { numRuns: 100 }
        );
    });

    /**
     * **Validates: Requirements 7.2**
     *
     * Combined structural check: each source produces a complete, correct
     * anchor tag with all required attributes and escaped content.
     */
    it('each source produces a structurally complete anchor tag', function () {
        fc.assert(
            fc.property(sourcesArb(), function (sources) {
                var html = renderer.renderSources(sources);

                sources.forEach(function (source) {
                    var escapedUrl = escapeHtml(source.url);
                    var escapedTitle = escapeHtml(source.title);

                    // Full expected anchor structure
                    var expectedAnchor =
                        '<a href="' + escapedUrl + '" ' +
                        'target="_blank" ' +
                        'rel="noopener noreferrer">' +
                        escapedTitle + '</a>';

                    expect(html).toContain(expectedAnchor);
                });
            }),
            { numRuns: 100 }
        );
    });
});
