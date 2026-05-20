/**
 * Extracted brief-fetch logic for unit testing.
 *
 * Mirrors the fetchBrief() and getCachedBrief() functions from ai-panel-init.js
 * but exposed as a testable module with injectable dependencies (fetch, AbortController, Date.now).
 */
'use strict';

var BRIEF_TTL_MS = 3600000; // 1 hour

/**
 * Create a brief-fetch instance with injectable dependencies.
 *
 * @param {object} deps
 * @param {Function} deps.fetch - The fetch function (global.fetch or mock)
 * @param {Function} deps.AbortController - AbortController constructor
 * @param {Function} deps.now - Function returning current timestamp (Date.now or mock)
 * @param {string} deps.origin - The origin URL (window.location.origin)
 */
function createBriefFetcher(deps) {
    var _fetch = deps.fetch;
    var _AbortController = deps.AbortController;
    var _now = deps.now || Date.now;
    var _origin = deps.origin || '';

    var _cache = null; // { brief: {...}, cachedAt: number }

    function getCachedBrief() {
        if (!_cache) return null;
        if (_now() - _cache.cachedAt >= BRIEF_TTL_MS) {
            _cache = null;
            return null;
        }
        return _cache.brief;
    }

    function fetchBrief() {
        var cached = getCachedBrief();
        if (cached) return Promise.resolve(cached);

        var url = _origin + '/api/v1/AiAssistant/brief';
        var controller = new _AbortController();
        var timeoutId = setTimeout(function () { controller.abort(); }, 10000);

        return _fetch(url, {
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
                _cache = { brief: brief, cachedAt: _now() };
            }
            return brief;
        })
        .catch(function () {
            clearTimeout(timeoutId);
            return null;
        });
    }

    return {
        fetchBrief: fetchBrief,
        getCachedBrief: getCachedBrief,
        getCache: function () { return _cache; },
        setCache: function (c) { _cache = c; },
    };
}

module.exports = { createBriefFetcher, BRIEF_TTL_MS };
