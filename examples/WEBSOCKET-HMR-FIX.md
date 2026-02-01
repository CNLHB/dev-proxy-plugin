# WebSocket 热更新修复说明

## 问题描述

在使用 Vue CLI 或其他开发服务器时，热更新（HMR）WebSocket 连接（如 `/ws` 和 `/sockjs-node/*`）被错误地代理到远程服务器，导致：

1. **ECONNRESET 错误**：连接被远程服务器重置
2. **热更新失败**：本地代码修改后页面不会自动刷新
3. **WebSocket 连接失败**：浏览器控制台显示 WebSocket 连接错误

### 错误示例

```
Proxy error: Could not proxy request /ws from 192.168.10.105:8081 to https://beta-internal.cxmuc.com.
See https://nodejs.org/api/errors.html#errors_common_system_errors for more information (ECONNRESET).
```

## 根本原因

在 `src/core.ts` 的 `shouldUseLocal` 函数中，之前的代码只排除了 `/sockjs-node/info`，但没有排除完整的 `/sockjs-node/*` 路径和 `/ws` 路径：

### 修复前（错误）

```typescript
const isLocalResource =
  (normalizedStaticPrefix && url.startsWith(normalizedStaticPrefix)) ||
  url.startsWith("/@") ||
  url.startsWith("/src") ||
  url.startsWith("/node_modules") ||
  url.includes(".hot-update.") ||
  url.startsWith("/sockjs-node/info") ||  // ❌ 只排除了 /sockjs-node/info
  url === "/" ||
  BYPASS_REGEX.test(pathname);
```

**问题**：
- `/sockjs-node/178/h54tlptm/websocket` 不会被识别为本地资源
- `/ws` 不会被识别为本地资源
- 这些路径会被代理到远程服务器，导致连接失败

### 修复后（正确）

```typescript
const isLocalResource =
  (normalizedStaticPrefix && url.startsWith(normalizedStaticPrefix)) ||
  url.startsWith("/@") ||
  url.startsWith("/src") ||
  url.startsWith("/node_modules") ||
  url.includes(".hot-update.") ||
  url.startsWith("/sockjs-node") || // ✅ 排除所有 /sockjs-node/* (Vue CLI/Webpack HMR)
  url.startsWith("/ws") ||           // ✅ 排除 /ws (Vite/通用 WebSocket)
  url === "/" ||
  BYPASS_REGEX.test(pathname);
```

**效果**：
- 所有以 `/sockjs-node` 开头的路径都会被识别为本地资源
- 所有以 `/ws` 开头的路径都会被识别为本地资源
- 这些路径不会被代理到远程服务器，保持在本地处理

## 影响范围

### 自动修复的场景

修复后，以下配置**无需修改**即可正常工作：

```javascript
// vue.config.js - 简单配置
const devProxy = VueCliPluginDevProxy({
  appHost: 'beta-internal.cxmuc.com',
  https: true,
  staticPrefix: '/static/contract',
  remotePrefixes: ['/static/component'],  // 数组形式，无需改动
  entry: ['/js/app.js'],
  debug: true
});

module.exports = {
  devServer: {
    proxy: devProxy.devServer.proxy  // 无需额外配置 WebSocket
  }
};
```

### 支持的 WebSocket 类型

修复后自动支持以下 HMR WebSocket：

1. **Vue CLI SockJS**：
   - `/sockjs-node/info`
   - `/sockjs-node/178/h54tlptm/websocket`
   - `/sockjs-node/*`（所有 SockJS 路径）

2. **Vite WebSocket**：
   - `/ws`
   - `/ws?*`（带查询参数）

3. **Webpack HMR**：
   - `/sockjs-node/*`

4. **其他热更新**：
   - 包含 `.hot-update.` 的路径
   - `/@vite/client` 等 Vite 特殊路径

## 使用建议

### 推荐配置（简单数组形式）

修复后，推荐使用简单的数组配置即可：

```javascript
const devProxy = VueCliPluginDevProxy({
  appHost: 'example.com',
  remotePrefixes: ['/static/component', '/api'],  // 只指定远程资源
  // WebSocket 会自动排除，无需手动配置
});
```

### 高级配置（函数形式）

如果需要更复杂的逻辑，仍可使用函数形式：

```javascript
const devProxy = VueCliPluginDevProxy({
  appHost: 'example.com',

  remotePrefixes: (url) => {
    // 自定义排除逻辑（可选，因为 WebSocket 已自动排除）
    if (url.startsWith('/ws')) return false;
    if (url.startsWith('/sockjs-node')) return false;

    // 自定义远程资源逻辑
    if (url.startsWith('/static/component')) return true;
    if (url.match(/^\/api\/v\d+\//)) return true;

    return false;
  },
});
```

### 不需要的配置（已废弃）

修复后，**不再需要**在 `devServer.proxy` 中单独配置 WebSocket：

```javascript
// ❌ 不再需要这样配置
module.exports = {
  devServer: {
    proxy: {
      '/ws': {              // 不需要
        target: '...',
        ws: true,
      },
      '/sockjs-node': {     // 不需要
        target: '...',
        ws: true,
      },
      ...devProxy.devServer.proxy,
    }
  }
};

// ✅ 简化后的配置
module.exports = {
  devServer: {
    proxy: devProxy.devServer.proxy  // 直接使用即可
  }
};
```

## 验证方法

### 1. 检查日志

启动开发服务器，应该看到：

```bash
# ✅ 正确：WebSocket 被识别为本地资源
[shouldUseLocal] /sockjs-node/info
[shouldUseLocal] /sockjs-node/178/h54tlptm/websocket
[shouldUseLocal] /ws

# ❌ 错误：WebSocket 被代理
[Proxy] /sockjs-node/178/h54tlptm/websocket
Proxy error: ECONNRESET
```

### 2. 检查热更新

修改代码文件，浏览器应该自动刷新或热更新，不应该出现：

```
❌ WebSocket connection to 'ws://...' failed
❌ [HMR] Hot Module Replacement is disabled
❌ Proxy error: ECONNRESET
```

### 3. 检查浏览器控制台

打开浏览器控制台，Network 标签，筛选 WS：

- ✅ WebSocket 连接状态应该是 `101 Switching Protocols`
- ✅ 连接应该保持打开状态（绿色）
- ❌ 不应该显示连接失败或关闭

## 版本信息

- **修复版本**：v1.0.1+
- **修复文件**：`src/core.ts` 第 368 行
- **修复日期**：2024-01-30
- **影响**：所有使用 Vue CLI、Vite、Webpack 的项目

## 相关文件

- [`src/core.ts`](../src/core.ts) - 核心逻辑文件
- [`examples/vue-cli-project/vue.config.js`](../examples/vue-cli-project/vue.config.js) - Vue CLI 配置示例
- [`examples/WEBSOCKET-TROUBLESHOOTING.md`](./WEBSOCKET-TROUBLESHOOTING.md) - WebSocket 故障排查

## 迁移指南

### 从旧版本升级

如果您之前手动配置了 WebSocket 代理来解决此问题：

#### 步骤 1：更新插件版本

```bash
npm update dev-proxy-plugin
# 或
pnpm update dev-proxy-plugin
```

#### 步骤 2：简化配置

移除手动添加的 WebSocket 配置：

```diff
// vue.config.js
const devProxy = VueCliPluginDevProxy({
  appHost: 'example.com',
- remotePrefixes: (url) => {
-   if (url.startsWith('/ws')) return false;
-   if (url.startsWith('/sockjs-node')) return false;
-   return url.startsWith('/static/component');
- },
+ remotePrefixes: ['/static/component'],  // 简化为数组
});

module.exports = {
  devServer: {
    proxy: {
-     '/ws': {
-       target: 'https://example.com',
-       ws: true,
-       changeOrigin: true,
-     },
-     '/sockjs-node': {
-       target: 'https://example.com',
-       ws: true,
-       changeOrigin: true,
-     },
      ...devProxy.devServer.proxy,
    }
  }
};
```

#### 步骤 3：测试验证

1. 重启开发服务器
2. 修改代码，检查热更新是否正常
3. 查看控制台，确认没有 WebSocket 错误

## 总结

这个修复使得 WebSocket 热更新的处理更加智能和自动化：

- ✅ **零配置**：无需手动排除 WebSocket 路径
- ✅ **兼容性**：支持 Vue CLI、Vite、Webpack 等所有主流工具
- ✅ **稳定性**：避免 ECONNRESET 和连接失败错误
- ✅ **简洁性**：简化配置，减少样板代码

如有问题，请查看 [WebSocket 故障排查指南](./WEBSOCKET-TROUBLESHOOTING.md)。
