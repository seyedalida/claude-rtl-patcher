const test = require('node:test');
const assert = require('node:assert/strict');
const { createMockWindow } = require('./helpers/mock-dom');

test('mock-dom helper provides document, elements, and querySelector', () => {
    const { window, document } = createMockWindow('<div id="root"><p class="text">سلام دنیا</p></div>');
    assert.ok(window);
    assert.ok(document);
    const p = document.querySelector('p');
    assert.ok(p);
    assert.equal(p.textContent, 'سلام دنیا');
    p.setAttribute('dir', 'rtl');
    assert.equal(p.getAttribute('dir'), 'rtl');
    assert.equal(p.tagName, 'P');
});

test('mock-dom helper supports querySelectorAll, closest, matches, and child manipulation', () => {
    const { document } = createMockWindow(`
        <main>
            <div id="container">
                <p id="first">متن اول</p>
                <p id="second" class="active">متن دوم</p>
                <pre><code>console.log('test')</code></pre>
            </div>
        </main>
    `);
    const paragraphs = document.querySelectorAll('p');
    assert.equal(paragraphs.length, 2);

    const code = document.querySelector('code');
    assert.ok(code);
    assert.ok(code.closest('pre'));
    assert.equal(code.matches('code'), true);

    const newEl = document.createElement('span');
    newEl.textContent = 'جدید';
    document.body.appendChild(newEl);
    assert.ok(document.querySelector('span'));
});
