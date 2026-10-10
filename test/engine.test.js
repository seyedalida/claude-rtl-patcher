const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const asar = require('@electron/asar');

const engine = require('../lib/engine');
const { getFontCss, UNICODE_RANGE } = require('../lib/font');
const { buildCssPayload, CSS_INJECT_FULL, CSS_INJECT_FONT_ONLY } = require('../lib/css');
const { getRuntimeScript } = require('../lib/runtime');

test('lib/font.js loads Vazirmatn font and outputs valid @font-face', () => {
    const css = getFontCss();
    assert.match(css, /@font-face/);
    assert.match(css, /font-family:\s*'Vazirmatn'/);
    assert.match(css, /unicode-range:/);
    assert.match(css, /U\+0600-06FF/);
    assert.match(css, /U\+200C/);
    assert.match(css, /font-weight:\s*100\s*900/);
});

test('lib/css.js generates both full and font-only payloads with isolation rules', () => {
    assert.match(CSS_INJECT_FULL, /\[dir="rtl"\]/);
    assert.match(CSS_INJECT_FULL, /html\[data-claude-rtl="force"\]/);
    assert.match(CSS_INJECT_FULL, /ui-monospace/);
    assert.match(CSS_INJECT_FULL, /\[class\*="thinking" i\]/);
    assert.match(CSS_INJECT_FULL, /\[class\*="katex" i\]/);
    assert.match(CSS_INJECT_FULL, /table\s*\{/);

    assert.match(CSS_INJECT_FONT_ONLY, /\[dir="rtl"\]/);
    assert.match(CSS_INJECT_FONT_ONLY, /html\[data-claude-rtl="force"\]/);
});

test('lib/runtime.js provides Alt+R, Shift+2 fix, and updateDir logic', () => {
    const script = getRuntimeScript();
    assert.match(script, /KeyR/);
    assert.match(script, /Digit2/);
    assert.match(script, /claude_rtl_mode/);
    assert.match(script, /updateDir/);
    assert.match(script, /claude-rtl-toast/);
    // Verified ES6 modernization and scoping
    assert.match(script, /^\(\(\)\s*=>\s*\{/);
    assert.match(script, /let\s+updatePending\s*=\s*false;/);
    assert.match(script, /let\s+pendingScope\s*=\s*null;/);
    assert.match(script, /function\s+updateDir\(scopeRoot\)/);
    assert.match(script, /#claude-rtl-widget,\s*#claude-rtl-toast/);
    assert.match(script, /function\s+isRTLContent\(text,\s*isForce/);
});

test('lib/runtime.js isRTLContent correctly discriminates mixed and predominantly English paragraphs', () => {
    const script = getRuntimeScript();

    // Verify isRTLContent definition exists in script
    assert.match(script, /function\s+isRTLContent\(text,\s*isForce/);

    // Extract isRTLContent function definition directly
    const fnMatch = script.match(/function\s+isRTLContent\s*\([\s\S]*?\n\s*\}/);
    assert.ok(fnMatch, 'Could not find isRTLContent definition in script');

    const RTL_REGEX = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
    const RTL_REGEX_GLOBAL = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g;
    const LTR_REGEX = /[A-Za-z]/;
    const LTR_REGEX_GLOBAL = /[A-Za-z]/g;

    const runner = new Function('RTL_REGEX', 'RTL_REGEX_GLOBAL', 'LTR_REGEX', 'LTR_REGEX_GLOBAL', `
        ${fnMatch[0]}
        return isRTLContent;
    `);
    const isRTLContent = runner(RTL_REGEX, RTL_REGEX_GLOBAL, LTR_REGEX, LTR_REGEX_GLOBAL);

    // Pure English -> LTR
    assert.equal(isRTLContent('Hello this is a purely English text sentence with several words.'), false);

    // Pure Persian -> RTL
    assert.equal(isRTLContent('سلام این یک متن کاملا فارسی است.'), true);

    // English with a Persian word quote -> MUST remain LTR (the bug we fixed!)
    assert.equal(isRTLContent('We call this concept اصالت in philosophy.'), false);
    assert.equal(isRTLContent('The word سلام means hello in Persian.'), false);
    assert.equal(isRTLContent('This bug was reported by علی.'), false);

    // Persian with technical/English terms -> MUST be RTL
    assert.equal(isRTLContent('Docker یک ابزار کانتینرسازی برای استقرار برنامه‌هاست.'), true);
    assert.equal(isRTLContent('API کار نمی‌کند و خطای ۵۰۰ برمی‌گرداند.'), true);
    assert.equal(isRTLContent('کتاب The Lean Startup را حتما بخوانید.'), true);

    // Force mode -> Always true
    assert.equal(isRTLContent('Hello world', true), true);

    // Empty text -> false
    assert.equal(isRTLContent(''), false);
});

test('lib/engine.js safely injects CSS via JSON.stringify without template literal breakage', () => {
    const tempTestRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-safe-inject-test-'));
    const extractDir = path.join(tempTestRoot, 'extract');
    fs.mkdirSync(path.join(extractDir, '.vite', 'build'), { recursive: true });
    fs.writeFileSync(path.join(extractDir, '.vite', 'build', 'mainWindow.js'), 'console.log("init");');

    // Run injection
    engine.injectStylesAndRuntime(extractDir, { fontOnly: false });

    const injectedJs = fs.readFileSync(path.join(extractDir, '.vite', 'build', 'mainWindow.js'), 'utf8');
    assert.match(injectedJs, /webFrame\.insertCSS\("/);
    assert.match(injectedJs, /alreadyLoaded/);

    // Verify injected JS is syntactically valid
    assert.doesNotThrow(() => {
        new Function('require', injectedJs);
    });

    fs.rmSync(tempTestRoot, { recursive: true, force: true });
});

test('lib/engine.js can extract, inject, and repack a mock asar bundle cleanly', async () => {
    const tempTestRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-engine-test-'));
    const srcDir = path.join(tempTestRoot, 'src');
    const extractDir = path.join(tempTestRoot, 'extract');
    const asarPath = path.join(tempTestRoot, 'app.asar');
    const backupPath = path.join(tempTestRoot, 'app.asar.bak');

    fs.mkdirSync(path.join(srcDir, '.vite', 'build'), { recursive: true });
    fs.mkdirSync(path.join(srcDir, '.vite', 'renderer'), { recursive: true });

    fs.writeFileSync(path.join(srcDir, '.vite', 'build', 'style.css'), 'body { margin: 0; }');
    fs.writeFileSync(path.join(srcDir, '.vite', 'build', 'mainWindow.js'), 'console.log("main window");');

    await asar.createPackage(srcDir, asarPath);
    assert.equal(fs.existsSync(asarPath), true);

    const created = engine.createBackup(asarPath, backupPath);
    assert.equal(created, true);
    assert.equal(fs.existsSync(backupPath), true);

    engine.extractPackage(asarPath, extractDir);
    assert.equal(fs.existsSync(path.join(extractDir, '.vite', 'build', 'style.css')), true);

    engine.injectStylesAndRuntime(extractDir, { fontOnly: false });

    const injectedCss = fs.readFileSync(path.join(extractDir, '.vite', 'build', 'style.css'), 'utf8');
    const injectedJs = fs.readFileSync(path.join(extractDir, '.vite', 'build', 'mainWindow.js'), 'utf8');

    assert.match(injectedCss, /Vazirmatn/);
    assert.match(injectedCss, /\[dir="rtl"\]/);
    assert.match(injectedJs, /insertCSS/);
    assert.match(injectedJs, /KeyR/);

    await engine.repackPackage(extractDir, asarPath, '{*.node,*.dylib}');
    assert.equal(fs.existsSync(asarPath), true);

    fs.rmSync(asarPath);
    engine.restoreBackup(backupPath, asarPath);
    assert.equal(fs.existsSync(asarPath), true);

    const restoredExtractDir = path.join(tempTestRoot, 'restored-extract');
    engine.extractPackage(asarPath, restoredExtractDir);
    const restoredCss = fs.readFileSync(path.join(restoredExtractDir, '.vite', 'build', 'style.css'), 'utf8');
    assert.equal(restoredCss, 'body { margin: 0; }');

    fs.rmSync(tempTestRoot, { recursive: true, force: true });
});
