const test = require('node:test');
const assert = require('node:assert/strict');
const { disableAsarIntegrityFuse } = require('../lib/fuses');

test('disableAsarIntegrityFuse passes proper options to injected fusesLib', async () => {
    let capturedTarget = null;
    let capturedOpts = null;

    const mockFusesLib = async (target, opts) => {
        capturedTarget = target;
        capturedOpts = opts;
    };

    const mockFs = {
        existsSync: () => true,
        statSync: () => ({ isDirectory: () => false })
    };

    const res = await disableAsarIntegrityFuse('/mock/executable', { platform: 'darwin' }, {
        fusesLib: mockFusesLib,
        fileSystem: mockFs
    });

    assert.equal(res.skipped, false);
    assert.equal(capturedTarget, '/mock/executable');
    assert.equal(capturedOpts.resetAdHocDarwinSignature, true);
    assert.equal(capturedOpts[4], false); // EnableEmbeddedAsarIntegrityValidation
});
