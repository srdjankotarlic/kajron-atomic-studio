const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const dictionary = JSON.parse(fs.readFileSync(path.join(root, 'desktop/translations.json')));

function fixture(storage = {}) {
  const user = { nodeType: 3, data: 'Tekst UŽIVO čćžšđ', parentElement: { closest: () => true } };
  const label = { nodeType: 3, data: ' Sačuvaj projekat ', parentElement: { closest: () => false } };
  const dynamic = { nodeType: 3, data: 'Izvezi WEBM video', parentElement: { closest: () => false } };
  const language = { value: '', addEventListener() {} };
  const html = { lang: '', querySelectorAll: () => [], getAttribute: () => null };
  const document = {
    body: html, documentElement: html, getElementById: () => language,
    createTreeWalker: () => {
      const nodes = [label, dynamic, user]; let index = 0;
      return { nextNode() { this.currentNode = nodes[index++]; return !!this.currentNode; } };
    }
  };
  const context = { window: {}, document, navigator: { language: 'en-US' }, Node: { TEXT_NODE: 3 }, NodeFilter: { SHOW_TEXT: 4 }, localStorage: { getItem: key => storage[key] || null, setItem: (key, value) => { storage[key] = value; } }, MutationObserver: class { observe() {} } };
  const code = fs.readFileSync(path.join(root, 'desktop/i18n.js'), 'utf8').replace('TRANSLATIONS_JSON', JSON.stringify(dictionary));
  vm.runInNewContext(code, context);
  return { api: context.window.KajronI18n, label, dynamic, user, document, storage };
}

test('language switch translates UI and dynamic labels without changing user text', () => {
  const f = fixture(); const sent = [];
  f.api.connect(event => sent.push(event));
  assert.equal(f.label.data, ' Save project ');
  assert.equal(f.dynamic.data, 'Export WEBM video');
  for (let i = 0; i < 3; i++) {
    f.api.select('sr');
    assert.equal(f.label.data, ' Sačuvaj projekat ');
    assert.equal(f.dynamic.data, 'Izvezi WEBM video');
    assert.equal(f.document.documentElement.lang, 'sr-Latn');
    f.api.select('en');
    assert.equal(f.label.data, ' Save project ');
    assert.equal(f.user.data, 'Tekst UŽIVO čćžšđ');
  }
  assert.equal(f.storage['kajron-atomic-language'], 'en');
  assert.equal(sent.at(-1).language, 'en');
  assert.equal(f.api.translate('4.00 s · 100 frejmova'), '4.00 s · 100 frames');
  assert.equal(f.api.translate('1 dodatih fontova · TTF'), '1 imported font · TTF');
});

test('language choice persists, and existing Serbian projects keep Serbian by default', () => {
  assert.equal(fixture({ 'kajron-atomic-language': 'sr' }).api.language, 'sr');
  assert.equal(fixture({ 'kajron-atomic-language': 'en', 'kajron-studio-project-v1': '{}' }).api.language, 'en');
  assert.equal(fixture({ 'kajron-studio-project-v1': '{}' }).api.language, 'sr');
});

test('new progress text is translated after the renderer replaces an existing value', () => {
  const f = fixture(); f.api.connect(() => {});
  f.dynamic.data = 'Pravljenje videa · 12 / 100 frejmova';
  f.api.select('en');
  assert.equal(f.dynamic.data, 'Creating video · 12 / 100 frames');
  f.api.select('sr');
  assert.equal(f.dynamic.data, 'Pravljenje videa · 12 / 100 frejmova');
});
