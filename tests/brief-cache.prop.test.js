const fc = require('fast-check');

/**
 * Property 8: Brief cache TTL validity
 *
 * For any cached brief entry and any query timestamp, the cache SHALL return
 * the entry if and only if `queryTimestamp - cachedAt < ttlMs`.
 * Expired entries SHALL return null.
 *
 * Validates: Requirements 3.4, 3.5
 *
 * We extract the pure cache logic from ai-panel-init.js and test it
 * independently with fast-check.
 */

// ── Extracted pure logic (mirrors ai-panel-init.js) ─────────

const BRIEF_TTL_MS = 3600000; // 1 hour

function getCachedBrief(cache, now) {
    if (!cache) return null;
    if (now - cache.cachedAt >= BRIEF_TTL_MS) {
        return null;
    }
    return cache.brief;
}

// ── Property-based tests ────────────────────────────────────

describe('Property 8: Client-side Brief Cache TTL Validity', () => {

    // Arbitrary brief object generator
    const briefArb = fc.record({
        recommendations: fc.array(
            fc.record({
                description: fc.string({ minLength: 1, maxLength: 100 }),
                reason: fc.string({ minLength: 1, maxLength: 100 }),
                suggestedCommand: fc.string({ minLength: 1, maxLength: 100 }),
            }),
            { minLength: 1, maxLength: 5 }
        ),
        isAiGenerated: fc.boolean(),
        generatedAt: fc.constant('2025-07-15T08:30:00.000Z'),
    });

    // Cache entry generator: cachedAt is a positive integer timestamp
    const cacheEntryArb = fc.tuple(briefArb, fc.nat({ max: 2000000000000 })).map(
        ([brief, cachedAt]) => ({ brief, cachedAt })
    );

    test('returns brief when queryTimestamp - cachedAt < TTL', () => {
        fc.assert(
            fc.property(
                cacheEntryArb,
                fc.nat({ max: BRIEF_TTL_MS - 1 }), // elapsed < TTL
                (cache, elapsed) => {
                    const now = cache.cachedAt + elapsed;
                    const result = getCachedBrief(cache, now);
                    return result === cache.brief;
                }
            ),
            { numRuns: 200 }
        );
    });

    test('returns null when queryTimestamp - cachedAt >= TTL', () => {
        fc.assert(
            fc.property(
                cacheEntryArb,
                fc.nat({ max: 100000000 }), // extra time beyond TTL
                (cache, extra) => {
                    const now = cache.cachedAt + BRIEF_TTL_MS + extra;
                    const result = getCachedBrief(cache, now);
                    return result === null;
                }
            ),
            { numRuns: 200 }
        );
    });

    test('returns null when cache is null (empty)', () => {
        fc.assert(
            fc.property(
                fc.nat({ max: 2000000000000 }), // any timestamp
                (now) => {
                    const result = getCachedBrief(null, now);
                    return result === null;
                }
            ),
            { numRuns: 100 }
        );
    });

    test('TTL boundary: exactly at TTL returns null (>= check)', () => {
        fc.assert(
            fc.property(
                cacheEntryArb,
                (cache) => {
                    const now = cache.cachedAt + BRIEF_TTL_MS; // exactly at boundary
                    const result = getCachedBrief(cache, now);
                    return result === null;
                }
            ),
            { numRuns: 200 }
        );
    });

    test('TTL boundary: 1ms before TTL returns brief', () => {
        fc.assert(
            fc.property(
                cacheEntryArb,
                (cache) => {
                    const now = cache.cachedAt + BRIEF_TTL_MS - 1; // 1ms before expiry
                    const result = getCachedBrief(cache, now);
                    return result === cache.brief;
                }
            ),
            { numRuns: 200 }
        );
    });
});
