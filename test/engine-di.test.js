const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../lib/engine');

test('engine.createBackup uses injected fileSystem', () => {
    let copiedSource = null;
    let copiedDest = null;

    const mockFs = {
        existsSync: (p) => p === '/mock/app.asar',
        copyFileSync: (src, dest) => {
            copiedSource = src;
            copiedDest = dest;
        }
    };

    const res = engine.createBackup('/mock/app.asar', '/mock/app.asar.bak', { fileSystem: mockFs });
    assert.equal(res, true);
    assert.equal(copiedSource, '/mock/app.asar');
    assert.equal(copiedDest, '/mock/app.asar.bak');
});

test('engine.restoreBackup calls updateMacAsarIntegrity and reSignMacApp when provided in DI', () => {
    let integrityCalled = false;
    let resignCalled = false;
    let copied = false;

    const mockFs = {
        existsSync: () => true,
        copyFileSync: () => { copied = true; }
    };
    const mockMacos = {
        updateMacAsarIntegrity: () => { integrityCalled = true; },
        reSignMacApp: () => { resignCalled = true; }
    };

    engine.restoreBackup('/mock/bak', '/mock/asar', {
        infoPlistPath: '/mock/Info.plist',
        appPath: '/mock/Claude.app',
        isMac: true
    }, { fileSystem: mockFs, macos: mockMacos });

    assert.equal(copied, true);
    assert.equal(integrityCalled, true);
    assert.equal(resignCalled, true);
});

test('engine.finalizeMacSecurity executes macos and fuses routines via DI', async () => {
    let integrityPassed = false;
    let fusePassed = false;
    let resignPassed = false;

    const mockFs = {
        existsSync: () => true
    };
    const mockMacos = {
        updateMacAsarIntegrity: () => { integrityPassed = true; },
        reSignMacApp: () => { resignPassed = true; }
    };
    const mockFuses = {
        disableAsarIntegrityFuse: async () => { fusePassed = true; }
    };

    await engine.finalizeMacSecurity('/mock/Claude.app', '/mock/asar', '/mock/Info.plist', {
        isMac: true,
        fileSystem: mockFs,
        macos: mockMacos,
        fuses: mockFuses
    });

    assert.equal(integrityPassed, true);
    assert.equal(fusePassed, true);
    assert.equal(resignPassed, true);
});

test('engine.injectStylesAndRuntime cleans renderer CSS files and avoids redundant payload duplication', () => {
    const path = require('path');
    const writtenFiles = new Map();
    const mockFs = {
        existsSync: (p) => true,
        readdirSync: (dir) => {
            if (dir.endsWith('renderer')) return [{ name: 'main_window', isDirectory: () => true }];
            if (dir.endsWith('main_window')) return [{ name: 'page.css', isDirectory: () => false }];
            if (dir.endsWith('build')) return [{ name: 'mainView.js', isDirectory: () => false }];
            return [];
        },
        readFileSync: (p) => {
            if (p.endsWith('page.css')) return 'body { margin: 0; } /* RTL and Vazirmatn Font Patch */ old content';
            if (p.endsWith('mainView.js')) return 'console.log("init");';
            return '';
        },
        writeFileSync: (p, data) => { writtenFiles.set(p, data); }
    };

    engine.injectStylesAndRuntime('/mock/extract', { fontOnly: false }, { fileSystem: mockFs });

    const updatedCss = writtenFiles.get(path.join('/mock/extract', '.vite', 'renderer', 'main_window', 'page.css'));
    assert.ok(updatedCss);
    assert.equal(updatedCss.includes('Vazirmatn Font Patch'), false, 'Renderer CSS should be cleaned of redundant patch payload');
    assert.equal(updatedCss.trim(), 'body { margin: 0; }');

    const updatedJs = writtenFiles.get(path.join('/mock/extract', '.vite', 'build', 'mainView.js'));
    assert.ok(updatedJs);
    assert.ok(updatedJs.includes('webFrame.insertCSS'));
});
