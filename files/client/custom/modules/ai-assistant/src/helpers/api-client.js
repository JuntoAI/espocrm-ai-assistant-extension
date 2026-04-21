/**
 * AI Assistant API Client
 *
 * Handles all communication with the AI Backend via the EspoCRM PHP proxy.
 * Uses Espo.Ajax for all requests so EspoCRM handles authentication
 * automatically — including file uploads (sent as base64 JSON).
 *
 * Error handling maps HTTP status codes to user-friendly messages:
 *   - 429 -> rate limit wait message with retry-after seconds
 *   - 401 -> session expired, prompt refresh
 *   - 503 / 0 -> AI service unavailable
 *   - other -> generic retry message
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
    var UPLOAD_ENDPOINT = 'AiAssistant/chat/upload';

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

    // Panel State Persistence

    function readStorage(key) {
        try {
            return sessionStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    function writeStorage(key, value) {
        try {
            sessionStorage.setItem(key, value);
        } catch (e) {
            // Silently fail
        }
    }

    // Constructor

    var ApiClient = function () {};

    // Panel State Methods

    ApiClient.prototype.savePanelState = function (expanded) {
        writeStorage(STORAGE_KEY_EXPANDED, expanded ? 'true' : 'false');
    };

    ApiClient.prototype.loadPanelState = function () {
        return readStorage(STORAGE_KEY_EXPANDED) === 'true';
    };

    ApiClient.prototype.saveSelectedModel = function (model) {
        writeStorage(STORAGE_KEY_MODEL, model);
    };

    ApiClient.prototype.loadSelectedModel = function () {
        return readStorage(STORAGE_KEY_MODEL);
    };

    // Chat API

    /**
     * Send a text message to the AI Backend.
     * Uses Espo.Ajax.postRequest which handles EspoCRM auth automatically.
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

    // File Upload

    /**
     * Upload a file (PDF) to the AI Backend.
     *
     * Reads the file as base64 and sends it via Espo.Ajax.postRequest
     * so that EspoCRM handles authentication automatically — the same
     * way the regular chat endpoint works. The PHP proxy decodes the
     * base64 and forwards the file to the AI backend.
     *
     * @param {File}        file       File object from input element
     * @param {string}      model      Selected Gemini model identifier
     * @param {string|null} sessionId  Conversation session ID
     * @param {Function}    callback   function(err, data)
     */
    ApiClient.prototype.uploadFile = function (file, model, sessionId, callback) {
        var reader = new FileReader();

        reader.onload = function (e) {
            var base64 = e.target.result;
            // Strip the data URL prefix (e.g. "data:application/pdf;base64,")
            var base64Data = base64.split(',')[1] || base64;

            var payload = {
                fileData: base64Data,
                fileName: file.name,
                fileMime: file.type || 'application/pdf',
            };

            if (model) {
                payload.model = model;
            }

            if (sessionId) {
                payload.sessionId = sessionId;
            }

            Espo.Ajax.postRequest(UPLOAD_ENDPOINT, payload)
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

        reader.onerror = function () {
            callback({message: 'Failed to read file.', status: 0});
        };

        reader.readAsDataURL(file);
    };

    // Expose error mapper for testing

    ApiClient.mapErrorMessage = mapErrorMessage;

    return ApiClient;
});
