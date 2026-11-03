# FLiNG Vault · 风灵月影修改器库

Windows 桌面客户端：从 [flingtrainer.com](https://flingtrainer.com/) 同步目录、下载修改器、本地归类管理、检测更新，并用全局热键一键启动。

界面沿用修改器本体的视觉语言：`#1E2021` 底、`#FF8000` 强调色、方角细描边、密集列表。非官方客户端，修改器版权归 FLiNG 所有。

![界面概览](docs/assets/app-overview.png)

---

## 功能

| 模块 | 说明 |
|---|---|
| 目录同步 | 一次拉取 766 条（8 页并发 3），含封面、选项数、游戏版本、最后更新 |
| 下载安装 | 流式下载 + 实时进度 + 取消；`.part` 临时文件 + rename 落盘；统一存入本地库 |
| 库管理 | 搜索（相关度排序）、按更新/名称/安装时间排序、收藏、标签分类、备注 |
| 更新检测 | 一次 `include=` 批量请求核对已安装项，标记「可更新」并一键覆盖安装 |
| 删除 | 删除 exe 与其目录，同步移除记录 |
| 启动 | 默认提权启动（修改器带 `requireAdministrator`），失败自动回退提权并提示 |
| 快捷调用 | `Ctrl+Alt+F` 唤出搜索面板，`↑↓` 选择、`Enter` 启动；托盘常驻 + 最近启动菜单 |

## 发布产物（v1.0.1）

| 文件 | 大小 | SHA-256 |
|---|---|---|
| `release/FLiNG Vault-1.0.1-x64.exe`（安装版） | 77.9 MB | `a424a95d8e1ee34ca8dcd239ffaa89b2fdeba77f2d30a323d4e84e991bbb09e2` |
| `release/FLiNG Vault-1.0.1-portable.exe`（便携版） | 77.7 MB | `312e715a5bcea15ec73d3085a07f0e7e9cd4935a6115490296879d0b9adbcf6f` |

- 安装版：按用户安装（默认 `%LOCALAPPDATA%\Programs\FLiNG Vault`），可改路径、建桌面与开始菜单快捷方式；卸载会连同 `%APPDATA%\FLiNG Vault` 一起清理干净。
- 便携版：双击即用，解压到临时目录运行，不写注册表。
- 未做代码签名，首次运行可能触发 SmartScreen「未知发布者」，选择「更多信息 → 仍要运行」。
- 变更明细见 [CHANGELOG.md](CHANGELOG.md)。

## 技术栈

Electron 33（Node 22）· React 18 · TypeScript 5 · Vite 5 · electron-builder。
运行时**零第三方依赖**，数据落盘为自研原子 JSON 存储，无原生模块。

## 快速开始

```bash
# 1. 安装依赖（国内网络建议先切镜像）
npm config set registry https://registry.npmmirror.com
npm install

# 2. 开发模式（Vite HMR + Electron）
npm run dev

# 3. 生产构建 + 启动
npm run build
npm start

# 4. 打包（NSIS 安装包 + 免安装 portable）
npm run dist
```

> **若 `npx electron` 报 `Electron failed to install correctly`**
> 说明二进制未下载：`ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/electron/install.js`
>
> **若启动后报 `app.getPath is not a function` 或窗口空白**
> 当前 shell 可能设置了 `ELECTRON_RUN_AS_NODE=1`（部分 IDE 会注入）。用 `env -u ELECTRON_RUN_AS_NODE npx electron .` 启动，或在系统环境变量中删除该项。

## 使用流程

1. **首次启动**自动同步官网目录（约 10–20 秒，取决于网络）。目录缓存在本地，之后可离线浏览与搜索。
2. 点击卡片 → 右侧抽屉展示**完整快捷键表**（`Num 1 – God Mode` 这种原始映射）、版本、文件大小、官网更新时间。
3. 「下载并安装」→ 文件存入 `%APPDATA%\FLiNG Vault\library\<slug>\`，卡片状态变为「已安装」。
4. 「启动修改器」→ 默认弹 UAC 以管理员运行（修改器需附加游戏进程）。
5. 侧栏「可更新」→ 有新版本时出现条目，抽屉内点「更新」覆盖安装。
6. 游戏中按 `Ctrl+Alt+F` → 输入游戏名 → 回车启动。

## 数据目录

```
%APPDATA%\FLiNG Vault\
├── data\
│   ├── settings.json      # 设置
│   ├── library.json       # 已安装条目
│   └── catalog.json       # 官网目录缓存（~300 KB）
├── library\<slug>\*.exe   # 修改器文件（可在设置中改目录）
└── tmp\                   # 下载临时文件
```

## 目录结构

```
├── electron/          主进程：main / preload / services（http·site·library·installer·launcher）
├── src/               渲染层：App / components / views / state / styles
├── scripts/           dev.mjs（开发启动）、build-electron.mjs（打包主进程）、cdp.mjs（调试桥）
├── build/             应用与托盘图标
├── docs/              产品设计 / 技术方案 / 验收清单 / 自测报告
└── electron-builder.yml
```

## 脚本

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发模式 |
| `npm run build` | 构建渲染层 + 主进程到 `dist/`、`dist-electron/` |
| `npm start` | 用构建产物启动 |
| `npm run typecheck` | TypeScript 检查（无输出即通过） |
| `npm run smoke -- "Phantom Blade Zero"` | 冒烟测试：同步 → 下载 → 安装 → 启动探测 → 检查更新 |
| `npm run dist` | 打包 NSIS + portable 到 `release/` |

## 已知限制

- **仅 Windows**：修改器本身是 Windows PE，提权与托盘逻辑也按 Windows 实现。
- **卸载会删除本地库**：安装版卸载时会一并清理 `%APPDATA%\FLiNG Vault`（设置、库记录、已下载的修改器与日志），确保不留残留；如需保留，卸载前先把下载目录里的 exe 复制出去。
- **启动需要 UAC**：修改器清单要求管理员，启动时必然弹窗；若在弹窗上点「否」，客户端会提示「已取消管理员授权」，不会再谎报成功。
- **依赖官网结构**：目录走 WordPress REST，下载令牌需解析详情页 HTML。站点改版会导致失败，适配逻辑集中在 `electron/services/site.ts`。
- **必须联网首次同步**：之后可离线浏览已缓存目录、启动已安装修改器。
- **UAC 无法绕过**：修改器清单要求管理员，启动时必然弹窗（这是 exe 自身属性，不是客户端行为）。
- 未做代码签名，SmartScreen 可能提示「未知发布者」。
