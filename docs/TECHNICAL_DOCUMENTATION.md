# vite-plugin-dev-proxy 技术文档

## 目录

- [功能概述](#功能概述)
- [核心架构](#核心架构)
- [接口定义](#接口定义)
- [配置参数](#配置参数)
- [核心算法说明](#核心算法说明)
- [使用示例](#使用示例)
- [注意事项](#注意事项)
- [常见问题解答](#常见问题解答)

---

## 功能概述

`vite-plugin-dev-proxy` 是一个用于开发环境的代理插件，支持 Vite 和 Vue CLI 两种构建工具。它能够在开发环境中自动代理远程服务器请求，并智能处理 HTML 响应，实现本地开发与远程资源的无缝集成。

### 主要特性

1. **自动代理远程服务器**：将所有开发环境的 HTTP/HTTPS 请求代理到指定的远程服务器
2. **智能 HTML 处理**：自动检测并处理 HTML 响应，注入本地入口脚本
3. **脚本和样式清理**：支持清除远程 HTML 中的指定脚本和样式表链接
4. **Cookie 重写**：自动移除 Cookie 中的 Secure、Domain、SameSite 属性，确保本地开发环境正常工作
5. **重定向处理**：自动处理 HTTP 重定向，修复协议不匹配问题（https://localhost → http://localhost）
6. **WebSocket 支持**：完整支持 WebSocket 连接代理，避免 "Invalid frame header" 错误
7. **多入口支持**：支持单个或多个入口文件配置
8. **库模式**：支持组件库开发模式，直接返回本地 HTML 文件
9. **调试日志**：提供详细的请求和响应日志，便于调试
10. **配置合并**：自动与现有的代理配置合并

### 支持的构建工具

- ✅ Vite 5.x+
- ✅ Vue CLI 5.x+
- ✅ Webpack 5.x+

---

## 核心架构

### 模块结构

```
src/
├── index.ts                    # 主入口文件，导出 Vite 和 Vue CLI 插件
├── vite-cli.ts                 # Vite 插件实现
├── vue-cli-plugin-dev-proxy.ts  # Vue CLI 插件实现
├── vue-cli.js                  # Vue CLI 配置形式导出
└── core.ts                     # 核心逻辑和工具函数
```

### 工作流程

```
┌─────────────────┐
│  开发服务器   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│  vite-plugin-dev-proxy           │
│                                 │
│  ┌─────────────────────────────┐  │
│  │ 请求分类与路由          │  │
│  └──────┬──────────────────┘  │
│         │         │
│         ▼         │
│  ┌─────────────┬──────────┐  │
│  │ 本地资源     │ 远程资源 │  │
│  └──────┬───────┴───────┬──┘  │
│         │               │       │    │
│         ▼               ▼       │    │
│  ┌─────────────┐  ┌───────────┐  │
│  │ 本地文件服务  │  HTTP 代理 │  │
│  └──────┬──────┘  └──────┬────┘  │
│         │               │       │    │
│         │               │       │    │
│         └───────────────┴───────┘    │
│                 │                │
│                 ▼                │
│         ┌──────────────────┐       │
│         │  响应处理         │       │
│         │  - Cookie 重写      │       │
│         │  - 重定向处理      │       │
│         │  - HTML 注入        │       │
│         │  - 脚本清理        │       │
│         └──────┬───────────┘       │
│                │                  │
│                ▼                  │
│         ┌──────────────────┐       │
│         │  返回给浏览器      │       │
│         └──────────────────┘       │
└─────────────────────────────────────┘
```

### 关键组件

1. **请求分类器（Request Classifier）**：判断请求应该使用本地资源还是代理到远程服务器
2. **代理配置生成器（Proxy Config Generator）**：根据用户配置生成 http-proxy 配置对象
3. **响应处理器（Response Handler）**：处理代理响应，包括 HTML 处理、Cookie 重写、重定向处理
4. **HTML 注入器（HTML Injector）**：将本地入口脚本注入到远程 HTML 中
5. **脚本清理器（Script Cleaner）**：根据规则清除远程 HTML 中的脚本和样式标签
6. **Cookie 重写器（Cookie Rewriter）**：移除 Cookie 中的安全属性
7. **重定向处理器（Redirect Handler）**：处理 HTTP 重定向，修复协议和域名

---

## 接口定义

### ProxyOptions

代理插件配置选项接口。

```typescript
interface ProxyOptions {
  https?: boolean;
  appHost?: string;
  isLib?: boolean;
  localIndexHtml?: string;
  staticPrefix?: string;
  remotePrefixes?: string | string[] | Function | RegExp;
  clearScriptCssPrefixes?: string | string[] | Function | RegExp;
  developmentAgentOccupancy?: string;
  entry?: string | string[];
  debug?: boolean;
}
```

### IncomingMessage

HTTP 请求消息对象接口。

```typescript
interface IncomingMessage {
  url?: string;
  headers: { [key: string]: string | string[] | undefined };
  method?: string;
  host?: string;
  accept?: string;
}
```

### ProxyResponse

代理响应对象接口。

```typescript
interface ProxyResponse {
  statusCode: number;
  headers: { [key: string]: string | string[] | undefined };
  on: (event: string, callback: (chunk?: Buffer) => void) => void;
  pipe: (destination: ServerResponse) => void;
}
```

### ServerResponse

HTTP 服务器响应对象接口。

```typescript
interface ServerResponse {
  writeHead: (
    statusCode: number,
    headers?: { [key: string]: string | string[] | undefined },
  ) => void;
  end: (data?: string) => void;
  headersSent?: boolean;
}
```

---

## 配置参数

### appHost

- **类型**：`string`
- **默认值**：无（必填）
- **说明**：目标服务器的主机地址，不包含协议
- **示例**：`'example.com'`、`'beta-internal.cxmuc.com'`

### https

- **类型**：`boolean`
- **默认值**：`true`
- **说明**：是否使用 HTTPS 协议连接目标服务器
- **示例**：`true`（使用 https://）、`false`（使用 http://）

### staticPrefix

- **类型**：`string`
- **默认值**：`''`
- **说明**：静态资源路径前缀，用于构建本地入口文件的完整路径
- **示例**：`'/dev/static'`、`'/static/contract'`

### remotePrefixes

- **类型**：`string | string[] | Function | RegExp`
- **默认值**：`['/static']`
- **说明**：需要代理到远程服务器的资源路径前缀规则
  - `string`：单个前缀字符串
  - `string[]`：前缀数组，匹配任一前缀
  - `Function`：自定义匹配函数，返回 `true` 表示匹配
  - `RegExp`：正则表达式匹配
- **示例**：

  ```javascript
  // 字符串
  remotePrefixes: "/static/component";

  // 数组
  remotePrefixes: ["/static", "/api"];

  // 函数
  remotePrefixes: (url) => url.startsWith("/api");

  // 正则
  remotePrefixes: /^\/api\//;
  ```

### clearScriptCssPrefixes

- **类型**：`string | string[] | Function | RegExp`
- **默认值**：`''`
- **说明**：需要从远程 HTML 中清除的脚本和样式表链接的前缀规则
  - `string`：单个前缀字符串
  - `string[]`：前缀数组，匹配任一前缀
  - `Function`：自定义匹配函数，返回 `true` 表示清除
  - `RegExp`：正则表达式匹配
- **示例**：

  ```javascript
  // 字符串
  clearScriptCssPrefixes: "//sslstatic.example.com/contract";

  // 数组
  clearScriptCssPrefixes: ["//cdn1.example.com", "//cdn2.example.com"];

  // 函数
  clearScriptCssPrefixes: (match) => match.includes("cdn");

  // 正则
  clearScriptCssPrefixes: /<script[^>]*src=["']https?:\/\/cdn\./;
  ```

### entry

- **类型**：`string | string[]`
- **默认值**：`'/src/main.js'`（Vite）、`['/js/chunk-vendors.js', '/js/app.js']`（Vue CLI）
- **说明**：本地开发入口文件路径，支持单个或多个入口
- **示例**：

  ```javascript
  // 单入口
  entry: "/src/main.js";

  // 多入口
  entry: ["/src/main.js", "/src/polyfills.js"];
  ```

### isLib

- **类型**：`boolean`
- **默认值**：`false`
- **说明**：是否为组件库模式。启用后，直接返回本地 HTML 文件，不进行远程代理
- **示例**：`true`

### localIndexHtml

- **类型**：`string`
- **默认值**：`'index.html'`
- **说明**：本地 HTML 文件路径（仅在 `isLib=true` 时使用）
- **示例**：`'public/index.html'`

### developmentAgentOccupancy

- **类型**：`string`
- **默认值**：`''`
- **说明**：开发代理占位符，用于精确替换 HTML 中的特定位置为入口脚本
- **示例**：`'<!-- Vite development mode proxy occupancy -->'`

### debug

- **类型**：`boolean`
- **默认值**：`false`
  `- **说明**：是否启用调试日志。启用后会输出详细的请求和响应信息
- **示例**：`true`

---

## 核心算法说明

### 1. 请求分类算法

**目的**：判断请求应该使用本地资源还是代理到远程服务器。

**算法流程**：

```
输入：请求 URL
输出：本地资源 | 远程代理

1. 提取 URL 的 pathname（去除查询参数）
2. 检查是否匹配本地资源规则：
   - staticPrefix + 源代码路径
   - /@ 开头（Vite 虚拟模块）
   - /src 开头（源代码）
   - /node_modules 开头（依赖）
   - 包含 .hot-update.（热更新）
   - /sockjs-node 开头（Vue CLI/Webpack 热更新 WebSocket）
   - 根路径 "/"
   - 匹配本地资源扩展名（.vue, .js, .css 等）
3. 检查是否匹配远程资源规则（remotePrefixes）
4. 判断逻辑：
   IF 匹配本地资源规则 AND 不匹配远程资源规则 THEN
     返回使用本地资源
   ELSE
     返回远程代理
```

**时间复杂度**：O(n)，其中 n 为 remotePrefixes 的数量

**空间复杂度**：O(1)

### 2. HTML 处理算法

**目的**：检测并处理 HTML 响应，注入本地入口脚本并清理远程脚本。

**算法流程**：

```
输入：代理响应
输出：处理后的 HTML

1. 检查响应状态码是否为 3xx 重定向
   IF 是重定向 THEN
     执行重定向处理算法
     返回

2. 检查是否应该处理为 HTML：
   - Content-Type 包含 "text/html"
   - Accept 请求头包含 "text/html"
   - URL 不是静态资源路径
   - URL 不是本地资源扩展名
   - 不是重定向

   IF 不应该处理为 HTML THEN
     直接代理响应
     返回

3. 检查是否为库模式（isLib）
   IF 是库模式 THEN
     读取本地 HTML 文件
     返回本地 HTML

4. 处理远程 HTML：
   a. 收集响应数据块
   b. 等待响应结束
   c. 解压缩响应数据（gzip/deflate/br）
   d. 转换为 UTF-8 字符串
   e. 注入本地入口脚本
   f. 清理远程脚本和样式标签
   g. 确保入口脚本存在
   h. 重写响应头
   i. 发送处理后的 HTML
```

**时间复杂度**：O(m)，其中 m 为 HTML 内容长度

**空间复杂度**：O(m)，需要缓存整个 HTML 内容

### 3. Cookie 重写算法

**目的**：移除 Cookie 中的安全属性，确保本地开发环境正常工作。

**算法流程**：

```
输入：Cookie 字符串
输出：重写后的 Cookie 字符串

1. 移除 "secure" 属性（不区分大小写）
   正则：/;\s*secure\s*(;|$)/gi → 替换为 $1

2. 移除 "domain" 属性
   正则：/;\s*domain\s*=[^;]+(;|$)/gi → 替换为 $1

3. 移除 "samesite" 属性
   正则：/;\s*samesite\s*=[^;]+(;|$)/gi → 替换为 $1

4. 清理多余的分号
   正则：/;+/g → 替换为 ";"

5. 移除末尾的分号和空格
   正则：/;\s*$/g → 替换为空字符串
```

**示例**：

```
输入：sessionid=abc123; Secure; Domain=.example.com; SameSite=Lax; Path=/
输出：sessionid=abc123; Path=/
```

### 4. 重定向处理算法

**目的**：处理 HTTP 重定向，修复协议和域名不匹配问题。

**算法流程**：

```
输入：重定向 URL，请求头
输出：处理后的重定向 URL

1. 获取重定向目标 URL（Location 头）
2. 获取请求的 Host 头
3. 替换目标 URL 中的远程域名为本地域名
   正则：new RegExp(appHost, 'gi')
   替换：host

4. 修复协议不匹配问题
   正则：/https:\/\/(localhost|127\.0\.0\.1)(:\d+)?/gi
   替换：http://$1$2

5. 重写 Cookie（应用 Cookie 重写算法）
6. 返回处理后的重定向 URL
```

**示例**：

```
输入：
  Location: https://example.com/login
  Host: localhost:3000

输出：
  Location: http://localhost:3000/login
```

### 5. 脚本清理算法

**目的**：根据规则清除远程 HTML 中的脚本和样式标签。

**算法流程**：

```
输入：HTML 内容，清理规则
输出：清理后的 HTML 内容

1. 使用正则匹配所有 <script> 和 <link> 标签
   正则：/<(?:script[^>]*>.*?<\/script>|link[^>]*>)/g

2. 对每个匹配的标签执行：
   a. 提取 src 或 href 属性值
   b. 根据清理规则类型判断是否应该清除：
      - 字符串：检查是否以指定前缀开头
      - 数组：检查是否匹配任一前缀
      - 正则：测试是否匹配正则
      - 函数：调用自定义判断函数
   c. 如果应该清除，则替换为空字符串
   d. 否则保留原标签

3. 返回处理后的 HTML
```

**正则表达式**：

```javascript
// 匹配 script 和 link 标签
/<(?:script[^>]*>.*?<\/script>|link[^>]*>)/g

// 提取 src 属性
/src="([^"]+)"/i

// 提取 href 属性
/href="([^"]+)"/i
```

### 6. WebSocket 处理算法

**目的**：正确处理 WebSocket 连接，避免 "Invalid frame header" 错误。

**算法流程**：

```
输入：请求对象
输出：WebSocket 连接处理

1. 检查 Upgrade 请求头
   upgradeHeader = req.headers.upgrade

2. 判断是否为 WebSocket 请求
   isWebSocket = upgradeHeader && upgradeHeader.toLowerCase() === 'websocket'

3. 如果是 WebSocket 请求：
   a. 记录 WebSocket 请求日志
   b. 在 onProxyRes 中直接透传响应
   c. 不进行 HTML 处理
   d. 应用 Cookie 重写
   e. pipe 响应到客户端

4. 如果不是 WebSocket 请求：
   执行标准 HTTP 请求处理流程
```

**关键点**：

- 必须在 `onProxyRes` 开始处检测 WebSocket 请求
- WebSocket 响应必须直接透传，不经过任何处理
- 必须设置 `ws: true` 配置项（Vue CLI 5.x）

---

## 使用示例

### Vite 项目

#### 基础配置

```javascript
// vite.config.js
import { defineConfig } from "vite";
import viteDevProxy from "vite-plugin-dev-proxy";

export default defineConfig({
  plugins: [
    viteDevProxy({
      appHost: "example.com",
      https: true,
      entry: "/src/main.js",
      staticPrefix: "/dev/static",
      remotePrefixes: ["/static/component"],
      clearScriptCssPrefixes: "//cdn.example.com",
      debug: true,
    }),
  ],
});
```

#### 与其他代理配置合并

```javascript
// vite.config.js
import { defineConfig } from "vite";
import viteDevProxy from "vite-plugin-dev-proxy";

export default defineConfig({
  plugins: [
    viteDevProxy({
      appHost: "example.com",
      https: true,
      debug: true,
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
```

### Vue CLI 项目

#### 配置形式

```javascript
// vue.config.js
const { VueCliPluginDevProxy } = require("vite-plugin-dev-proxy/vue-cli");

module.exports = VueCliPluginDevProxy({
  appHost: "example.com",
  https: true,
  staticPrefix: "/static/contract",
  clearScriptCssPrefixes: ["//sslstatic.xiaoyusan.com/contract"],
  remotePrefixes: ["/static/component"],
  entry: ["/js/chunk-vendors.js", "/js/app.js"],
  debug: true,
});
```

#### 与其他配置合并

```javascript
// vue.config.js
const { VueCliPluginDevProxy } = require("vite-plugin-dev-proxy/vue-cli");
const devProxy = VueCliPluginDevProxy({
  appHost: "example.com",
  https: true,
  debug: true,
});

module.exports = {
  devServer: {
    proxy: {
      ...devProxy.devServer.proxy,
      "/api": {
        target: "http://localhost:8080",
      },
    },
  },
};
```

#### 插件形式（vue add）

```bash
# 安装插件
vue add vue-cli-plugin-dev-proxy
```

```javascript
// vue.config.js
module.exports = {
  pluginOptions: {
    vueCliPluginDevProxy: {
      appHost: "example.com",
      https: true,
      debug: true,
    },
  },
};
```

### Webpack 项目

```javascript
// webpack.config.js
const webpackDevProxy = require("vite-plugin-dev-proxy");

module.exports = {
  // ...其他配置
  devServer: {
    ...webpackDevProxy({
      appHost: "example.com",
      https: true,
      debug: true,
    }),
  },
};
```

### 多入口配置

```javascript
viteDevProxy({
  appHost: "example.com",
  https: true,
  entry: ["/src/main.js", "/src/polyfills.js", "/src/vendor.js"],
  debug: true,
});
```

### 库模式

```javascript
viteDevProxy({
  appHost: "example.com",
  https: true,
  isLib: true,
  localIndexHtml: "public/index.html",
  debug: true,
});
```

### 自定义清理规则

```javascript
viteDevProxy({
  appHost: "example.com",
  https: true,
  // 使用函数自定义清理规则
  clearScriptCssPrefixes: (match) => {
    // 清除所有来自特定域名的脚本
    return (
      match.includes("cdn.example.com") || match.includes("static.example.com")
    );
  },
  debug: true,
});
```

---

## 注意事项

### 1. 必填参数

- `appHost` 是必填参数，不提供会抛出错误
- 错误信息：`vite-plugin-dev-proxy: appHost is required`

### 2. 环境限制

- 插件仅在 `NODE_ENV === 'development'` 时生效
- 生产环境会返回空配置，不影响构建

### 3. 路径标准化

- `staticPrefix` 会自动移除末尾的斜杠
- 例如：`'/static/'` → `'/static'`

### 4. WebSocket 支持

- Vue CLI 5.x 必须设置 `ws: true`
- Vue CLI 4.x 不需要设置 `ws: true`
- 必须在 `onProxyRes` 开始处检测 WebSocket 请求

### 5. 响应处理

- 设置 `selfHandleResponse: true` 会拦截所有响应
- WebSocket 响应必须直接透传，不经过 HTML 处理
- 否则会报 "Invalid frame header" 错误

### 6. Cookie 重写

- Cookie 重写会移除 `Secure`、`Domain`、`SameSite` 属性
- 这是为了确保本地开发环境（localhost）能正常使用远程 Cookie

### 7. 重定向处理

- 重定向会自动替换远程域名为本地域名
- 会修复协议不匹配问题（https://localhost → http://localhost）
- 确保 HMR（热模块替换）正常工作

### 8. 性能考虑

- HTML 处理需要缓存整个响应内容
- 大型 HTML 文件可能会占用较多内存
- 建议在 `debug` 模式下监控处理时间

### 9. 配置合并

- 插件会自动与现有的代理配置合并
- 使用展开运算符合并配置
- 插件配置优先级高于现有配置

### 10. 正则表达式

- 所有正则表达式使用全局标志（`g`）
- 大小写不敏感匹配使用 `i` 标志
- 路径匹配使用 `gi` 标志

---

## 常见问题解答

### Q1: WebSocket 连接失败，报错 "Invalid frame header"

**原因**：

- `selfHandleResponse: true` 会拦截所有响应，包括 WebSocket 握手响应
- WebSocket 握手响应被当作普通 HTTP 响应处理，导致帧头解析失败

**解决方案**：

```javascript
// 1. 设置 ws: true（Vue CLI 5.x）
{
  ws: true,
  selfHandleResponse: true
}

// 2. 在 onProxyRes 开始处检测 WebSocket
onProxyRes: (proxyRes, req, res) => {
  const upgradeHeader = req.headers.upgrade;
  const isWebSocket = upgradeHeader && upgradeHeader.toLowerCase() === 'websocket';

  if (isWebSocket) {
    // 直接透传，不处理
    const headers = rewriteCookies({ ...proxyRes.headers });
    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res);
    return;
  }

  // 继续处理 HTTP 请求...
}
```

### Q2: Cookie 在本地开发环境不生效

**原因**：

- 远程服务器设置的 Cookie 包含 `Secure`、`Domain`、`SameSite` 属性
- 这些属性会阻止 Cookie 在 localhost 环境下使用

**解决方案**：
-` 插件会自动重写 Cookie，移除这些属性

- 启用 `debug: true` 可以查看重写后的 Cookie

**日志示例**：

```[rewrittenCookie] sessionid=abc123; Path=/

```

### Q3: 重定向后 HMR（热模块替换）失败

**原因**：

- 重定向 URL 中的协议不匹配
- 例如：`https://localhost` 在本地开发环境不可用

**解决方案**：

- 插件会自动修复重定向 URL
- 将 `https://localhost` 替换为 `http://localhost`

**日志示例**：

```
Redirect handled: https://example.com/login -> http://localhost:3000/login (3ms)
```

### Q4: 远程脚本没有被清除

**原因**：

- `clearScriptCssPrefixes` 配置不正确
- 规则与实际 URL 不匹配

**解决方案**：

```javascript
// 检查实际的脚本 URL
// 例如：<script src="https://cdn.example.com/app.js"></script>

// 正确的配置
clearScriptCssPrefixes: "https://cdn.example.com";

// 或使用数组
clearScriptCssPrefixes: ["https://cdn.example.com", "https://cdn2.example.com"];

// 或使用正则
clearScriptCssPrefixes: /https:\/\/cdn\.example\.com\//;

// 启用 debug 查看匹配情况
debug: true;
```

### Q5: 本地资源路径 404

**原因**：

- `staticPrefix` 配置不正确
- 本地资源路径与实际文件路径不匹配

**解决方案**：

```javascript
// 确保 staticPrefix 与实际文件结构匹配
staticPrefix: "/dev/static";

// 检查入口文件路径
entry: "/src/main.js";

// 完整的本地路径将是：
// /dev/static/src/main.js

// 启用 debug 查看请求日志
debug: true;
```

### Q6: 插件在生产环境生效

**原因**：

- 插件在 `NODE_ENV === 'development'` 时才生效
- 生产环境不需要代理功能

**解决方案**：

- 这是正常行为，不是错误
- 生产环境应该使用实际的构建配置
- 如果需要在生产环境使用代理，应该配置服务器级别的代理

### Q7: 多入口脚本没有全部注入

**原因**：

- `entry` 配置为数组时，脚本标签生成逻辑有问题
- HTML 中没有匹配到占位符

**解决方案**：

```javascript
// 使用数组配置多入口
entry: ["/src/main.js", "/src/polyfills.js"];

// 生成的 HTML：
// <script crossorigin type="module" src="/dev/static/src/main.js"></script>
// <script crossorigin type="module" src="/dev/static/src/polyfills.js"></script>

// 如果使用 developmentAgentOccupancy
developmentAgentOccupancy: "<!-- Vite development mode proxy occupancy -->";

// HTML 中需要有对应的占位符
// <div id="app"><!-- Vite development mode proxy occupancy --></div>
```

### Q8: 代理请求超时

**原因**：

- 远程服务器响应慢
- 网络连接问题

**解决方案**：

```javascript
// 在 vite.config.js 中配置超时
server: {
  proxy: {
    '/': {
      // ...其他配置
      timeout: 30000,  // 30 秒
      proxyTimeout: 30000
    }
  }
}
```

### Q9: SSL 证书验证失败

**原因**：

- 远程服务器使用自签名证书
- `secure: true` 会验证证书

**解决方案**：

```javascript
viteDevProxy({
  appHost: "example.com",
  https: true,
  // 插件内部已设置 secure: false
  // 如果需要验证证书，可以手动配置
  debug: true,
});
```

### Q10: 如何调试代理请求

**解决方案**：

```javascript
// 1. 启用 debug 模式
viteDevProxy({
  appHost: "example.com",
  debug: true,
});

// 2. 查看控制台日志
// [proxyReq] GET /api/users -> example.com/api/users
// [proxyRes] /api/users - Status: 200, ContentType: application/json
// Proxy request: /api/users (5ms)

// 3. 查看 WebSocket 日志
// [WebSocket] GET /ws -> example.com/ws
// [WebSocket Response] /ws

// 4. 查看重定向日志
// Redirect handled: https://example.com/login -> http://localhost:3000/login (3ms)

// 5. 查看 HTML 处理日志
// [shouldProcessHtml] true, requestUrl: /
// [HTML processed]: / (23ms)
```

---

## 附录

### A. 正则表达式参考

```javascript
// 匹配脚本和样式标签
SCRIPT_LINK_REGEX = /<(?:script[^>]*>.*?<\/script>|link[^>]*>)/g;

// 匹配静态资源扩展名
ASSET_REGEX =
  /\.(js|mjs|ts|tsx|jsx|css|scss|sass|less|vue|json|woff2?|ttf|eot|ico|png|jpe?g|gif|svg|webp)(\?.*)?$/i;

// 匹配静态资源路径
STATIC_PATH_REGEX = /^\/(static|assets|public|images|css|js)\//i;

// 匹配本地资源扩展名
BYPASS_REGEX =
  /\.(vue|js|mjs|ts|tsx|jsx|css|scss|sass|less|json|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot)$/i;

// 匹配应用挂载点
DEFAULT_APP_DIV_REGEX = /<div[^>]*id=["']app["'][^>]*><\/div>/g;

// HTTPS 转 HTTP
HTTPS_TO_HTTP_REGEX = /https:\/\/(localhost|127\.0\.0\.1)(:\d+)?/gi;
```

### B. 默认配置值

```javascript
// Vite 默认配置
{
  https: true,
  appHost: '',
  isLib: false,
  localIndexHtml: 'index.html',
  staticPrefix: '',
  remotePrefixes: ['/static/component'],
  clearScriptCssPrefixes: '',
  entry: '/src/main.js',
  debug: false
}

// Vue CLI 默认配置
{
  https: true,
  appHost: '',
  isLib: false,
  localIndexHtml: 'index.html',
  staticPrefix: '',
  remotePrefixes: ['/static/component'],
  clearScriptCssPrefixes: '',
  entry: ['/js/chunk-vendors.js', '/js/app.js'],
  debug: false
}
```

### C. 日志格式

```javascript
// 代理请求日志
[proxyReq] {METHOD} {URL} -> {HOST}{PATH}

// WebSocket 请求日志
[WebSocket] {METHOD} {URL} -> {HOST}{PATH}

// 代理响应日志
[proxyRes] {URL} - Status: {CODE}, ContentType: {TYPE}

// WebSocket 响应日志
[WebSocket Response] {URL}

// 重定向日志
Redirect handled: {FROM} -> {TO} ({TIME}ms)

// HTML 处理日志
[HTML processed]: {URL} ({TIME}ms)

// 本地资源日志
shouldUseLocal: {URL}

// 代理日志
Proxy request: {URL} ({TIME}ms)

// Cookie 重写日志
[rewrittenCookie] {COOKIE}

// 错误日志
[proxyError] {URL}: {MESSAGE}
[WebSocket Error] {URL}: {MESSAGE}
```

---

## 版本历史

### v1.0.0

- ✅ 初始版本
- ✅ 支持 Vite 和 Vue CLI
- ✅ 基础代理功能
- ✅ HTML 注入和清理
- ✅ Cookie 重写
- ✅ 重定向处理
- ✅ WebSocket 支持
- ✅ 多入口配置
- ✅ 库模式
- ✅ 调试日志

---

## 相关资源

- [Vite 官方文档](https://vitejs.dev/)
- [Vue CLI 官方文档](https://cli.vuejs.org/)
- [http-proxy 文档](https://github.com/http-party/node-http-proxy)
- [WebSocket 协议](https://tools.ietf.org/html/rfc6455)

---

**文档版本**：1.0.0  
**最后更新**：2026-01-31  
**维护者**：vite-plugin-dev-proxy 团队
