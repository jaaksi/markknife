# Markknife

一个简洁的** Markdown 查看 / 编辑应用**(从开源项目 [Tolaria](https://github.com/refactoringhq/tolaria) 剥离而来)。

技术栈:Tauri 2(Rust) + React 19 + TypeScript + Vite + Tailwind + shadcn/ui;富文本用 BlockNote,源码编辑用 CodeMirror 6,数学公式 KaTeX、图表 Mermaid。

## 三种模式

- **查看** — 只读富文本渲染(BlockNote)
- **所见即所得** — 可编辑富文本
- **分栏** — 左 CodeMirror 源码 + 右只读预览

共享同一份内存中的 Markdown 文本为唯一真相源;附带可自动生成的目录(TOC)面板。

## 安装(macOS)

下载 `.dmg`,打开后把 **MarkKnife** 拖到「应用程序」。

本应用**未经 Apple 公证**(项目没有 Apple 开发者账号),首次打开会被 macOS Gatekeeper 拦截(提示「已损坏」或「来自身份不明的开发者」)。按任一方式放行即可,之后正常使用、自动更新不受影响:

- **右键** App →「打开」,在弹窗里再点「打开」;
- 新系统(Sequoia 15+):双击被拦后,到 **系统设置 → 隐私与安全性**,点最下方「仍要打开」;
- 或在终端执行:`xattr -dr com.apple.quarantine /Applications/MarkKnife.app`

> **First launch on macOS** — the app is **not notarized** (no Apple Developer account), so Gatekeeper blocks it.
> Right‑click the app ▸ **Open** (then **Open** again), or go to **System Settings ▸ Privacy & Security ▸ Open Anyway**,
> or run `xattr -dr com.apple.quarantine /Applications/MarkKnife.app`. Auto‑update keeps working afterwards.

## 开发

```bash
pnpm dev        # 浏览器开发(dev mock,无 Tauri)
pnpm tauri dev  # 原生应用开发
pnpm build      # tsc -b && vite build
pnpm lint       # eslint(0 警告)
```

详见 [AGENTS.md](AGENTS.md)。

## 致谢

基于 Luca Ronin 的开源项目 **Tolaria**(MIT)精简改造而成。
