/**
 * @jest-environment jsdom
 */
'use strict';

const { renderBriefCard, showBriefLoading, hideBriefLoading } = require('./brief-card/brief-card');

/**
 * Brief Card DOM Tests
 * Validates: Requirements 3.2, 3.3
 */
describe('Brief Card', () => {
    let el;

    function createPanel() {
        const panel = document.createElement('div');
        panel.innerHTML = `
            <div data-messages></div>
            <textarea data-input></textarea>
        `;
        document.body.appendChild(panel);
        return panel;
    }

    function sampleBrief(count) {
        const recommendations = [];
        for (let i = 0; i < (count || 3); i++) {
            recommendations.push({
                description: 'Follow up with Contact ' + (i + 1),
                reason: 'No activity in ' + (10 + i) + ' days',
                suggestedCommand: 'draft email to contact' + (i + 1),
            });
        }
        return { recommendations, isAiGenerated: true, generatedAt: new Date().toISOString() };
    }

    beforeEach(() => {
        document.body.innerHTML = '';
        el = createPanel();
    });

    // ─── DOM Structure ──────────────────────────────────

    describe('DOM structure', () => {
        test('renderBriefCard creates .ai-brief-card container', () => {
            renderBriefCard(el, sampleBrief());
            const card = el.querySelector('.ai-brief-card');
            expect(card).not.toBeNull();
        });

        test('card contains .ai-brief-header', () => {
            renderBriefCard(el, sampleBrief());
            const header = el.querySelector('.ai-brief-header');
            expect(header).not.toBeNull();
        });

        test('card contains .ai-brief-body', () => {
            renderBriefCard(el, sampleBrief());
            const body = el.querySelector('.ai-brief-body');
            expect(body).not.toBeNull();
        });

        test('card contains .ai-brief-action for each recommendation', () => {
            renderBriefCard(el, sampleBrief(3));
            const actions = el.querySelectorAll('.ai-brief-action');
            expect(actions.length).toBe(3);
        });

        test('each action has .ai-brief-desc, .ai-brief-reason, .ai-brief-cmd', () => {
            renderBriefCard(el, sampleBrief(1));
            const action = el.querySelector('.ai-brief-action');
            expect(action.querySelector('.ai-brief-desc')).not.toBeNull();
            expect(action.querySelector('.ai-brief-reason')).not.toBeNull();
            expect(action.querySelector('.ai-brief-cmd')).not.toBeNull();
        });

        test('command chip has correct data-cmd attribute', () => {
            renderBriefCard(el, sampleBrief(1));
            const cmd = el.querySelector('.ai-brief-cmd');
            expect(cmd.getAttribute('data-cmd')).toBe('draft email to contact1');
        });

        test('card is inserted at the top of messages (before existing content)', () => {
            const container = el.querySelector('[data-messages]');
            const existingMsg = document.createElement('div');
            existingMsg.className = 'existing-message';
            existingMsg.textContent = 'Hello';
            container.appendChild(existingMsg);

            renderBriefCard(el, sampleBrief());

            expect(container.firstChild.classList.contains('ai-brief-card')).toBe(true);
            expect(container.lastChild.classList.contains('existing-message')).toBe(true);
        });

        test('duplicate brief cards are prevented (existing card removed before new one)', () => {
            renderBriefCard(el, sampleBrief(2));
            renderBriefCard(el, sampleBrief(3));

            const cards = el.querySelectorAll('.ai-brief-card');
            expect(cards.length).toBe(1);
            // Should have the latest recommendations (3 actions)
            const actions = el.querySelectorAll('.ai-brief-action');
            expect(actions.length).toBe(3);
        });

        test('does not render card when recommendations array is empty', () => {
            renderBriefCard(el, { recommendations: [] });
            const card = el.querySelector('.ai-brief-card');
            expect(card).toBeNull();
        });
    });

    // ─── Collapsible Behavior ───────────────────────────

    describe('collapsible behavior', () => {
        test('card starts expanded (data-collapsed="false")', () => {
            renderBriefCard(el, sampleBrief());
            const card = el.querySelector('.ai-brief-card');
            expect(card.getAttribute('data-collapsed')).toBe('false');
        });

        test('header click collapses the card (data-collapsed="true")', () => {
            renderBriefCard(el, sampleBrief());
            const header = el.querySelector('.ai-brief-header');
            header.click();

            const card = el.querySelector('.ai-brief-card');
            expect(card.getAttribute('data-collapsed')).toBe('true');
        });

        test('when collapsed, body is hidden (display: none)', () => {
            renderBriefCard(el, sampleBrief());
            const header = el.querySelector('.ai-brief-header');
            header.click();

            const body = el.querySelector('.ai-brief-body');
            expect(body.style.display).toBe('none');
        });

        test('when expanded again, body is visible', () => {
            renderBriefCard(el, sampleBrief());
            const header = el.querySelector('.ai-brief-header');
            // Collapse
            header.click();
            // Expand
            header.click();

            const card = el.querySelector('.ai-brief-card');
            const body = el.querySelector('.ai-brief-body');
            expect(card.getAttribute('data-collapsed')).toBe('false');
            expect(body.style.display).toBe('');
        });

        test('toggle icon changes on collapse/expand', () => {
            renderBriefCard(el, sampleBrief());
            const header = el.querySelector('.ai-brief-header');
            const toggle = el.querySelector('.ai-brief-toggle');

            expect(toggle.textContent).toBe('\u25BC'); // ▼ when expanded
            header.click();
            expect(toggle.textContent).toBe('\u25B6'); // ▶ when collapsed
            header.click();
            expect(toggle.textContent).toBe('\u25BC'); // ▼ when expanded again
        });
    });

    // ─── Command Chip Click ─────────────────────────────

    describe('command chip click', () => {
        test('clicking command chip sets input value to the command text', () => {
            renderBriefCard(el, sampleBrief(1));
            const cmd = el.querySelector('.ai-brief-cmd');
            cmd.click();

            const input = el.querySelector('[data-input]');
            expect(input.value).toBe('draft email to contact1');
        });

        test('clicking different chips sets corresponding command text', () => {
            renderBriefCard(el, sampleBrief(3));
            const cmds = el.querySelectorAll('.ai-brief-cmd');

            cmds[2].click();
            const input = el.querySelector('[data-input]');
            expect(input.value).toBe('draft email to contact3');
        });
    });

    // ─── Loading Indicator ──────────────────────────────

    describe('loading indicator', () => {
        test('showBriefLoading inserts loading element at top of messages', () => {
            showBriefLoading(el);
            const loader = el.querySelector('.ai-brief-loading');
            expect(loader).not.toBeNull();
            expect(loader.textContent).toContain('Loading daily brief');
        });

        test('hideBriefLoading removes the loading element', () => {
            showBriefLoading(el);
            hideBriefLoading(el);
            const loader = el.querySelector('.ai-brief-loading');
            expect(loader).toBeNull();
        });

        test('showBriefLoading replaces existing loading indicator (no duplicates)', () => {
            showBriefLoading(el);
            showBriefLoading(el);
            const loaders = el.querySelectorAll('.ai-brief-loading');
            expect(loaders.length).toBe(1);
        });

        test('renderBriefCard removes loading indicator when rendering', () => {
            showBriefLoading(el);
            renderBriefCard(el, sampleBrief());
            const loader = el.querySelector('.ai-brief-loading');
            expect(loader).toBeNull();
        });
    });
});
