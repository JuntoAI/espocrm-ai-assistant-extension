/**
 * AI Assistant Side Panel
 *
 * EspoCRM View that renders a collapsible chat panel on the right edge
 * of the screen. Communicates with the PHP proxy endpoint at
 * /api/v1/AiAssistant/chat via the api-client helper.
 *
 * State persisted in sessionStorage:
 *   - ai-panel-expanded  (boolean)
 *   - ai-panel-model     (string)
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 2.7, 2.9, 2.10, 5.4, 10.3
 */
define('ai-assistant:views/ai-panel', ['view'], function (View) {

    var STORAGE_KEY_EXPANDED = 'ai-panel-expanded';
    var STORAGE_KEY_MODEL = 'ai-panel-model';

    var MODELS = [
        {value: 'gemini-3.1-pro-preview', label: 'Gemini Pro'},
        {value: 'gemini-3.1-flash-lite-preview', label: 'Gemini Flash'},
    ];

    var DEFAULT_MODEL = 'gemini-3.1-flash-lite-preview';

    var PANEL_WIDTH = 400;
    var COLLAPSED_WIDTH = 48;
    var NAV_HEIGHT = 56;
    var MOBILE_BREAKPOINT = 768;

    return View.extend({

        className: 'ai-panel-wrapper',

        /**
         * Panel state.
         */
        isExpanded: false,
        messages: null,
        isLoading: false,
        selectedModel: null,
        sessionId: null,
        isMobile: false,

        /**
         * References to DOM elements cached after render.
         */
        els: null,

        setup: function () {
            this.messages = [];
            this.els = {};

            this.isExpanded = this._readStorage(STORAGE_KEY_EXPANDED) === 'true';
            this.selectedModel = this._readStorage(STORAGE_KEY_MODEL) || DEFAULT_MODEL;
            this.isMobile = window.innerWidth < MOBILE_BREAKPOINT;

            this._onResize = this._onResize.bind(this);
            window.addEventListener('resize', this._onResize);
        },

        afterRender: function () {
            this._buildDOM();
            this._cacheElements();
            this._bindEvents();
            this._applyState();
        },

        onRemove: function () {
            window.removeEventListener('resize', this._onResize);
        },

        // ─── DOM Construction ───────────────────────────────

        _buildDOM: function () {
            var html = this._getTemplate();
            this.$el.html(html);
        },

        _getTemplate: function () {
            return '' +
                '<div class="ai-panel" data-ai-panel>' +
                    // Toggle button — always visible
                    '<button class="ai-panel-toggle" data-action="toggle" title="AI Assistant" aria-label="Toggle AI Assistant">' +
                        '<span class="ai-panel-toggle-icon">' +
                            '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                                '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>' +
                            '</svg>' +
                        '</span>' +
                    '</button>' +

                    // Expanded panel body
                    '<div class="ai-panel-body" data-panel-body>' +

                        // Header
                        '<div class="ai-panel-header">' +
                            '<div class="ai-panel-header-left">' +
                                '<span class="ai-panel-title">AI Assistant</span>' +
                            '</div>' +
                            '<div class="ai-panel-header-controls">' +
                                '<select class="ai-panel-model-select" data-action="selectModel" aria-label="Select AI model">' +
                                    this._buildModelOptions() +
                                '</select>' +
                                '<button class="ai-panel-btn ai-panel-btn-new" data-action="newConversation" title="New Conversation" aria-label="New Conversation">' +
                                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                                        '<line x1="12" y1="5" x2="12" y2="19"></line>' +
                                        '<line x1="5" y1="12" x2="19" y2="12"></line>' +
                                    '</svg>' +
                                '</button>' +
                                '<button class="ai-panel-btn ai-panel-btn-close" data-action="closeMobile" title="Close" aria-label="Close panel">' +
                                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                                        '<line x1="18" y1="6" x2="6" y2="18"></line>' +
                                        '<line x1="6" y1="6" x2="18" y2="18"></line>' +
                                    '</svg>' +
                                '</button>' +
                            '</div>' +
                        '</div>' +

                        // Messages area
                        '<div class="ai-panel-messages" data-messages>' +
                            '<div class="ai-panel-welcome">' +
                                '<p>How can I help you with your CRM today?</p>' +
                            '</div>' +
                        '</div>' +

                        // Typing indicator
                        '<div class="ai-panel-typing" data-typing style="display:none;">' +
                            '<span class="ai-panel-typing-dot"></span>' +
                            '<span class="ai-panel-typing-dot"></span>' +
                            '<span class="ai-panel-typing-dot"></span>' +
                        '</div>' +

                        // Input area
                        '<div class="ai-panel-input-area">' +
                            '<div class="ai-panel-input-row">' +
                                '<button class="ai-panel-btn ai-panel-btn-upload" data-action="uploadFile" title="Upload File" aria-label="Upload File file">' +
                                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                                        '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>' +
                                    '</svg>' +
                                '</button>' +
                                '<textarea class="ai-panel-textarea" data-input placeholder="Type a message..." rows="1" aria-label="Chat message input"></textarea>' +
                                '<button class="ai-panel-btn ai-panel-btn-send" data-action="send" title="Send" aria-label="Send message">' +
                                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                                        '<line x1="22" y1="2" x2="11" y2="13"></line>' +
                                        '<polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>' +
                                    '</svg>' +
                                '</button>' +
                            '</div>' +
                        '</div>' +

                        // Hidden file input
                        '<input type="file" class="ai-panel-file-input" data-file-input accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.html,application/pdf,image/*,text/*" style="display:none;" aria-hidden="true">' +

                    '</div>' +
                '</div>';
        },

        _buildModelOptions: function () {
            var html = '';

            for (var i = 0; i < MODELS.length; i++) {
                var m = MODELS[i];
                var selected = m.value === this.selectedModel ? ' selected' : '';
                html += '<option value="' + m.value + '"' + selected + '>' + m.label + '</option>';
            }

            return html;
        },

        // ─── Element Caching ────────────────────────────────

        _cacheElements: function () {
            this.els.panel = this.$el.find('[data-ai-panel]');
            this.els.body = this.$el.find('[data-panel-body]');
            this.els.messages = this.$el.find('[data-messages]');
            this.els.typing = this.$el.find('[data-typing]');
            this.els.input = this.$el.find('[data-input]');
            this.els.fileInput = this.$el.find('[data-file-input]');
            this.els.modelSelect = this.$el.find('[data-action="selectModel"]');
            this.els.closeBtn = this.$el.find('[data-action="closeMobile"]');
        },

        // ─── Event Binding ──────────────────────────────────

        _bindEvents: function () {
            var self = this;

            this.$el.find('[data-action="toggle"]').on('click', function () {
                self.toggle();
            });

            this.$el.find('[data-action="send"]').on('click', function () {
                self.sendMessage();
            });

            this.$el.find('[data-action="newConversation"]').on('click', function () {
                self.newConversation();
            });

            this.$el.find('[data-action="uploadFile"]').on('click', function () {
                self.els.fileInput.trigger('click');
            });

            this.$el.find('[data-action="closeMobile"]').on('click', function () {
                self.collapse();
            });

            this.els.modelSelect.on('change', function () {
                self.selectedModel = self.els.modelSelect.val();
                self._writeStorage(STORAGE_KEY_MODEL, self.selectedModel);
            });

            this.els.input.on('keydown', function (e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    self.sendMessage();
                }
            });

            // Auto-resize textarea
            this.els.input.on('input', function () {
                self._autoResizeInput();
            });

            this.els.fileInput.on('change', function () {
                var files = self.els.fileInput[0].files;

                if (files && files.length > 0) {
                    self._handleFileUpload(files[0]);
                }

                // Reset so the same file can be re-selected
                self.els.fileInput.val('');
            });
        },

        // ─── State Management ───────────────────────────────

        _applyState: function () {
            this._updateMobileState();

            if (this.isExpanded) {
                this._showExpanded();
            } else {
                this._showCollapsed();
            }
        },

        toggle: function () {
            if (this.isExpanded) {
                this.collapse();
            } else {
                this.expand();
            }
        },

        expand: function () {
            this.isExpanded = true;
            this._writeStorage(STORAGE_KEY_EXPANDED, 'true');
            this._showExpanded();
        },

        collapse: function () {
            this.isExpanded = false;
            this._writeStorage(STORAGE_KEY_EXPANDED, 'false');
            this._showCollapsed();
        },

        _showExpanded: function () {
            this.els.panel.addClass('is-expanded').removeClass('is-collapsed');
            this.els.body.show();
            this._scrollToBottom();
            this.els.input.focus();
        },

        _showCollapsed: function () {
            this.els.panel.addClass('is-collapsed').removeClass('is-expanded');
            this.els.body.hide();
        },

        _updateMobileState: function () {
            this.isMobile = window.innerWidth < MOBILE_BREAKPOINT;

            if (this.isMobile) {
                this.els.panel.addClass('is-mobile');
            } else {
                this.els.panel.removeClass('is-mobile');
            }
        },

        _onResize: function () {
            this._updateMobileState();

            if (this.isExpanded) {
                this._showExpanded();
            }
        },

        // ─── Messaging ─────────────────────────────────────

        sendMessage: function () {
            var text = (this.els.input.val() || '').trim();

            if (!text || this.isLoading) {
                return;
            }

            this.els.input.val('');
            this._autoResizeInput();

            this._addMessage('user', text);
            this._setLoading(true);

            var self = this;
            var apiClient = this._getApiClient();

            apiClient.sendMessage(text, this.selectedModel, this.sessionId, function (err, data) {
                self._setLoading(false);

                if (err) {
                    self._addMessage('assistant', err.message || 'Something went wrong. Please try again.', true);
                    return;
                }

                if (data.sessionId) {
                    self.sessionId = data.sessionId;
                }

                self._addMessage('assistant', data.message, false, data.sources);
            });
        },

        newConversation: function () {
            this.messages = [];
            this.sessionId = null;
            this._renderMessages();
        },

        _addMessage: function (role, content, isError, sources) {
            this.messages.push({
                role: role,
                content: content,
                isError: !!isError,
                sources: sources || null,
                timestamp: new Date(),
            });

            this._renderMessages();
            this._scrollToBottom();
        },

        _renderMessages: function () {
            if (!this.messages.length) {
                this.els.messages.html(
                    '<div class="ai-panel-welcome">' +
                        '<p>How can I help you with your CRM today?</p>' +
                    '</div>'
                );
                return;
            }

            var html = '';
            var renderer = this._getMarkdownRenderer();

            for (var i = 0; i < this.messages.length; i++) {
                var msg = this.messages[i];
                var cssClass = 'ai-panel-message ai-panel-message-' + msg.role;

                if (msg.isError) {
                    cssClass += ' ai-panel-message-error';
                }

                var renderedContent;

                if (msg.role === 'assistant' && !msg.isError) {
                    renderedContent = renderer.render(msg.content);
                } else {
                    renderedContent = this._escapeHtml(msg.content);
                }

                html += '<div class="' + cssClass + '">';
                html += '<div class="ai-panel-message-content">' + renderedContent + '</div>';

                // Render source attributions for search grounding
                if (msg.sources && msg.sources.length) {
                    html += '<div class="ai-panel-message-sources">';
                    html += '<span class="ai-panel-sources-label">Sources:</span>';

                    for (var j = 0; j < msg.sources.length; j++) {
                        var src = msg.sources[j];
                        html += ' <a href="' + this._escapeAttr(src.url) + '" target="_blank" rel="noopener noreferrer">' +
                            this._escapeHtml(src.title) + '</a>';

                        if (j < msg.sources.length - 1) {
                            html += ',';
                        }
                    }

                    html += '</div>';
                }

                html += '</div>';
            }

            this.els.messages.html(html);
        },

        // ─── Typing Indicator ───────────────────────────────

        _setLoading: function (loading) {
            this.isLoading = loading;

            if (loading) {
                this.els.typing.show();
                this._scrollToBottom();
            } else {
                this.els.typing.hide();
            }
        },

        // ─── File Upload ────────────────────────────────────

        _handleFileUpload: function (file) {
            // Validate client-side before sending
            if (!file.type.match(/^(application\/pdf|image\/(png|jpeg|gif|webp)|text\/(plain|csv|html))$/)) {
                this._addMessage('assistant', 'Please upload a supported file (PDF, image, or text).', true);
                return;
            }

            // 20 MB limit
            if (file.size > 20 * 1024 * 1024) {
                this._addMessage('assistant', 'File size must be under 20 MB.', true);
                return;
            }

            this._addMessage('user', '📎 Uploaded: ' + file.name);
            this._setLoading(true);

            var self = this;
            var apiClient = this._getApiClient();

            apiClient.uploadFile(file, this.selectedModel, this.sessionId, function (err, data) {
                self._setLoading(false);

                if (err) {
                    self._addMessage('assistant', err.message || 'Failed to process the file.', true);
                    return;
                }

                if (data.sessionId) {
                    self.sessionId = data.sessionId;
                }

                self._addMessage('assistant', data.message, false, data.sources);
            });
        },

        // ─── Helpers ────────────────────────────────────────

        _getApiClient: function () {
            if (!this._apiClient) {
                try {
                    // Attempt to load the api-client helper module.
                    // This will be available once Task 11.2 is implemented.
                    var ApiClient = require('ai-assistant:helpers/api-client');
                    this._apiClient = new ApiClient();
                } catch (e) {
                    // Fallback: inline API client using Espo.Ajax
                    this._apiClient = this._createFallbackApiClient();
                }
            }

            return this._apiClient;
        },

        /**
         * Inline fallback API client using Espo.Ajax.
         * Used when the api-client helper module is not yet available.
         */
        _createFallbackApiClient: function () {
            return {
                sendMessage: function (message, model, sessionId, callback) {
                    var payload = {message: message};

                    if (model) {
                        payload.model = model;
                    }

                    if (sessionId) {
                        payload.sessionId = sessionId;
                    }

                    Espo.Ajax.postRequest('AiAssistant/chat', payload)
                        .then(function (response) {
                            callback(null, response);
                        })
                        .catch(function (xhr) {
                            var status = xhr && xhr.status;
                            var msg = 'Something went wrong. Please try again.';

                            if (status === 429) {
                                var data = xhr.responseJSON || {};
                                var wait = data.retryAfter || 30;
                                msg = "You're sending messages too quickly. Please wait " + wait + ' seconds.';
                            } else if (status === 401) {
                                msg = 'Your session has expired. Please refresh the page.';
                            } else if (status === 503 || status === 0) {
                                msg = 'The AI service is temporarily unavailable.';
                            }

                            callback({message: msg});
                        });
                },

                uploadFile: function (file, model, sessionId, callback) {
                    var formData = new FormData();
                    formData.append('file', file);
                    if (model) { formData.append('model', model); }
                    if (sessionId) { formData.append('sessionId', sessionId); }

                    fetch('api/v1/AiAssistant/upload', {
                        method: 'POST',
                        credentials: 'include',
                        body: formData,
                    })
                    .then(function (response) {
                        return response.json().then(function (data) {
                            if (response.ok) {
                                callback(null, data);
                            } else {
                                var msg = 'Failed to upload file.';
                                if (response.status === 429) { msg = "You're sending messages too quickly. Please wait."; }
                                callback({message: msg});
                            }
                        });
                    })
                    .catch(function () { callback({message: 'Network error. Please check your connection.'}); });
                },
            };
        },

        _getMarkdownRenderer: function () {
            if (!this._markdownRenderer) {
                try {
                    // Attempt to load the markdown-renderer helper module.
                    // This will be available once Task 11.4 is implemented.
                    var MarkdownRenderer = require('ai-assistant:helpers/markdown-renderer');
                    this._markdownRenderer = new MarkdownRenderer();
                } catch (e) {
                    // Fallback: inline lightweight markdown renderer
                    this._markdownRenderer = this._createFallbackRenderer();
                }
            }

            return this._markdownRenderer;
        },

        /**
         * Inline fallback markdown renderer.
         * Handles bold, lists, and code blocks. Escapes HTML first to prevent XSS.
         */
        _createFallbackRenderer: function () {
            var self = this;

            return {
                render: function (text) {
                    if (!text) {
                        return '';
                    }

                    // First escape HTML entities
                    var escaped = self._escapeHtml(text);

                    // Fenced code blocks: ```...```
                    escaped = escaped.replace(
                        /```([\s\S]*?)```/g,
                        '<pre><code>$1</code></pre>'
                    );

                    // Inline code: `...`
                    escaped = escaped.replace(
                        /`([^`]+)`/g,
                        '<code>$1</code>'
                    );

                    // Bold: **...**
                    escaped = escaped.replace(
                        /\*\*(.+?)\*\*/g,
                        '<strong>$1</strong>'
                    );

                    // Unordered lists: lines starting with "- "
                    escaped = escaped.replace(
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

                    // Convert remaining newlines to <br>
                    escaped = escaped.replace(/\n/g, '<br>');

                    return escaped;
                },
            };
        },

        _scrollToBottom: function () {
            var el = this.els.messages[0];

            if (el) {
                // Use setTimeout to ensure DOM has updated
                setTimeout(function () {
                    el.scrollTop = el.scrollHeight;
                }, 0);
            }
        },

        _autoResizeInput: function () {
            var el = this.els.input[0];

            if (!el) {
                return;
            }

            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 120) + 'px';
        },

        _escapeHtml: function (str) {
            if (!str) {
                return '';
            }

            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        },

        _escapeAttr: function (str) {
            return this._escapeHtml(str);
        },

        _readStorage: function (key) {
            try {
                return sessionStorage.getItem(key);
            } catch (e) {
                return null;
            }
        },

        _writeStorage: function (key, value) {
            try {
                sessionStorage.setItem(key, value);
            } catch (e) {
                // Silently fail — sessionStorage may be unavailable
            }
        },
    });
});
