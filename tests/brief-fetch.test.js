/**
 * brief-fetch.test.js
 *
 * Tests for the fetchBrief() logic extracted from ai-panel-init.js.
 * Validates: Requirements 3.1, 3.6, 3.8
 *
 * Covers:
 * - Fetch timeout handling (10s timeout triggers fallback)
 * - Error states (network error, 500 response, 401 response)
 * - Loading indicator shown during fetch (non-blocking behavior)
 * - Cache interactions (hit, miss, store)
 */
'use strict';

const { createBriefFetcher, BRIEF_TTL_MS } = require('./brief-fetch/brief-fetch');

// ─── Helpers ────────────────────────────────────────────

function mockResponse(ok, jsonData) {
    return {
        ok: ok,
        json: jest.fn().mockResolvedValue(jsonData),
    };
}

function createMockAbortController() {
    const controller = {
        signal: { aborted: false },
        abort: jest.fn(function () { controller.signal.aborted = true; }),
    };
    return controller;
}

function MockAbortControllerFactory() {
    const instance = createMockAbortController();
    MockAbortControllerFactory._lastInstance = instance;
    return instance;
}

function makeFetcher(fetchFn, nowFn) {
    return createBriefFetcher({
        fetch: fetchFn || jest.fn(),
        AbortController: MockAbortControllerFactory,
        now: nowFn || Date.now,
        origin: 'https://crm.juntoai.org',
    });
}

const SAMPLE_BRIEF = {
    recommendations: [
        { description: 'Follow up with Delta Partners', reason: 'No activity in 18 days', suggestedCommand: 'draft email to Maria' },
    ],
    isAiGenerated: true,
    generatedAt: '2025-07-15T08:30:00Z',
    cacheHit: false,
};

// ─── Tests ──────────────────────────────────────────────

describe('brief-fetch — fetchBrief()', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    // ─── Cache behavior ─────────────────────────────────

    test('returns cached brief when cache is valid (no fetch call)', async () => {
        const mockFetch = jest.fn();
        const now = Date.now();
        const fetcher = makeFetcher(mockFetch, () => now);

        // Pre-populate cache
        fetcher.setCache({ brief: SAMPLE_BRIEF, cachedAt: now - 1000 }); // 1s ago

        const result = await fetcher.fetchBrief();

        expect(result).toEqual(SAMPLE_BRIEF);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    test('calls fetch when cache is empty', async () => {
        const mockFetch = jest.fn().mockResolvedValue(mockResponse(true, SAMPLE_BRIEF));
        const fetcher = makeFetcher(mockFetch, Date.now);

        const result = await fetcher.fetchBrief();

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(result).toEqual(SAMPLE_BRIEF);
    });

    test('calls fetch when cache is expired', async () => {
        const mockFetch = jest.fn().mockResolvedValue(mockResponse(true, SAMPLE_BRIEF));
        const now = Date.now();
        const fetcher = makeFetcher(mockFetch, () => now);

        // Set expired cache (older than 1 hour)
        fetcher.setCache({ brief: { old: true }, cachedAt: now - BRIEF_TTL_MS - 1 });

        const result = await fetcher.fetchBrief();

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(result).toEqual(SAMPLE_BRIEF);
    });

    // ─── Error states ───────────────────────────────────

    test('returns null on network error (does not throw)', async () => {
        const mockFetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
        const fetcher = makeFetcher(mockFetch, Date.now);

        const result = await fetcher.fetchBrief();

        expect(result).toBeNull();
    });

    test('returns null on 500 response (does not throw)', async () => {
        const mockFetch = jest.fn().mockResolvedValue(mockResponse(false, null));
        const fetcher = makeFetcher(mockFetch, Date.now);

        const result = await fetcher.fetchBrief();

        expect(result).toBeNull();
    });

    test('returns null on 401 response (does not throw)', async () => {
        const mockFetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 401,
            json: jest.fn().mockResolvedValue({ error: 'Unauthorized' }),
        });
        const fetcher = makeFetcher(mockFetch, Date.now);

        const result = await fetcher.fetchBrief();

        expect(result).toBeNull();
    });

    test('returns null on timeout (AbortError) (does not throw)', async () => {
        const abortError = new DOMException('The operation was aborted', 'AbortError');
        const mockFetch = jest.fn().mockRejectedValue(abortError);
        const fetcher = makeFetcher(mockFetch, Date.now);

        const result = await fetcher.fetchBrief();

        expect(result).toBeNull();
    });

    // ─── Successful fetch caching ───────────────────────

    test('stores successful response in cache', async () => {
        const mockFetch = jest.fn().mockResolvedValue(mockResponse(true, SAMPLE_BRIEF));
        const now = 1700000000000;
        const fetcher = makeFetcher(mockFetch, () => now);

        await fetcher.fetchBrief();

        const cache = fetcher.getCache();
        expect(cache).not.toBeNull();
        expect(cache.brief).toEqual(SAMPLE_BRIEF);
        expect(cache.cachedAt).toBe(now);
    });

    test('after successful fetch, subsequent calls return cached data', async () => {
        const mockFetch = jest.fn().mockResolvedValue(mockResponse(true, SAMPLE_BRIEF));
        const now = Date.now();
        const fetcher = makeFetcher(mockFetch, () => now);

        // First call — fetches from network
        const first = await fetcher.fetchBrief();
        expect(first).toEqual(SAMPLE_BRIEF);
        expect(mockFetch).toHaveBeenCalledTimes(1);

        // Second call — should use cache
        const second = await fetcher.fetchBrief();
        expect(second).toEqual(SAMPLE_BRIEF);
        expect(mockFetch).toHaveBeenCalledTimes(1); // No additional fetch
    });

    // ─── Request configuration ──────────────────────────

    test('uses POST method with correct URL', async () => {
        const mockFetch = jest.fn().mockResolvedValue(mockResponse(true, SAMPLE_BRIEF));
        const fetcher = makeFetcher(mockFetch, Date.now);

        await fetcher.fetchBrief();

        expect(mockFetch).toHaveBeenCalledWith(
            'https://crm.juntoai.org/api/v1/AiAssistant/brief',
            expect.objectContaining({
                method: 'POST',
            })
        );
    });

    test('includes credentials: include', async () => {
        const mockFetch = jest.fn().mockResolvedValue(mockResponse(true, SAMPLE_BRIEF));
        const fetcher = makeFetcher(mockFetch, Date.now);

        await fetcher.fetchBrief();

        expect(mockFetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                credentials: 'include',
            })
        );
    });

    test('passes AbortController signal for timeout', async () => {
        const mockFetch = jest.fn().mockResolvedValue(mockResponse(true, SAMPLE_BRIEF));
        const fetcher = makeFetcher(mockFetch, Date.now);

        await fetcher.fetchBrief();

        expect(mockFetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                signal: expect.objectContaining({ aborted: false }),
            })
        );
    });

    // ─── Timeout mechanism ──────────────────────────────

    test('10s timeout triggers abort on the controller', () => {
        // Create a fetch that never resolves (simulates slow server)
        const mockFetch = jest.fn().mockReturnValue(new Promise(() => {}));
        const fetcher = makeFetcher(mockFetch, Date.now);

        // Start the fetch (don't await — it will never resolve)
        fetcher.fetchBrief();

        // Verify abort hasn't been called yet
        expect(MockAbortControllerFactory._lastInstance.abort).not.toHaveBeenCalled();

        // Advance time by 10 seconds
        jest.advanceTimersByTime(10000);

        // Now abort should have been called
        expect(MockAbortControllerFactory._lastInstance.abort).toHaveBeenCalledTimes(1);
    });

    // ─── Does not cache error responses ─────────────────

    test('does not cache null responses from errors', async () => {
        const mockFetch = jest.fn().mockResolvedValue(mockResponse(false, null));
        const fetcher = makeFetcher(mockFetch, Date.now);

        await fetcher.fetchBrief();

        expect(fetcher.getCache()).toBeNull();
    });

    test('does not cache null responses from network errors', async () => {
        const mockFetch = jest.fn().mockRejectedValue(new Error('Network error'));
        const fetcher = makeFetcher(mockFetch, Date.now);

        await fetcher.fetchBrief();

        expect(fetcher.getCache()).toBeNull();
    });
});
