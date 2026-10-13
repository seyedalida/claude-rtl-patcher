const test = require('node:test');
const assert = require('node:assert/strict');
const { isRTLContent, getConfig, saveConfig, updateDir, MODES, LABELS } = require('../lib/runtime-core');
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
