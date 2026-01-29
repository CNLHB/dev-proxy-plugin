# vite-plugin-dev-proxy

Vite 开发环境代理插件，用于在开发环境中代理远程服务器，并自动处理 HTML 响应。

## 功能特性

- 自动代理远程服务器请求
- 智能处理 HTML 响应，替换远程脚本和样式表为本地开发版本
- 自动重写 Cookie，移除 Secure 和 Domain 属性
- 处理重定向，修复协议不匹配问题
- 支持自定义静态资源前缀
- 支持调试日志
- 支持与其他 proxy 配置合并

## 安装

```bash
npm install vite-plugin-dev-proxy
```

## 使用方法

### 基础使用

```javascript
import viteDevProxy from 'vite-plugin-dev-proxy'

export default defineConfig({
  plugins: [
    viteDevProxy({
      appHost: 'example.com',
    })
  ]
})
```

### 完整配置

```javascript
import viteDevProxy from 'vite-plugin-dev-proxy'

export default defineConfig({
  plugins: [
    viteDevProxy({
      appHost: 'example.com',
      staticPrefix: '/dev/static',
      bypassPrefixes: ['/static'],
      scriptCssPrefix: '/static/global',
      entry: '/src/main.js',
      debug: true,
    })
  ]
})
```

### 与其他 proxy 配置共存

```javascript
export default defineConfig({
  plugins: [
    viteDevProxy({
      appHost: 'example.com',
    })
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080'
      }
    }
  }
})
```

## 配置选项

| 参数 | 类型 | 默认值 | 必填 | 说明 |
|------|------|--------|------|------|
| `appHost` | `string` | - | ✅ | 目标服务器地址 |
| `staticPrefix` | `string` | `''` | - | 静态资源前缀，用于构建本地入口路径 |
| `bypassPrefixes` | `string[]` | `['/static']` | - | 跳过代理的前缀列表，匹配这些前缀的请求将访问远程资源 |
| `scriptCssPrefix` | `string` | `''` | - | Script/CSS 前缀，用于精确匹配需要移除的远程脚本和样式表 |
| `entry` | `string` | `'/src/main.js'` | - | 本地开发入口文件路径 |
| `isLib` | `boolean` | `false` | - | 是否为组件库模式，为 true 时返回本地 HTML 文件 |
| `localIndexHtml` | `string` | `'index.html'` | - | 本地 HTML 文件路径（仅在 isLib=true 时使用） |
| `debug` | `boolean` | `false` | - | 是否启用调试日志 |

## 工作原理

### 1. 代理配置

插件通过 Vite 的 `config` 钩子注入 `server.proxy` 配置，将所有请求代理到目标服务器。

### 2. HTML 处理

当检测到浏览器页面导航请求且响应是 HTML 时：
- 移除远程的 `type="module" crossorigin` script 标签
- 移除远程的 `crossorigin` stylesheet link 标签
- 插入本地开发脚本入口

### 3. Cookie 重写

自动移除 Cookie 中的 `Secure`、`Domain`、`SameSite` 属性，确保本地开发环境正常工作。

### 4. 重定向处理

- 替换重定向 URL 中的远程域名为本地域名
- 修复协议不匹配问题（https://localhost -> http://localhost）

## 调试

启用 `debug` 选项查看详细日志：

```javascript
viteDevProxy({
  appHost: 'example.com',
  debug: true,
})
```

日志输出示例：
```
vite-plugin-dev-proxy: staticPrefix /dev/static
vite-plugin-dev-proxy: scriptCssPrefix /static/global
Proxy request: /admin/index (5ms)
HTML processed: /admin/index (23ms)
Bypass proxy: /static/js/app.js
Redirect handled: https://example.com/login -> http://localhost:3003/login (3ms)
```

## 注意事项

1. `appHost` 是必填参数，不提供会抛出错误
2. 插件会优先覆盖 `vite.config.js` 中的 `server.proxy` 配置
3. 确保本地开发服务器端口与重定向处理中的端口一致
4. 使用 `scriptCssPrefix` 可以精确控制移除哪些远程脚本和样式表

## License

MIT
