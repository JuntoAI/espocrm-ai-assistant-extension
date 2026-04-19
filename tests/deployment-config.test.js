const fs = require('fs');
const path = require('path');

// ─── File paths ─────────────────────────────────────────
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DOCKER_COMPOSE_PATH = path.join(
  REPO_ROOT,
  'terraform/templates/docker-compose.yml.tpl'
);
const CADDYFILE_PATH = path.join(
  REPO_ROOT,
  'terraform/templates/Caddyfile.tpl'
);

// ─── 1. Docker Compose — ai-backend service ─────────────
describe('Docker Compose template — ai-backend service', () => {
  let compose;

  beforeAll(() => {
    compose = fs.readFileSync(DOCKER_COMPOSE_PATH, 'utf-8');
  });

  test('defines the ai-backend service', () => {
    expect(compose).toMatch(/^\s*ai-backend:/m);
  });

  test('has container_name: ai-backend', () => {
    expect(compose).toMatch(/container_name:\s*ai-backend/);
  });

  test('has restart: always', () => {
    // Match restart: always within the ai-backend service block
    const aiBackendBlock = extractServiceBlock(compose, 'ai-backend');
    expect(aiBackendBlock).toMatch(/restart:\s*always/);
  });

  test('binds port 127.0.0.1:3001:3001 (localhost only)', () => {
    const aiBackendBlock = extractServiceBlock(compose, 'ai-backend');
    expect(aiBackendBlock).toMatch(/["']?127\.0\.0\.1:3001:3001["']?/);
  });

  describe('required environment variables', () => {
    const requiredEnvVars = [
      'PORT',
      'ESPOCRM_URL',
      'GOOGLE_CLOUD_PROJECT',
      'GOOGLE_CLOUD_REGION',
      'GEMINI_DEFAULT_MODEL',
      'GEMINI_AVAILABLE_MODELS',
      'SESSION_TIMEOUT_MS',
      'RATE_LIMIT_PER_MIN',
      'MAX_CONTEXT_MESSAGES',
      'LOG_LEVEL',
    ];

    let aiBackendBlock;

    beforeAll(() => {
      aiBackendBlock = extractServiceBlock(compose, 'ai-backend');
    });

    test.each(requiredEnvVars)('contains %s', (envVar) => {
      // Match either "KEY: value" (YAML mapping) or "KEY=value" (string list)
      const pattern = new RegExp(`\\b${envVar}[:\\s=]`);
      expect(aiBackendBlock).toMatch(pattern);
    });
  });

  test('has health check using wget to /health', () => {
    const aiBackendBlock = extractServiceBlock(compose, 'ai-backend');
    expect(aiBackendBlock).toMatch(/healthcheck:/);
    expect(aiBackendBlock).toMatch(/wget/);
    expect(aiBackendBlock).toMatch(/\/health/);
  });

  test('has volume mount for GCP credentials (read-only)', () => {
    const aiBackendBlock = extractServiceBlock(compose, 'ai-backend');
    expect(aiBackendBlock).toMatch(/credentials\.json:ro/);
  });

  test('has volume mount for /tmp/uploads', () => {
    const aiBackendBlock = extractServiceBlock(compose, 'ai-backend');
    expect(aiBackendBlock).toMatch(/\/tmp\/uploads/);
  });
});

// ─── 2. Caddyfile — AI API routing ─────────────────────
describe('Caddyfile template — routing', () => {
  let caddyfile;

  beforeAll(() => {
    caddyfile = fs.readFileSync(CADDYFILE_PATH, 'utf-8');
  });

  test('contains handle /ai-api/* block', () => {
    expect(caddyfile).toMatch(/handle\s+\/ai-api\/\*/);
  });

  test('contains reverse_proxy ai-backend:3001', () => {
    expect(caddyfile).toMatch(/reverse_proxy\s+ai-backend:3001/);
  });

  test('still contains the main reverse_proxy to espocrm:80', () => {
    expect(caddyfile).toMatch(/reverse_proxy\s+espocrm:80/);
  });

  test('still contains the websocket route', () => {
    expect(caddyfile).toMatch(/\/ws\b/);
    expect(caddyfile).toMatch(/espocrm-websocket:8080/);
  });
});

// ─── Helper: extract a service block from docker-compose ─
/**
 * Extracts the YAML block for a given top-level service name.
 * Works by finding the service key and grabbing everything until
 * the next top-level key (same indentation or less) or EOF.
 */
function extractServiceBlock(yamlText, serviceName) {
  const lines = yamlText.split('\n');
  let capturing = false;
  let indent = -1;
  const block = [];

  for (const line of lines) {
    if (!capturing) {
      // Match the service key at the expected indentation (2 spaces under services:)
      const match = line.match(new RegExp(`^(\\s*)${serviceName}:`));
      if (match) {
        capturing = true;
        indent = match[1].length;
        block.push(line);
      }
    } else {
      // Stop if we hit another key at the same or lesser indentation (non-empty line)
      if (line.trim() !== '' && !/^\s/.test(line)) {
        // Top-level key like "volumes:" — stop
        break;
      }
      if (line.trim() !== '') {
        const currentIndent = line.match(/^(\s*)/)[1].length;
        if (currentIndent <= indent) {
          // Same-level sibling service — stop
          break;
        }
      }
      block.push(line);
    }
  }

  return block.join('\n');
}
