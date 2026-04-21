/**
 * AI Assistant API Client
 *
 * Handles all communication with the AI Backend via the EspoCRM PHP proxy.
 * Uses Espo.Ajax for standard JSON requests (auth handled automatically).
 * Uses fetch() with credentials:'include' for multipart file uploads.
 *
 * EspoCRM authenticates the user server-side before the PHP action runs,
 * so the PHP proxy already has the user's credentials — the frontend only
 * needs to send the session cookie, which fetch() does via credentials:'include'.
 *
 * Requirements: 2.5, 6.1, 10.2, 10.5
 */
define('ai-assistant:helpers/api-client', [], function () {

    var STORAGE_KEY_EXPANDED = 'ai-panel-expanded';
    var STORAGE_KEY_MODEL = 'ai-panel-model';

    var CHAT_ENDPOINT = 'AiAssistant/chat';
    var UPLOAD_ENDPOINT = 'api/v1/AiAssistant/upload';

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

    function readStorage(key) {
        try { return sessionStorage.getItem(key); } catch (e) { return null; }
    }

    function writeStorage(key, value) {
        try { sessionStorage.setItem(key, value); } catch (e) {}
    }

    var ApiClient = function () {};

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

    /**
     * Send a text message via Espo.Ajax (handles EspoCRM auth automatically).
     */
    ApiClient.prototype.sendMessage = function (message, model, sessionId, callback) {
        var payload = {message: message};
        if (model) { payload.model = model; }
        if (sessionId) { payload.sessionId = sessionId; }

        Espo.Ajax.postRequest(CHAT_ENDPOINT, payload)
            .then(function (response) { callback(null, response); })
            .catch(function (xhr) {
                var status = (xhr && xhr.status) || 0;
                var responseJSON = (xhr && xhr.responseJSON) || null;
                callback({message: mapErrorMessage(status, responseJSON), status: status});
            });
    };

    /**
     * Upload a PDF file via multipart form data.
     *
     * Uses fetch() with credentials:'include' so the EspoCRM session cookie
     * is sent. EspoCRM authenticates the user server-side before the PHP
     * action runs — the PHP proxy then adds the user's API key when
     * forwarding to the AI backend. No auth header manipulation needed.
     */
    ApiClient.prototype.uploadFile = function (file, model, sessionId, callback) {
        var formData = new FormData();
        formData.append('file', file);
        if (model) { formData.append('model', model); }
        if (sessionId) { formData.append('sessionId', sessionId); }

        fetch(UPLOAD_ENDPOINT, {
            method: 'POST',
            credentials: 'include',
            body: formData,
        })
        .then(function (response) {
            return response.json().then(function (data) {
                if (response.ok) {
                    callback(null, data);
                } else {
                    var msg = mapErrorMessage(response.status, data);
                    callback({message: msg, status: response.status});
                }
            });
        })
        .catch(function () {
            callback({message: mapErrorMessage(0, null), status: 0});
        });
    };

    ApiClient.mapErrorMessage = mapErrorMessage;

    return ApiClient;
});
