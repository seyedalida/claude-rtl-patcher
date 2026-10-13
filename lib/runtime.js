const fs = require('fs');
const path = require('path');

function getRuntimeScript() {
    const corePath = path.join(__dirname, 'runtime-core.js');
    const coreSource = fs.readFileSync(corePath, 'utf8');

    return `
(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (window.__CLAUDE_RTL_INITIALIZED__) return;
    window.__CLAUDE_RTL_INITIALIZED__ = true;

    ${coreSource}

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initRuntime);
    } else {
        initRuntime();
    }
})();
    `.trim();
}

module.exports = { getRuntimeScript };
