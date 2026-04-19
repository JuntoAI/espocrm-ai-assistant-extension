/**
 * Property Test: Panel State Persistence Round-Trip (Property 1)
 *
 * Validates: Requirements 2.5
 *
 * For any panel state (expanded or collapsed), writing the state to
 * sessionStorage and reading it back should return the identical state value.
 * Similarly, for any model string, writing and reading back returns the
 * identical string.
 */

const fc = require('fast-check');

// ── sessionStorage mock ─────────────────────────────────────────────

function createSessionStorageMock() {
    const store = new Map();

    return {
        getItem: function (key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem: function (key, value) {
            store.set(key, String(value));
        },
        removeItem: function (key) {
            store.delete(key);
        },
        clear: function () {
            store.clear();
        },
    };
}

// ── Load the module under test ──────────────────────────────────────

let ApiClient;

beforeAll(function () {
    // Provide a global sessionStorage mock
    global.sessionStorage = createSessionStorageMock();

    // Minimal AMD shim so the module's `define` call captures the factory
    let factory;

    global.define = function (_name, _deps, fn) {
        factory = fn;
    };

    require('../files/client/custom/modules/ai-assistant/src/helpers/api-client.js');

    ApiClient = factory();
});

afterAll(function () {
    delete global.define;
    delete global.sessionStorage;
});

beforeEach(function () {
    global.sessionStorage.clear();
});

// ── Property Tests ──────────────────────────────────────────────────

describe('Property 1: Panel State Persistence Round-Trip', function () {
    /**
     * **Validates: Requirements 2.5**
     *
     * For any boolean panel state, savePanelState followed by
     * loadPanelState must return the original boolean.
     */
    it('round-trips any boolean panel expanded state through sessionStorage', function () {
        fc.assert(
            fc.property(fc.boolean(), function (expanded) {
                var client = new ApiClient();

                client.savePanelState(expanded);
                var loaded = client.loadPanelState();

                expect(loaded).toBe(expanded);
            }),
            { numRuns: 100 }
        );
    });

    /**
     * **Validates: Requirements 2.5**
     *
     * For any non-empty model string, saveSelectedModel followed by
     * loadSelectedModel must return the identical string.
     */
    it('round-trips any model string through sessionStorage', function () {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1 }),
                function (model) {
                    var client = new ApiClient();

                    client.saveSelectedModel(model);
                    var loaded = client.loadSelectedModel();

                    expect(loaded).toBe(model);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * **Validates: Requirements 2.5**
     *
     * Panel state and model selection are independent — writing one
     * must not corrupt the other.
     */
    it('panel state and model selection do not interfere with each other', function () {
        fc.assert(
            fc.property(
                fc.boolean(),
                fc.string({ minLength: 1 }),
                function (expanded, model) {
                    var client = new ApiClient();

                    client.savePanelState(expanded);
                    client.saveSelectedModel(model);

                    expect(client.loadPanelState()).toBe(expanded);
                    expect(client.loadSelectedModel()).toBe(model);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * **Validates: Requirements 2.5**
     *
     * Overwriting the panel state with a new value must reflect the
     * latest write, not a stale one.
     */
    it('last-write-wins for sequential panel state updates', function () {
        fc.assert(
            fc.property(
                fc.array(fc.boolean(), { minLength: 1, maxLength: 50 }),
                function (states) {
                    var client = new ApiClient();

                    states.forEach(function (s) {
                        client.savePanelState(s);
                    });

                    var lastState = states[states.length - 1];
                    expect(client.loadPanelState()).toBe(lastState);
                }
            ),
            { numRuns: 100 }
        );
    });
});
