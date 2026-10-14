const test = require('node:test');
const assert = require('node:assert/strict');
const { updateDir } = require('../lib/runtime-core');
const { createMockWindow } = require('./helpers/mock-dom');

function buildCodeTabFixture() {
    const { document } = createMockWindow('<main></main>');
    const main = document.querySelector('main');
    for (let i = 0; i < 500; i++) {
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.textContent = 'const value' + i + ' = compute(' + i + '); // line ' + i;
        pre.appendChild(code);
        main.appendChild(pre);
    }
    const editor = document.createElement('div');
    editor.setAttribute('class', 'monaco-editor');
    for (let i = 0; i < 200; i++) {
        const line = document.createElement('div');
        line.textContent = 'editor line ' + i;
        editor.appendChild(line);
    }
    main.appendChild(editor);
    for (let i = 0; i < 20; i++) {
        const art = document.createElement('article');
        const p = document.createElement('p');
        p.textContent = 'سلام دنیا شماره ' + i;
        art.appendChild(p);
        main.appendChild(art);
    }
    return document;
}

test('benchmark: updateDir over a code-tab-sized document stays within budget', () => {
    const document = buildCodeTabFixture();
    const cfg = { mode: 'auto', fontSize: '16', lineHeight: '1.65', customFont: '' };

    const start = performance.now();
    updateDir(document, { config: cfg });
    const duration = performance.now() - start;

    const rtl = document.querySelectorAll('p').filter((p) => p.getAttribute('dir') === 'rtl');
    assert.equal(rtl.length, 20);
    assert.ok(duration < 2000, `updateDir took ${duration.toFixed(1)}ms over code-tab fixture (budget 2000ms)`);
});
