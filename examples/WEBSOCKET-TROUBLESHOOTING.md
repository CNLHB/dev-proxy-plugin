# WebSocket 代理故障排查指南

## 常见错误及解决方案

### 1. ECONNRESET 错误

**错误信息：**
```
Proxy error: Could not proxy request /ws from 192.168.10.105:8081 to https://beta-internal.cxmuc.com.
See https://nodejs.org/api/errors.html#errors_common_system_errors for more information (ECONNRESET).
```

**原因：**
- HTTP 代理插件拦截了 WebSocket 请求
- HTTP 代理无法正确处理 WebSocket 协议升级
- 导致连接被服务器重置

**解决方案：**

#### 步骤 1：排除 WebSocket 路径

在 `remotePrefixes` 中排除 WebSocket 路径：

```javascript
const devProxy = VueCliPluginDevProxy({
  appHost: 'beta-internal.cxmuc.com',

  remotePrefixes: (url) => {
    // 关键：排除 WebSocket 路径
    if (url.startsWith('/ws')) return false;
    if (url.startsWith('/sockjs-node')) return false;

    // 其他远程资源
    return url.startsWith('/static/component');
  },
});
```

#### 步骤 2：配置 WebSocket 代理

在 `devServer.proxy` 中单独配置 WebSocket：

```javascript
module.exports = {
  devServer: {
    proxy: {
      // WebSocket 代理（必须在前面！）
      '/ws': {
        target: 'https://beta-internal.cxmuc.com',
        ws: true,           // 启用 WebSocket
        changeOrigin: true,
        secure: false,      // 自签名证书设为 false
        logLevel: 'debug',
      },

      // HTTP 代理（在后面）
      ...devProxy.devServer.proxy,
    },
  },
};
```

#### 步骤 3：验证配置

重启开发服务器并检查日志：

```bash
# 应该看到类似的日志
[WebSocket] 升级请求: /ws
  → 目标: https://beta-internal.cxmuc.com
[WebSocket] 连接已建立
```

---

### 2. Invalid Frame Header 错误

**错误信息：**
```
WebSocket connection to 'ws://192.168.10.105:8080/ws' failed: Invalid frame header
```

**原因：**
- WebSocket 连接被 HTTP 响应处理器拦截
- 插件尝试解析 WebSocket 帧为 HTTP 响应

**解决方案：**

同错误 1，确保：
1. `remotePrefixes` 排除 WebSocket 路径
2. `devServer.proxy` 配置 WebSocket 代理
3. WebSocket 代理在 HTTP 代理之前

---

### 3. WebSocket 代理不生效

**现象：**
- WebSocket 请求仍然走 HTTP 代理
- 无法建立 WebSocket 连接

**检查清单：**

#### ✅ 1. 代理顺序是否正确

```javascript
// ✅ 正确：WebSocket 在前
proxy: {
  '/ws': { ws: true, ... },
  ...devProxy.devServer.proxy,
}

// ❌ 错误：HTTP 代理在前
proxy: {
  ...devProxy.devServer.proxy,
  '/ws': { ws: true, ... },
}
```

#### ✅ 2. remotePrefixes 是否排除 WebSocket

```javascript
// ✅ 正确：返回 false
remotePrefixes: (url) => {
  if (url.startsWith('/ws')) return false;
  return url.startsWith('/static');
}

// ❌ 错误：未排除
remotePrefixes: ['/static']  // /ws 会走默认处理
```

#### ✅ 3. ws 选项是否启用

```javascript
// ✅ 正确
'/ws': {
  ws: true,
  ...
}

// ❌ 错误：缺少 ws: true
'/ws': {
  changeOrigin: true,
}
```

#### ✅ 4. target 协议是否正确

```javascript
// ✅ 正确：使用 http/https
target: 'https://beta-internal.cxmuc.com'

// ❌ 错误：使用 ws/wss
target: 'wss://beta-internal.cxmuc.com'
```

---

### 4. SockJS 连接问题

**现象：**
- SockJS 路径如 `/sockjs-node/178/h54tlptm/websocket` 无法连接

**解决方案：**

#### 配置 SockJS 路径前缀

```javascript
// remotePrefixes 排除
remotePrefixes: (url) => {
  if (url.startsWith('/sockjs-node')) return false;
  return url.startsWith('/static');
}

// proxy 配置
proxy: {
  '/sockjs-node': {
    target: 'https://beta-internal.cxmuc.com',
    ws: true,
    changeOrigin: true,
    secure: false,
  },
  ...devProxy.devServer.proxy,
}
```

---

## 调试技巧

### 1. 启用详细日志

```javascript
const devProxy = VueCliPluginDevProxy({
  debug: true,  // 插件调试日志

  remotePrefixes: (url) => {
    console.log(`[DEBUG] 判断 URL: ${url}`);
    if (url.startsWith('/ws')) {
      console.log('  → 排除 WebSocket 路径');
      return false;
    }
    return url.startsWith('/static');
  },
});

module.exports = {
  devServer: {
    proxy: {
      '/ws': {
        logLevel: 'debug',  // WebSocket 调试日志

        onProxyReqWs: (proxyReq, req, socket) => {
          console.log('[WS] 升级请求:', req.url);
        },

        onOpen: (proxySocket) => {
          console.log('[WS] 连接已建立');
        },

        onError: (err, req, res) => {
          console.error('[WS] 错误:', err);
        },
      },
    },
  },
};
```

### 2. 检查浏览器 Network 面板

1. 打开浏览器开发者工具
2. 切换到 Network 标签
3. 筛选 WS（WebSocket）
4. 查看连接状态和消息

### 3. 查看服务器日志

```bash
# 开发服务器应该输出
[WebSocket] 升级请求: /ws
[WebSocket] 连接已建立

# 而不是
[proxyRes] /ws - Status: 200, ContentType: text/html  # 错误！被 HTTP 处理了
```

### 4. 使用测试组件

使用提供的 `WebSocketTest.vue` 组件测试连接：

```vue
<template>
  <div id="app">
    <WebSocketTest />
  </div>
</template>

<script>
import WebSocketTest from './components/WebSocketTest.vue';

export default {
  components: { WebSocketTest }
};
</script>
```

---

## 完整配置模板

### Vue CLI 项目

```javascript
// vue.config.js
const { VueCliPluginDevProxy } = require('dev-proxy-plugin');

const devProxy = VueCliPluginDevProxy({
  appHost: 'beta-internal.cxmuc.com',
  https: true,
  staticPrefix: '/dev/static',

  remotePrefixes: (url) => {
    // 排除 WebSocket
    if (url.startsWith('/ws')) return false;
    if (url.startsWith('/sockjs-node')) return false;

    // 远程资源
    return url.startsWith('/static/component');
  },

  entry: ['/js/chunk-vendors.js', '/js/app.js'],
  clearScriptCssPrefixes: '/static',
  debug: true,
});

module.exports = {
  devServer: {
    port: 8081,

    proxy: {
      // 1. WebSocket 代理（最前面）
      '/ws': {
        target: 'https://beta-internal.cxmuc.com',
        ws: true,
        changeOrigin: true,
        secure: false,
        logLevel: 'debug',
      },

      // 2. SockJS（如果需要）
      '/sockjs-node': {
        target: 'https://beta-internal.cxmuc.com',
        ws: true,
        changeOrigin: true,
        secure: false,
      },

      // 3. HTTP 代理（最后）
      ...devProxy.devServer.proxy,
    },
  },

  ...devProxy,
};
```

### Vite 项目

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import { VitePluginDevProxy } from 'dev-proxy-plugin';

export default defineConfig({
  plugins: [
    VitePluginDevProxy({
      appHost: 'beta-internal.cxmuc.com',
      https: true,

      remotePrefixes: (url) => {
        if (url.startsWith('/ws')) return false;
        if (url.startsWith('/sockjs-node')) return false;
        return url.startsWith('/static/component');
      },

      entry: '/src/main.js',
      debug: true,
    })
  ],

  server: {
    port: 8081,

    proxy: {
      '/ws': {
        target: 'https://beta-internal.cxmuc.com',
        ws: true,
        changeOrigin: true,
        secure: false,
      },

      '/sockjs-node': {
        target: 'https://beta-internal.cxmuc.com',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    }
  }
});
```

---

## 验证步骤

### 1. 检查配置

```bash
# 检查 remotePrefixes 是否排除 /ws
console.log(remotePrefixes('/ws'))  # 应该输出 false

# 检查代理配置顺序
console.log(Object.keys(module.exports.devServer.proxy))
# 应该输出: ['/ws', '/sockjs-node', '/']
```

### 2. 测试连接

```javascript
// 浏览器控制台测试
const ws = new WebSocket(`ws://${location.host}/ws`);
ws.onopen = () => console.log('✅ 连接成功');
ws.onerror = (e) => console.error('❌ 连接失败', e);
```

### 3. 检查日志

启动开发服务器，查看是否有以下日志：

```
✅ 正确的日志：
[remotePrefixes] 判断 URL: /ws
  → WebSocket 路径，使用本地代理
[WebSocket] 升级请求: /ws
[WebSocket] 连接已建立

❌ 错误的日志：
[Proxy] /ws
[proxyRes] /ws - Status: 200
Proxy error: ECONNRESET
```

---

## 常见问题 FAQ

### Q1: 为什么 WebSocket target 要用 http 而不是 ws？

**A:** http-proxy-middleware 会自动将 HTTP 升级为 WebSocket。使用 `ws://` 反而会导致错误。

```javascript
// ✅ 正确
target: 'https://example.com'

// ❌ 错误
target: 'wss://example.com'
```

### Q2: 可以只配置 WebSocket 代理，不用插件吗？

**A:** 可以，但你会失去：
- HTML 脚本注入
- Cookie 重写
- 重定向处理
- 远程资源代理

### Q3: SockJS 动态路径如何处理？

**A:** 使用路径前缀匹配：

```javascript
'/sockjs-node': {  // 匹配 /sockjs-node/*
  target: 'https://example.com',
  ws: true,
}
```

### Q4: 如何同时代理多个 WebSocket 端点？

**A:** 分别配置每个端点：

```javascript
proxy: {
  '/ws1': { target: 'https://server1.com', ws: true },
  '/ws2': { target: 'https://server2.com', ws: true },
  ...devProxy.devServer.proxy,
}
```

---

## 总结

解决 WebSocket 代理问题的关键步骤：

1. ✅ **排除 WebSocket 路径**：`remotePrefixes` 中返回 `false`
2. ✅ **单独配置 WebSocket**：在 `proxy` 中设置 `ws: true`
3. ✅ **正确的顺序**：WebSocket 代理在 HTTP 代理之前
4. ✅ **使用 http 协议**：target 使用 `http://` 不是 `ws://`
5. ✅ **启用调试**：`debug: true` 和 `logLevel: 'debug'`

按照以上步骤配置，WebSocket 应该能正常工作！
