/**
 * AI Assistant API Client
 *
 * Handles all communication with the AI Backend via the EspoCRM PHP proxy.
 * Uses Espo.Ajax for standard JSON requests (auth cookies handled automatically)
 * and XMLHttpRequest for multipart file uploads.
 *
 * Error handling maps HTTP status codes to user-friendly messages:
 *   - 429 → rate limit wait message with retry-after seconds
 *   - 401 → session expired, prompt refresh
 *   - 503 / 0 → AI service unavailable
 *   - other → generic retry message
 *
 * Panel state persistence:
 *   - ai-panel-expanded  (boolean string) in sessionStorage
 *   - ai-panel-model     (model identifier) in sessionStorage
 *
 * Requirements: 2.5, 6.1, 10.2, 10.5
 */
define('ai-assistant:helpers/api-client', [], function () {

    var STORAGE_KEY_EXPANDED = 'ai-panel-expanded';
    var STORAGE_KEY_MODEL = 'ai-panel-model';

    var CHAT_ENDPOINT = 'AiAssistant/chat';
    var UPLOAD_ENDPOINT = 'api/v1/AiAssistant/chat/upload';

    /**
     * Map an XHR or error status to a user-facing message.
     *
     * @param {number} status  HTTP status code (0 for network errors)
     * @param {Object} [responseJSON]  Parsed response body, if available
     * @returns {string}
     */
    function mapErrorMessage(status, responseJSON) {
        if (status === 429) {
            var data = responseJSON || {};
            var wait = data.retryAfter || 30;

            return "You're sending messages too quickly. Please wait " + wait + ' seconds.';
        }

        if (status === 401) {
            return 'Your session has expired. Please refresh the page.';
        }

        if (status === 503 || status === 0) {
            return 'The AI service is temporarily unavailable.';
        }

        return 'Something went wrong. Please try again.';
    }

    // ─── Panel State Persistence ────────────────────────

    /**
     * Read a value from sessionStorage.
     *
     * @param {string} key
     * @returns {string|null}
     */
    function readStorage(key) {
        try {
            return sessionStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    /**
     * Write a value to sessionStorage.
     *
     * @param {string} key
     * @param {string} value
     */
    function writeStorage(key, value) {
        try {
            sessionStorage.setItem(key, value);
        } catch (e) {
            // Silently fail — sessionStorage may be unavailable
        }
    }

    // ─── Constructor ────────────────────────────────────

    /**
     * @constructor
     */
    var ApiClient = function () {};

    // ─── Panel State Methods ────────────────────────────

    /**
     * Persist the panel expanded/collapsed state.
     *
     * @param {boolean} expanded
     */
    ApiClient.prototype.savePanelState = function (expanded) {
        writeStorage(STORAGE_KEY_EXPANDED, expanded ? 'true' : 'false');
    };

    /**
     * Read the persisted panel state.
     *
     * @returns {boolean}  true if expanded, false otherwise
     */
    ApiClient.prototype.loadPanelState = function () {
        return readStorage(STORAGE_KEY_EXPANDED) === 'true';
    };

    /**
     * Persist the selected model identifier.
     *
     * @param {string} model
     */
    ApiClient.prototype.saveSelectedModel = function (model) {
        writeStorage(STORAGE_KEY_MODEL, model);
    };

    /**
     * Read the persisted model identifier.
     *
     * @returns {string|null}
     */
    ApiClient.prototype.loadSelectedModel = function () {
        return readStorage(STORAGE_KEY_MODEL);
    };

    // ─── Chat API ───────────────────────────────────────

    /**
     * Send a text message to the AI Backend.
     *
     * Uses Espo.Ajax.postRequest which automatically includes
     * the EspoCRM auth cookie / Espo-Authorization header.
     *
     * @param {string}   message    User message text
     * @param {string}   model      Selected Gemini model identifier
     * @param {string|null} sessionId  Conversation session ID (null for new)
     * @param {Function} callback   function(err, data)
     */
    ApiClient.prototype.sendMessage = function (message, model, sessionId, callback) {
        var payload = {message: message};

        if (model) {
            payload.model = model;
        }

        if (sessionId) {
            payload.sessionId = sessionId;
        }

        Espo.Ajax.postRequest(CHAT_ENDPOINT, payload)
            .then(function (response) {
                callback(null, response);
            })
            .catch(function (xhr) {
                var status = (xhr && xhr.status) || 0;
                var responseJSON = (xhr && xhr.responseJSON) || null;
                var msg = mapErrorMessage(status, responseJSON);

                callback({message: msg, status: status});
            });
    };

    // ─── File Upload ────────────────────────────────────

    /**
     * Upload a file (PDF) to the AI Backend as multipart form data.
     *
     * Uses XMLHttpRequest directly because Espo.Ajax does not
     * support multipart/form-data payloads.
     *
     * @param {File}     file       File object from input element
     * @param {string}   model      Selected Gemini model identifier
     * @param {string|null} sessionId  Conversation session ID
     * @param {Function} callback   function(err, data)
     */
    ApiClient.prototype.uploadFile = function (file, model, sessionId, callback) {
        var formData = new FormData();
        formData.append('file', file);

        if (model) {
            formData.append('model', model);
        }

        if (sessionId) {
            formData.append('sessionId', sessionId);
        }

        var xhr = new XMLHttpRequest();
        xhr.open('POST', UPLOAD_ENDPOINT, true);

        // Send session cookies for same-origin EspoCRM authentication.
        xhr.withCredentials = true;

        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    callback(null, data);
                } catch (e) {
                    callback({message: 'Invalid response from server.', status: xhr.status});
                }
            } else {
                var responseJSON = null;

                try {
                    responseJSON = JSON.parse(xhr.responseText);
                } catch (e) {
                    // ignore parse failure
                }

                var msg = mapErrorMessage(xhr.status, responseJSON);
                callback({message: msg, status: xhr.status});
            }
        };

        xhr.onerror = function () {
            callback({
                message: mapErrorMessage(0, null),
                status: 0,
            });
        };

        xhr.send(formData);
    };

    // ─── Expose error mapper for testing ────────────────

    ApiClient.mapErrorMessage = mapErrorMessage;

    return ApiClient;
});
