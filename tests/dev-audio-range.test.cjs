const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

const root = path.resolve(__dirname, '..');

function request(base, pathname, method = 'GET', range) {
  return new Promise((resolve, reject) => {
    const req = http.request(base + pathname, {
      method, headers: range === undefined ? {} : { Range: range }
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

test('preview server serves seekable byte ranges and HEAD without exposing paths or losing sparse redirects', { timeout: 15000 }, async t => {
  fs.mkdirSync(path.join(root, 'outputs'), { recursive: true });
  const fixtureDir = fs.mkdtempSync(path.join(root, 'outputs', 'dev-audio-range-'));
  t.after(() => fs.rmSync(fixtureDir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(fixtureDir, 'sample.mp3'), '0123456789');
  fs.writeFileSync(path.join(fixtureDir, 'empty.mp3'), '');
  const server = spawn(process.execPath, ['dev/serve.cjs'], {
    cwd: root, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(async () => {
    if (server.exitCode === null && server.signalCode === null) {
      const closed = once(server, 'close');
      server.kill();
      await closed;
    }
  });
  const base = await new Promise((resolve, reject) => {
    let output = '';
    server.on('error', reject);
    server.on('exit', code => reject(new Error('Preview exited before ready: ' + code)));
    server.stderr.on('data', chunk => { output += chunk; });
    server.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/Preview: (http:\/\/127\.0\.0\.1:(\d+))/);
      if (match) {
        if (Number(match[2]) === 0) reject(new Error('Preview must report its actual ephemeral port, not 0'));
        else resolve(match[1]);
      }
    });
  });
  const pathname = '/' + path.relative(root, path.join(fixtureDir, 'sample.mp3')).split(path.sep).join('/');
  const matrix = [
    { name: 'complete response', status: 200, body: '0123456789', length: '10' },
    { name: 'inclusive middle', range: 'bytes=2-5', status: 206, body: '2345', length: '4', contentRange: 'bytes 2-5/10' },
    { name: 'open end', range: 'bytes=7-', status: 206, body: '789', length: '3', contentRange: 'bytes 7-9/10' },
    { name: 'suffix', range: 'bytes=-3', status: 206, body: '789', length: '3', contentRange: 'bytes 7-9/10' },
    { name: 'suffix longer than file', range: 'bytes=-50', status: 206, body: '0123456789', length: '10', contentRange: 'bytes 0-9/10' },
    { name: 'end clamps to file', range: 'bytes=8-99', status: 206, body: '89', length: '2', contentRange: 'bytes 8-9/10' },
    { name: 'last byte', range: 'bytes=9-9', status: 206, body: '9', length: '1', contentRange: 'bytes 9-9/10' },
    { name: 'HEAD full', method: 'HEAD', status: 200, body: '', length: '10' },
    { name: 'HEAD ignores Range', method: 'HEAD', range: 'bytes=2-5', status: 200, body: '', length: '10' },
    ...['bytes=10-', 'bytes=5-2', 'bytes=-0', 'bytes=-', 'bytes=a-b', 'items=0-1', 'bytes=0-1,4-5', 'bytes=1.5-2', 'bytes=9007199254740992-'].map(range => ({
      name: 'reject ' + range, range, status: 416, body: '', length: '0', contentRange: 'bytes */10'
    })),
    { name: 'HEAD ignores unsatisfiable Range', method: 'HEAD', range: 'bytes=20-', status: 200, body: '', length: '10' }
  ];
  for (const item of matrix) await t.test(item.name, async () => {
    const response = await request(base, pathname, item.method, item.range);
    assert.equal(response.status, item.status);
    assert.equal(response.body, item.body);
    assert.equal(response.headers['content-length'], item.length);
    assert.equal(response.headers['content-range'], item.contentRange);
    assert.equal(response.headers['accept-ranges'], 'bytes');
    assert.equal(response.headers['content-type'], 'audio/mpeg');
  });
  await t.test('empty files have no satisfiable range', async () => {
    const response = await request(base, pathname.replace('sample.mp3', 'empty.mp3'), 'GET', 'bytes=0-');
    assert.equal(response.status, 416);
    assert.equal(response.headers['content-range'], 'bytes */0');
    assert.equal(response.body, '');
  });
  await t.test('encoded path traversal remains blocked', async () => {
    const response = await request(base, '/%2e%2e%2fpackage.json');
    assert.equal(response.status, 403);
  });
  await t.test('missing media retains its production redirect', async () => {
    const response = await request(base, '/audio/dev-audio-range-missing-' + path.basename(fixtureDir) + '.mp3');
    assert.equal(response.status, 302);
    assert.match(response.headers.location, /^https:\/\/rroboter7-hue\.github\.io\/new-concept-study-room\/audio\//);
  });
  await t.test('sparse source WAV redirects to its real optimized published MP3', async () => {
    const response = await request(base, '/audio/words/pipeline-preview-not-present.wav');
    assert.equal(response.status, 302);
    assert.equal(response.headers.location, 'https://rroboter7-hue.github.io/new-concept-study-room/audio/optimized/words/pipeline-preview-not-present.mp3');
  });
});
