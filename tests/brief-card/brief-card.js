/**
 * Brief Card — Extracted rendering logic for testing.
 *
 * These functions mirror the brief card logic in ai-panel-init.js,
 * extracted as pure functions that operate on a given DOM element.
 */
'use strict';

/**
 * Escape HTML entities to prevent XSS.
 */
function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Show a loading indicator in the brief card area while fetching.
 */
function showBriefLoading(el) {
    var container = el.querySelector('[data-messages]');
    if (!container) return;
    // Remove any existing loading indicator
    var existing = container.querySelector('.ai-brief-loading');
    if (existing) existing.remove();

    var loader = document.createElement('div');
    loader.className = 'ai-brief-loading';
    loader.innerHTML = '<span class="ai-brief-loading-spinner"></span> Loading daily brief...';
    container.insertBefore(loader, container.firstChild);
}

/**
 * Remove the brief loading indicator.
 */
function hideBriefLoading(el) {
    var container = el.querySelector('[data-messages]');
    if (!container) return;
    var loader = container.querySelector('.ai-brief-loading');
    if (loader) loader.remove();
}

/**
 * Render the daily brief card in the messages area.
 * Displays a collapsible card with action recommendations and clickable command chips.
 */
function renderBriefCard(el, brief) {
    var container = el.querySelector('[data-messages]');
    if (!container) return;

    // Remove loading indicator if still present
    hideBriefLoading(el);

    // Remove existing brief card to prevent duplicates
    var existing = container.querySelector('.ai-brief-card');
    if (existing) existing.remove();

    // Build recommendations HTML
    var recommendations = brief.recommendations || [];
    if (!recommendations.length) return;

    var actionsHtml = '';
    for (var i = 0; i < recommendations.length; i++) {
        var rec = recommendations[i];
        actionsHtml += '<div class="ai-brief-action">';
        actionsHtml += '<p class="ai-brief-desc">' + escapeHtml(rec.description) + '</p>';
        actionsHtml += '<p class="ai-brief-reason">' + escapeHtml(rec.reason) + '</p>';
        if (rec.suggestedCommand) {
            actionsHtml += '<button class="ai-brief-cmd" data-cmd="' + escapeHtml(rec.suggestedCommand) + '">';
            actionsHtml += '\uD83D\uDCAC ' + escapeHtml(rec.suggestedCommand);
            actionsHtml += '</button>';
        }
        actionsHtml += '</div>';
    }

    var cardHtml = '<div class="ai-brief-card" data-collapsed="false">' +
        '<div class="ai-brief-header">' +
            '<span class="ai-brief-title">\uD83D\uDCCB Daily Brief</span>' +
            '<span class="ai-brief-toggle">\u25BC</span>' +
        '</div>' +
        '<div class="ai-brief-body">' +
            actionsHtml +
        '</div>' +
    '</div>';

    // Insert at the top of messages area without clearing existing messages
    var tempDiv = document.createElement('div');
    tempDiv.innerHTML = cardHtml;
    var card = tempDiv.firstChild;
    container.insertBefore(card, container.firstChild);

    // Bind collapse/expand toggle on header click
    var header = card.querySelector('.ai-brief-header');
    header.addEventListener('click', function () {
        var isCollapsed = card.getAttribute('data-collapsed') === 'true';
        var body = card.querySelector('.ai-brief-body');
        var toggleIcon = card.querySelector('.ai-brief-toggle');

        if (isCollapsed) {
            card.setAttribute('data-collapsed', 'false');
            body.style.display = '';
            toggleIcon.textContent = '\u25BC';
        } else {
            card.setAttribute('data-collapsed', 'true');
            body.style.display = 'none';
            toggleIcon.textContent = '\u25B6';
        }
    });

    // Bind command chip clicks — pre-fill chat input without submitting
    var cmdButtons = card.querySelectorAll('.ai-brief-cmd');
    for (var j = 0; j < cmdButtons.length; j++) {
        cmdButtons[j].addEventListener('click', function () {
            var cmd = this.getAttribute('data-cmd');
            if (!cmd) return;
            var input = el.querySelector('[data-input]');
            if (input) {
                input.value = cmd;
                input.focus();
            }
        });
    }
}

module.exports = {
    escapeHtml,
    showBriefLoading,
    hideBriefLoading,
    renderBriefCard,
};
