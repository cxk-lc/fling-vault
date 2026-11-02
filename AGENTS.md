# FLiNG Vault — 协作规则（唯一硬约束入口）

## 项目定位
Windows 桌面应用：下载、管理、快捷调用 FLiNG（风灵月影）修改器。数据源为 flingtrainer.com。

## 技术栈（不可随意替换）
- Electron 33（主进程 Node 22）+ React 18 + TypeScript 5 + Vite 5
- 主进程用 esbuild 打包为 CJS；渲染层为纯静态产物
- 无原生模块、无运行时第三方依赖（数据落盘用自研 JSON 原子存储）
- 打包：electron-builder（NSIS + portable）

## 目录约定
- `electron/` 主进程：`services/` 放纯逻辑（不依赖 Electron API 的尽量纯函数），`ipc/` 只做通道注册与参数校验
- `src/` 渲染层：`components/` 展示组件、`views/` 页面、`state/` 全局状态、`styles/` 设计令牌
- `docs/` 规格文档；`scripts/` 构建脚本

## 硬性规则
1. 任何网络请求必须带超时与重试上限；不得阻塞主进程 UI（全部 async）。
2. 所有磁盘写入走 `services/store.ts` 的原子写（tmp + rename），禁止直接 `writeFile` 覆盖数据文件。
3. 文件系统路径必须来自 `app.getPath()` 或用户设置，不得硬编码绝对路径。
4. IPC 通道必须在 `preload.ts` 中显式白名单暴露，渲染层禁止开启 `nodeIntegration`。
5. 不提交密钥、token、`.env`；不提交 `node_modules`、`dist*`、`release*`。
6. 每个可独立验证的功能一个 commit，提交信息用中文，格式 `feat|fix|docs|chore: 说明`。
7. 修改行为前先改 `docs/`，再改代码。
8. 站点适配逻辑集中在 `electron/services/site.ts`；站点结构变化时只改这一处。

## 自测方式（提交前必须执行）
- `npm run typecheck` 通过
- `npm run build` 通过
- 手工冒烟：启动应用 → 同步目录 → 下载《影之刃零》→ 启动 → 检查更新 → 删除
