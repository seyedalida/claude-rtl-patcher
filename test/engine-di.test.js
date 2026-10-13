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
