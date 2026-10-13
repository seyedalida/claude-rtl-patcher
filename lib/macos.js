const fs = require('fs');
const crypto = require('crypto');
const plist = require('plist');
const { execFileSync } = require('child_process');

function updateMacAsarIntegrity(asarPath, infoPlistPath, deps = {}) {
    const fileSystem = deps.fileSystem || fs;
    const plistParser = deps.plistParser || plist;
    const cryptoLib = deps.cryptoLib || crypto;

    if (!fileSystem.existsSync(asarPath) || !fileSystem.existsSync(infoPlistPath)) return false;
    const fileBuffer = fileSystem.readFileSync(asarPath);
    const newHash = cryptoLib.createHash('sha256').update(fileBuffer).digest('hex');
    const plistData = fileSystem.readFileSync(infoPlistPath, 'utf8');
    const parsed = plistParser.parse(plistData);

    if (parsed?.ElectronAsarIntegrity?.['Resources/app.asar']) {
        parsed.ElectronAsarIntegrity['Resources/app.asar'].hash = newHash;
        fileSystem.writeFileSync(infoPlistPath, plistParser.build(parsed));
        return true;
    }
    return false;
}

function reSignMacApp(appPath, options = {}) {
    // Support either reSignMacApp(appPath, customExecFile) or reSignMacApp(appPath, { execFile })
    const execFile = typeof options === 'function' ? options : (options.execFile || execFileSync);

    execFile('xattr', ['-cr', appPath], { stdio: 'pipe' });

    try {
        execFile('codesign', ['--remove-signature', '--deep', appPath], { stdio: 'pipe' });
    } catch (e) {
        // non-fatal — some items may not have had a signature to remove
    }

    execFile('codesign', [
        '--force',
        '--deep',
        '--sign',
        '-',
        appPath
    ], { stdio: 'pipe' });
    execFile('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], {
        stdio: 'pipe'
    });
}

module.exports = { updateMacAsarIntegrity, reSignMacApp };
