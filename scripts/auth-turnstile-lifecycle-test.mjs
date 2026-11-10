import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

let nextId = 0;
const widgets = new Map();
const removed = [];
const timers = new Map();
const listeners = new Map();
const turnstile = {
  render(_container, options) { const id = String(++nextId); widgets.set(id, options); return id; },
  remove(id) { removed.push(id); },
};
const fakeWindow = {
  turnstile,
  setTimeout(callback) { const id = timers.size + 1; timers.set(id, callback); return id; },
  clearTimeout(id) { timers.delete(id); },
};
const fakeDocument = {
  visibilityState: 'visible',
  addEventListener(name, callback) { listeners.set(name, callback); },
  removeEventListener(name) { listeners.delete(name); },
};
const source = fs.readFileSync(new URL('../src/components/auth/TurnstileWidget.tsx', import.meta.url), 'utf8')
  .replaceAll('import.meta.env.VITE_TURNSTILE_SITE_KEY', "'test-key'");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, { module, exports: module.exports, require(name) { if (name === 'react') return React; throw new Error(name); }, window: fakeWindow, document: fakeDocument, Date, Promise });
const { TurnstileWidget } = module.exports;
const tokens = [];
const onTokenChange = (token) => tokens.push(token);
let renderer;
await act(async () => { renderer = TestRenderer.create(React.createElement(TurnstileWidget, { onTokenChange }), { createNodeMock: () => ({}) }); });
assert.equal(nextId, 1);
act(() => widgets.get('1').callback('first-token'));
assert.equal(tokens.at(-1), 'first-token');
assert.equal(timers.size, 1);
// Failed login: remove old successful widget, invalidate its token, render fresh.
await act(async () => { renderer.update(React.createElement(TurnstileWidget, { onTokenChange, resetKey: 1 })); });
assert.deepEqual(removed, ['1']);
assert.equal(tokens.at(-1), null);
assert.equal(timers.size, 0);
act(() => widgets.get('1').callback('late-old-token'));
assert.equal(tokens.at(-1), null, 'late callbacks cannot restore a consumed token');
act(() => widgets.get('2').callback('second-token'));
assert.equal(tokens.at(-1), 'second-token');
// Refresh before expiry without user reloading the page.
await act(async () => { [...timers.values()][0](); });
assert.equal(nextId, 3);
assert.equal(tokens.at(-1), null);
await act(async () => widgets.get('3')['expired-callback']());
assert.equal(nextId, 4);
act(() => widgets.get('4')['error-callback']());
assert.equal(tokens.at(-1), null);
const retry = renderer.root.findByType('button');
await act(async () => retry.props.onClick());
assert.equal(nextId, 5);
act(() => widgets.get('5').callback('recovered-token'));
assert.equal(tokens.at(-1), 'recovered-token');
act(() => renderer.unmount());
assert.equal(timers.size, 0);
assert.equal(listeners.size, 0);
assert.equal(tokens.at(-1), null);
console.log('auth-turnstile-lifecycle-test: OK');

// Exercise real admin submission handler with an unresolved request and two same-tick submits.
let calls = 0;
let finishLogin;
const TurnstileMock = () => null;
const errorModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/lib/authErrorMessage.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module: errorModule, exports: errorModule.exports });
const adminModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/pages/AdminLoginPage.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, {
  module: adminModule, exports: adminModule.exports,
  require(name) {
    if (name === 'react') return React;
    if (name === 'react-router-dom') return { useNavigate: () => () => {}, useLocation: () => ({}), Link: 'a' };
    if (name.endsWith('AuthProvider')) return { useAuth: () => ({ signIn() { calls++; return new Promise(resolve => { finishLogin = resolve; }); } }) };
    if (name.endsWith('/Button')) return { Button: 'button' };
    if (name.endsWith('TurnstileWidget')) return { isTurnstileConfigured: true, TurnstileWidget: TurnstileMock };
    if (name.endsWith('authErrorMessage')) return errorModule.exports;
    throw new Error(name);
  },
});
act(() => { renderer = TestRenderer.create(React.createElement(adminModule.exports.AdminLoginPage)); });
act(() => renderer.root.findByType(TurnstileMock).props.onTokenChange('single-use-token'));
const submit = renderer.root.findByType('form').props.onSubmit;
let first, duplicate;
act(() => { first = submit({ preventDefault() {} }); duplicate = submit({ preventDefault() {} }); });
assert.equal(calls, 1, 'same-tick duplicate submit must not reach Supabase');
await act(async () => { finishLogin({ error: { code: 'captcha_failed', message: 'timeout-or-duplicate' } }); await first; await duplicate; });
assert.equal(renderer.root.findByType(TurnstileMock).props.resetKey, 1);
assert.match(renderer.root.findByProps({ role: 'alert' }).children.join(''), /Sicherheitsprüfung/);
assert.doesNotMatch(renderer.root.findByProps({ role: 'alert' }).children.join(''), /timeout-or-duplicate/);
act(() => renderer.unmount());
console.log('auth-login-single-submit-test: OK');
