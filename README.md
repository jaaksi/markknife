# MarkKnife

🇺🇸 [English](README.md) | 🇨🇳 [简体中文](README.zh-CN.md)

A clean, fast **Markdown viewer & editor** for the desktop — built on a [Tolaria](https://github.com/refactoringhq/tolaria) fork.

Open Markdown files in tabs and read or edit them in whichever way suits the moment: a polished read-only render, a live WYSIWYG editor, or a side-by-side source/preview split. Math (KaTeX), diagrams (Mermaid), code highlighting, and images all just work.

<p>
  <img src="docs/images/screenshot.png" alt="MarkKnife screenshot" width="800">
</p>

## Features

- **Three view modes**, switchable per file:
  - **View** — read-only rich-text render
  - **WYSIWYG** — editable rich text (the default when you open a file)
  - **Split** — CodeMirror source on one side, live read-only preview on the other (orientation configurable)
- **Multi-tab** editing — open many files at once; drag a tab out into its own window.
- **Auto-save** — changes are written back to disk automatically (debounced).
- **Outline (TOC)** panel with scroll-spy, click-to-jump, and collapsible tree.
- **In-document search** (`Cmd/Ctrl+F`).
- **Math & diagrams** — KaTeX formulas, Mermaid diagrams, syntax-highlighted code blocks, inline images.
- **Customizable** reading width / font size / line height, configurable shortcuts, and **English / 简体中文** UI.
- **Native niceties** — open `.md`/`.markdown` via the OS "Open With", recent-files start page, and silent auto-update.

## Install

Download the latest build for your platform from the **[releases page](https://github.com/jaaksi/markknife/releases/latest)**.

### macOS

Open the `.dmg` and drag **MarkKnife** into your Applications folder.

The app is **not notarized** (the project has no Apple Developer account), so on first launch Gatekeeper will block it ("damaged" or "unidentified developer"). Allow it once with any of the following — auto-update keeps working afterwards:

- **Right-click** the app → **Open**, then click **Open** again in the dialog;
- On Sequoia 15+: after the block, go to **System Settings → Privacy & Security** and click **Open Anyway** at the bottom;
- Or run in a terminal: `xattr -dr com.apple.quarantine /Applications/MarkKnife.app`

### Windows

Download the installer (`.msi`/`.exe`) from the releases page and run it.

## Development

```bash
pnpm install
pnpm dev         # Browser dev (uses an in-app Tauri mock; no native features)
pnpm tauri dev   # Native app dev
pnpm build       # tsc -b && vite build
pnpm lint        # eslint (must be 0 warnings)
pnpm tauri build # Produce a packaged build (.dmg etc.)
```

Tech stack: **Tauri 2 (Rust) + React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui**, with **BlockNote** for rich text, **CodeMirror 6** for source editing, **KaTeX** for math, and **Mermaid** for diagrams.

> Contributing? See [CLAUDE.md](CLAUDE.md) for the architecture overview and conventions.

## Acknowledgements

Built as a trimmed-down fork of **Tolaria** by Luca Ronin (MIT). Many thanks to the original project.

## License

[AGPL-3.0-or-later](LICENSE).
