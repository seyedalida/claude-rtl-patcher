const test = require('node:test');
const assert = require('node:assert/strict');
const { updateMacAsarIntegrity, reSignMacApp } = require('../lib/macos');

test('updateMacAsarIntegrity works with injected fileSystem and plistParser', () => {
    let writtenPath = null;
    let writtenData = null;

    const mockFs = {
        existsSync: (p) => true,
        readFileSync: (p) => p.endsWith('.asar') ? Buffer.from('dummy-asar-content') : 'plist-xml',
        writeFileSync: (p, data) => {
            writtenPath = p;
            writtenData = data;
        }
    };

    const mockPlist = {
        parse: () => ({
            ElectronAsarIntegrity: {
                'Resources/app.asar': { hash: 'oldhash' }
            }
        }),
        build: (parsed) => JSON.stringify(parsed)
    };

    const result = updateMacAsarIntegrity('/mock/app.asar', '/mock/Info.plist', {
        fileSystem: mockFs,
        plistParser: mockPlist
    });

    assert.equal(result, true);
    assert.equal(writtenPath, '/mock/Info.plist');
    const parsedWritten = JSON.parse(writtenData);
    assert.ok(parsedWritten.ElectronAsarIntegrity['Resources/app.asar'].hash);
    assert.notEqual(parsedWritten.ElectronAsarIntegrity['Resources/app.asar'].hash, 'oldhash');
});

test('reSignMacApp calls xattr and codesign with exact expected args via injected execFile', () => {
    const calls = [];
    const mockExecFile = (cmd, args) => {
        calls.push({ cmd, args });
    };

    reSignMacApp('/mock/Claude.app', { execFile: mockExecFile });

    assert.equal(calls.length, 4);
    assert.equal(calls[0].cmd, 'xattr');
    assert.deepEqual(calls[0].args, ['-cr', '/mock/Claude.app']);
    assert.equal(calls[1].cmd, 'codesign');
    assert.deepEqual(calls[1].args, ['--remove-signature', '--deep', '/mock/Claude.app']);
    assert.equal(calls[2].cmd, 'codesign');
    assert.deepEqual(calls[2].args, ['--force', '--deep', '--sign', '-', '/mock/Claude.app']);
    assert.equal(calls[3].cmd, 'codesign');
    assert.deepEqual(calls[3].args, ['--verify', '--deep', '--strict', '--verbose=2', '/mock/Claude.app']);
});
