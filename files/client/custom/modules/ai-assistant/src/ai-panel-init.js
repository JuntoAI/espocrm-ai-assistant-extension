/**
 * AI Assistant — Bootstrap script
 *
 * Injects the AI chat panel directly into the DOM using vanilla JS.
 * Does NOT depend on EspoCRM's View system or AMD loader for rendering.
 * The panel is self-contained HTML/CSS/JS.
 */
(function () {
    'use strict';

    var PANEL_ID = 'ai-assistant-panel';
    var STORAGE_EXPANDED = 'ai-panel-expanded';
    var STORAGE_MODEL = 'ai-panel-model';
    var STORAGE_WIDTH = 'ai-panel-width';
    var STORAGE_WIDE = 'ai-panel-wide';
    var DEFAULT_MODEL = 'gemini-3.5-flash';
    var MIN_PANEL_WIDTH = 350;
    var MAX_PANEL_WIDTH_RATIO = 0.7; // 70% of viewport
    var WIDE_PANEL_WIDTH_RATIO = 0.5; // 50% of viewport for expand toggle

    // Model display labels (model ID → friendly name)
    var MODEL_LABELS = {
        'gemini-3.5-flash': 'Gemini 3.5 Flash',
        'gemini-3.1-pro-preview': 'Gemini 3.1 Pro',
        'gemini-3.1-flash-lite-preview': 'Gemini 3.1 Flash-Lite',
        'gemini-3-flash-preview': 'Gemini 3 Flash',
    };

    // ── Brief caching ───────────────────────────────────
    var _aiBriefCache = null; // { brief: {...}, cachedAt: Date.now() }
    var BRIEF_TTL_MS = 3600000; // 1 hour

    /**
     * Return cached brief if valid (within TTL), otherwise null.
     */
    function getCachedBrief() {
        if (!_aiBriefCache) return null;
        if (Date.now() - _aiBriefCache.cachedAt >= BRIEF_TTL_MS) {
            _aiBriefCache = null;
            return null;
        }
        return _aiBriefCache.brief;
    }

    /**
     * Fetch the daily brief from the backend with a 10-second timeout.
     * Returns the brief object on success, or null on error/timeout.
     * Non-blocking — does not throw.
     */
    function fetchBrief() {
        var cached = getCachedBrief();
        if (cached) return Promise.resolve(cached);

        var url = window.location.origin + '/api/v1/AiAssistant/brief';
        var controller = new AbortController();
        var timeoutId = setTimeout(function () { controller.abort(); }, 10000);

        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            signal: controller.signal,
        })
        .then(function (response) {
            clearTimeout(timeoutId);
            if (!response.ok) return null;
            return response.json();
        })
        .then(function (brief) {
            if (brief) {
                _aiBriefCache = { brief: brief, cachedAt: Date.now() };
            }
            return brief;
        })
        .catch(function () {
            clearTimeout(timeoutId);
            // Timeout or network error — don't block chat
            return null;
        });
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
                    // Auto-resize textarea to fit content
                    input.style.height = 'auto';
                    input.style.height = Math.min(input.scrollHeight, 150) + 'px';
                }
            });
        }
    }

    // Available models — populated dynamically from backend
    var availableModels = [DEFAULT_MODEL];

    /** Build <option> tags from the current availableModels list. */
    function buildModelOptions() {
        var html = '';
        for (var i = 0; i < availableModels.length; i++) {
            var m = availableModels[i];
            var label = MODEL_LABELS[m] || m;
            var selected = m === state.model ? ' selected' : '';
            html += '<option value="' + m + '"' + selected + '>' + label + '</option>';
        }
        return html;
    }

    /** Fetch available models from backend and update the dropdown. */
    function fetchModels() {
        var url = window.location.origin + '/api/v1/AiAssistant/models';

        fetch(url, { credentials: 'include' })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.models && data.models.length > 0) {
                    availableModels = data.models;
                }
                if (data.defaultModel) {
                    DEFAULT_MODEL = data.defaultModel;
                    // If user hasn't explicitly chosen a model, use the backend default
                    if (!sessionStorage.getItem(STORAGE_MODEL)) {
                        state.model = DEFAULT_MODEL;
                    }
                }
                // Update the dropdown if it exists
                var select = document.querySelector('#' + PANEL_ID + ' [data-model]');
                if (select) {
                    select.innerHTML = buildModelOptions();
                }
            })
            .catch(function () {
                // Silently fail — dropdown keeps its initial state
            });
    }

    // ── Loading status messages ─────────────────────────
    var LOADING_STAGES = [
        { text: 'Thinking...', delay: 0 },
    ];

    // ── Tool name → friendly label ──────────────────────
    var TOOL_LABELS = {
        search_contacts: 'Searched contacts',
        create_contact: 'Created contact',
        get_contact: 'Retrieved contact',
        search_accounts: 'Searched accounts',
        create_account: 'Created account',
        search_opportunities: 'Searched opportunities',
        create_opportunity: 'Created opportunity',
        search_leads: 'Searched leads',
        create_lead: 'Created lead',
        update_lead: 'Updated lead',
        convert_lead: 'Converted lead',
        assign_lead: 'Assigned lead',
        search_meetings: 'Searched meetings',
        create_meeting: 'Created meeting',
        get_meeting: 'Retrieved meeting',
        update_meeting: 'Updated meeting',
        search_tasks: 'Searched tasks',
        create_task: 'Created task',
        get_task: 'Retrieved task',
        update_task: 'Updated task',
        assign_task: 'Assigned task',
        search_calls: 'Searched calls',
        create_call: 'Logged call',
        search_cases: 'Searched cases',
        create_case: 'Created case',
        update_case: 'Updated case',
        search_users: 'Searched users',
        get_user_by_email: 'Looked up user',
        search_teams: 'Searched teams',
        add_note: 'Added note',
        search_notes: 'Searched notes',
        health_check: 'Checked system',
        fetch_url: 'Fetched webpage',
        list_knowledge: 'Checked knowledge base',
        update_knowledge: 'Updated knowledge base',
        delete_knowledge: 'Removed from knowledge base',
    };

    // ── State ───────────────────────────────────────────
    var state = {
        expanded: sessionStorage.getItem(STORAGE_EXPANDED) === 'true',
        minimized: sessionStorage.getItem('ai-panel-minimized') === 'true',
        model: sessionStorage.getItem(STORAGE_MODEL) || DEFAULT_MODEL,
        wide: sessionStorage.getItem(STORAGE_WIDE) === 'true',
        customWidth: parseInt(sessionStorage.getItem(STORAGE_WIDTH), 10) || 0,
        loading: false,
        messages: [],
        sessionId: null,
        loadingTimers: [],
        pendingFiles: [],
        promptHistory: JSON.parse(sessionStorage.getItem('ai-panel-prompt-history') || '[]'),
        historyIndex: -1,
        historyDraft: '',
        currentXhr: null,
        currentAbortController: null,
    };

    // ── Keyboard shortcut (Ctrl+Shift+A) ──────────────────
    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey && e.shiftKey && e.key === 'A') {
            e.preventDefault();
            var el = document.getElementById(PANEL_ID);
            if (!el) return;

            if (state.minimized) {
                // Restore from minimized
                state.minimized = false;
                state.expanded = true;
                sessionStorage.setItem(STORAGE_EXPANDED, 'true');
                sessionStorage.removeItem('ai-panel-minimized');
                applyState(el);
            } else if (state.expanded) {
                // Minimize (not close) — keeps bubble visible
                state.expanded = false;
                state.minimized = true;
                sessionStorage.setItem(STORAGE_EXPANDED, 'false');
                sessionStorage.setItem('ai-panel-minimized', 'true');
                applyState(el);
            } else {
                // Expand from collapsed/minimized
                state.minimized = false;
                state.expanded = true;
                sessionStorage.setItem(STORAGE_EXPANDED, 'true');
                sessionStorage.removeItem('ai-panel-minimized');
                applyState(el);
            }
        }
    });

    // ── Wait for page ready ─────────────────────────────
    function boot() {
        if (document.getElementById(PANEL_ID)) return;
        if (!document.querySelector('.navbar')) {
            setTimeout(boot, 300);
            return;
        }
        inject();
    }

    // ── Build and inject the panel ──────────────────────
    function inject() {
        var el = document.createElement('div');
        el.id = PANEL_ID;
        el.className = 'ai-panel-wrapper';
        el.innerHTML = getHTML();
        document.body.appendChild(el);
        bind(el);
        applyState(el);
        fetchModels();
    }

    function getHTML() {
        return '<div class="ai-panel is-collapsed" data-ai-panel>' +
            '<button class="ai-panel-toggle" data-action="toggle" title="AI Assistant (Ctrl+Shift+A)">' +
                '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>' +
                '<span class="ai-panel-toggle-label">AI</span>' +
            '</button>' +
            // Minimized bubble — shows last message snippet
            '<div class="ai-panel-mini-bubble" data-mini-bubble style="display:none">' +
                '<div class="ai-panel-mini-bubble-content" data-mini-text>AI Assistant</div>' +
                '<button class="ai-panel-mini-bubble-close" data-action="miniClose" title="Close">&times;</button>' +
            '</div>' +
            '<div class="ai-panel-body" data-body style="display:none">' +
                '<div class="ai-panel-resize-handle" data-resize-handle></div>' +
                '<div class="ai-panel-header">' +
                    '<span class="ai-panel-title">AI Assistant</span>' +
                    '<div class="ai-panel-header-controls">' +
                        '<select class="ai-panel-model-select" data-model>' +
                            buildModelOptions() +
                        '</select>' +
                        '<button class="ai-panel-btn ai-panel-btn-expand" data-action="expand" title="Expand to 50%">' +
                            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>' +
                        '</button>' +
                        '<button class="ai-panel-btn" data-action="newChat" title="New Conversation">&#8634;</button>' +
                        '<button class="ai-panel-btn ai-panel-btn-help" data-action="showHelp" title="What can I do?">' +
                            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>' +
                        '</button>' +
                        '<button class="ai-panel-btn ai-panel-btn-minimize" data-action="minimize" title="Minimize (Ctrl+Shift+A)">' +
                            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>' +
                        '</button>' +
                        '<button class="ai-panel-btn ai-panel-btn-close" data-action="close" title="Close">&times;</button>' +
                    '</div>' +
                '</div>' +
                '<div class="ai-panel-messages" data-messages>' +
                    '<div class="ai-panel-welcome">' +
                        '<p>How can I help you with your CRM today?</p>' +
                        '<p class="ai-panel-welcome-hint">💡 Tip: I have a <strong>knowledge base</strong> that remembers context across conversations. Ask me <em>"what do you know about me?"</em> or tell me to remember something.</p>' +
                    '</div>' +
                '</div>' +
                '<div class="ai-panel-status" data-status style="display:none">' +
                    '<span class="ai-panel-status-icon"></span>' +
                    '<span class="ai-panel-status-text" data-status-text>Thinking...</span>' +
                '</div>' +
                '<div class="ai-panel-input-area">' +
                    '<div class="ai-panel-input-row">' +
                        '<textarea class="ai-panel-textarea" data-input placeholder="Type a message... (Shift+Enter for new line)" rows="3"></textarea>' +
                        '<div class="ai-panel-input-buttons">' +
                            '<label class="ai-panel-btn ai-panel-btn-upload" title="Upload File">' +
                                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"></path></svg>' +
                                '<input type="file" data-file-input multiple accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.html,application/pdf,image/*,text/*" style="display:none">' +
                            '</label>' +
                            '<button class="ai-panel-btn ai-panel-btn-send" data-action="send">&#9654;</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="ai-panel-file-list" data-file-list></div>' +
                '</div>' +
            '</div>' +
        '</div>';
    }

    // ── Event binding ───────────────────────────────────
    function bind(el) {
        el.querySelector('[data-action="toggle"]').addEventListener('click', function () {
            state.expanded = !state.expanded;
            state.minimized = false;
            sessionStorage.setItem(STORAGE_EXPANDED, state.expanded);
            sessionStorage.removeItem('ai-panel-minimized');
            applyState(el);
        });

        el.querySelector('[data-action="send"]').addEventListener('click', function () {
            if (state.loading) {
                abortRequest(el);
            } else {
                sendMessage(el);
            }
        });

        el.querySelector('[data-action="newChat"]').addEventListener('click', function () {
            state.messages = [];
            state.sessionId = null;
            renderMessages(el);
        });

        el.querySelector('[data-action="close"]').addEventListener('click', function () {
            state.expanded = false;
            state.minimized = false;
            sessionStorage.setItem(STORAGE_EXPANDED, 'false');
            sessionStorage.removeItem('ai-panel-minimized');
            applyState(el);
        });

        el.querySelector('[data-action="minimize"]').addEventListener('click', function () {
            state.expanded = false;
            state.minimized = true;
            sessionStorage.setItem(STORAGE_EXPANDED, 'false');
            sessionStorage.setItem('ai-panel-minimized', 'true');
            applyState(el);
        });

        el.querySelector('[data-mini-bubble]').addEventListener('click', function (e) {
            // Don't expand if clicking the close button inside the bubble
            if (e.target.closest('[data-action="miniClose"]')) return;
            state.minimized = false;
            state.expanded = true;
            sessionStorage.setItem(STORAGE_EXPANDED, 'true');
            sessionStorage.removeItem('ai-panel-minimized');
            applyState(el);
        });

        el.querySelector('[data-action="miniClose"]').addEventListener('click', function (e) {
            e.stopPropagation();
            state.minimized = false;
            sessionStorage.removeItem('ai-panel-minimized');
            applyState(el);
        });

        el.querySelector('[data-action="showHelp"]').addEventListener('click', function () {
            showHelpModal(el);
        });

        el.querySelector('[data-action="expand"]').addEventListener('click', function () {
            state.wide = !state.wide;
            state.customWidth = 0; // Reset custom drag width when toggling
            sessionStorage.setItem(STORAGE_WIDE, state.wide);
            sessionStorage.removeItem(STORAGE_WIDTH);
            applyPanelWidth(el);
        });

        // ── Resize handle drag logic ────────────────────────
        (function () {
            var handle = el.querySelector('[data-resize-handle]');
            var panel = el.querySelector('[data-ai-panel]');
            var dragging = false;
            var startX = 0;
            var startWidth = 0;

            handle.addEventListener('mousedown', function (e) {
                e.preventDefault();
                dragging = true;
                startX = e.clientX;
                startWidth = panel.offsetWidth;
                panel.classList.add('is-resizing');
                handle.classList.add('is-dragging');
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });

            function onMouseMove(e) {
                if (!dragging) return;
                var delta = startX - e.clientX; // dragging left = wider
                var newWidth = startWidth + delta;
                var maxWidth = window.innerWidth * MAX_PANEL_WIDTH_RATIO;
                newWidth = Math.max(MIN_PANEL_WIDTH, Math.min(newWidth, maxWidth));
                state.customWidth = newWidth;
                state.wide = false; // Custom drag overrides the toggle
                sessionStorage.setItem(STORAGE_WIDE, 'false');
                document.documentElement.style.setProperty('--ai-panel-width', newWidth + 'px');
            }

            function onMouseUp() {
                if (!dragging) return;
                dragging = false;
                panel.classList.remove('is-resizing');
                handle.classList.remove('is-dragging');
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                if (state.customWidth) {
                    sessionStorage.setItem(STORAGE_WIDTH, state.customWidth);
                }
            }
        })();

        el.querySelector('[data-model]').addEventListener('change', function (e) {
            state.model = e.target.value;
            sessionStorage.setItem(STORAGE_MODEL, state.model);
        });

        el.querySelector('[data-input]').addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(el);
            } else if (e.key === 'ArrowUp' && !e.shiftKey) {
                // Only navigate history when cursor is at the start or input is empty
                var input = el.querySelector('[data-input]');
                if (input.selectionStart === 0 || input.value.trim() === '') {
                    e.preventDefault();
                    if (state.promptHistory.length === 0) return;
                    if (state.historyIndex === -1) {
                        state.historyDraft = input.value;
                        state.historyIndex = state.promptHistory.length - 1;
                    } else if (state.historyIndex > 0) {
                        state.historyIndex--;
                    }
                    input.value = state.promptHistory[state.historyIndex];
                    input.style.height = 'auto';
                    input.style.height = Math.min(input.scrollHeight, 150) + 'px';
                }
            } else if (e.key === 'ArrowDown' && !e.shiftKey) {
                var input = el.querySelector('[data-input]');
                if (state.historyIndex === -1) return;
                e.preventDefault();
                if (state.historyIndex < state.promptHistory.length - 1) {
                    state.historyIndex++;
                    input.value = state.promptHistory[state.historyIndex];
                } else {
                    state.historyIndex = -1;
                    input.value = state.historyDraft;
                }
                input.style.height = 'auto';
                input.style.height = Math.min(input.scrollHeight, 150) + 'px';
            }
        });

        el.querySelector('[data-input]').addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 150) + 'px';
        });

        // File upload handling
        el.querySelector('[data-file-input]').addEventListener('change', function () {
            var files = this.files;
            if (!files || !files.length) return;
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                if (!file.type.match(/^(application\/pdf|image\/(png|jpeg|gif|webp)|text\/(plain|csv|html))$/)) {
                    addMessage('error', file.name + ': unsupported file type.');
                    renderMessages(el);
                    continue;
                }
                if (file.size > 20 * 1024 * 1024) {
                    addMessage('error', file.name + ': file too large (max 20 MB).');
                    renderMessages(el);
                    continue;
                }
                state.pendingFiles.push(file);
            }
            this.value = '';
            renderFileList(el);
        });

        el.querySelector('[data-file-list]').addEventListener('click', function (e) {
            if (e.target.classList.contains('ai-panel-file-remove')) {
                var idx = parseInt(e.target.getAttribute('data-idx'), 10);
                state.pendingFiles.splice(idx, 1);
                renderFileList(el);
            }
        });
    }

    // ── Panel width calculation ────────────────────────────
    function applyPanelWidth(el) {
        var panel = el.querySelector('[data-ai-panel]');
        var width;

        if (state.customWidth > 0) {
            width = state.customWidth;
        } else if (state.wide) {
            width = Math.max(MIN_PANEL_WIDTH, window.innerWidth * WIDE_PANEL_WIDTH_RATIO);
        } else {
            width = 400; // default
        }

        document.documentElement.style.setProperty('--ai-panel-width', width + 'px');

        if (state.wide) {
            panel.classList.add('is-wide');
        } else {
            panel.classList.remove('is-wide');
        }
    }

    // ── State application ───────────────────────────────
    function applyState(el) {
        var panel = el.querySelector('[data-ai-panel]');
        var body = el.querySelector('[data-body]');
        var toggle = el.querySelector('[data-action="toggle"]');
        var miniBubble = el.querySelector('[data-mini-bubble]');

        if (state.expanded) {
            panel.classList.remove('is-collapsed', 'is-minimized');
            panel.classList.add('is-expanded');
            body.style.display = '';
            toggle.style.display = 'none';
            miniBubble.style.display = 'none';
            applyPanelWidth(el);
            el.querySelector('[data-input]').focus();
            scrollToBottom(el);

            // Non-blocking brief fetch on panel open
            showBriefLoading(el);
            fetchBrief().then(function (brief) {
                hideBriefLoading(el);
                if (brief) {
                    renderBriefCard(el, brief);
                }
            });
        } else if (state.minimized) {
            panel.classList.add('is-collapsed', 'is-minimized');
            panel.classList.remove('is-expanded');
            body.style.display = 'none';
            toggle.style.display = 'none';
            miniBubble.style.display = 'flex';
            updateMiniBubble(el);
        } else {
            panel.classList.add('is-collapsed');
            panel.classList.remove('is-expanded', 'is-minimized');
            body.style.display = 'none';
            toggle.style.display = '';
            miniBubble.style.display = 'none';
        }
    }

    /** Update the mini bubble text with the last message snippet. */
    function updateMiniBubble(el) {
        var miniText = el.querySelector('[data-mini-text]');
        if (!miniText) return;

        if (state.messages.length === 0) {
            miniText.textContent = 'AI Assistant';
            return;
        }

        var lastMsg = state.messages[state.messages.length - 1];
        var text = lastMsg.content || '';
        // Strip markdown for preview
        text = text.replace(/\*\*/g, '').replace(/`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
        if (text.length > 60) {
            text = text.substring(0, 57) + '...';
        }
        miniText.textContent = text || 'AI Assistant';
    }

    // ── Abort in-flight request ────────────────────────
    function abortRequest(el) {
        if (state.currentXhr) {
            if (typeof state.currentXhr.abort === 'function') {
                state.currentXhr.abort();
            }
            state.currentXhr = null;
        }
        if (state.currentAbortController) {
            state.currentAbortController.abort();
            state.currentAbortController = null;
        }
        setLoading(el, false);
        addMessage('error', 'Request cancelled.');
        renderMessages(el);
    }

    // ── Messaging ───────────────────────────────────────
    function sendMessage(el) {
        var input = el.querySelector('[data-input]');
        var text = (input.value || '').trim();
        var files = state.pendingFiles.slice();
        if ((!text && !files.length) || state.loading) return;

        // Save to prompt history
        if (text) {
            // Avoid duplicating the last entry
            if (state.promptHistory.length === 0 || state.promptHistory[state.promptHistory.length - 1] !== text) {
                state.promptHistory.push(text);
                // Keep max 50 entries
                if (state.promptHistory.length > 50) {
                    state.promptHistory.shift();
                }
                try { sessionStorage.setItem('ai-panel-prompt-history', JSON.stringify(state.promptHistory)); } catch (e) {}
            }
            state.historyIndex = -1;
            state.historyDraft = '';
        }

        input.value = '';
        input.style.height = 'auto';

        if (text) {
            var fileNames = files.map(function(f) { return f.name; }).join(', ');
            addMessage('user', text + (files.length ? ' 📎 ' + fileNames : ''));
        } else if (files.length) {
            var fileNames = files.map(function(f) { return f.name; }).join(', ');
            addMessage('user', '📎 ' + fileNames);
        }
        renderMessages(el);
        setLoading(el, true);

        // Clear file state
        state.pendingFiles = [];
        renderFileList(el);
        el.querySelector('[data-file-input]').value = '';

        if (files.length) {
            // Upload files sequentially, then send the text message
            var uploadIdx = 0;

            function uploadNext() {
                if (uploadIdx >= files.length) {
                    // All files uploaded — now send the text message if any
                    if (text) {
                        var chatPayload = { message: text };
                        if (state.model) chatPayload.model = state.model;
                        if (state.sessionId) chatPayload.sessionId = state.sessionId;

                        var jqXhr = Espo.Ajax.postRequest('AiAssistant/chat', chatPayload);
                        state.currentXhr = jqXhr;
                        jqXhr
                            .then(function (data) { state.currentXhr = null; handleResponse(el, data); })
                            .catch(function (xhr) { state.currentXhr = null; if (xhr && xhr.statusText === 'abort') return; handleError(el, null); });
                    } else {
                        setLoading(el, false);
                    }
                    return;
                }

                var currentFile = files[uploadIdx];
                var formData = new FormData();
                formData.append('file', currentFile);
                // Only send message with the last file if no separate chat call
                if (!text && uploadIdx === files.length - 1) {
                    // no message
                }
                if (state.model) formData.append('model', state.model);
                if (state.sessionId) formData.append('sessionId', state.sessionId);

                var xhr = new XMLHttpRequest();
                state.currentXhr = xhr;
                xhr.open('POST', window.location.origin + '/api/v1/AiAssistant/upload', true);
                xhr.withCredentials = true;

                try {
                    var jqSettings = (typeof $ !== 'undefined' && $.ajaxSetup) ? $.ajaxSetup() : {};
                    if (jqSettings.headers) {
                        for (var key in jqSettings.headers) {
                            xhr.setRequestHeader(key, jqSettings.headers[key]);
                        }
                    }
                } catch (e) {}

                xhr.onload = function () {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        if (data.sessionId) state.sessionId = data.sessionId;
                        // Don't show upload confirmation — just proceed silently
                    } catch (e) {}
                    uploadIdx++;
                    uploadNext();
                };
                xhr.onerror = function () {
                    addMessage('error', 'Failed to upload ' + currentFile.name);
                    renderMessages(el);
                    uploadIdx++;
                    uploadNext();
                };
                xhr.send(formData);
            }

            uploadNext();
        } else {
            // Regular text message
            var payload = { message: text };
            if (state.model) payload.model = state.model;
            if (state.sessionId) payload.sessionId = state.sessionId;

            if (typeof Espo !== 'undefined' && Espo.Ajax) {
                var jqXhr = Espo.Ajax.postRequest('AiAssistant/chat', payload);
                state.currentXhr = jqXhr;
                jqXhr
                    .then(function (data) {
                        state.currentXhr = null;
                        handleResponse(el, data);
                    })
                    .catch(function (xhr) {
                        state.currentXhr = null;
                        if (xhr && xhr.statusText === 'abort') return; // Already handled by abortRequest
                        handleError(el, xhr);
                    });
            } else {
                var controller = new AbortController();
                state.currentAbortController = controller;
                fetch('api/v1/AiAssistant/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    state.currentAbortController = null;
                    handleResponse(el, data);
                })
                .catch(function (err) {
                    state.currentAbortController = null;
                    if (err && err.name === 'AbortError') return; // Already handled by abortRequest
                    handleError(el, null);
                });
            }
        }
    }

    function renderFileList(el) {
        var list = el.querySelector('[data-file-list]');
        if (!state.pendingFiles.length) {
            list.innerHTML = '';
            return;
        }
        var html = '';
        for (var i = 0; i < state.pendingFiles.length; i++) {
            html += '<div class="ai-panel-file-item">' +
                '<span class="ai-panel-file-name">' + state.pendingFiles[i].name + '</span>' +
                '<button class="ai-panel-file-remove" data-idx="' + i + '">&times;</button>' +
            '</div>';
        }
        list.innerHTML = html;
    }

    function handleResponse(el, data) {
        state.currentXhr = null;
        state.currentAbortController = null;
        setLoading(el, false);
        if (data.sessionId) state.sessionId = data.sessionId;

        var toolsUsed = data.toolsUsed || [];
        var sources = data.sources || [];
        addMessage('assistant', data.message || 'No response.', toolsUsed, sources);
        renderMessages(el);
    }

    function handleError(el, xhr) {
        state.currentXhr = null;
        state.currentAbortController = null;
        setLoading(el, false);
        var status = xhr && xhr.status;
        var msg = 'Something went wrong. Please try again.';
        if (status === 429) msg = 'Too many messages. Please wait a moment.';
        else if (status === 401) msg = 'Session expired. Please refresh.';
        else if (status === 503) msg = 'AI service is temporarily unavailable.';
        addMessage('error', msg);
        renderMessages(el);
    }

    function addMessage(role, content, toolsUsed, sources) {
        state.messages.push({
            role: role,
            content: content,
            toolsUsed: toolsUsed || [],
            sources: sources || [],
        });
    }

    function setLoading(el, on) {
        state.loading = on;
        var statusEl = el.querySelector('[data-status]');
        var statusText = el.querySelector('[data-status-text]');
        var sendBtn = el.querySelector('[data-action="send"]');

        // Clear any pending stage timers
        for (var i = 0; i < state.loadingTimers.length; i++) {
            clearTimeout(state.loadingTimers[i]);
        }
        state.loadingTimers = [];

        if (on) {
            statusEl.style.display = 'flex';
            statusText.textContent = LOADING_STAGES[0].text;

            // Transform send button into stop button
            if (sendBtn) {
                sendBtn.innerHTML = '&#9632;'; // ■ square = stop
                sendBtn.classList.remove('ai-panel-btn-send');
                sendBtn.classList.add('ai-panel-btn-stop');
                sendBtn.title = 'Stop request';
            }

            // Schedule progressive status updates
            for (var j = 1; j < LOADING_STAGES.length; j++) {
                (function (stage) {
                    var timer = setTimeout(function () {
                        if (state.loading) {
                            statusText.textContent = stage.text;
                        }
                    }, stage.delay);
                    state.loadingTimers.push(timer);
                })(LOADING_STAGES[j]);
            }

            scrollToBottom(el);
        } else {
            statusEl.style.display = 'none';

            // Restore send button
            if (sendBtn) {
                sendBtn.innerHTML = '&#9654;'; // ▶ play = send
                sendBtn.classList.remove('ai-panel-btn-stop');
                sendBtn.classList.add('ai-panel-btn-send');
                sendBtn.title = '';
            }
        }
    }

    // ── Rendering ───────────────────────────────────────
    function renderMessages(el) {
        var container = el.querySelector('[data-messages]');

        // Preserve the brief card if it exists (requirement 3.7)
        var briefCard = container.querySelector('.ai-brief-card');
        var briefLoading = container.querySelector('.ai-brief-loading');

        if (!state.messages.length) {
            container.innerHTML = '<div class="ai-panel-welcome"><p>How can I help you with your CRM today?</p></div>';
            // Re-insert brief card at top if it existed
            if (briefCard) container.insertBefore(briefCard, container.firstChild);
            if (briefLoading) container.insertBefore(briefLoading, container.firstChild);
            return;
        }
        var html = '';
        for (var i = 0; i < state.messages.length; i++) {
            var m = state.messages[i];
            var cls = 'ai-panel-message ai-panel-message-' + m.role;
            if (m.role === 'error') cls += ' ai-panel-message-error';
            var content = m.role === 'assistant' ? renderMarkdown(m.content) : escapeHtml(m.content);

            html += '<div class="' + cls + '">';
            html += '<div class="ai-panel-message-content">' + content + '</div>';

            // Tool badges for assistant messages
            if (m.role === 'assistant' && m.toolsUsed && m.toolsUsed.length > 0) {
                html += '<div class="ai-panel-tools-used">';
                for (var t = 0; t < m.toolsUsed.length; t++) {
                    var tool = m.toolsUsed[t];
                    var label = TOOL_LABELS[tool.tool] || tool.tool;
                    var badgeCls = tool.success ? 'ai-panel-tool-badge' : 'ai-panel-tool-badge ai-panel-tool-badge-error';
                    var icon = tool.success ? '&#10003;' : '&#10007;';
                    html += '<span class="' + badgeCls + '">' + icon + ' ' + escapeHtml(label) + '</span>';
                }
                html += '</div>';
            }

            // Source attributions
            if (m.role === 'assistant' && m.sources && m.sources.length > 0) {
                html += '<div class="ai-panel-message-sources">';
                html += '<span class="ai-panel-sources-label">Sources: </span>';
                for (var s = 0; s < m.sources.length; s++) {
                    var src = m.sources[s];
                    if (s > 0) html += ', ';
                    html += '<a href="' + escapeHtml(src.url) + '" target="_blank" rel="noopener">' + escapeHtml(src.title) + '</a>';
                }
                html += '</div>';
            }

            html += '</div>';
        }
        container.innerHTML = html;

        // Re-insert brief card at top after re-render (requirement 3.7)
        if (briefCard) container.insertBefore(briefCard, container.firstChild);
        if (briefLoading) container.insertBefore(briefLoading, container.firstChild);

        scrollToBottom(el);

        // Bind CRM link click handlers for SPA navigation
        var crmLinks = container.querySelectorAll('[data-crm-link]');
        for (var j = 0; j < crmLinks.length; j++) {
            crmLinks[j].addEventListener('click', function (e) {
                e.preventDefault();
                var route = this.getAttribute('data-crm-link');
                if (route) {
                    window.location.hash = '#' + route;
                }
            });
        }

        // Auto-navigate: if the last message is from the assistant and has
        // exactly one CRM link from a create/update/get action, navigate
        // to it automatically after a brief delay.
        if (state.messages.length > 0) {
            var lastMsg = state.messages[state.messages.length - 1];
            if (lastMsg.role === 'assistant' && lastMsg.toolsUsed && lastMsg.toolsUsed.length > 0) {
                var actionTools = lastMsg.toolsUsed.filter(function (t) {
                    return t.success && (
                        t.tool.startsWith('create_') ||
                        t.tool.startsWith('get_') ||
                        t.tool.startsWith('update_')
                    );
                });
                // Only auto-navigate for single-record operations
                if (actionTools.length === 1) {
                    var lastCrmLinks = container.querySelectorAll('.ai-panel-message:last-child [data-crm-link]');
                    if (lastCrmLinks.length === 1) {
                        var autoRoute = lastCrmLinks[0].getAttribute('data-crm-link');
                        if (autoRoute) {
                            setTimeout(function () {
                                window.location.hash = '#' + autoRoute;
                            }, 1500);
                        }
                    }
                }
            }
        }
    }

    function scrollToBottom(el) {
        var c = el.querySelector('[data-messages]');
        if (c) setTimeout(function () { c.scrollTop = c.scrollHeight; }, 0);
    }

    // ── Minimal markdown ────────────────────────────────
    function renderMarkdown(text) {
        // 1. Extract and protect links before HTML escaping
        var links = [];
        var placeholder = '\x00LINK';

        // Markdown links [text](url) — handle both external URLs and internal #Entity/view/ID links
        text = text.replace(/\[([^\]]+)\]\((#[^)]+)\)/g, function (_, label, hash) {
            var idx = links.length;
            links.push('<a href="' + escapeHtml(hash) + '" class="ai-panel-crm-link" data-crm-link="' + escapeHtml(hash.substring(1)) + '">' + escapeHtml(label) + '</a>');
            return placeholder + idx + '\x00';
        });

        text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, function (_, label, url) {
            var idx = links.length;
            links.push('<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(label) + '</a>');
            return placeholder + idx + '\x00';
        });

        // Bare URLs
        text = text.replace(/(https?:\/\/[^\s<>\[\]()]+)/g, function (url) {
            var idx = links.length;
            links.push('<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(url) + '</a>');
            return placeholder + idx + '\x00';
        });

        // 2. Escape HTML on the remaining text
        var h = escapeHtml(text);

        // 3. Restore links
        for (var i = 0; i < links.length; i++) {
            h = h.replace(placeholder + i + '\x00', links[i]);
        }

        // 4. Markdown formatting
        h = h.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
        h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        h = h.replace(/\n/g, '<br>');
        return h;
    }

    function escapeHtml(s) {
        if (!s) return '';
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // ── Help Modal ────────────────────────────────────
    function showHelpModal(el) {
        // Remove existing modal if any
        var existing = document.querySelector('.ai-help-modal-overlay');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.className = 'ai-help-modal-overlay';
        overlay.innerHTML =
            '<div class="ai-help-modal">' +
                '<div class="ai-help-modal-header">' +
                    '<span class="ai-help-modal-title">🤖 AI Assistant — What can I do?</span>' +
                    '<button class="ai-help-modal-close" data-action="closeHelp">&times;</button>' +
                '</div>' +
                '<div class="ai-help-modal-body">' +
                    '<div class="ai-help-section">' +
                        '<h4>💬 Natural Language CRM</h4>' +
                        '<p>Ask me anything about your CRM in plain language. I can search, create, update, and manage contacts, accounts, leads, opportunities, meetings, tasks, calls, and cases.</p>' +
                        '<p class="ai-help-example"><em>"Show me all leads from last week"</em></p>' +
                        '<p class="ai-help-example"><em>"Create a meeting with Delta Partners tomorrow at 10am"</em></p>' +
                    '</div>' +
                    '<div class="ai-help-section">' +
                        '<h4>📋 Daily Brief</h4>' +
                        '<p>Every time you open the panel, I analyze your CRM data and suggest actions — follow-ups, overdue tasks, upcoming meetings, and leads that need attention. Click any suggestion to execute it.</p>' +
                    '</div>' +
                    '<div class="ai-help-section">' +
                        '<h4>🧠 Knowledge Base</h4>' +
                        '<p>I remember context across conversations. Tell me about your company, investment criteria, communication preferences, or anything else — I\'ll use it in future interactions.</p>' +
                        '<p class="ai-help-example"><em>"What do you know about me?"</em></p>' +
                        '<p class="ai-help-example"><em>"Remember that we focus on Pre-Seed and Seed stage startups"</em></p>' +
                    '</div>' +
                    '<div class="ai-help-section">' +
                        '<h4>📎 File Upload</h4>' +
                        '<p>Upload PDFs, images, or text files and I\'ll analyze them in context. Great for pitch decks, contracts, or data imports.</p>' +
                    '</div>' +
                    '<div class="ai-help-section">' +
                        '<h4>🔍 Web Search</h4>' +
                        '<p>I can search the web for current information — company research, market data, or anything you need to enrich your CRM records.</p>' +
                    '</div>' +
                    '<div class="ai-help-section">' +
                        '<h4>⌨️ Shortcuts</h4>' +
                        '<p><strong>Ctrl+Shift+A</strong> — Toggle panel<br>' +
                        '<strong>Enter</strong> — Send message<br>' +
                        '<strong>Shift+Enter</strong> — New line<br>' +
                        '<strong>↑ / ↓</strong> — Browse prompt history</p>' +
                    '</div>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        // Close on button click
        overlay.querySelector('[data-action="closeHelp"]').addEventListener('click', function () {
            overlay.remove();
        });

        // Close on overlay click (outside modal)
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) {
                overlay.remove();
            }
        });

        // Close on Escape key
        function onEsc(e) {
            if (e.key === 'Escape') {
                overlay.remove();
                document.removeEventListener('keydown', onEsc);
            }
        }
        document.addEventListener('keydown', onEsc);
    }

    // ── Start ───────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 500); });
    } else {
        setTimeout(boot, 500);
    }
})();
