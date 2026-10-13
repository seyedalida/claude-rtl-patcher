const test = require('node:test');
const assert = require('node:assert/strict');
const { isRTLContent, getConfig, saveConfig, updateDir, applyMode, applyTypographySettings, MODES, LABELS } = require('../lib/runtime-core');
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
