import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/feedMediaUpload.ts', import.meta.url), 'utf8')
  .replace("import { Upload } from 'tus-js-client';", '')
  .replace("import { supabase } from './supabaseClient';", '')
  .replace('import.meta.env.VITE_SUPABASE_URL', "'https://test-project.supabase.co'");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function harness(getSession = async () => ({ data: { session: { access_token: 'test-token' } }, error: null })) {
  const timers = new Map();
  let nextId = 0;
  let instance;
  class Upload {
    constructor(file, options) { this.file = file; this.options = options; instance = this; }
    start() { this.started = true; }
    async abort() { this.aborted = true; }
  }
  const context = {
    exports: {}, Upload, supabase: { auth: { getSession } }, URL, Error,
    setTimeout(callback, ms) { const id = ++nextId; timers.set(id, { callback, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  vm.runInNewContext(compiled, context);
  return { ...context.exports, timers, get upload() { return instance; }, fire(ms) {
    const item = [...timers.values()].find((timer) => timer.ms === ms);
    assert.ok(item, `timer ${ms} exists`); item.callback();
  } };
}
const file = { type: 'video/mp4', size: 118.5 * 1024 * 1024 };
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const options = () => ({ signal: new AbortController().signal, onProgress() {} });

{
  const h = harness();
  assert.equal(h.feedStorageEndpoint('https://abc.supabase.co'), 'https://abc.storage.supabase.co/storage/v1/upload/resumable');
  assert.equal(h.feedStorageEndpoint('http://localhost:54321'), 'http://localhost:54321/storage/v1/upload/resumable');
  const progress = [];
  const task = h.uploadFeedMedia(file, 'videos/season/test.mp4', { ...options(), onProgress: (pct) => progress.push(pct) });
  await flush();
  assert.equal(h.upload.options.chunkSize, 6 * 1024 * 1024);
  assert.equal(h.upload.options.headers.authorization, 'Bearer test-token');
  assert.equal(h.upload.options.headers['x-upsert'], 'false');
  assert.equal(h.upload.options.metadata.objectName, 'videos/season/test.mp4');
  h.upload.options.onProgress(25, 100);
  h.upload.options.onProgress(89, 100);
  h.upload.options.onProgress(100, 100);
  assert.deepEqual(progress, [25, 89, 100]);
  h.upload.options.onSuccess(); await task;
  assert.equal(h.timers.size, 0);
}
{
  const h = harness(); const controller = new AbortController();
  const task = h.uploadFeedMedia(file, 'videos/test.mp4', { ...options(), signal: controller.signal });
  await flush(); controller.abort();
  await assert.rejects(task, /Upload abgebrochen/);
  assert.equal(h.upload.aborted, true); assert.equal(h.timers.size, 0);
}
{
  const h = harness(); const controller = new AbortController(); controller.abort();
  await assert.rejects(h.uploadFeedMedia(file, 'videos/test.mp4', { ...options(), signal: controller.signal }), /abgebrochen/);
  assert.equal(h.upload, undefined);
}
{
  const h = harness(); const task = h.uploadFeedMedia(file, 'videos/test.mp4', options());
  await flush(); h.fire(90_000);
  await assert.rejects(task, /90 Sekunden/); assert.equal(h.upload.aborted, true);
  h.upload.options.onSuccess(); assert.equal(h.timers.size, 0);
}
{
  const h = harness(); const task = h.uploadFeedMedia(file, 'videos/test.mp4', options());
  await flush(); h.fire(15 * 60_000);
  await assert.rejects(task, /dauert zu lange/);
}
{
  const h = harness(); const task = h.uploadFeedMedia(file, 'videos/test.mp4', options());
  await flush(); h.upload.options.onError(new Error('HTTP 413'));
  await assert.rejects(task, /HTTP 413/); assert.equal(h.timers.size, 0);
}
{
  const h = harness(async () => ({ data: { session: null }, error: null }));
  await assert.rejects(h.uploadFeedMedia(file, 'videos/test.mp4', options()), /neu anmelden/);
  assert.equal(h.upload, undefined); assert.equal(h.timers.size, 0);
}
{
  let resolveSession;
  const h = harness(() => new Promise((resolve) => { resolveSession = resolve; }));
  const task = h.uploadFeedMedia(file, 'videos/test.mp4', options());
  h.fire(90_000); await assert.rejects(task, /90 Sekunden/);
  resolveSession({ data: { session: { access_token: 'late' } }, error: null }); await flush();
  assert.equal(h.upload, undefined);
}
const composer = readFileSync(new URL('../src/features/home/HomeFeedComposer.tsx', import.meta.url), 'utf8');
assert.ok(!composer.includes('startFakeUploadProgress'));
assert.ok(composer.includes('Upload abbrechen'));
assert.ok(composer.includes('onProgress: setUploadPct'));
console.log('Feed upload: endpoint, chunking, real progress, cancellation, timeouts, errors and session checks passed.');
