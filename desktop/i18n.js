// A single offline package supports both languages. User text and project data are never translated.
window.KajronI18n = (() => {
  const dictionary = TRANSLATIONS_JSON;
  let language;
  try { language = localStorage.getItem('kajron-atomic-language'); } catch {}
  if (!['en', 'sr'].includes(language)) {
    let legacy = false;
    try { legacy = !!localStorage.getItem('kajron-studio-project-v1'); } catch {}
    language = legacy || /^sr\b/i.test(navigator.language) ? 'sr' : 'en';
  }
  const originals = new WeakMap();
  let sendNative = null;
  function translate(text) {
    if (language === 'sr' || typeof text !== 'string') return text;
    const trimmed = text.trim();
    if (dictionary[trimmed]) return text.replace(trimmed, dictionary[trimmed]);
    return text
      .replace(/(\d+) dodatih fontova/g, (_, n) => `${n} imported font${n === '1' ? '' : 's'}`)
      .replace(/ · Tvoj font/g, ' · Your font')
      .replace(/(\d+) frejmova/g, '$1 frames')
      .replace(/Veći kadar zahteva dužu obradu\./g, 'Larger frames take longer to encode.')
      .replace(/Izvezi (MP4|MOV|WEBM) video/g, 'Export $1 video')
      .replace(/✓ Sačuvan (MP4|MOV|WEBM) video/g, '✓ Saved $1 video')
      .replace(/Video je sačuvan: /g, 'Video saved: ')
      .replace(/Projekat je sačuvan: /g, 'Project saved: ')
      .replace(/Projekat nije sačuvan: /g, 'Project could not be saved: ')
      .replace(/Font nije dodat: /g, 'Font could not be imported: ')
      .replace(/Izvoz nije pokrenut: /g, 'Export could not be started: ')
      .replace(/Video nije sačuvan: /g, 'Video could not be saved: ')
      .replace(/Pravljenje videa · /g, 'Creating video · ');
  }
  function setText(node) {
    if (!node.parentElement || node.parentElement.closest('script,style,textarea,[data-user-content],#saved-path')) return;
    let item = originals.get(node);
    if (!item || node.data !== item.last) item = { source: node.data, last: node.data };
    const next = translate(item.source);
    if (node.data !== next) node.data = next;
    item.last = next; originals.set(node, item);
  }
  const attributes = new WeakMap();
  function apply(root = document.body) {
    if (root.nodeType === Node.TEXT_NODE) { setText(root); return; }
    if (!root.querySelectorAll) return;
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) setText(walk.currentNode);
    for (const el of [root, ...root.querySelectorAll('[title],[aria-label],[placeholder]')]) {
      if (el.closest?.('[data-user-content]')) continue;
      const saved = attributes.get(el) || {};
      for (const attr of ['title', 'aria-label', 'placeholder']) {
        const value = el.getAttribute?.(attr);
        if (value === null || value === undefined) continue;
        let item = saved[attr];
        if (!item || value !== item.last) item = { source: value, last: value };
        const next = translate(item.source);
        if (value !== next) el.setAttribute(attr, next);
        item.last = next; saved[attr] = item;
      }
      attributes.set(el, saved);
    }
  }
  function select(value) {
    language = value === 'sr' ? 'sr' : 'en';
    try { localStorage.setItem('kajron-atomic-language', language); } catch {}
    document.documentElement.lang = language === 'sr' ? 'sr-Latn' : 'en';
    document.getElementById('language').value = language;
    apply(document.documentElement);
    sendNative?.({ action: 'setLanguage', language });
  }
  function connect(send) {
    sendNative = send;
    document.getElementById('language').addEventListener('change', event => select(event.target.value));
    select(language);
    new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData') setText(record.target);
        else if (record.type === 'attributes') apply(record.target);
        else for (const node of record.addedNodes) apply(node);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-label', 'placeholder'] });
  }
  return { get language() { return language; }, translate, connect, select, dictionary };
})();
