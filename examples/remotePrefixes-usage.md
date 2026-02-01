# remotePrefixes 参数使用指南

`remotePrefixes` 参数用于指定哪些资源应该从远程服务器加载，而不是使用本地资源。该参数支持多种类型：字符串、数组、函数、正则表达式。

## 1. 字符串类型（单个前缀）

最简单的用法，指定单个远程资源前缀：

```javascript
// vite.config.js
import viteDevProxy from '@xysfe/dev-proxy-plugin';

export default {
  plugins: [
    viteDevProxy({
      appHost: 'example.com',
      remotePrefixes: '/static/component',  // 字符串
    })
  ]
}
```

**匹配规则**：URL 以 `/static/component` 开头的资源会从远程加载

**示例**：
- ✅ `/static/component/button.js` → 远程加载
- ✅ `/static/component/styles/main.css` → 远程加载
- ❌ `/static/images/logo.png` → 本地加载

## 2. 数组类型（多个前缀）

指定多个远程资源前缀：

```javascript
// vite.config.js
import viteDevProxy from '@xysfe/dev-proxy-plugin';

export default {
  plugins: [
    viteDevProxy({
      appHost: 'example.com',
      remotePrefixes: [
        '/static/component',
        '/static/lib',
        '/api'
      ],  // 数组
    })
  ]
}
```

**匹配规则**：URL 以数组中任一前缀开头的资源会从远程加载

**示例**：
- ✅ `/static/component/button.js` → 远程加载
- ✅ `/static/lib/jquery.js` → 远程加载
- ✅ `/api/users` → 远程加载
- ❌ `/static/images/logo.png` → 本地加载

## 3. 正则表达式类型

使用正则表达式进行更灵活的匹配：

```javascript
// vite.config.js
import viteDevProxy from '@xysfe/dev-proxy-plugin';

export default {
  plugins: [
    viteDevProxy({
      appHost: 'example.com',
      // 匹配所有 /static/ 下除了 images 文件夹外的资源
      remotePrefixes: /^\/static\/(?!images)/,  // 正则表达式
    })
  ]
}
```

**匹配规则**：URL 匹配正则表达式的资源会从远程加载

**更多示例**：

```javascript
// 匹配所有 .min.js 文件
remotePrefixes: /\.min\.js$/

// 匹配 /api/ 或 /services/ 开头的路径
remotePrefixes: /^\/(api|services)\//

// 匹配包含版本号的资源，如 /lib/v1.2.3/
remotePrefixes: /\/lib\/v\d+\.\d+\.\d+\//
```

## 4. 函数类型（自定义逻辑）

使用函数提供完全自定义的匹配逻辑：

```javascript
// vite.config.js
import viteDevProxy from '@xysfe/dev-proxy-plugin';

export default {
  plugins: [
    viteDevProxy({
      appHost: 'example.com',
      remotePrefixes: (url) => {
        // 自定义逻辑：工作日加载远程资源，周末使用本地资源
        const day = new Date().getDay();
        const isWeekday = day > 0 && day < 6;
        return isWeekday && url.startsWith('/static/component');
      },
    })
  ]
}
```

**函数签名**：
```typescript
remotePrefixes: (url: string) => boolean
```

**参数**：
- `url`: 完整的请求 URL（包含查询参数）

**返回值**：
- `true`: 从远程服务器加载
- `false`: 使用本地资源

### 更多函数示例

```javascript
// 根据环境变量决定
remotePrefixes: (url) => {
  return process.env.USE_REMOTE_COMPONENTS === 'true'
    && url.startsWith('/static/component');
}

// 根据文件大小决定（需要配合其他工具）
remotePrefixes: (url) => {
  const largeFiles = ['/static/video.mp4', '/static/large-data.json'];
  return largeFiles.includes(url);
}

// 复杂的业务逻辑
remotePrefixes: (url) => {
  // 仅特定模块使用远程资源
  if (url.startsWith('/modules/payment/')) return true;
  if (url.startsWith('/modules/checkout/')) return true;

  // 第三方库始终使用远程
  if (url.includes('/vendor/')) return true;

  return false;
}
```

## 5. 组合使用示例

虽然 `remotePrefixes` 只接受一个值，但你可以通过函数来组合多种规则：

```javascript
// vite.config.js
import viteDevProxy from '@xysfe/dev-proxy-plugin';

export default {
  plugins: [
    viteDevProxy({
      appHost: 'example.com',
      remotePrefixes: (url) => {
        // 组合字符串前缀检查
        const prefixes = ['/static/component', '/static/lib'];
        if (prefixes.some(prefix => url.startsWith(prefix))) {
          return true;
        }

        // 组合正则匹配
        if (/\.min\.(js|css)$/.test(url)) {
          return true;
        }

        // 组合自定义逻辑
        if (url.includes('/vendor/') && url.includes('production')) {
          return true;
        }

        return false;
      },
    })
  ]
}
```

## 6. 实际应用场景

### 场景 1：微前端架构

```javascript
// 主应用只使用本地开发，子应用使用远程资源
remotePrefixes: [
  '/micro-app-1/',
  '/micro-app-2/',
  '/shared-components/'
]
```

### 场景 2：渐进式迁移

```javascript
// 已迁移的模块使用本地资源，未迁移的使用远程
remotePrefixes: (url) => {
  const localModules = ['/modules/user/', '/modules/product/'];
  return !localModules.some(module => url.startsWith(module));
}
```

### 场景 3：性能优化

```javascript
// 小文件本地加载，大文件远程加载
remotePrefixes: (url) => {
  const largeAssets = [
    /\/assets\/.*\.(mp4|webm|avi)$/,  // 视频文件
    /\/assets\/.*\.pdf$/,              // PDF文件
    /\/data\/.*\.json$/                // 大型数据文件
  ];
  return largeAssets.some(regex => regex.test(url));
}
```

### 场景 4：A/B 测试

```javascript
// 根据用户ID决定使用本地还是远程组件
remotePrefixes: (url) => {
  if (!url.startsWith('/components/')) return false;

  const userId = getUserId(); // 假设有获取用户ID的函数
  const useRemote = userId % 2 === 0; // 偶数ID使用远程
  return useRemote;
}
```

## 7. 调试技巧

开启 `debug` 模式可以查看每个请求的处理情况：

```javascript
// vite.config.js
import viteDevProxy from '@xysfe/dev-proxy-plugin';

export default {
  plugins: [
    viteDevProxy({
      appHost: 'example.com',
      debug: true,  // 开启调试模式
      remotePrefixes: (url) => {
        const isRemote = url.startsWith('/static/component');
        console.log(`[remotePrefixes] ${url} -> ${isRemote ? 'REMOTE' : 'LOCAL'}`);
        return isRemote;
      },
    })
  ]
}
```

控制台输出示例：
```
[remotePrefixes] /static/component/button.js -> REMOTE
[Proxy] /static/component/button.js
[remotePrefixes] /src/main.js -> LOCAL
[shouldUseLocal] /src/main.js
```

## 8. 注意事项

1. **优先级**：本地资源判断优先于远程资源判断
2. **性能**：函数类型会在每个请求时调用，避免执行耗时操作
3. **缓存**：正则表达式会被缓存，函数每次都会重新执行
4. **默认值**：如果不设置，默认为 `['/static/component']`

## 9. 类型定义

```typescript
interface ProxyOptions {
  // ... 其他配置

  /**
   * 远程资源路径前缀规则
   * - string: 单个前缀匹配
   * - string[]: 多个前缀匹配
   * - RegExp: 正则表达式匹配
   * - Function: 自定义匹配函数
   */
  remotePrefixes?: string | string[] | Function | RegExp;
}
```

## 10. 与 clearScriptCssPrefixes 的区别

- `remotePrefixes`: 控制哪些资源从远程加载
- `clearScriptCssPrefixes`: 控制哪些 `<script>` 和 `<link>` 标签被清除

两者可以配合使用，实现精细的资源控制。
