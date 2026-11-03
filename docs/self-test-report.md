# 自测报告 · FLiNG Vault 1.0.1

日期：2026-11-02 · 环境：Windows 11 (10.0.26100) · Node 22.22.2 · Electron 33.4.11

## 1. 测试命令与结果

```bash
$ npm run typecheck
# 无输出，退出码 0

$ npm run build
✓ 43 modules transformed.
../dist/index.html                   0.64 kB
../dist/assets/index-*.css          21.43 kB
../dist/assets/index-*.js          171.50 kB
dist-electron\main.js  32.2kb | preload.js 3.7kb | smoke.js 26.4kb
```

冒烟测试（真实网络、真实下载、真实磁盘写入）：

```bash
$ npm run smoke -- "Phantom Blade Zero"
[smoke] target: Phantom Blade Zero
[smoke] sync-progress: 8/8
[smoke] sync-done: {"total":766,"fetched":766,"updatedAt":1793634215583}
[smoke] catalog-hit: {"id":43494,"slug":"phantom-blade-zero-trainer","options":36,"version":"1.0+"}
[smoke] download-state: preparing
[smoke] download-state: installing
[smoke] download-state: done
[smoke] installed: {"path":"C:\\Users\\73151\\AppData\\Roaming\\FLiNG Vault\\library\\phantom-blade-zero-trainer\\Phantom.Blade.Zero.v1.0.Plus.36.Trainer-FLiNG.exe","size":1781760,"version":"v1.0 Plus 36","options":36}
[smoke] elevation-required: exe 带 requireAdministrator 清单，正式启动将走 Start-Process -Verb RunAs
[smoke] updates: {"checked":1,"updates":0}
[smoke] stats: {"installed":1,"updates":0,"catalogTotal":766,"diskUsage":1781760,"lastSyncAt":1793634215583}
[smoke] ok: true
```

## 2. 断言覆盖

| 断言 | 结果 |
|---|---|
| 目录总数 ≥ 700 且抓取条数与站点总数一致（766/766） | 通过 |
| 目标条目可被标题精确命中 | 通过 |
| 下载文件字节数 = 1,781,760（PE 头 `4D 5A`） | 通过 |
| 快捷键表解析条数 = 官网标注选项数（36/36） | 通过 |
| 版本号解析 `v1.0 Plus 36`（不截断） | 通过（修复贪婪匹配后） |
| 启动链路识别 `requireAdministrator` | 通过 |
| 更新检测在无变更时返回 `updates: 0` | 通过 |

## 3. 自测中发现并修复的缺陷

| # | 现象 | 根因 | 修复 |
|---|---|---|---|
| 1 | 卡片高度 222px 但内容 247px 溢出，标题下多出 27px 空隙 | `<h3>` 默认 `margin: 1em` 未重置 | 全局重置标题/段落外边距 |
| 2 | 卡片封面 141px 被压缩到 115px | 卡片被 `contain-intrinsic-size` 固定高度后 flex 收缩 | 移除 `content-visibility`，封面 `flex: none` |
| 3 | 首屏 12 张图 14 秒仍未加载 | `loading="lazy"` 在本环境不触发 + 原图 700 KB | 改用 300w 缩略图，移除懒加载，加骨架与淡入 |
| 4 | 版本号显示 `v1.0` 而非 `v1.0 Plus 36` | `v[\d.]+` 贪婪吃掉分隔点，可选组不回溯 | 改为 `v\d+(?:\.\d+)*(?:[.\-]Plus[.\-]\d+)?` |
| 5 | 打包后窗口不出现 | 生产环境手工拼 `file://` + ES module 被 CORS 拦截 | 注册 `app://` 私有协议 + `pathToFileURL` 兜底 |
| 6 | 非管理员启动静默失败（无报错、无 pid） | `spawn` 错误是异步事件，同步调用不抛 | 监听 `spawn`/`error` 事件；识别 WinError 740 并回退提权 |
| 7 | 设置项标签出现单字换行（「修改/器」） | 标签列 108px 过窄 | 加宽至 132px 并缩短提示文案 |
| 8 | 标题栏「快捷启动」被窗口按钮盖住 | `titleBarOverlay` 占用右侧 138px | 标题栏右侧留 150px |

## 4. 未覆盖 / 需人工

- UAC 提权后的修改器窗口与游戏内热键：需人工在游戏运行时验证。
- 高 DPI（125%/150%）缩放：当前环境为 100%。
- 官网改版容错：仅通过代码分支确认，无真实改版可测。

## 5. 回归建议

每次改动 `electron/services/site.ts` 后必须重跑 `npm run smoke -- "Phantom Blade Zero"`，重点看 `options` 是否仍为 36、`size` 是否非 0。

---

## 6. 1.0.1 修复批次（4 项）

### 6.1 点击启动后修改器不出现

**根因**：旧实现把 `Start-Process -Verb RunAs` 拼成字符串交给 `-Command`，并且只在**外壳进程 spawn 成功**时就返回成功——UAC 被拒、命令解析失败、修改器秒退都被吞掉，界面仍提示「已启动」。

**修复**：
- 改用 `-EncodedCommand`（UTF-16LE Base64）传脚本，规避路径空格与中文引号的解析问题；
- `-PassThru` 拿到真实 PID（UAC 通过后才返回）；
- 启动后**观察 6 秒**并采集 `MainWindowTitle`，秒退时回传退出码；
- 失败按 HResult（`0x800704C7` / NativeErrorCode `1223`）判定「用户取消」，不再依赖本地化文案；
- 渲染层按 `LaunchResult` 区分「已启动 / 已取消 / 启动失败」三种提示。

**验证**：日志 `[launch] powershell-result {"code":0,"stdout":"RUNNING:26300:《影之刃零》 v1.0 三十六项修改器"}`，用户确认窗口正常弹出。

### 6.2 已安装 / 未安装标签对比度不足

**根因**：徽标底色 `rgba(12,14,15,0.72)` 让封面截图透出，配 9.5px `#8B8E8F` 文字；在亮色封面上实测对比度仅 **3.05:1**（低于 WCAG AA 4.5:1）。

**修复**：底色提到 0.9–0.92 不透明度、字号 10.5px/600、文字改为高亮色（`#E2E5E6` / `#A6E7AE` / `#FFC178`），并加 0.55 透明度描边与 1px 文字阴影。

**验证**：暗封面 15.4:1、亮封面 12.4:1（未安装）；已安装 11.5:1 / 9.2:1，均超过 AAA。

### 6.3 卸载后残留文件夹

**根因**：卸载程序运行时自身就在 `$INSTDIR` 中，`RMDir /r` 删不掉「自己所在的目录」，只留下一个空文件夹。

**修复**：`customUnInstall` 改为：先 `taskkill` 结束实例 → 删除 `%APPDATA%` / `%LOCALAPPDATA%` 数据 → 写一个自删除批处理到 `%TEMP%` 并分离执行，等卸载程序退出后 `rmdir` 安装目录（12 次重试）。
关键一行是批处理里的 `cd /d "%TEMP%"`：**命令行的当前目录若指向被删目录，`rmdir` 必定失败**（已单独复现验证）。

**验证**（静默安装 → 静默卸载）：
```
✔ 安装目录已彻底删除   ✔ 数据目录已删除
✔ 开始菜单已清理       ✔ 桌面快捷方式已清理   ✔ Programs 下无残留
```

### 6.4 托盘图标显示异常

**根因**：`iconPath()` 在打包后查找 `resources/build/icon.png`，但 `electron-builder.yml` 没有 `extraResources`，文件根本不在包里 → `nativeImage.createEmpty()` → Windows 收到空图标。

**修复**：新增 `extraResources` 释放 `tray.png` / `tray-16.png`；图标改为透明底橙色 F，并用 `addRepresentation` 同时提供 1x(16px) / 2x(32px)，避免缩放发虚；另内置 Base64 兜底图标。

**验证**：日志 `[tray] 图标已加载 {"size":{"width":16,"height":16}}`；托盘溢出面板中显示为透明底橙色 F，无白块/空位。
