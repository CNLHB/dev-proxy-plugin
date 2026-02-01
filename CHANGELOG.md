# 更新日志

所有重要的项目变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.0.1] - 2024-01-30

### 修复 (Fixed)

- **WebSocket 热更新支持** - 修复 Vue CLI/Vite 热更新 WebSocket 被错误代理的问题
  - 自动排除 `/ws` 路径（Vite HMR WebSocket）
  - 自动排除 `/sockjs-node/*` 路径（Vue CLI HMR WebSocket）
  - 解决 `ECONNRESET` 错误和连接失败问题
  - 无需手动配置 WebSocket 代理

### 改进 (Improved)

- **零配置 WebSocket** - 所有 HMR WebSocket 自动在本地处理，无需额外配置
- **更好的默认行为** - `shouldUseLocal` 函数现在默认识别所有常见的热更新路径

### 文档 (Documentation)

- 新增 [WebSocket 热更新修复说明](./examples/WEBSOCKET-HMR-FIX.md)
- 新增 [WebSocket 故障排查指南](./examples/WEBSOCKET-TROUBLESHOOTING.md)
- 更新 README 特性列表，添加 WebSocket 热更新说明

### 技术细节

**修改文件**：`src/core.ts`

**修改前**：
```typescript
url.startsWith("/sockjs-node/info") ||  // 只排除 /sockjs-node/info
```

**修改后**：
```typescript
url.startsWith("/sockjs-node") ||  // 排除所有 /sockjs-node/*
url.startsWith("/ws") ||            // 排除 /ws
```

这个修复确保以下路径自动在本地处理：
- `/ws` - Vite WebSocket
- `/ws?*` - 带查询参数的 WebSocket
- `/sockjs-node/info` - SockJS 信息端点
- `/sockjs-node/178/h54tlptm/websocket` - SockJS WebSocket
- `/sockjs-node/*` - 所有 SockJS 路径

---

## [1.0.0] - 2024-01-28

### 新增 (Added)

- 🎉 **首次发布** - dev-proxy-plugin 正式发布

### 核心特性

- ✅ **双框架支持** - 同时支持 Vite 和 Vue CLI
- ✅ **智能代理** - 自动代理远程服务器的 HTML、API 等请求
- ✅ **脚本注入** - 自动注入本地入口脚本到远程 HTML
- ✅ **脚本清理** - 灵活清除远程 HTML 中不需要的脚本和样式
- ✅ **Cookie 处理** - 自动重写 Cookie，解决本地开发跨域问题
- ✅ **重定向处理** - 智能处理 HTTP 重定向，自动转换为本地地址
- ✅ **解压缩支持** - 支持 gzip、deflate、brotli 压缩格式
- ✅ **灵活配置** - 支持字符串、数组、函数、正则等多种配置方式

### 配置选项

#### ProxyOptions

- `appHost` - 远程服务器地址（必填）
- `https` - 是否使用 HTTPS 协议（默认 `true`）
- `staticPrefix` - 静态资源路径前缀（默认 `'/dev/static'`）
- `remotePrefixes` - 远程资源路径规则（支持 string, string[], Function, RegExp）
- `clearScriptCssPrefixes` - 清除脚本/CSS 的规则（支持 string, string[], Function, RegExp）
- `entry` - 本地入口文件路径（支持单个或多个）
- `developmentAgentOccupancy` - 自定义占位符
- `isLib` - 库模式（默认 `false`）
- `localIndexHtml` - 本地 HTML 文件路径（默认 `'index.html'`）
- `debug` - 是否开启调试模式（默认 `false`）

### 项目结构

```
src/
├── core.ts                      # 核心共享逻辑（~530 行）
├── vite-cli.ts                  # Vite 插件（~160 行）
├── vue-cli-plugin-dev-proxy.ts  # Vue CLI 插件（~180 行）
└── index.ts                     # 入口文件
```

### 文档

- ✅ 完整的中文 README
- ✅ remotePrefixes 详细用法指南
- ✅ 示例项目（Vite、Vue CLI、Webpack）
- ✅ TypeScript 类型定义和 JSDoc 注释

### 工具函数

核心模块提供 20+ 个工具函数：

- `createLogger` - 创建日志函数
- `normalizePath` - 路径标准化
- `generateEntryScript` - 生成入口脚本
- `rewriteCookies` - Cookie 重写
- `decompressBuffer` - 解压缩
- `shouldClearScriptCss` - 判断是否清除标签
- `injectEntryScript` - 注入脚本
- `clearScriptCssTags` - 清除标签
- `isRedirectResponse` - 判断重定向
- `shouldProcessAsHtml` - 判断处理HTML
- `matchesRemoteResource` - 匹配远程资源
- `shouldUseLocal` - 判断使用本地
- `handleRedirect` - 处理重定向
- `handleLibModeHtml` - 处理库模式HTML
- `handleHtmlResponse` - 处理HTML响应
- `validateOptions` - 验证配置
- `processOptions` - 处理配置

---

## 版本说明

### 版本号规则

遵循 [语义化版本 2.0.0](https://semver.org/lang/zh-CN/)：

- **主版本号（Major）**：不兼容的 API 修改
- **次版本号（Minor）**：向后兼容的功能性新增
- **修订号（Patch）**：向后兼容的问题修正

### 版本标签

- `[Unreleased]` - 未发布的变更
- `[X.Y.Z]` - 具体版本号和发布日期

### 变更类型

- `Added` - 新增功能
- `Changed` - 对现有功能的变更
- `Deprecated` - 已弃用的功能
- `Removed` - 移除的功能
- `Fixed` - 任何 bug 修复
- `Security` - 安全性修复

---

## 链接

- [npm 包](https://www.npmjs.com/package/dev-proxy-plugin)
- [GitHub 仓库](https://github.com/CNLHB/dev-proxy-plugin)
- [问题反馈](https://github.com/CNLHB/dev-proxy-plugin/issues)

---

Made with ❤️ by [aiwa](https://cnlhb.github.io/blog/)
