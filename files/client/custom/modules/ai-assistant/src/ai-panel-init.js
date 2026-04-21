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
    var DEFAULT_MODEL = 'gemini-3-flash-preview';

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
    };

    // ── State ───────────────────────────────────────────
    var state = {
        expanded: sessionStorage.getItem(STORAGE_EXPANDED) === 'true',
        model: sessionStorage.getItem(STORAGE_MODEL) || DEFAULT_MODEL,
        loading: false,
        messages: [],
        sessionId: null,
        loadingTimers: [],
        pendingFiles: [],
    };

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
    }

    function getHTML() {
        return '<div class="ai-panel is-collapsed" data-ai-panel>' +
            '<button class="ai-panel-toggle" data-action="toggle" title="AI Assistant">' +
                '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>' +
                '<span class="ai-panel-toggle-label">AI</span>' +
            '</button>' +
            '<div class="ai-panel-body" data-body style="display:none">' +
                '<div class="ai-panel-header">' +
                    '<span class="ai-panel-title">AI Assistant</span>' +
                    '<div class="ai-panel-header-controls">' +
                        '<select class="ai-panel-model-select" data-model>' +
                            '<option value="gemini-3-flash-preview"' + (state.model === 'gemini-3-flash-preview' ? ' selected' : '') + '>Gemini 3 Flash</option>' +
                            '<option value="gemini-3.1-flash-lite-preview"' + (state.model === 'gemini-3.1-flash-lite-preview' ? ' selected' : '') + '>Gemini 3.1 Flash-Lite</option>' +
                            '<option value="gemini-3.1-pro-preview"' + (state.model === 'gemini-3.1-pro-preview' ? ' selected' : '') + '>Gemini 3.1 Pro</option>' +
                        '</select>' +
                        '<button class="ai-panel-btn" data-action="newChat" title="New Conversation">&#8634;</button>' +
                        '<button class="ai-panel-btn ai-panel-btn-close" data-action="close" title="Close">&times;</button>' +
                    '</div>' +
                '</div>' +
                '<div class="ai-panel-messages" data-messages>' +
                    '<div class="ai-panel-welcome"><p>How can I help you with your CRM today?</p></div>' +
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
            sessionStorage.setItem(STORAGE_EXPANDED, state.expanded);
            applyState(el);
        });

        el.querySelector('[data-action="send"]').addEventListener('click', function () {
            sendMessage(el);
        });

        el.querySelector('[data-action="newChat"]').addEventListener('click', function () {
            state.messages = [];
            state.sessionId = null;
            renderMessages(el);
        });

        el.querySelector('[data-action="close"]').addEventListener('click', function () {
            state.expanded = false;
            sessionStorage.setItem(STORAGE_EXPANDED, state.expanded);
            applyState(el);
        });

        el.querySelector('[data-model]').addEventListener('change', function (e) {
            state.model = e.target.value;
            sessionStorage.setItem(STORAGE_MODEL, state.model);
        });

        el.querySelector('[data-input]').addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(el);
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

    // ── State application ───────────────────────────────
    function applyState(el) {
        var panel = el.querySelector('[data-ai-panel]');
        var body = el.querySelector('[data-body]');
        if (state.expanded) {
            panel.classList.remove('is-collapsed');
            panel.classList.add('is-expanded');
            body.style.display = '';
            el.querySelector('[data-input]').focus();
            scrollToBottom(el);
        } else {
            panel.classList.add('is-collapsed');
            panel.classList.remove('is-expanded');
            body.style.display = 'none';
        }
    }

    // ── Messaging ───────────────────────────────────────
    function sendMessage(el) {
        var input = el.querySelector('[data-input]');
        var text = (input.value || '').trim();
        var files = state.pendingFiles.slice();
        if ((!text && !files.length) || state.loading) return;

        input.value = '';
        input.style.height = 'auto';

        if (text) {
            addMessage('user', text + (file ? ' 📎 ' + file.name : ''));
        } else if (files.length) {
            addMessage('user', '📎 ' + file.name);
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

                        Espo.Ajax.postRequest('AiAssistant/chat', chatPayload)
                            .then(function (data) { handleResponse(el, data); })
                            .catch(function () { handleError(el, null); });
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
                        if (xhr.status >= 200 && xhr.status < 300) {
                            // Show upload confirmation as assistant message
                            if (data.message) {
                                addMessage('assistant', data.message);
                                renderMessages(el);
                            }
                        }
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
                Espo.Ajax.postRequest('AiAssistant/chat', payload)
                    .then(function (data) {
                        handleResponse(el, data);
                    })
                    .catch(function (xhr) {
                        handleError(el, xhr);
                    });
            } else {
                fetch('api/v1/AiAssistant/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                .then(function (r) { return r.json(); })
                .then(function (data) { handleResponse(el, data); })
                .catch(function () { handleError(el, null); });
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
        setLoading(el, false);
        if (data.sessionId) state.sessionId = data.sessionId;

        var toolsUsed = data.toolsUsed || [];
        var sources = data.sources || [];
        addMessage('assistant', data.message || 'No response.', toolsUsed, sources);
        renderMessages(el);
    }

    function handleError(el, xhr) {
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

        // Clear any pending stage timers
        for (var i = 0; i < state.loadingTimers.length; i++) {
            clearTimeout(state.loadingTimers[i]);
        }
        state.loadingTimers = [];

        if (on) {
            statusEl.style.display = 'flex';
            statusText.textContent = LOADING_STAGES[0].text;

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
        }
    }

    // ── Rendering ───────────────────────────────────────
    function renderMessages(el) {
        var container = el.querySelector('[data-messages]');
        if (!state.messages.length) {
            container.innerHTML = '<div class="ai-panel-welcome"><p>How can I help you with your CRM today?</p></div>';
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

    // ── Start ───────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 500); });
    } else {
        setTimeout(boot, 500);
    }
})();
