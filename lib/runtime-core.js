const MODES = ["auto", "force", "disabled"];
const LABELS = {
    "auto": "✨ راست‌چین: خودکار (Auto RTL)",
    "force": "✨ راست‌چین: اجباری (Force RTL)",
    "disabled": "✨ راست‌چین: غیرفعال (Disabled)"
};

const RTL_REGEX = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const RTL_REGEX_GLOBAL = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g;
const LTR_REGEX = /[A-Za-z]/;
const LTR_REGEX_GLOBAL = /[A-Za-z]/g;

function isRTLContent(text, isForce = false) {
    if (isForce) return true;
    if (!text) return false;
    if (!RTL_REGEX.test(text)) return false;
    if (!LTR_REGEX.test(text)) return true;

    const rtlCount = (text.match(RTL_REGEX_GLOBAL) || []).length;
    const ltrCount = (text.match(LTR_REGEX_GLOBAL) || []).length;
    return rtlCount >= ltrCount * 0.35;
}

let updatePending = false;
let pendingScope = null;
let isSelecting = false;
let toastTimer = null;

function getConfig(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
    const defaults = {
        mode: "auto",
        fontSize: "16",
        lineHeight: "1.65",
        customFont: ""
    };
    try {
        if (!storage) return defaults;
        const raw = storage.getItem("claude_rtl_config");
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed) {
                if (MODES.includes(parsed.mode)) defaults.mode = parsed.mode;
                if (parsed.fontSize) defaults.fontSize = String(parsed.fontSize);
                if (parsed.lineHeight) defaults.lineHeight = String(parsed.lineHeight);
                if (typeof parsed.customFont === "string") defaults.customFont = parsed.customFont;
            }
        }
    } catch (e) {}
    return defaults;
}

function saveConfig(cfg, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
    try {
        if (!storage) return;
        storage.setItem("claude_rtl_config", JSON.stringify(cfg));
        storage.setItem("claude_rtl_mode", cfg.mode);
    } catch (e) {}
}

function applyTypographySettings(cfg, doc = (typeof document !== 'undefined' ? document : null)) {
    try {
        if (!doc || !doc.documentElement) return;
        const root = doc.documentElement;
        if (cfg.mode === "disabled") {
            root.style.removeProperty("--claude-rtl-font-size");
            root.style.removeProperty("--claude-rtl-line-height");
            root.style.removeProperty("--claude-rtl-custom-font");
            return;
        }
        root.style.setProperty("--claude-rtl-font-size", (cfg.fontSize || "16") + "px");
        root.style.setProperty("--claude-rtl-line-height", cfg.lineHeight || "1.65");
        if (cfg.customFont && cfg.customFont.trim()) {
            const cleanFont = cfg.customFont.replace(/['"]/g, "").trim();
            root.style.setProperty("--claude-rtl-custom-font", "'" + cleanFont + "', 'CustomPersianFont'");
        } else {
            root.style.removeProperty("--claude-rtl-custom-font");
        }
    } catch (e) {}
}

function isInsideProtectedElement(el) {
    if (!el || !el.closest) return false;
    return !!el.closest('nav, [role="navigation"], aside, header, pre, code, [class*="code-block" i], pre[class*="code__" i], code[class*="code__" i], [class*="group/copy"], [class*="epitaxy-codeblock" i], [class*="thinking" i], [class*="thought" i], [class*="reasoning" i], [class*="katex" i], .monaco-editor, button, [role="button"], [data-cds*="icon" i], [class*="icon" i], [class*="Icon"], [class*="lucide" i], [class*="codicon" i], [aria-hidden="true"], svg, #claude-rtl-widget');
}

function getProseText(el, doc = (typeof document !== 'undefined' ? document : null)) {
    if (!el.querySelector("pre, code, [class*='code-block' i], [class*='epitaxy-codeblock' i]")) {
        return (el.textContent || "").slice(0, 120).replace(/[​-‏﻿]/g, "").trim();
    }
    let text = "";
    try {
        if (doc && doc.createTreeWalker) {
            const walker = doc.createTreeWalker(el, 4 /* SHOW_TEXT */, {
                acceptNode: (node) => {
                    const parent = node.parentElement;
                    if (parent && parent.closest("pre, code, [class*='code-block' i], [class*='epitaxy-codeblock' i], [class*='group/copy']")) {
                        return 2 /* FILTER_REJECT */;
                    }
                    return 1 /* FILTER_ACCEPT */;
                }
            });
            let curr = walker.nextNode();
            while (curr) {
                text += curr.nodeValue;
                if (text.length >= 120) break;
                curr = walker.nextNode();
            }
        } else {
            text = (el.textContent || "").slice(0, 120);
        }
    } catch (e) {
        text = (el.textContent || "").slice(0, 120);
    }
    return text.replace(/[​-‏﻿]/g, "").trim();
}

function updateDir(scopeRoot) {
    const deps = arguments[1] || {};
    if (isSelecting) return;
    const doc = scopeRoot?.ownerDocument || (scopeRoot?.nodeType === 9 ? scopeRoot : (typeof document !== 'undefined' ? document : null));
    if (!doc) return;

    const storage = deps.localStorage || (typeof localStorage !== 'undefined' ? localStorage : null);
    const cfg = deps.config || getConfig(storage);
    if (cfg.mode === "disabled") {
        doc.querySelectorAll("[data-claude-dir], [dir]").forEach((el) => {
            if (el.getAttribute("data-claude-dir") || el.getAttribute("dir") === "rtl" || el.getAttribute("dir") === "ltr") {
                el.removeAttribute("dir");
                el.removeAttribute("data-claude-dir");
            }
        });
        return;
    }

    const isForce = (cfg.mode === "force");
    const root = (scopeRoot && scopeRoot.nodeType === 1 && scopeRoot.isConnected) ? scopeRoot : doc;

    const protectedRoots = root.querySelectorAll ? root.querySelectorAll(PROTECTED_ROOT_SELECTOR) : [];

    const codeSelector = 'pre, code, [class*="code-block" i], pre[class*="code__" i], code[class*="code__" i], [class*="group/copy"], [class*="epitaxy-codeblock" i]';
    if (root !== doc && root.matches && root.matches(codeSelector)) {
        if (root.getAttribute("dir") !== "ltr") {
            root.setAttribute("dir", "ltr");
            root.setAttribute("data-claude-dir", "ltr");
        }
    }
    const codeBlocks = root.querySelectorAll(codeSelector);
    for (let c = 0; c < codeBlocks.length; c++) {
        const cb = codeBlocks[c];
        if (cb.getAttribute("dir") !== "ltr") {
            cb.setAttribute("dir", "ltr");
            cb.setAttribute("data-claude-dir", "ltr");
        }
    }

    const userMessageContainers = root.querySelectorAll('[data-cds="UserMessage"], [data-testid="user-message"]');
    for (let u = 0; u < userMessageContainers.length; u++) {
        const um = userMessageContainers[u];
        if (um.getAttribute("dir") !== "ltr") {
            um.setAttribute("dir", "ltr");
            um.setAttribute("data-claude-dir", "ltr");
        }
    }

    const textSelector = 'p, li, h1, h2, h3, h4, h5, h6, th, td, blockquote, .cds-user-message-body, .font-user-message, [contenteditable="true"] p, [contenteditable="true"]';
    const elements = [];
    if (root !== doc && root.matches && root.matches(textSelector)) {
        elements.push(root);
    }
    const queried = root.querySelectorAll(textSelector);
    for (let q = 0; q < queried.length; q++) {
        elements.push(queried[q]);
    }

    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        let underProtectedRoot = false;
        for (let s = 0; s < protectedRoots.length; s++) {
            if (protectedRoots[s] === el || (protectedRoots[s].contains && protectedRoots[s].contains(el))) {
                underProtectedRoot = true;
                break;
            }
        }
        if (underProtectedRoot) continue;
        if (isInsideProtectedElement(el)) continue;

        if (!el.isContentEditable && el.getAttribute("data-claude-dir") && !isForce) {
            continue;
        }

        const text = getProseText(el, doc);
        if (!text) continue;

        const isRTL = isRTLContent(text, isForce);
        const targetDir = isRTL ? "rtl" : "ltr";

        if (el.getAttribute("dir") !== targetDir) {
            el.setAttribute("dir", targetDir);
            el.setAttribute("data-claude-dir", targetDir);
        }

        if ((el.tagName === 'TH' || el.tagName === 'TD') && isRTL) {
            const parentTable = el.closest('table');
            if (parentTable && parentTable.getAttribute('dir') !== 'rtl') {
                parentTable.setAttribute('dir', 'rtl');
                parentTable.setAttribute('data-claude-dir', 'rtl');
            }
        }
        if (el.tagName === "LI" && isRTL) {
            const parentList = el.parentElement;
            if (parentList && (parentList.tagName === "UL" || parentList.tagName === "OL")) {
                if (parentList.getAttribute("dir") !== "rtl") {
                    parentList.setAttribute("dir", "rtl");
                    parentList.setAttribute("data-claude-dir", "rtl");
                }
            }
        }
    }
}

function scheduleUpdateDir(scope) {
    if (isSelecting) return;
    if (scope && pendingScope) {
        if (pendingScope !== scope) {
            pendingScope = (pendingScope.contains && pendingScope.contains(scope))
                ? pendingScope
                : ((scope.contains && scope.contains(pendingScope)) ? scope : null);
        }
    } else if (scope) {
        pendingScope = scope;
    } else {
        pendingScope = null;
    }

    if (updatePending) return;
    updatePending = true;
    if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => {
            updatePending = false;
            const scopeToRun = pendingScope;
            pendingScope = null;
            updateDir(scopeToRun);
        });
    } else {
        setTimeout(() => {
            updatePending = false;
            const scopeToRun = pendingScope;
            pendingScope = null;
            updateDir(scopeToRun);
        }, 50);
    }
}

function applyMode(mode, showToastNotification = false, deps = {}) {
    try {
        const storage = deps.localStorage || (typeof localStorage !== 'undefined' ? localStorage : null);
        const doc = deps.document || (typeof document !== 'undefined' ? document : null);
        const cfg = getConfig(storage);
        cfg.mode = mode;
        saveConfig(cfg, storage);
        if (doc && doc.documentElement) {
            doc.documentElement.setAttribute("data-claude-rtl", mode);
        }
        applyTypographySettings(cfg, doc);
        updateDir(doc, { localStorage: storage, config: cfg });
        syncWidgetUI();
        if (showToastNotification) showToast(LABELS[mode] || mode);
    } catch (e) {}
}

function showToast(text) {
    try {
        if (typeof document === 'undefined') return;
        const id = "claude-rtl-toast";
        let toast = document.getElementById(id);
        if (!toast) {
            toast = document.createElement("div");
            toast.id = id;
            toast.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);background:rgba(22,27,34,0.92);color:#58a6ff;padding:8px 18px;border-radius:24px;font-size:13px;font-weight:600;font-family:Vazirmatn,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,0.35);border:1px solid rgba(88,166,255,0.25);backdrop-filter:blur(8px);z-index:999999;pointer-events:none;opacity:0;transition:opacity 0.25s ease,transform 0.25s ease;direction:rtl;";
            document.body.appendChild(toast);
        }
        toast.textContent = text;
        toast.style.opacity = "1";
        toast.style.transform = "translateX(-50%) translateY(0)";
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateX(-50%) translateY(20px)";
        }, 1600);
    } catch (e) {}
}

function createFloatingWidget() {
    if (typeof document === 'undefined') return;
    if (document.getElementById("claude-rtl-widget")) return;
    const widget = document.createElement("div");
    widget.id = "claude-rtl-widget";
    widget.innerHTML = '<div id="claude-rtl-widget-btn" title="تنظیمات فونت و راست‌چین (Alt + R)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg></div><div id="claude-rtl-widget-panel"><div style="font-size:13px;font-weight:700;color:#58a6ff;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:6px;display:flex;justify-content:space-between;align-items:center;"><span>تنظیمات راست‌چین</span><span style="font-size:10px;opacity:0.6;font-weight:normal;">Alt + R</span></div><div class="claude-rtl-row"><span class="claude-rtl-label">حالت چیدمان:</span><select id="claude-rtl-mode-select" class="claude-rtl-select"><option value="auto">خودکار (Auto)</option><option value="force">اجباری (Force)</option><option value="disabled">غیرفعال (Off)</option></select></div><div class="claude-rtl-row"><span class="claude-rtl-label">اندازه قلم (<span id="claude-rtl-fs-val">16</span>px):</span><input id="claude-rtl-fs-slider" type="range" min="13" max="24" step="1" class="claude-rtl-slider"></div><div class="claude-rtl-row"><span class="claude-rtl-label">فاصله خطوط (<span id="claude-rtl-lh-val">1.65</span>):</span><input id="claude-rtl-lh-slider" type="range" min="1.3" max="2.4" step="0.05" class="claude-rtl-slider"></div><div class="claude-rtl-row"><span class="claude-rtl-label">فونت دلخواه:</span><input id="claude-rtl-font-input" type="text" placeholder="پیش‌فرض: Vazirmatn" class="claude-rtl-input" style="width:120px;"></div></div>';
    document.body.appendChild(widget);

    const btn = document.getElementById("claude-rtl-widget-btn");
    if (btn) {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            widget.classList.toggle("is-open");
        });
    }

    document.addEventListener("click", (e) => {
        if (!widget.contains(e.target)) {
            widget.classList.remove("is-open");
        }
    });

    const modeSelect = document.getElementById("claude-rtl-mode-select");
    const fsSlider = document.getElementById("claude-rtl-fs-slider");
    const fsVal = document.getElementById("claude-rtl-fs-val");
    const lhSlider = document.getElementById("claude-rtl-lh-slider");
    const lhVal = document.getElementById("claude-rtl-lh-val");
    const fontInput = document.getElementById("claude-rtl-font-input");

    if (modeSelect) {
        modeSelect.addEventListener("change", (e) => {
            applyMode(e.target.value, true);
        });
    }

    if (fsSlider) {
        fsSlider.addEventListener("input", (e) => {
            if (fsVal) fsVal.textContent = e.target.value;
            const cfg = getConfig();
            cfg.fontSize = e.target.value;
            saveConfig(cfg);
            applyTypographySettings(cfg);
        });
    }

    if (lhSlider) {
        lhSlider.addEventListener("input", (e) => {
            if (lhVal) lhVal.textContent = e.target.value;
            const cfg = getConfig();
            cfg.lineHeight = e.target.value;
            saveConfig(cfg);
            applyTypographySettings(cfg);
        });
    }

    if (fontInput) {
        fontInput.addEventListener("change", (e) => {
            const cfg = getConfig();
            cfg.customFont = e.target.value.trim();
            saveConfig(cfg);
            applyTypographySettings(cfg);
            showToast("قلم به‌روزرسانی شد ✨");
        });
    }

    syncWidgetUI();
}

function syncWidgetUI() {
    if (typeof document === 'undefined') return;
    const cfg = getConfig();
    const modeSelect = document.getElementById("claude-rtl-mode-select");
    const fsSlider = document.getElementById("claude-rtl-fs-slider");
    const fsVal = document.getElementById("claude-rtl-fs-val");
    const lhSlider = document.getElementById("claude-rtl-lh-slider");
    const lhVal = document.getElementById("claude-rtl-lh-val");
    const fontInput = document.getElementById("claude-rtl-font-input");

    if (modeSelect) modeSelect.value = cfg.mode;
    if (fsSlider) fsSlider.value = cfg.fontSize || "16";
    if (fsVal) fsVal.textContent = cfg.fontSize || "16";
    if (lhSlider) lhSlider.value = cfg.lineHeight || "1.65";
    if (lhVal) lhVal.textContent = cfg.lineHeight || "1.65";
    if (fontInput) fontInput.value = cfg.customFont || "";
}

const JUNK_CONTAINER_SELECTOR = 'pre, code, kbd, samp, .monaco-editor, .cm-editor, .xterm, [class*="group/copy"], [class*="epitaxy-codeblock" i], [class*="katex" i], nav, aside, header, button, svg, #claude-rtl-widget, #claude-rtl-widget *, #claude-rtl-toast, #claude-rtl-toast *';

const PROTECTED_ROOT_SELECTOR = 'pre, code, .monaco-editor, .cm-editor, [class*="group/copy"], [class*="epitaxy-codeblock" i]';

function shouldSkipMutationBatch(mutations) {
    if (!mutations || mutations.length === 0) return true;
    let sawContent = false;
    for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        const added = m.addedNodes || [];
        for (let j = 0; j < added.length; j++) {
            const node = added[j];
            if (!node || node.nodeType !== 1) {
                sawContent = true;
                continue;
            }
            if (node.closest && node.closest(JUNK_CONTAINER_SELECTOR)) continue;
            sawContent = true;
        }
    }
    return !sawContent;
}

function setupShortcuts() {
    if (typeof document === 'undefined') return;
    document.addEventListener("keydown", (e) => {
        if (e.altKey && (e.code === "KeyR" || e.key === "r" || e.key === "R" || e.key === "ق")) {
            e.preventDefault();
            const cfg = getConfig();
            const nextIndex = (MODES.indexOf(cfg.mode) + 1) % MODES.length;
            applyMode(MODES[nextIndex], true);
            return;
        }

        if (e.code === "Digit2" && e.shiftKey && (e.key === "٬" || e.key === "،" || e.key === "‚")) {
            e.preventDefault();
            if (typeof document.execCommand === "function") {
                document.execCommand("insertText", false, "@");
            }
        }
    }, { capture: true });

    document.addEventListener("mousedown", () => {
        isSelecting = true;
    }, { capture: true, passive: true });

    document.addEventListener("mouseup", () => {
        isSelecting = false;
        setTimeout(() => {
            if (!isSelecting) scheduleUpdateDir();
        }, 60);
    }, { capture: true, passive: true });

    if (document.body) {
        document.body.addEventListener("input", (e) => {
            const target = e.target;
            if (target && (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
                const cfg = getConfig();
                if (cfg.mode === "disabled") return;
                const text = (target.textContent || target.value || "").trim();
                if (text) {
                    const isRTL = isRTLContent(text, cfg.mode === "force");
                    target.setAttribute("dir", isRTL ? "rtl" : "ltr");
                }
            }
        }, { capture: true, passive: true });
    }

    if (typeof MutationObserver !== "undefined") {
        let activeTarget = null;
        const observer = new MutationObserver((mutations) => {
            let hasNewElements = false;
            let targetScope = null;

            if (shouldSkipMutationBatch(mutations)) return;

            for (let i = 0; i < mutations.length; i++) {
                const m = mutations[i];
                if (m.target && m.target.closest && m.target.closest('#claude-rtl-widget, #claude-rtl-toast')) {
                    continue;
                }
                if (m.addedNodes.length > 0) {
                    const mainContainer = document.querySelector('main, [role="main"]');
                    if (mainContainer && activeTarget !== mainContainer) {
                        retargetObserver();
                    }
                    hasNewElements = true;
                    if (!targetScope && m.target && m.target.closest) {
                        targetScope = m.target.closest('[data-testid*="message"], [data-cds*="Message"], .font-claude-response-body, article') || m.target;
                    }
                    break;
                }
            }
            if (hasNewElements) scheduleUpdateDir(targetScope);
        });

        function retargetObserver() {
            const target = document.querySelector('main, [role="main"]') || document.getElementById('root') || document.body;
            if (target && target !== activeTarget) {
                observer.disconnect();
                activeTarget = target;
                observer.observe(target, { childList: true, subtree: true });
            }
        }

        retargetObserver();
    }
}

function initRuntime() {
    const cfg = getConfig();
    applyTypographySettings(cfg);
    applyMode(cfg.mode, false);
    setupShortcuts();
    createFloatingWidget();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MODES,
        LABELS,
        RTL_REGEX,
        RTL_REGEX_GLOBAL,
        LTR_REGEX,
        LTR_REGEX_GLOBAL,
        isRTLContent,
        getConfig,
        saveConfig,
        applyTypographySettings,
        isInsideProtectedElement,
        getProseText,
        updateDir,
        shouldSkipMutationBatch,
        scheduleUpdateDir,
        applyMode,
        showToast,
        createFloatingWidget,
        syncWidgetUI,
        setupShortcuts,
        initRuntime
    };
}
