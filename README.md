<div align="center">
  <img src="./assets/preview.png" alt="Claude RTL Patcher Preview" width="100%">
  
  <h1>Claude RTL Patcher</h1>
  <p><strong>Clean Persian typography and Right-to-Left (RTL) support for Claude Desktop.</strong></p>

  [![npm version](https://img.shields.io/npm/v/@seyedalida/claude-rtl-patcher?color=blue)](https://www.npmjs.com/package/@seyedalida/claude-rtl-patcher)
  [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
  [![GitHub stars](https://img.shields.io/github/stars/seyedalida/claude-rtl-patcher?style=flat&color=yellow)](https://github.com/seyedalida/claude-rtl-patcher/stargazers)

  [نسخه فارسی](./README-FA.md)
</div>

---

**Claude RTL Patcher** brings native Right-to-Left (RTL) text layout, the modern **Vazirmatn** font, and an in-app settings widget to the official **Claude Desktop** application on **macOS**, **Windows**, and **Linux**.

It solves text alignment issues in Persian without touching your chat history or account credentials, while keeping code blocks, monospace text, and markdown formatting fully intact.

---

## Installation

Run this single command in your terminal (Terminal / PowerShell / CMD):

```bash
npx @seyedalida/claude-rtl-patcher
```

Follow the prompt, then restart Claude (`Cmd + Q` or `Ctrl + Q`).

> **Windows Note:** If Claude was installed via the Microsoft Store, use the standard installer from [claude.ai/download](https://claude.ai/download).

To restore Claude to its original unpatched state at any time:

```bash
npx @seyedalida/claude-rtl-patcher --restore
```

---

## Features

- **In-App Settings Widget:** A floating widget in the bottom-right corner of Claude to adjust font size, line height, switch layouts, or apply any custom system font in real time.
- **Vazirmatn Variable Font:** Clean, modern typography with natural weights (`100`–`900`). Uses local system fonts when installed.
- **Smart Direction:** Automatically detects language per paragraph without flipping English prose or code blocks.
- **Developer-Friendly:** Code blocks, syntax highlighting, monospace font, math equations (KaTeX), and thinking blocks remain strictly left-to-right (LTR).
- **Proportional Headings:** Headings (`h1`–`h6`) are scaled properly so subheadings always remain readable.
- **Shortcuts & Fixes:**
  - `Alt + R`: Quick-toggle between Auto, Force RTL, and Disabled modes.
  - `Shift + 2`: Types `@` directly on Persian keyboard layouts instead of `٬`.

---

## Command Line Options

```bash
npx @seyedalida/claude-rtl-patcher [options] [path_to_claude]
```

| Option | Description |
|---|---|
| *(none)* | Interactive auto-detection and setup. |
| `--restore` | Restores original unpatched backup. |
| `--font-only` | Applies Vazirmatn font only without forcing RTL direction. |
| `--full` | Forces full RTL patch regardless of Claude version. |
| `--yes`, `-y` | Skips confirmation prompts. |

---

## License & Credits

- Released under the [MIT License](./LICENSE).
- Based on the original [claude-rtl-patcher](https://github.com/m4tinbeigi-official/claude-rtl-patcher) project by [Matin Beigi](https://github.com/m4tinbeigi-official).
- Font: [Vazirmatn](https://github.com/rastikerdar/vazirmatn) by the late Saber Rastikerdar (OFL).
