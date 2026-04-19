/**
 * AI Assistant Markdown Renderer
 *
 * Lightweight markdown-to-HTML renderer for AI responses.
 * No external library — handles the subset of markdown used by Gemini responses:
 *   - Fenced code blocks (```code```)
 *   - Inline code (`code`)
 *   - Bold (**text**)
 *   - Unordered lists (- item)
 *   - Newlines → <br> (outside code blocks)
 *
 * XSS prevention: all input is HTML-entity-escaped BEFORE markdown
 * transformations are applied. This means user-supplied `<script>` tags
 * become `&lt;script&gt;` and are never interpreted as HTML.
 *
 * Also provides source attribution rendering for search grounding results.
 *
 * Requirements: 2.8, 7.2
 */
define('ai-assistant:helpers/markdown-renderer', [], function () {

    // ─── HTML Escaping (XSS Prevention) ─────────────────

    /**
     * Escape HTML entities to prevent XSS.
     * Must be applied BEFORE any markdown transformation.
     *
     * @param {string} str  Raw text
     * @returns {string}  Escaped text safe for HTML insertion
     */
    function escapeHtml(str) {
        if (!str) {
            return '';
        }

        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // ─── Constructor ────────────────────────────────────

    /**
     * @constructor
     */
    var MarkdownRenderer = function () {};

    // ─── Markdown Rendering ─────────────────────────────

    /**
     * Convert a markdown string to HTML.
     *
     * Processing order matters:
     *   1. Escape all HTML entities (XSS prevention)
     *   2. Fenced code blocks (``` ... ```) — must be first to protect
     *      code content from further transformations
     *   3. Inline code (` ... `)
     *   4. Bold (** ... **)
     *   5. Unordered lists (- item lines)
     *   6. Remaining newlines → <br>
     *
     * @param {string} text  Markdown-formatted text
     * @returns {string}  HTML string
     */
    MarkdownRenderer.prototype.render = function (text) {
        if (!text) {
            return '';
        }

        // Step 1: Escape HTML entities to prevent XSS
        var html = escapeHtml(text);

        // Step 2: Fenced code blocks — extract them first so their
        // content is not affected by later transformations.
        // We use a placeholder approach to protect code block content.
        var codeBlocks = [];

        html = html.replace(/```([\s\S]*?)```/g, function (match, code) {
            var index = codeBlocks.length;
            codeBlocks.push('<pre><code>' + code + '</code></pre>');

            return '%%CODEBLOCK_' + index + '%%';
        });

        // Step 3: Inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Step 4: Bold
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Step 5: Unordered lists — consecutive lines starting with "- "
        html = html.replace(
            /(?:^|\n)((?:- .+(?:\n|$))+)/g,
            function (match, listBlock) {
                var items = listBlock.trim().split('\n');
                var lis = '';

                for (var i = 0; i < items.length; i++) {
                    var item = items[i].replace(/^- /, '');
                    lis += '<li>' + item + '</li>';
                }

                return '<ul>' + lis + '</ul>';
            }
        );

        // Step 6: Remaining newlines → <br>
        html = html.replace(/\n/g, '<br>');

        // Step 7: Restore code blocks (no <br> conversion inside them)
        for (var i = 0; i < codeBlocks.length; i++) {
            html = html.replace('%%CODEBLOCK_' + i + '%%', codeBlocks[i]);
        }

        return html;
    };

    // ─── Source Attribution Rendering ────────────────────

    /**
     * Render search grounding sources as clickable links.
     *
     * Each source is rendered as an anchor tag with:
     *   - href pointing to the source URL
     *   - target="_blank" for new tab
     *   - rel="noopener noreferrer" for security
     *   - title text as the link label
     *
     * Both title and URL are HTML-escaped to prevent XSS.
     *
     * @param {Array<{title: string, url: string}>} sources
     * @returns {string}  HTML string with anchor tags
     */
    MarkdownRenderer.prototype.renderSources = function (sources) {
        if (!sources || !sources.length) {
            return '';
        }

        var html = '<div class="ai-sources">';

        for (var i = 0; i < sources.length; i++) {
            var source = sources[i];
            var title = escapeHtml(source.title || '');
            var url = escapeHtml(source.url || '');

            html += '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' +
                title + '</a>';

            if (i < sources.length - 1) {
                html += ', ';
            }
        }

        html += '</div>';

        return html;
    };

    // ─── Expose escapeHtml for testing ──────────────────

    MarkdownRenderer.escapeHtml = escapeHtml;

    return MarkdownRenderer;
});
