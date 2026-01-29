# vite-plugin-dev-proxy

[![npm](https://img.shields.io/npm/dt/vite-plugin-dev-proxy?style=for-the-badge)](https://www.npmjs.com/package/vite-plugin-dev-proxy) ![GitHub Repo stars](https://img.shields.io/github/stars/CNLHB/vite-plugin-dev-proxy?label=GitHub%20Stars&style=for-the-badge) [![GitHub](https://img.shields.io/github/license/CNLHB/vite-plugin-dev-proxy?color=blue&style=for-the-badge)](https://github.com/CNLHB/vite-plugin-dev-proxy/blob/master/LICENSE)
![GitHub last commit](https://img.shields.io/github/last-commit/CNLHB/vite-plugin-dev-proxy?style=for-the-badge) [![Issues](https://img.shields.io/github/issues/CNLHB/vite-plugin-dev-proxy?style=for-the-badge)](https://github.com/CNLHB/vite-plugin-dev-proxy/issues)

A Vite plugin for development environment proxy that automatically proxies remote server requests and handles HTML responses.

## Features

- 🚀 Automatically proxy remote server requests
- 📦 Smart HTML response handling, replacing remote scripts and stylesheets with local development versions
- 🍪 Automatic cookie rewriting, removing Secure and Domain attributes
- 🔀 Redirect handling with protocol mismatch fixes
- ⚙️ Support for custom static resource prefixes
- 🐛 Debug logging support
- 🔗 Merge with other proxy configurations
- 🔧 TypeScript support with full type definitions

## Installation

```bash
npm install vite-plugin-dev-proxy --save-dev
```

```bash
yarn add vite-plugin-dev-proxy --dev
```

```bash
pnpm add vite-plugin-dev-proxy --save-dev
```

## Usage

### Basic Usage

```js
// vite.config.js
import { defineConfig } from 'vite';
import viteDevProxy from 'vite-plugin-dev-proxy';

export default defineConfig({
  plugins: [
    viteDevProxy({
      appHost: 'example.com',
    })
  ]
});
```

### Full Configuration

```js
// vite.config.js
import { defineConfig } from 'vite';
import viteDevProxy from 'vite-plugin-dev-proxy';

export default defineConfig({
  plugins: [
    viteDevProxy({
      appHost: 'example.com',
      https: true,
      staticPrefix: '/dev/static',
      bypassPrefixes: ['/static'],
      scriptCssPrefix: '/static/global',
      entry: '/src/main.js',
      debug: true,
    })
  ]
});
```

### Coexisting with Other Proxy Configurations

```js
// vite.config.js
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
});
```

## API

### `viteDevProxy(options?)`

#### Options

| Parameter | Type | Default | Required | Description |
|-----------|------|---------|----------|-------------|
| `appHost` | `string` | - | ✅ | Target server address |
| `https` | `boolean` | `true` | - | Whether to use HTTPS for the target server |
| `staticPrefix` | `string` | `''` | - | Static resource prefix, used to build local entry path |
| `bypassPrefixes` | `string[]` | `['/static']` | - | List of prefixes to bypass proxy, requests matching these prefixes will access remote resources |
| `scriptCssPrefix` | `string` | `''` | - | Script/CSS prefix, used to precisely match remote scripts and stylesheets to remove |
| `entry` | `string` | `'/src/main.js'` | - | Local development entry file path |
| `isLib` | `boolean` | `false` | - | Whether in component library mode, returns local HTML file when true |
| `localIndexHtml` | `string` | `'index.html'` | - | Local HTML file path (only used when isLib=true) |
| `debug` | `boolean` | `false` | - | Whether to enable debug logging |

## How It Works

### 1. Proxy Configuration

The plugin injects `server.proxy` configuration through Vite's `config` hook, proxying all requests to the target server.

### 2. HTML Processing

When detecting a browser page navigation request and the response is HTML:
- Removes remote `type="module" crossorigin` script tags
- Removes remote `crossorigin` stylesheet link tags
- Inserts local development script entry

### 3. Cookie Rewriting

Automatically removes `Secure`, `Domain`, and `SameSite` attributes from cookies to ensure proper functioning in the local development environment.

### 4. Redirect Handling

- Replaces remote domain names in redirect URLs with local domain names
- Fixes protocol mismatch issues (https://localhost -> http://localhost)

## Debugging

Enable the `debug` option to view detailed logs:

```js
viteDevProxy({
  appHost: 'example.com',
  debug: true,
});
```

Log output example:
```
vite-plugin-dev-proxy: staticPrefix /dev/static
vite-plugin-dev-proxy: scriptCssPrefix /static/global
Proxy request: /admin/index (5ms)
HTML processed: /admin/index (23ms)
Bypass proxy: /static/js/app.js
Redirect handled: https://example.com/login -> http://localhost:3003/login (3ms)
```

## TypeScript Support

This plugin is written in TypeScript and provides full type definitions. You can import types for better development experience:

```typescript
import viteDevProxy, { ProxyOptions } from 'vite-plugin-dev-proxy';

const config: ProxyOptions = {
  appHost: 'example.com',
  https: true,
  debug: true
};

export default defineConfig({
  plugins: [viteDevProxy(config)]
});
```

## Notes

1. `appHost` is a required parameter, not providing it will throw an error
2. The plugin will override `server.proxy` configuration in `vite.config.js`
3. Ensure the local development server port matches the port in redirect handling
4. Use `scriptCssPrefix` to precisely control which remote scripts and stylesheets to remove

## Requirements

- Vite 5.0+
- Node.js 18+

## License

MIT © [aiwa](https://cnlhb.github.io/blog/)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Issues

If you encounter any issues, please report them on [GitHub Issues](https://github.com/CNLHB/vite-plugin-dev-proxy/issues).
