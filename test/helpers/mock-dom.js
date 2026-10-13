class MockElement {
    constructor(tagName, ownerDocument = null) {
        this.tagName = tagName.toUpperCase();
        this.nodeType = 1;
        this.attributes = new Map();
        this.children = [];
        this.parentElement = null;
        this.ownerDocument = ownerDocument;
        this._textContent = '';
        this.style = {
            _props: new Map(),
            setProperty(name, val) { this._props.set(name, String(val)); },
            getPropertyValue(name) { return this._props.get(name) || ''; },
            removeProperty(name) { this._props.delete(name); }
        };
        this.classList = {
            _set: new Set(),
            add: (...cls) => cls.forEach(c => this.classList._set.add(c)),
            remove: (...cls) => cls.forEach(c => this.classList._set.delete(c)),
            toggle: (c) => this.classList._set.has(c) ? (this.classList._set.delete(c), false) : (this.classList._set.add(c), true),
            contains: (c) => this.classList._set.has(c)
        };
        this._listeners = new Map();
    }

    get isConnected() {
        let curr = this.parentElement;
        while (curr) {
            if (curr.nodeType === 9) return true;
            curr = curr.parentElement;
        }
        return false;
    }

    get id() {
        return this.getAttribute('id') || '';
    }

    set id(val) {
        this.setAttribute('id', val);
    }

    get textContent() {
        if (this.children.length > 0) {
            return this.children.map(c => c.textContent).join('');
        }
        return this._textContent;
    }

    set textContent(val) {
        this._textContent = String(val);
        this.children = [];
    }

    getAttribute(name) {
        return this.attributes.get(name.toLowerCase()) ?? null;
    }

    setAttribute(name, val) {
        const lower = name.toLowerCase();
        this.attributes.set(lower, String(val));
        if (lower === 'class') {
            this.classList._set = new Set(String(val).split(/\s+/).filter(Boolean));
        }
    }

    removeAttribute(name) {
        this.attributes.delete(name.toLowerCase());
    }

    hasAttribute(name) {
        return this.attributes.has(name.toLowerCase());
    }

    appendChild(child) {
        if (!child) return child;
        child.parentElement = this;
        this.children.push(child);
        return child;
    }

    removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx !== -1) {
            this.children.splice(idx, 1);
            child.parentElement = null;
        }
        return child;
    }

    contains(el) {
        if (!el) return false;
        if (el === this) return true;
        let curr = el.parentElement;
        while (curr) {
            if (curr === this) return true;
            curr = curr.parentElement;
        }
        return false;
    }

    matches(selector) {
        if (!selector) return false;
        const sel = selector.trim();
        if (sel === '*') return true;
        if (sel.startsWith('#')) return this.id === sel.slice(1);
        if (sel.startsWith('.')) return this.classList.contains(sel.slice(1));
        if (sel.toUpperCase() === this.tagName) return true;
        if (sel.startsWith('[') && sel.endsWith(']')) {
            const inner = sel.slice(1, -1);
            if (inner.includes('=')) {
                const [attr, val] = inner.split('=');
                const cleanVal = val.replace(/['"]/g, '');
                return this.getAttribute(attr) === cleanVal;
            }
            return this.hasAttribute(inner);
        }
        return false;
    }

    closest(selector) {
        let curr = this;
        while (curr && curr.nodeType === 1) {
            if (curr.matches(selector)) return curr;
            curr = curr.parentElement;
        }
        return null;
    }

    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }

    querySelectorAll(selector) {
        const results = [];
        const traverse = (node) => {
            for (const child of node.children) {
                if (child.matches(selector)) results.push(child);
                traverse(child);
            }
        };
        traverse(this);
        return results;
    }

    addEventListener(event, fn) {
        if (!this._listeners.has(event)) this._listeners.set(event, []);
        this._listeners.get(event).push(fn);
    }

    dispatchEvent(eventObj) {
        const list = this._listeners.get(eventObj.type) || [];
        for (const fn of list) fn(eventObj);
    }
}

class MockDocument {
    constructor() {
        this.nodeType = 9;
        this.documentElement = new MockElement('html', this);
        this.body = new MockElement('body', this);
        this.documentElement.appendChild(this.body);
    }

    createElement(tagName) {
        return new MockElement(tagName, this);
    }

    getElementById(id) {
        return this.querySelector(`#${id}`);
    }

    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }

    querySelectorAll(selector) {
        const results = [];
        const traverse = (node) => {
            if (node.matches && node.matches(selector)) results.push(node);
            for (const child of node.children || []) {
                traverse(child);
            }
        };
        traverse(this.documentElement);
        return results;
    }

    addEventListener(event, fn) {
        this.documentElement.addEventListener(event, fn);
    }

    createTreeWalker(root, whatToShow, filter) {
        const textNodes = [];
        const collect = (el) => {
            if (filter && filter.acceptNode && el !== root) {
                const res = filter.acceptNode(el);
                if (res === 2) return; // FILTER_REJECT
            }
            if (el._textContent) {
                textNodes.push({ nodeValue: el._textContent, parentElement: el });
            }
            for (const child of el.children) {
                collect(child);
            }
        };
        collect(root);
        let idx = 0;
        return {
            nextNode() {
                if (idx < textNodes.length) return textNodes[idx++];
                return null;
            }
        };
    }
}

class MockLocalStorage {
    constructor() { this.store = new Map(); }
    getItem(k) { return this.store.get(k) ?? null; }
    setItem(k, v) { this.store.set(k, String(v)); }
    removeItem(k) { this.store.delete(k); }
    clear() { this.store.clear(); }
}

function parseSimpleHtml(html, document) {
    // Very lightweight parser for simple nested mock elements in tests
    const tagRegex = /<\/?([a-zA-Z0-9_-]+)([^>]*)>/g;
    let stack = [document.body];
    let lastIndex = 0;
    let match;

    while ((match = tagRegex.exec(html)) !== null) {
        const textBefore = html.slice(lastIndex, match.index).trim();
        if (textBefore && stack.length > 0) {
            stack[stack.length - 1].textContent = textBefore;
        }

        const isClosing = match[0].startsWith('</');
        const tagName = match[1];
        const rawAttrs = match[2];

        if (isClosing) {
            if (stack.length > 1 && stack[stack.length - 1].tagName.toLowerCase() === tagName.toLowerCase()) {
                stack.pop();
            }
        } else {
            const el = document.createElement(tagName);
            const attrRegex = /([a-zA-Z0-9_-]+)(?:=["']([^"']*)["'])?/g;
            let attrMatch;
            while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
                if (attrMatch[1]) el.setAttribute(attrMatch[1], attrMatch[2] || '');
            }
            stack[stack.length - 1].appendChild(el);
            if (!match[0].endsWith('/>')) {
                stack.push(el);
            }
        }
        lastIndex = tagRegex.lastIndex;
    }
}

function createMockWindow(initialHtml = '') {
    const doc = new MockDocument();
    if (initialHtml) parseSimpleHtml(initialHtml, doc);

    const win = {
        document: doc,
        localStorage: new MockLocalStorage(),
        requestAnimationFrame(fn) { return setTimeout(fn, 0); },
        addEventListener(event, fn) { doc.addEventListener(event, fn); }
    };

    return { window: win, document: doc, localStorage: win.localStorage };
}

module.exports = {
    MockElement,
    MockDocument,
    MockLocalStorage,
    createMockWindow
};
