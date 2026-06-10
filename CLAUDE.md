# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**MarkKnife** 是一个跨平台 **Markdown 查看 / 编辑桌面应用**,基于开源项目 [Tolaria](https://github.com/refactoringhq/tolaria) 二次开发。

技术栈:**Tauri 2(Rust 后端)+ React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui**。
富文本用 **BlockNote**,源码编辑用 **CodeMirror 6**,数学公式 **KaTeX**,图表 **Mermaid**,代码高亮 **Shiki / lezer**。

应用是**多标签**的,共三种查看 / 编辑模式:

- **查看(`view`)** — BlockNote 只读富文本渲染
- **所见即所得(`wysiwyg`)** — BlockNote 可编辑富文本(打开文件的默认模式)
- **分栏(`split`)** — 左 CodeMirror 源码 + 右只读预览(方向可在设置里调)

## 开发命令

```bash
pnpm dev            # 浏览器开发(走 src/mock-tauri 的 mock,无原生能力;Vite 端口 5202)
pnpm tauri dev      # 原生应用开发(beforeDevCommand 会自动起 pnpm dev)
pnpm build          # tsc -b && vite build
pnpm lint           # eslint . --max-warnings=0(必须 0 警告)
pnpm tauri build    # 打包(dmg 等需在你自己的终端里跑)
pnpm l10n:validate  # 校验 src/lib/locales/*.json(Tolaria 遗留 i18n,非 markdown-app 自带 i18n)
```

Rust 侧:

```bash
cargo test  --manifest-path=src-tauri/Cargo.toml                      # 运行 Rust 单元测试(src-tauri 内有 #[cfg(test)])
cargo clippy --manifest-path=src-tauri/Cargo.toml -- -D warnings      # 0 警告
cargo fmt   --manifest-path=src-tauri/Cargo.toml -- --check
```

## 提交前自查(无自动门禁)

本项目**没有任何 CI / pre-commit / pre-push 钩子**——提交前请手动跑检查,不要把红着的改动推上去:

- 改了前端(`.ts/.tsx`):`pnpm lint`(0 警告)+ `npx tsc --noEmit`;push 前再跑一次 `pnpm build`
- 改了 `src-tauri/`:`cargo clippy ... -- -D warnings` + `cargo fmt ... --check`(+ 必要时 `cargo test`)

提交规范前缀:`feat:` / `fix:` / `opt:`(优化)/ `refactor:` / `chore:` / `docs:`。提交信息用中文。

## 架构

### 前端外壳 — [src/markdown-app/](src/markdown-app/)

- [App.tsx](src/markdown-app/App.tsx) — 根组件。**真相源是 `tabs[]`(每个 `OpenTab` = 路径 + 文件名 + 内存内容 + dirty 标记)+ `activePath`**;三种模式都读 / 写「当前标签」。内容变更后 **800ms 防抖自动落盘**(`AUTOSAVE_DEBOUNCE_MS`)。`MarkdownWorkspace` 按 `mode` 渲染对应表面:`view`/`split` 只读、按 `activePath` 重挂载;`wysiwyg` 复用 `useEditorTabSwap`,引擎实例跨标签存活、缓存秒切。
- [Toolbar.tsx](src/markdown-app/Toolbar.tsx) + [TabBar.tsx](src/markdown-app/TabBar.tsx) — 工具栏与标签条。标签右键菜单:在新窗口打开、在访达中显示、复制路径、重命名、关闭其他。图标见 [toolbarIcons.tsx](src/markdown-app/toolbarIcons.tsx)。
- [StartPage.tsx](src/markdown-app/StartPage.tsx) + [useRecentFiles.ts](src/markdown-app/useRecentFiles.ts) — 无标签时的起始页 + 最近打开历史。
- 目录(TOC):[TocPanel.tsx](src/markdown-app/TocPanel.tsx) + [useTocHeadings.ts](src/markdown-app/useTocHeadings.ts),从渲染出的标题 DOM 提取,支持滚动高亮、跳转、树折叠。
- 文档内查找(Cmd/Ctrl+F):[SearchBar.tsx](src/markdown-app/SearchBar.tsx) + [useDocumentSearch.ts](src/markdown-app/useDocumentSearch.ts),搜索富文本渲染区。
- 文件读写:[fileIo.ts](src/markdown-app/fileIo.ts) → [invokeCommand.ts](src/markdown-app/invokeCommand.ts) → Tauri 命令。系统「打开方式 / 双击」走 [useOpenWithFile.ts](src/markdown-app/useOpenWithFile.ts)(冷启动 `take_pending_open_file` 领取 + 运行时 `open-file` 事件);多窗口拆分走 `detach_tab_to_window` + `take_detached_open_path`。
- 偏好(均 localStorage 持久化):`useReadingPreferences`(宽度/字号/行高)、`useReadingStyle`、`useTocPreferences`(默认显示/左右)、`useEditorPreferences`(分栏方向、打开文件默认在新窗口)、`useShortcuts`(可自定义快捷键)、`useLanguage`(界面语言)。这些 Provider 在 `MarkdownApp` 根部统一挂载。
- 设置弹窗 [SettingsDialog.tsx](src/markdown-app/SettingsDialog.tsx)(左导航 + 右面板;设计稿 [design/settings-mockup.html](design/settings-mockup.html));自动更新 [useAppUpdate.ts](src/markdown-app/useAppUpdate.ts) / [UpdateDialog.tsx](src/markdown-app/UpdateDialog.tsx)(指向 GitHub Pages,minisign 签名)。

### i18n(重要)

markdown-app **自带一套轻量 i18n,不复用 Tolaria 遗留的 [src/lib/i18n.ts](src/lib/i18n.ts) 与 src/lib/locales/**:

- 文案目录在 [i18nMessages.ts](src/markdown-app/i18nMessages.ts):**以简体中文为键真相源**,英文用 `Record<MessageKey, string>` 约束防漏译。
- [useLanguage.ts](src/markdown-app/useLanguage.ts) 提供 Context/Provider 与响应式 `t()`;首次按系统语言推断(中文→`zh-CN`,其余→`en`)。
- 组件渲染用 `useLanguage().t`;非组件 / 事件回调(插入内容、保存 toast 等)用 `i18nMessages` 导出的模块级 `t`。
- **新增任何用户可见文案都必须进 `i18nMessages.ts`,禁止在组件里硬编码中文 / 英文。** 加语言只需在 `MESSAGES` 补一份完整目录并在设置页语言列表加项。
- 注意:`pnpm l10n:validate` 校验的是 **Tolaria 遗留** 的 `src/lib/locales/*.json`,与 markdown-app 自带的 i18n **无关**。

### 复用的 Tolaria 底层

- [src/components/](src/components/) — BlockNote 视图 [SingleEditorView.tsx](src/components/SingleEditorView.tsx)、编辑器 schema / 格式化 / 各类输入扩展、[MermaidDiagram.tsx](src/components/MermaidDiagram.tsx)、shadcn/ui 组件库 [src/components/ui/](src/components/ui/)。
- [src/hooks/](src/hooks/) — CodeMirror [useCodeMirror.ts](src/hooks/useCodeMirror.ts)、编辑器标签切换 [useEditorTabSwap.ts](src/hooks/useEditorTabSwap.ts) 及一系列 `editor*` 解析 / 缓存 / 修复辅助。
- **已移除**:vault 库管理、git 同步、AI、wikilink 双链、Tldraw 白板、属性/类型/视图/图谱、命令面板,以及全部前端测试。`src/lib/i18n.ts`、`src/lib/locales/`、`src/shared/appCommandManifest.json` 等多为遗留死代码。
- 「vault」概念在本应用退化为**「当前文件所在目录」**(`vaultPath = dirnameOf(filePath)`),仅用于图片 / 附件等资源的解析与 asset 协议授权,不是 Tolaria 的库。

### Tauri 后端 — [src-tauri/src/](src-tauri/src/)

- 入口 [lib.rs](src-tauri/src/lib.rs):插件装配、窗口 chrome、菜单、深链、单实例、updater。所有命令在 `app_invoke_handler!` 宏里集中注册。
- 命令实现在 [src-tauri/src/commands/](src-tauri/src/commands/),按 `markdown_file` / `clipboard` / `system` / `window` / `version` / `vault` / `runtime` 分模块。前端新增 `invokeCommand('xxx')` 调用时,务必在 `app_invoke_handler!` 里登记对应命令。
- 配置 [tauri.conf.json](src-tauri/tauri.conf.json):productName `MarkKnife`,identifier `org.jaaksi.markknife`,文件关联 `.md/.markdown`,深链 scheme `markknife://`。macOS **ad-hoc 临时签名**(`signingIdentity: "-"`),未公证。

### 启动链路

[index.html](index.html) → [src/main.tsx](src/main.tsx)(挂 React root、错误兜底覆盖层、自定义窗口 chrome 判定)→ lazy 加载 [src/markdown-app/App.tsx](src/markdown-app/App.tsx)。

## UI 规范

- **必须用 shadcn/ui 组件**([src/components/ui/](src/components/ui/)),禁止裸 HTML 表单控件;新 UI 要与应用整体视觉一致。
- 改 UI 前后对照 [design/](design/) 下的设计稿(`settings-mockup.html`、`toc-ui-mockup.html`、`tabbar-mockup.html`、`homepage-ui-mockup.html` 等),保持 1:1。
- Tailwind 是 v4(`@tailwindcss/vite`);组件文本样式优先用 `style`/类约定,沿用周边代码风格。

## macOS / Tauri 注意

- `Option+N` 在 macOS 会变特殊字符,快捷键判断用 `e.code` 或 `Cmd+N`,不要用 `e.key`。
- macOS 使用 **Tauri 默认菜单**(不安装 Tolaria 旧菜单——旧菜单会用自定义加速键在 webview 之前截获 ⌘S 等导致前端快捷键失效)。`app.set_menu()` 会替换整条菜单栏,要一次性给全。
- WKWebView 会吞掉部分浏览器保留组合键;`⌘O`、`⌘F` 通过 `tauri-plugin-prevent-default` 放行给前端处理(见 lib.rs 的 `MACOS_WEBVIEW_RESERVED_COMMAND_KEYS`)。
- [src/mock-tauri/](src/mock-tauri/) 会为 `pnpm dev`(浏览器)提供 mock 数据,但会**静默吞掉**真实 Tauri 调用,不能替代原生验证;原生行为一律用 `pnpm tauri dev` 验证。

## 遥测与密钥

Sentry + PostHog,key 走环境变量(见 [.env.example](.env.example),复制为 `.env.local`,已 gitignore)。CSP 在 tauri.conf.json 里已为 PostHog 域名开口。
