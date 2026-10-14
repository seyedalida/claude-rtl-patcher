const test = require('node:test');
const assert = require('node:assert/strict');
const { isRTLContent, getConfig, saveConfig, updateDir, applyMode, applyTypographySettings, shouldSkipMutationBatch, scheduleUpdateDir, MODES, LABELS } = require('../lib/runtime-core');
const { createMockWindow } = require('./helpers/mock-dom');

test('runtime-core isRTLContent distinguishes RTL vs LTR content', () => {
    assert.equal(isRTLContent('سلام به همگی'), true);
    assert.equal(isRTLContent('Hello world!'), false);
    assert.equal(isRTLContent('English text with inline فارسی word'), false);
    assert.equal(isRTLContent('متن کاملا فارسی با کلمه انگلیسی test'), true);
});

test('runtime-core exports MODES and LABELS properly', () => {
    assert.deepEqual(MODES, ['auto', 'force', 'disabled']);
    assert.ok(LABELS.auto);
    assert.ok(LABELS.force);
    assert.ok(LABELS.disabled);
});

test('runtime-core updateDir sets dir=rtl on Persian elements and preserves code blocks', () => {
    const { document, localStorage } = createMockWindow(`
        <main>
            <p id="persian">سلام دنیا</p>
            <pre id="code"><code>console.log("سلام")</code></pre>
        </main>
    `);
    const cfg = { mode: 'auto', fontSize: '16', lineHeight: '1.65', customFont: '' };
    updateDir(document, { config: cfg });
    const p = document.getElementById('persian');
    const pre = document.getElementById('code');
    assert.equal(p.getAttribute('dir'), 'rtl');
    assert.equal(pre.getAttribute('dir'), 'ltr');
});

test('runtime-core disabled mode cleans all inline typography variables and direction attributes', () => {
    const { window, document, localStorage } = createMockWindow(`
        <main>
            <p id="p1" dir="rtl" data-claude-dir="rtl">سلام دنیا</p>
            <span id="s1" dir="rtl" data-claude-dir="rtl">تست</span>
        </main>
    `);
    const cfg = { mode: 'auto', fontSize: '18', lineHeight: '1.8', customFont: 'Dana' };
    applyTypographySettings(cfg, document);

    const root = document.documentElement;
    assert.equal(root.style.getPropertyValue('--claude-rtl-font-size'), '18px');
    assert.equal(root.style.getPropertyValue('--claude-rtl-line-height'), '1.8');
    assert.ok(root.style.getPropertyValue('--claude-rtl-custom-font').includes('Dana'));

    // Switch to disabled mode
    applyMode('disabled', false, { document, localStorage });

    // Assert that root variables are completely wiped
    assert.equal(root.style.getPropertyValue('--claude-rtl-font-size'), '');
    assert.equal(root.style.getPropertyValue('--claude-rtl-line-height'), '');
    assert.equal(root.style.getPropertyValue('--claude-rtl-custom-font'), '');

    // Assert data-claude-rtl attribute is set to disabled
    assert.equal(root.getAttribute('data-claude-rtl'), 'disabled');

    // Assert direction attributes were completely removed
    const p1 = document.getElementById('p1');
    const s1 = document.getElementById('s1');
    assert.equal(p1.getAttribute('dir'), null);
    assert.equal(p1.getAttribute('data-claude-dir'), null);
    assert.equal(s1.getAttribute('dir'), null);
    assert.equal(s1.getAttribute('data-claude-dir'), null);
});

test('runtime-core switching back from disabled to auto restores custom typography and direction', () => {
    const { window, document, localStorage } = createMockWindow(`
        <main>
            <p id="persian">سلام مجدد</p>
        </main>
    `);
    const cfg = { mode: 'auto', fontSize: '19', lineHeight: '1.7', customFont: '' };
    saveConfig(cfg, localStorage);

    // First disable
    applyMode('disabled', false, { document, localStorage });
    assert.equal(document.documentElement.style.getPropertyValue('--claude-rtl-font-size'), '');

    // Switch back to auto
    applyMode('auto', false, { document, localStorage });
    assert.equal(document.documentElement.getAttribute('data-claude-rtl'), 'auto');
    assert.equal(document.documentElement.style.getPropertyValue('--claude-rtl-font-size'), '19px');
    assert.equal(document.documentElement.style.getPropertyValue('--claude-rtl-line-height'), '1.7');

    const p = document.getElementById('persian');
    assert.equal(p.getAttribute('dir'), 'rtl');
});

test('observer batch filter skips code-only mutations but keeps message batches', () => {
    const { document } = createMockWindow(`
        <main>
            <div class="monaco-editor"><div>const x = 1;</div></div>
            <article><p>سلام دنیا</p></article>
        </main>
    `);
    const editor = document.querySelector('.monaco-editor');
    const codeLine = editor.children[0];
    const msg = document.querySelector('p');

    assert.equal(shouldSkipMutationBatch([{ target: codeLine, addedNodes: [codeLine] }]), true);
    assert.equal(shouldSkipMutationBatch([{ target: msg, addedNodes: [msg] }]), false);
    assert.equal(shouldSkipMutationBatch([]), true);
});

test('observer batch filter never drops mixed or streaming-prose batches', () => {
    const { document } = createMockWindow(`
        <main>
            <div class="monaco-editor"><div>code</div></div>
            <article><p>سلام</p></article>
        </main>
    `);
    const codeLine = document.querySelector('.monaco-editor').children[0];
    const msg = document.querySelector('p');

    assert.equal(shouldSkipMutationBatch([
        { target: codeLine, addedNodes: [codeLine] },
        { target: msg, addedNodes: [msg] }
    ]), false);
    assert.equal(shouldSkipMutationBatch([{ target: msg, addedNodes: [] }]), true);
});

test('updateDir prunes protected subtrees without changing outcomes', () => {
    const { document } = createMockWindow(`
        <main>
            <article><p id="msg">سلام دنیا</p></article>
            <div class="monaco-editor"><div><p id="editorP">کد داخل ادیتور</p></div></div>
            <pre id="block"><code>const y = 2;</code></pre>
        </main>
    `);
    const cfg = { mode: 'auto', fontSize: '16', lineHeight: '1.65', customFont: '' };
    updateDir(document, { config: cfg });

    assert.equal(document.getElementById('msg').getAttribute('dir'), 'rtl');
    const editorP = document.getElementById('editorP');
    assert.equal(editorP.getAttribute('dir'), null);
    assert.equal(editorP.getAttribute('data-claude-dir'), null);
    const block = document.getElementById('block');
    assert.equal(block.getAttribute('dir'), 'ltr');
});

test('updateDir still rescans settled nodes in force mode after pruning', () => {
    const { document } = createMockWindow(`
        <main>
            <article><p id="msg" dir="ltr" data-claude-dir="ltr">سلام دوباره</p></article>
        </main>
    `);
    const cfg = { mode: 'force', fontSize: '16', lineHeight: '1.65', customFont: '' };
    updateDir(document, { config: cfg });

    assert.equal(document.getElementById('msg').getAttribute('dir'), 'rtl');
});

test('scheduler runs a lone update on the fast path exactly once', () => {
    const { document } = createMockWindow(`<main><article><p id="a">سلام</p></article></main>`);
    const frames = [];
    const cfg = { mode: 'auto', fontSize: '16', lineHeight: '1.65', customFont: '' };
    const deps = {
        config: cfg,
        now: () => 1000,
        requestFrame: (fn) => { frames.push(fn); },
        setTimer: () => { throw new Error('trailing timer must not arm for a lone update'); },
        clearTimer: () => {}
    };
    scheduleUpdateDir(document, deps);
    assert.equal(frames.length, 1);
    frames[0]();
    assert.equal(document.getElementById('a').getAttribute('dir'), 'rtl');
});

test('scheduler coalesces burst schedules into a single trailing run', () => {
    const { document } = createMockWindow(`<main><article><p id="b">سلام</p></article></main>`);
    // NOTE: fake epoch far from the lone-update test's epoch (1000) because
    // lastRunAt is module-level state shared across tests in this file.
    let now = 100000;
    const timers = [];
    let seq = 0;
    const cfg = { mode: 'auto', fontSize: '16', lineHeight: '1.65', customFont: '' };
    const deps = {
        config: cfg,
        now: () => now,
        requestFrame: (fn) => { fn(); },
        setTimer: (fn) => { const id = ++seq; timers.push({ id, fn, cancelled: false }); return id; },
        clearTimer: (id) => { const t = timers.find((t) => t.id === id); if (t) t.cancelled = true; }
    };
    scheduleUpdateDir(document, deps);
    now = 100050;
    scheduleUpdateDir(document, deps);
    now = 100100;
    scheduleUpdateDir(document, deps);
    const live = timers.filter((t) => !t.cancelled);
    assert.equal(live.length, 1);
    live[0].fn();
    assert.equal(document.getElementById('b').getAttribute('dir'), 'rtl');
});

test('composer ProseMirror typing path still sets dir live', () => {
    const { setupShortcuts } = require('../lib/runtime-core');
    const { document, localStorage } = createMockWindow('<main></main>');
    const prevDoc = global.document;
    const prevStorage = global.localStorage;
    global.document = document;
    global.localStorage = localStorage;
    try {
        setupShortcuts();
        const editor = document.createElement('div');
        editor.setAttribute('contenteditable', 'true');
        editor.textContent = 'سلام از ادیتور';
        document.body.appendChild(editor);
        editor.dispatchEvent({ type: 'input', target: editor, bubbles: true });
        const h = document.body._listeners.get('input') || [];
        for (const fn of h) fn({ target: editor });
        assert.equal(editor.getAttribute('dir'), 'rtl');
    } finally {
        global.document = prevDoc;
        global.localStorage = prevStorage;
    }
});
