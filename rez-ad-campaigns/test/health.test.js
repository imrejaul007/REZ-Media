const test = require('node:test');
const assert = require('node:assert/strict');

test('rez-ads-service health endpoint structure', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.ts'), 'utf8');

  // Verify health endpoint exists and returns ok status
  assert.match(source, /app\.get\('\/health',/);
  assert.match(source, /res\.json\(\{.*status:\s*'ok'/);
  assert.match(source, /service:\s*'rez-ads-service'/);
});

test('rez-ads-service route registration', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.ts'), 'utf8');

  // Verify routes are registered
  assert.match(source, /app\.use\('\/merchant\/ads',/);
  assert.match(source, /app\.use\('\/admin\/ads',/);
  assert.match(source, /app\.use\('\/ads',/);
});

test('rez-ads-service error handler installed', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.ts'), 'utf8');

  // Verify error handler is defined
  assert.match(source, /app\.use\(\(err:.*_req:.*_next/);
  assert.match(source, /res\.status\(500\)/);
});

test('rez-ads-service middleware stack', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.ts'), 'utf8');

  // Verify core middleware
  assert.match(source, /app\.use\(helmet\(\)\)/);
  assert.match(source, /app\.use\(cors\(\)\)/);
  assert.match(source, /app\.use\(express\.json/);
});
