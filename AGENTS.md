# AGENTS.md — Markknife

MarkKnife 是一个** Markdown 查看 / 编辑应用**(从开源项目 [Tolaria](https://github.com/refactoringhq/tolaria) 剥离而来)。
技术栈:Tauri 2(Rust 后端)+ React 19 + TypeScript + Vite + Tailwind + shadcn/ui,
富文本用 BlockNote,源码编辑用 CodeMirror 6,数学 KaTeX、图表 Mermaid。

## 开发命令

```bash
pnpm dev            # 浏览器开发(dev mock,无 Tauri)
pnpm tauri dev      # 原生应用开发
pnpm build          # tsc -b && vite build
pnpm lint           # eslint(0 警告)
pnpm tauri build    # 打包(dmg 等需在你自己的终端里跑)
```

## 提交规范与本地自查(无自动门禁)

本项目**不使用测试 / 覆盖率 / CodeScene / Codacy**;也**已移除 husky 钩子(pre-commit/pre-push)与 GitHub Actions CI**,因此没有任何自动门禁——提交前请自行手动跑以下检查:

- 改了前端(`.ts/.tsx`):`pnpm lint`(0 警告)+ `npx tsc --noEmit`;push 前再跑一次 `pnpm build`
- 改了 `src-tauri/`:`cargo clippy --manifest-path=src-tauri/Cargo.toml -- -D warnings` + `cargo fmt --manifest-path=src-tauri/Cargo.toml -- --check`

提交规范:`feat:` / `fix:` / `refactor:` / `chore:` / `docs:`。
检查不过就修代码(通常是 lint/类型/构建错误),不要把红着的改动推上去。

## 架构

应用外壳在 [src/markdown-app/](src/markdown-app/):

- `App.tsx` — 根组件,唯一真相源是内存里的 `markdown` 字符串;三种模式共享它。
- `Toolbar.tsx` — 工具栏:打开文件、文件名、三模式纯图标按钮(查看 / 所见即所得 / 分栏)、设置齿轮。图标见 `toolbarIcons.tsx`,与设计稿内联 SVG 一致。
- 模式 `AppMode = 'view' | 'wysiwyg' | 'split'`:
  - 查看 = BlockNote 只读(`MarkdownReadonlyView`)
  - 所见即所得 = BlockNote 可编辑(`MarkdownEditableView`)
  - 分栏 = 左 CodeMirror 源码 + 右只读预览(`SplitView`),方向在设置里调
- 目录面板 `TocPanel.tsx` + `useTocHeadings.ts`(从渲染出的标题 DOM 提取,滚动高亮、跳转、树折叠)。
- 偏好:`useReadingPreferences`(宽度/字号/行高)、`useTocPreferences`(默认显示/左右)、`useEditorPreferences`(分栏方向)、`useLanguage`(界面语言)——均 localStorage 持久化。
- 多语言(i18n):自带轻量方案,**不复用 Tolaria 遗留的 `src/lib/i18n.ts`**。文案目录在 `i18nMessages.ts`(以简体中文为键真相源,英文用 `Record<MessageKey,string>` 约束防漏译);`useLanguage.ts` 提供 Context/Provider 与响应式 `t()`,首次按系统语言推断(中文→`zh-CN`,其余→`en`)。组件渲染用 `useLanguage().t`;非组件/事件回调(插入内容、保存 toast 等)用 `i18nMessages` 导出的模块级 `t`。目前支持 `zh-CN` / `en`,加语言只需在 `MESSAGES` 补一份完整目录并在设置页语言列表加项。**新增任何用户可见文案都要进 `i18nMessages.ts`,禁止在组件里硬编码中文/英文。**
- 设置弹窗 `SettingsDialog.tsx`(左导航 + 右面板,7 项:外观/样式/语言/快捷键/目录/编辑/关于,设计稿 [design/settings-mockup.html](design/settings-mockup.html));自动更新 `useAppUpdate.ts` / `UpdateDialog.tsx`(指向 GitHub 仓库,minisign 签名)。
- 文件读写经 Tauri 命令(`fileIo.ts` → `src-tauri/`);系统「打开方式」经 `useOpenWithFile.ts`。

底层复用 Tolaria 的 BlockNote 视图 `SingleEditorView` 与 CodeMirror hook;数学 / Mermaid / 代码高亮 / 图片保留,**已移除**:vault 库管理、git 同步、AI、全文搜索、wikilink 双链、Tldraw 白板、属性/类型/视图/图谱、命令面板、埋点、以及全部测试。多语言改用自带的轻量 i18n(见上),Tolaria 遗留的 `src/lib/i18n.ts` 与 `src/lib/locales/*.json` 已不再被 markdown-app 使用(死代码,可后续清理)。

## UI 规范

- **必须用 shadcn/ui 组件**(`src/components/ui/`),禁止裸 HTML 表单控件;新 UI 要与应用视觉一致。
- 设计稿:[design/toc-ui-mockup.html](design/toc-ui-mockup.html),改 UI 前后保持 1:1。

## macOS / Tauri 注意

- `Option+N` 在 macOS 会变特殊字符,快捷键用 `e.code` 或 `Cmd+N`。
- `app.set_menu()` 会替换整条菜单栏,要一次性给全。
- `mock-tauri.ts` 会静默吞掉 Tauri 调用,不能替代原生测试;原生验证用 `pnpm tauri dev`。
