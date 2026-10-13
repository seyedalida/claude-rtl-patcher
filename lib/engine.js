const fs = require('fs');
const path = require('path');
const asar = require('@electron/asar');
const crypto = require('crypto');
const plist = require('plist');

const { buildCssPayload } = require('./css');
const { getRuntimeScript } = require('./runtime');
const { computeUnpackGlob } = require('./unpack');
const macosDefault = require('./macos');
const fusesDefault = require('./fuses');

const isMacDefault = process.platform === 'darwin';

const BOOTSTRAP_JS_FILES = new Set([
    'mainView.js', 'mainWindow.js', 'buddy.js',
    'quickWindow.js', 'aboutWindow.js', 'findInPage.js'
]);

function createBackup(asarPath, backupPath, deps = {}) {
    const fileSystem = deps.fileSystem || fs;
    if (!fileSystem.existsSync(asarPath)) {
        throw new Error(`Target app.asar not found at: ${asarPath}`);
    }
    if (!fileSystem.existsSync(backupPath)) {
        fileSystem.copyFileSync(asarPath, backupPath);
        return true;
    }
    return false;
}

function restoreBackup(backupPath, asarPath, options = {}, deps = {}) {
    const fileSystem = deps.fileSystem || fs;
    const macos = deps.macos || macosDefault;
    const isMacPlatform = typeof options.isMac === 'boolean' ? options.isMac : isMacDefault;

    if (!fileSystem.existsSync(backupPath)) {
        throw new Error(`Backup not found at: ${backupPath}`);
    }
    fileSystem.copyFileSync(backupPath, asarPath);

    if (isMacPlatform && options.infoPlistPath && fileSystem.existsSync(options.infoPlistPath)) {
        try {
            macos.updateMacAsarIntegrity(asarPath, options.infoPlistPath, { fileSystem });
            if (options.appPath) macos.reSignMacApp(options.appPath);
        } catch (e) {}
    }
}

function extractPackage(sourcePath, extractDir, deps = {}) {
    const fileSystem = deps.fileSystem || fs;
    const asarLib = deps.asarLib || asar;

    if (fileSystem.existsSync(extractDir)) {
        fileSystem.rmSync(extractDir, { recursive: true, force: true });
    }
    fileSystem.mkdirSync(extractDir, { recursive: true });
    asarLib.extractAll(sourcePath, extractDir);
}

function injectStylesAndRuntime(extractDir, options = {}, deps = {}) {
    const fileSystem = deps.fileSystem || fs;
    const fontOnly = !!options.fontOnly;
    const cssPayload = buildCssPayload({ fontOnly, customFontBuffer: options.customFontBuffer });
    const runtimeScript = getRuntimeScript();

    const jsPayload = `
// Injected for Persian/Arabic/Hebrew support
try {
  const rootStyle = (typeof document !== "undefined" && document.documentElement) ? getComputedStyle(document.documentElement) : null;
  const alreadyLoaded = rootStyle && rootStyle.getPropertyValue('--claude-rtl-font-size');
  if (!alreadyLoaded) {
    require('electron/renderer').webFrame.insertCSS(${JSON.stringify(cssPayload)});
  }
  console.log("%c✨ ${fontOnly ? 'Vazirmatn font applied' : 'RTL applied'} by Rick Sanchez and Vazirmatn font used in memory of Saber Rastikerdar ✨", "color: #00e5ff; font-size: 14px; font-weight: bold; background: #222; padding: 5px; border-radius: 5px;");
  ${runtimeScript}
} catch(e) {}
`;

    const injectIntoDir = (dir) => {
        if (!fileSystem.existsSync(dir)) return;
        const entries = fileSystem.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                injectIntoDir(fullPath);
            } else if (entry.name.endsWith('.css')) {
                let content = fileSystem.readFileSync(fullPath, 'utf8');
                content = content.replace(/\/\*\s*RTL and Vazirmatn Font Patch[\s\S]*$/, '');
                content = content.replace(/\/\*\s*Vazirmatn Font Patch[\s\S]*$/, '');
                fileSystem.writeFileSync(fullPath, content.trimEnd() + '\n' + cssPayload);
            } else if (entry.name.endsWith('.js') && BOOTSTRAP_JS_FILES.has(entry.name)) {
                let content = fileSystem.readFileSync(fullPath, 'utf8');
                content = content.replace(/\/\/\s*Injected for Persian\/Arabic\/Hebrew support[\s\S]*$/, '');
                fileSystem.writeFileSync(fullPath, content.trimEnd() + '\n' + jsPayload);
            }
        }
    };

    injectIntoDir(path.join(extractDir, '.vite', 'build'));
    injectIntoDir(path.join(extractDir, '.vite', 'renderer'));
}

async function repackPackage(extractDir, destinationAsar, unpackGlob, deps = {}) {
    const asarLib = deps.asarLib || asar;
    await asarLib.createPackageWithOptions(extractDir, destinationAsar, { unpack: unpackGlob });
}

async function finalizeMacSecurity(appPath, asarPath, infoPlistPath, options = {}, deps = {}) {
    // Support options passed either as options object or direct deps
    const opts = (options && typeof options === 'object') ? options : {};
    const dependencies = (deps && Object.keys(deps).length > 0) ? deps : opts;
    const isMacPlatform = typeof opts.isMac === 'boolean' ? opts.isMac : isMacDefault;
    const fileSystem = dependencies.fileSystem || fs;
    const macos = dependencies.macos || macosDefault;
    const fuses = dependencies.fuses || fusesDefault;

    if (!isMacPlatform || !infoPlistPath || !fileSystem.existsSync(infoPlistPath)) return;

    macos.updateMacAsarIntegrity(asarPath, infoPlistPath, { fileSystem });
    await fuses.disableAsarIntegrityFuse(appPath, { platform: 'darwin' }, { fileSystem });
    macos.reSignMacApp(appPath);
}

module.exports = {
    createBackup,
    restoreBackup,
    extractPackage,
    injectStylesAndRuntime,
    repackPackage,
    finalizeMacSecurity,
    BOOTSTRAP_JS_FILES
};
