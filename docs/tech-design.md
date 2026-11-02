# 技术方案 · FLiNG Vault

> 配套文档：`product-design.md`。本文只锁大方向与关键实现，不逐行描述代码。

## 1. 技术选型

| 方案 | 体积 | 开发效率 | 视觉可控度 | 生态/风险 | 结论 |
|---|---|---|---|---|---|
| **Electron 33 + React 18 + TS + Vite** | 安装包 ~85 MB | 高（Web 技术栈、热更新式调试） | 高（完整 CSS 能力，便于对齐修改器视觉） | 成熟，需处理二进制下载源 | **采用** |
| Tauri 2 + React | ~8 MB | 中（Rust 侧命令、插件生态较新） | 高 | 需 Rust + MSVC 工具链，本机未安装；打包链更易受阻 | 否 |
| .NET 8 WPF | ~15 MB | 中（XAML 数据绑定） | 中（样式系统繁琐，深色主题需大量模板重写） | 无运行时依赖，但设计迭代慢 | 否 |
| Python + PySide6 | 需 PyInstaller | 高 | 中 | 打包后体积大、启动慢；Qt 样式表表达力弱于 CSS | 否 |

**决定性因素**：产品要求「界面视觉与修改器本体一致」，需要像素级控制间距/描边/字体与密集列表排版。CSS 是达成这一点成本最低的工具；同时对 Node 侧的 HTTP 流式下载、文件系统操作有直接支持，无需额外运行时。

运行时依赖为 **0 个第三方包**（React 仅构建期打入），避免原生模块（如 better-sqlite3）带来的 ABI 与打包问题。

## 2. 进程模型

```
┌─────────────────────────────── Main (Node 22) ───────────────────────────────┐
│  main.ts          窗口 / 托盘 / 全局热键 / 单实例锁 / IPC 注册                 │
│  services/http.ts      fetch 封装：超时、重试退避、流式下载、取消               │
│  services/site.ts      flingtrainer.com 适配层（唯一与站点结构耦合的模块）      │
│  services/library.ts   settings / library / catalog 三个 JSON 存储 + 更新检测   │
│  services/installer.ts 下载 → .part → rename → 入库（含进度节流）               │
│  services/launcher.ts  spawn 探测 + PowerShell 提权启动                        │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │ contextBridge（白名单 API）
┌───────────────────────────────────┴──────────────────────────────────────────┐
│  Renderer (Chromium 130)：React 18 + 自研 CSS 设计令牌                        │
│  App.tsx（主窗口） / QuickPanel.tsx（#/quick 独立窗口）                        │
│  状态：useVault（IPC 调用 + 事件订阅，无状态库依赖）                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

- 渲染层 `nodeIntegration: false`、`contextIsolation: true`，只通过 `preload.ts` 暴露 `window.vault`。
- 快捷面板是**独立 BrowserWindow**（frameless + transparent + alwaysOnTop），共用同一份构建产物，用 `#/quick` 路由区分，避免主窗口被最小化时无法唤出。

## 3. 目录结构

```
风灵月影/
├── AGENTS.md                 # 协作硬规则（提交/自测/目录约定）
├── README.md
├── package.json
├── vite.config.ts            # root=src，产物 dist/
├── tsconfig.json
├── electron-builder.yml      # NSIS + portable 双目标
├── build/                    # 图标（icon.ico / icon.png / tray.png）
├── scripts/
│   ├── dev.mjs               # Vite dev server + esbuild + 启动 Electron
│   ├── build-electron.mjs    # 打包 main / preload / smoke 为 CJS
│   └── cdp.mjs               # 调试桥：eval / shot / click（仅开发用）
├── electron/
│   ├── main.ts               # 窗口、托盘、热键、IPC
│   ├── preload.ts            # contextBridge 白名单
│   ├── smoke.ts              # 冒烟测试入口（同步→下载→安装→启动探测）
│   ├── shared/
│   │   ├── types.ts          # 主/渲染共享类型
│   │   └── constants.ts      # 站点地址、IPC 通道名、超时参数
│   └── services/
│       ├── paths.ts          # userData / library / tmp 路径
│       ├── store.ts          # 原子 JSON 存储（tmp + rename）
│       ├── http.ts           # 请求与流式下载
│       ├── site.ts           # 目录/详情解析（正则 + REST）
│       ├── library.ts        # 三条数据 + 更新检测 + 统计
│       ├── installer.ts      # 安装事务与进度
│       └── launcher.ts       # 启动与提权
├── src/
│   ├── index.html
│   ├── main.tsx              # 按 hash 分流主窗口 / 快捷面板
│   ├── App.tsx               # 视图编排、筛选排序、抽屉、快捷键
│   ├── components/           # Shell / Toolbar / TrainerCard / DetailDrawer / …
│   ├── views/QuickPanel.tsx
│   ├── state/useVault.ts     # 数据与动作聚合（含下载事件订阅）
│   ├── lib/{api,format}.ts   # IPC 封装 / 格式化与匹配打分
│   └── styles/{tokens,app}.css
└── docs/                     # 产品/技术/验收/自测报告
```

## 4. 站点适配（核心耦合点）

### 4.1 目录读取：WordPress REST API

`GET /wp-json/wp/v2/posts?categories=5&per_page=100&page=N&_fields=id,date,modified,slug,link,title,content`

- 站点为 WordPress，Trainer 分类 `id=5`，当前 **766 条 / 8 页**；响应头 `X-WP-Total` / `X-WP-TotalPages` 给出总数与页数。
- 首页拿到分页数后，其余页以 **并发 3** 拉取，进度通过 `event:sync` 回传。
- 正文 `content.rendered` 内即可解析出：选项数量、游戏版本、最后更新日期、封面图。
- 封面使用 `srcset` 中的 **300w** 候选（约 45 KB）用于卡片；抽屉用原图。这一步把首屏图片流量从 ~8 MB 降到 ~2 MB。

### 4.2 详情页：只有 HTML 才有下载令牌

REST 的 `content` **不包含**下载表格（由 download-attachments 插件在前端渲染）。因此详情按需拉取页面 HTML 并正则解析：

```html
<a href="https://flingtrainer.com/downloads/<token>" title="<文件名>" class="attachment-link">
<td class="attachment-date">2026-10-29 18:23</td>
<td class="attachment-size">964 KB</td>
```

### 4.3 下载链路（实测）

```
GET /downloads/<token>            → 302 download-trainer.php?path=/wp-content/uploads/2026/10/<file>.zip
                                  → 302 /wp-content/uploads/trainer-files/.../<file>.zip/<Name>.exe
                                  → 200 application/x-msdownload（1.78 MB，PE 头 MZ）
```

结论：官网返回的**直接是 exe**，不是 zip（站点标注的 964 KB 是压缩后大小）。下载器需跟随重定向（fetch `redirect:'follow'`）并带 `Referer`，HEAD 请求会被 403，必须用 GET。

### 4.4 更新检测

`GET /wp-json/wp/v2/posts?include=<id1,id2,...>` 一次请求覆盖全部已安装项（≤100/批），比较 `lastUpdated` 与 `postModified`。相比逐条拉详情，N 个修改器只需 1 个请求。

## 5. 数据与存储

三个 JSON 文件，均位于 `%APPDATA%/FLiNG Vault/data/`：

| 文件 | 内容 | 规模 |
|---|---|---|
| `settings.json` | 下载目录、管理员启动、托盘、热键、自动检查 | <1 KB |
| `library.json` | 已安装条目（含快捷键表快照、标签、备注、启动计数） | 每条 ~3 KB |
| `catalog.json` | 官网目录摘要（不含正文 HTML） | 766 条 ≈ 300 KB |

写入统一走 `JsonStore.write()`：`writeFileSync(tmp)` → `renameSync`，避免断电/崩溃产生半截 JSON；读取带内存缓存，失败回退默认值。

**惰性初始化**：`store` 实例不在模块顶层创建（`app.getPath('userData')` 依赖 `app.setName` 与 ready 时机），改为 `settingsStore()` 等工厂函数。

## 6. 关键实现点

### 6.1 下载事务

`preparing → downloading → installing → done`，四点约束：

1. 先写 `tmp/<slug>-<ts>.part`，完成后 `rename` 到 `library/<slug>/<fileName>.exe`；
2. 进度每 240 ms 节流一次，速度用差值计算，避免 IPC 洪泛；
3. `AbortController` 贯穿 fetch 与写流，取消时清理半截文件；
4. 同 id 并发下载直接拒绝（`active` Map 去重）。

### 6.2 提权启动（实测发现的硬约束）

FLiNG 修改器 exe 带 `requireAdministrator` 清单，非提权 `spawn` 返回 **WinError 740**，但 Node 把它作为**异步 `error` 事件**抛出，同步 `spawn()` 不会 throw。实现要点：

```ts
// 必须等 spawn / error 事件才知道成败
await new Promise((resolve, reject) => {
  child.once('spawn', resolve);
  child.once('error', reject);
});
```

- 默认走 `powershell Start-Process -FilePath <exe> -WorkingDirectory <dir> -Verb RunAs`（弹 UAC）；
- 若用户关闭了「管理员启动」，首次普通启动失败会被识别为 `ElevationRequiredError`，IPC 层自动回退到提权并返回 `fallback: true`，UI 提示「已提权」。

### 6.3 快捷面板

`globalShortcut.register('Control+Alt+F')` → 面板 `show + focus`，`blur` 自动隐藏。列表按「收藏 → 最近启动」排序，`↑↓` 选择、`Enter` 启动（先隐藏面板再 spawn，避免焦点抢占）、`Esc` 关闭。

### 6.4 搜索与排序

本地匹配函数 `matchScore`：规范化（小写、去符号）后，整串包含记 3 分，全词命中记 2 分；再按 `lastUpdated / 名称 / 安装时间` 排序。目录 766 条全量在内存中计算，无需索引。

### 6.5 性能取舍

- 列表只渲染 48 条，滚动到底部再追加 48/96 条；
- 曾尝试 `content-visibility: auto`，但因 `contain-intrinsic-size` 覆盖真实高度导致卡片内容溢出，已移除；改为固定封面比例（16:9）+ 标题两行截断，保证行高一致；
- `loading="lazy"` 在无焦点/遮挡窗口中不触发（实测 14s 仍未发起请求），对 48 张图无必要，已移除并改为「骨架 shimmer + onload 淡入」。

## 7. 安全

- `contextIsolation: true` / `nodeIntegration: false` / `sandbox: false`（preload 需要 Node API）；
- 渲染层 CSP：`default-src 'self'; img-src 'self' https: data:; connect-src 'self' ws: http://localhost:*`（dev 需要 ws）；
- 所有外链走 `shell.openExternal`，不在应用内导航；
- 只从 `flingtrainer.com` 下载；文件落盘路径来自设置目录，文件名做非法字符过滤；
- 不收集任何用户数据，无遥测。

## 8. 风险与后续

| 风险 | 影响 | 缓解 |
|---|---|---|
| 官网改版（REST 关闭 / 表格结构变化） | 同步或下载失败 | 适配层集中在 `site.ts`；失败给出明确错误而不是静默 |
| 站点限流 / 图片慢（实测 45 KB 需 ~2.6 s） | 首屏图慢 | 缩略图 + 骨架；后续可加磁盘图片缓存协议 |
| 修改器需要管理员 | UAC 打断 | 默认提权 + 失败自动回退 |
| Electron 二进制下载源受限 | 安装失败 | README 给出 `ELECTRON_MIRROR` 镜像写法 |
