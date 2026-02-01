# dev-proxy-plugin

[![npm version](https://img.shields.io/npm/v/dev-proxy-plugin.svg)](https://www.npmjs.com/package/dev-proxy-plugin)
[![license](https://img.shields.io/npm/l/dev-proxy-plugin.svg)](./LICENSE)

一个强大的开发环境代理插件，支持 **Vite** 和 **Vue CLI**，用于代理远程服务器并自动注入本地开发代码。

[English](./README.en.md) | 简体中文

## ✨ 特性

- 🚀 **双框架支持** - 同时支持 Vite 和 Vue CLI
- 🔄 **智能代理** - 自动代理远程服务器的 HTML、API 等请求
- 💉 **脚本注入** - 自动注入本地入口脚本到远程 HTML
- 🧹 **脚本清理** - 灵活清除远程 HTML 中不需要的脚本和样式
- 🍪 **Cookie 处理** - 自动重写 Cookie，解决本地开发跨域问题
- 🔀 **重定向处理** - 智能处理 HTTP 重定向，自动转换为本地地址
- 🗜️ **解压缩支持** - 支持 gzip、deflate、brotli 压缩格式
- 🔌 **WebSocket 热更新** - 自动识别并排除 HMR WebSocket，无需手动配置
- 🎯 **灵活配置** - 支持字符串、数组、函数、正则等多种配置方式
- 📦 **零依赖** - 核心功能无外部依赖
- 🔧 **TypeScript** - 完整的类型定义和 JSDoc 注释
- 🐛 **调试模式** - 详细的日志输出，方便排查问题

## 📦 安装

```bash
# npm
npm install dev-proxy-plugin -D

# yarn
yarn add dev-proxy-plugin -D

# pnpm
pnpm add dev-proxy-plugin -D
```

## 🚀 快速开始

### Vite 项目

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import { VitePluginDevProxy } from 'dev-proxy-plugin';

export default defineConfig({
  plugins: [
    VitePluginDevProxy({
      appHost: 'example.com',           // 远程服务器地址（必填）
      https: true,                      // 使用 HTTPS
      entry: '/src/main.js',            // 本地入口文件
      staticPrefix: '/dev/static',      // 静态资源前缀
      remotePrefixes: ['/static/component'],  // 远程资源路径
      clearScriptCssPrefixes: '/static', // 清除远程脚本/样式
      debug: true,                      // 开启调试日志
    })
  ]
});
```

### Vue CLI 项目

```javascript
// vue.config.js
const { VueCliPluginDevProxy } = require('dev-proxy-plugin');

module.exports = VueCliPluginDevProxy({
  appHost: 'example.com',
  https: true,
  entry: ['/js/chunk-vendors.js', '/js/app.js'],
  staticPrefix: '/dev/static',
  remotePrefixes: ['/static/component'],
  clearScriptCssPrefixes: '/static',
  debug: true,
});
```

## 📚 配置选项

### ProxyOptions

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `appHost` | `string` | - | **必填**。远程服务器地址，如 `'example.com'` |
| `https` | `boolean` | `true` | 是否使用 HTTPS 协议 |
| `staticPrefix` | `string` | `'/dev/static'` | 静态资源路径前缀，用于构建本地资源路径 |
| `remotePrefixes` | `string \| string[] \| Function \| RegExp` | `['/static/component']` | 远程资源路径规则，匹配的资源从远程加载 |
| `clearScriptCssPrefixes` | `string \| string[] \| Function \| RegExp` | `''` | 清除脚本/CSS 的规则，匹配的标签会被移除 |
| `entry` | `string \| string[]` | Vite: `'/src/main.js'`<br>Vue CLI: `['/js/chunk-vendors.js', '/js/app.js']` | 本地入口文件路径，支持单个或多个 |
| `developmentAgentOccupancy` | `string` | `''` | 自定义占位符，用于替换为入口脚本 |
| `isLib` | `boolean` | `false` | 库模式，直接返回本地 HTML 文件 |
| `localIndexHtml` | `string` | `'index.html'` | 本地 HTML 文件路径（库模式使用） |
| `debug` | `boolean` | `false` | 是否开启调试模式，输出详细日志 |

## 🎯 高级用法

### 1. remotePrefixes - 远程资源路径配置

`remotePrefixes` 用于指定哪些资源应该从远程服务器加载，支持 4 种类型：

#### 字符串类型（单个前缀）

```javascript
VitePluginDevProxy({
  appHost: 'example.com',
  remotePrefixes: '/static/component',  // 字符串
})
```

**匹配规则**：URL 以 `/static/component` 开头的资源从远程加载。

**示例**：
- ✅ `/static/component/button.js` → 远程加载
- ✅ `/static/component/styles/main.css` → 远程加载
- ❌ `/static/images/logo.png` → 本地加载

#### 数组类型（多个前缀）

```javascript
VitePluginDevProxy({
  appHost: 'example.com',
  remotePrefixes: ['/static/component', '/static/lib', '/api'],  // 数组
})
```

**匹配规则**：URL 以数组中任一前缀开头的资源从远程加载。

#### 正则表达式类型

```javascript
VitePluginDevProxy({
  appHost: 'example.com',
  remotePrefixes: /^\/static\/(?!images)/,  // 正则：排除 images 文件夹
})
```

**更多正则示例**：
```javascript
// 匹配所有 .min.js 文件
remotePrefixes: /\.min\.js$/

// 匹配 /api/ 或 /services/ 开头的路径
remotePrefixes: /^\/(api|services)\//

// 匹配包含版本号的资源
remotePrefixes: /\/lib\/v\d+\.\d+\.\d+\//
```

#### 函数类型（自定义逻辑）

```javascript
VitePluginDevProxy({
  appHost: 'example.com',
  remotePrefixes: (url) => {
    // 微前端场景：子应用使用远程资源
    const microApps = ['/micro-app-1/', '/micro-app-2/'];
    return microApps.some(app => url.startsWith(app));
  },
})
```

**函数签名**：`(url: string) => boolean`
- 参数 `url`：完整的请求 URL
- 返回 `true`：从远程加载
- 返回 `false`：使用本地资源

**更多函数示例**：
```javascript
// 根据环境变量决定
remotePrefixes: (url) => {
  return process.env.USE_REMOTE === 'true' && url.startsWith('/static');
}

// 复杂的业务逻辑
remotePrefixes: (url) => {
  if (url.startsWith('/modules/payment/')) return true;
  if (url.startsWith('/modules/checkout/')) return true;
  if (url.includes('/vendor/')) return true;
  return false;
}
```

### 2. clearScriptCssPrefixes - 清除远程脚本/样式

`clearScriptCssPrefixes` 用于清除远程 HTML 中不需要的 `<script>` 和 `<link>` 标签，同样支持 4 种类型：

#### 字符串类型

```javascript
VitePluginDevProxy({
  appHost: 'example.com',
  clearScriptCssPrefixes: '/static',  // 清除 src/href 以 /static 开头的标签
})
```

#### 数组类型

```javascript
VitePluginDevProxy({
  appHost: 'example.com',
  clearScriptCssPrefixes: ['/static', '/vendor'],  // 清除多个前缀
})
```

#### 正则表达式类型

```javascript
VitePluginDevProxy({
  appHost: 'example.com',
  clearScriptCssPrefixes: /\.(min\.js|min\.css)$/,  // 清除压缩文件
})
```

#### 函数类型

```javascript
VitePluginDevProxy({
  appHost: 'example.com',
  clearScriptCssPrefixes: (tag) => {
    // 清除包含 'legacy' 的标签
    return tag.includes('legacy');
  },
})
```

**函数签名**：`(tag: string) => boolean`
- 参数 `tag`：完整的 HTML 标签字符串
- 返回 `true`：清除该标签
- 返回 `false`：保留该标签

### 3. 多入口配置

支持单个或多个入口文件：

```javascript
// 单入口
VitePluginDevProxy({
  appHost: 'example.com',
  entry: '/src/main.js',
})

// 多入口（会按顺序注入）
VitePluginDevProxy({
  appHost: 'example.com',
  entry: [
    '/src/vendors.js',
    '/src/polyfills.js',
    '/src/main.js'
  ],
})
```

生成的 HTML：
```html
<script crossorigin type="module" src="/dev/static/src/vendors.js"></script>
<script crossorigin type="module" src="/dev/static/src/polyfills.js"></script>
<script crossorigin type="module" src="/dev/static/src/main.js"></script>
```

### 4. 自定义占位符

使用自定义占位符精确控制脚本注入位置：

```javascript
VitePluginDevProxy({
  appHost: 'example.com',
  developmentAgentOccupancy: '<!-- DEV_ENTRY -->',
  entry: '/src/main.js',
})
```

远程 HTML：
```html
<body>
  <div id="app"></div>
  <!-- DEV_ENTRY -->
</body>
```

处理后：
```html
<body>
  <div id="app"></div>
  <script crossorigin type="module" src="/dev/static/src/main.js"></script>
</body>
```

如果不设置占位符，脚本会自动注入到 `<div id="app">` 后面。

### 5. 库模式

开发组件库时，直接使用本地 HTML 文件：

```javascript
VitePluginDevProxy({
  appHost: 'example.com',
  isLib: true,
  localIndexHtml: './public/index.html',
})
```

## 📖 使用场景

### 场景 1：微前端开发

```javascript
VitePluginDevProxy({
  appHost: 'main-app.com',
  // 主应用本地开发，子应用使用远程
  remotePrefixes: (url) => {
    const remoteApps = ['/micro-app-1/', '/micro-app-2/'];
    return remoteApps.some(app => url.startsWith(app));
  },
  // 清除主应用的远程脚本
  clearScriptCssPrefixes: ['/static/main'],
  entry: '/src/main.js',
})
```

### 场景 2：渐进式迁移

```javascript
VitePluginDevProxy({
  appHost: 'legacy.com',
  // 已迁移的模块使用本地，未迁移的使用远程
  remotePrefixes: (url) => {
    const migratedModules = ['/modules/user/', '/modules/product/'];
    return !migratedModules.some(m => url.startsWith(m));
  },
  entry: '/src/main.js',
})
```

### 场景 3：组件库开发

```javascript
VitePluginDevProxy({
  appHost: 'showcase.com',
  isLib: true,
  localIndexHtml: './examples/index.html',
  // 清除远程组件库的脚本
  clearScriptCssPrefixes: /^\/lib\//,
  entry: '/src/index.js',
})
```

### 场景 4：A/B 测试

```javascript
VitePluginDevProxy({
  appHost: 'example.com',
  // 根据条件决定使用本地还是远程
  remotePrefixes: (url) => {
    if (!url.startsWith('/components/')) return false;

    // 50% 的流量使用远程组件
    const userId = getUserId();
    return userId % 2 === 0;
  },
})
```

## 🔍 调试

开启 `debug` 模式查看详细日志：

```javascript
VitePluginDevProxy({
  appHost: 'example.com',
  debug: true,  // 开启调试
})
```

**控制台输出示例**：
```
vite-plugin-dev-proxy: staticPrefix /dev/static
[shouldUseLocal] /src/main.js
[Proxy] /static/component/button.js
Redirect handled: https://example.com/login -> http://localhost:5173/login (15ms)
HTML processed: /dashboard (342ms)
dev-proxy: rewrittenCookie token=xxx
```

## 🛠️ 工作原理

### 流程图

```
┌─────────────────┐
│  浏览器请求      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  判断资源类型    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌────────┐
│ 本地资源│ │ 远程资源│
└────────┘ └───┬────┘
              │
         ┌────┴────┐
         │         │
         ▼         ▼
    ┌────────┐ ┌────────┐
    │ HTML   │ │ 其他   │
    └───┬────┘ └────────┘
        │
        ▼
┌────────────────────┐
│ 1. 解压缩内容       │
│ 2. 清除远程脚本     │
│ 3. 注入本地脚本     │
│ 4. 重写 Cookie     │
│ 5. 处理重定向       │
└────────────────────┘
```

### 详细说明

1. **请求拦截**：拦截所有开发服务器请求
2. **资源判断**：根据 `remotePrefixes` 判断使用本地还是远程资源
3. **HTML 处理**：
   - 代理远程 HTML
   - 解压缩内容（gzip/deflate/br）
   - 根据 `clearScriptCssPrefixes` 清除指定标签
   - 注入本地入口脚本
   - 重写 Cookie 和重定向
4. **其他资源**：直接代理或使用本地资源

### Cookie 重写

自动移除 Cookie 的 `secure`、`domain`、`samesite` 属性：

```javascript
// 原始 Cookie
Set-Cookie: token=xxx; Domain=example.com; Secure; SameSite=Strict

// 重写后
Set-Cookie: token=xxx
```

### 重定向处理

自动将远程重定向转换为本地重定向：

```javascript
// 原始重定向
Location: https://example.com/dashboard

// 转换后
Location: http://localhost:5173/dashboard
```

## 📁 项目结构

```
src/
├── core.ts                      # 核心共享逻辑（~500 行）
│   ├── 类型定义 (ProxyOptions, IncomingMessage, etc.)
│   ├── 常量配置 (正则表达式、状态码等)
│   ├── 工具函数 (20+ 个纯函数)
│   │   ├── createLogger        - 创建日志函数
│   │   ├── normalizePath       - 路径标准化
│   │   ├── generateEntryScript - 生成入口脚本
│   │   ├── rewriteCookies      - Cookie 重写
│   │   ├── decompressBuffer    - 解压缩
│   │   ├── shouldClearScriptCss - 判断是否清除标签
│   │   ├── injectEntryScript   - 注入脚本
│   │   ├── clearScriptCssTags  - 清除标签
│   │   ├── isRedirectResponse  - 判断重定向
│   │   ├── shouldProcessAsHtml - 判断处理HTML
│   │   ├── matchesRemoteResource - 匹配远程资源
│   │   ├── shouldUseLocal      - 判断使用本地
│   │   ├── handleRedirect      - 处理重定向
│   │   ├── handleLibModeHtml   - 处理库模式HTML
│   │   ├── handleHtmlResponse  - 处理HTML响应
│   │   ├── validateOptions     - 验证配置
│   │   └── processOptions      - 处理配置
│   └── 导出所有公共功能
│
├── vite-cli.ts                  # Vite 插件（~160 行）
│   ├── VitePluginDevProxy      - 默认导出
│   ├── createProxyConfig       - 创建代理配置
│   └── 使用 core.ts 的工具函数
│
├── vue-cli-plugin-dev-proxy.ts  # Vue CLI 插件（~180 行）
│   ├── VueCliPluginDevProxy    - 默认导出
│   ├── createProxyConfig       - 创建代理配置
│   ├── onProxyReq, onError, onProxyRes 钩子
│   └── 使用 core.ts 的工具函数
│
└── index.ts                     # 入口文件
    ├── export VitePluginDevProxy
    └── export VueCliPluginDevProxy
```

## 📝 TypeScript 支持

完整的 TypeScript 类型定义和 JSDoc 注释：

```typescript
import { VitePluginDevProxy } from 'dev-proxy-plugin';
import type { ProxyOptions } from 'dev-proxy-plugin/dist/core';

const config: ProxyOptions = {
  appHost: 'example.com',
  https: true,
  entry: '/src/main.js',
  remotePrefixes: ['/static/component'],
  clearScriptCssPrefixes: (tag: string) => tag.includes('legacy'),
  debug: true,
};

export default defineConfig({
  plugins: [VitePluginDevProxy(config)]
});
```

## ⚙️ 与其他工具对比

| 功能 | dev-proxy-plugin | vite-plugin-proxy | http-proxy-middleware |
|------|-----------------|-------------------|----------------------|
| 双框架支持 | ✅ Vite + Vue CLI | ❌ | ✅ |
| HTML 脚本注入 | ✅ | ❌ | ❌ |
| 脚本清除 | ✅ 4种类型 | ❌ | ❌ |
| Cookie 重写 | ✅ 自动 | ❌ | ⚠️ 手动 |
| 重定向处理 | ✅ 自动转换 | ⚠️ | ⚠️ |
| 压缩支持 | ✅ gzip/deflate/br | ❌ | ⚠️ |
| 灵活配置 | ✅ 4种类型 | ⚠️ 数组 | ⚠️ 对象 |
| TypeScript | ✅ 完整 | ⚠️ 部分 | ✅ |
| 文档 | ✅ 详细 | ⚠️ 简单 | ✅ |
| 代码量 | 📦 ~850 行 | - | - |

## 💡 常见问题

### 1. 为什么需要这个插件？

**场景**：你的项目依赖后端服务器渲染的 HTML，但你想在本地开发时使用 Vite/Vue CLI 的热更新功能。

**解决方案**：
- 代理远程服务器的 HTML
- 清除远程的脚本和样式
- 注入本地开发的脚本
- 处理 Cookie 和重定向问题

### 2. `remotePrefixes` 和 `clearScriptCssPrefixes` 有什么区别？

- **`remotePrefixes`**：控制哪些**资源**从远程加载
- **`clearScriptCssPrefixes`**：控制哪些 HTML **标签**被清除

**示例**：
```javascript
{
  // /static/component 下的资源从远程加载
  remotePrefixes: '/static/component',
  // 但清除 HTML 中 /static 开头的 script/link 标签
  clearScriptCssPrefixes: '/static',
}
```

### 3. 如何调试配置是否生效？

开启 `debug: true`，查看控制台日志：

```javascript
VitePluginDevProxy({
  appHost: 'example.com',
  debug: true,  // 开启调试
  remotePrefixes: (url) => {
    const isRemote = url.startsWith('/static');
    console.log(`[自定义] ${url} -> ${isRemote ? '远程' : '本地'}`);
    return isRemote;
  },
})
```

### 4. 支持哪些压缩格式？

支持 3 种常见的 HTTP 压缩格式：
- **gzip** - `Content-Encoding: gzip`
- **deflate** - `Content-Encoding: deflate`
- **brotli** - `Content-Encoding: br`

### 5. 如何与其他 Vite 插件配合使用？

直接添加到 `plugins` 数组即可：

```javascript
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    VitePluginDevProxy({ appHost: 'example.com' }),
  ]
});
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发指南

```bash
# 克隆项目
git clone https://github.com/CNLHB/dev-proxy-plugin.git

# 安装依赖
pnpm install

# 构建
pnpm run build

# 发布
pnpm publish
```

## 📄 许可证

MIT License © 2024

## 🔗 相关链接

- [npm 包](https://www.npmjs.com/package/dev-proxy-plugin)
- [GitHub 仓库](https://github.com/CNLHB/dev-proxy-plugin)
- [问题反馈](https://github.com/CNLHB/dev-proxy-plugin/issues)
- [remotePrefixes 详细用法](./examples/remotePrefixes-usage.md)
- [WebSocket 热更新修复说明](./examples/WEBSOCKET-HMR-FIX.md)
- [WebSocket 故障排查指南](./examples/WEBSOCKET-TROUBLESHOOTING.md)
- [更新日志](./CHANGELOG.md)

## 🌟 Star History

如果这个项目对你有帮助，请给个 ⭐️ Star 支持一下！

---

Made with ❤️ by [aiwa](https://cnlhb.github.io/blog/)
