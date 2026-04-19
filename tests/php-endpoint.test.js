const fs = require('fs');
const path = require('path');

// ─── File paths ─────────────────────────────────────────
const EXTENSION_ROOT = path.resolve(__dirname, '..');
const FILES_ROOT = path.join(EXTENSION_ROOT, 'files');
const ROUTES_PATH = path.join(
  FILES_ROOT,
  'custom/Espo/Modules/AiAssistant/Resources/routes.json'
);
const MANIFEST_PATH = path.join(EXTENSION_ROOT, 'manifest.json');
const POSTCHAT_PATH = path.join(
  FILES_ROOT,
  'custom/Espo/Modules/AiAssistant/Api/PostChat.php'
);

// ─── 1. routes.json validation ──────────────────────────
describe('routes.json', () => {
  let routes;

  beforeAll(() => {
    const raw = fs.readFileSync(ROUTES_PATH, 'utf-8');
    routes = JSON.parse(raw);
  });

  test('is valid JSON and is an array', () => {
    expect(Array.isArray(routes)).toBe(true);
  });

  test('contains exactly 2 routes', () => {
    expect(routes).toHaveLength(2);
  });

  test('/AiAssistant/chat maps to PostChat#process via POST', () => {
    const chatRoute = routes.find((r) => r.route === '/AiAssistant/chat');
    expect(chatRoute).toBeDefined();
    expect(chatRoute.method).toBe('post');
    expect(chatRoute.actionMethodName).toBe('process');
    expect(chatRoute.actionClassName).toBe(
      'Espo\\Modules\\AiAssistant\\Api\\PostChat'
    );
  });

  test('/AiAssistant/chat/upload maps to PostChat#processUpload via POST', () => {
    const uploadRoute = routes.find(
      (r) => r.route === '/AiAssistant/chat/upload'
    );
    expect(uploadRoute).toBeDefined();
    expect(uploadRoute.method).toBe('post');
    expect(uploadRoute.actionMethodName).toBe('processUpload');
    expect(uploadRoute.actionClassName).toBe(
      'Espo\\Modules\\AiAssistant\\Api\\PostChat'
    );
  });

  test('all routes reference the correct action class namespace', () => {
    const expectedNamespace = 'Espo\\Modules\\AiAssistant\\Api\\PostChat';
    for (const route of routes) {
      expect(route.actionClassName).toBe(expectedNamespace);
    }
  });
});


// ─── 2. manifest.json validation ────────────────────────
describe('manifest.json', () => {
  let manifest;

  beforeAll(() => {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    manifest = JSON.parse(raw);
  });

  test('is valid JSON', () => {
    expect(manifest).toBeDefined();
    expect(typeof manifest).toBe('object');
  });

  test('has name "AI Assistant"', () => {
    expect(manifest.name).toBe('AI Assistant');
  });

  test('declares EspoCRM >=9.0.0 compatibility', () => {
    expect(manifest.acceptableVersions).toBeDefined();
    expect(Array.isArray(manifest.acceptableVersions)).toBe(true);
    const hasNineOrAbove = manifest.acceptableVersions.some((v) =>
      v.includes('>=9.0.0')
    );
    expect(hasNineOrAbove).toBe(true);
  });

  test('declares PHP >=8.1', () => {
    expect(manifest.php).toBeDefined();
    expect(Array.isArray(manifest.php)).toBe(true);
    const hasPhp81 = manifest.php.some((v) => v.includes('>=8.1'));
    expect(hasPhp81).toBe(true);
  });
});

// ─── 3. PostChat.php static analysis ────────────────────
describe('PostChat.php static analysis', () => {
  let phpSource;

  beforeAll(() => {
    phpSource = fs.readFileSync(POSTCHAT_PATH, 'utf-8');
  });

  test('contains the PostChat class', () => {
    expect(phpSource).toMatch(/class\s+PostChat/);
  });

  test('implements the Action interface', () => {
    expect(phpSource).toMatch(/class\s+PostChat\s+implements\s+Action/);
  });

  test('has a process() method', () => {
    expect(phpSource).toMatch(
      /public\s+function\s+process\s*\(\s*Request\s+\$request\s*\)\s*:\s*Response/
    );
  });

  test('has a processUpload() method', () => {
    expect(phpSource).toMatch(
      /public\s+function\s+processUpload\s*\(\s*Request\s+\$request\s*\)\s*:\s*Response/
    );
  });

  test('references getUserApiKey method', () => {
    expect(phpSource).toMatch(/getUserApiKey/);
  });

  test('uses curl for HTTP requests (not file_get_contents)', () => {
    expect(phpSource).toMatch(/curl_init/);
    expect(phpSource).toMatch(/curl_exec/);
    expect(phpSource).not.toMatch(/file_get_contents\s*\(/);
  });

  test('handles HTTP 429 (rate limit) responses', () => {
    expect(phpSource).toMatch(/429/);
  });

  test('handles HTTP 401 (unauthorized) responses', () => {
    expect(phpSource).toMatch(/401/);
  });

  test('handles HTTP 400 (bad request) responses', () => {
    expect(phpSource).toMatch(/400/);
  });

  test('handles HTTP 5xx (server error) responses', () => {
    // The code checks $httpCode >= 500
    expect(phpSource).toMatch(/>=\s*500/);
  });

  test('default backend URL is http://ai-backend:3001', () => {
    expect(phpSource).toMatch(/http:\/\/ai-backend:3001/);
  });
});
