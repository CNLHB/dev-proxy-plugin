# @xysfe/vite-plugin-dev-proxy

A Vite plugin for development environment proxy that automatically proxies remote server requests and handles HTML responses.

## Features

- 🚀 Automatically proxy remote server requests
- 📦 Smart HTML response handling, replacing remote scripts and stylesheets with local development versions
- 🍪 Automatic cookie rewriting, removing Secure and Domain attributes
- 🔀 Redirect handling with protocol mismatch fixes
- ⚙️ Support for custom static resource prefixes
- 🎯 Flexible script/link tag filtering with string, array, regex, or function
- 🏷️ Custom placeholder replacement for development script injection
- 🐛 Debug logging support
- 🔗 Merge with other proxy configurations
- 🔧 TypeScript support with full type definitions

## Installation

```bash
npm install @xysfe/vite-plugin-dev-proxy --save-dev
```

```bash
yarn add @xysfe/vite-plugin-dev-proxy --dev
```

```bash
pnpm add @xysfe/vite-plugin-dev-proxy --save-dev
```

## Usage

### Basic Usage

```js
// vite.config.js
import { defineConfig } from "vite";
import viteDevProxy from "@xysfe/vite-plugin-dev-proxy";

export default defineConfig({
  plugins: [
    viteDevProxy({
      appHost: "example.com",
    }),
  ],
});
```

### Full Configuration

```js
// vite.config.js
import { defineConfig } from "vite";
import viteDevProxy from "@xysfe/vite-plugin-dev-proxy";

export default defineConfig({
  plugins: [
    viteDevProxy({
      appHost: "example.com",
      https: true,
      staticPrefix: "/dev/static",
      bypassPrefixes: ["/static"],
      clearScriptCssPrefixes: "/static/global",
      developmentAgentOccupancy:
        "<!-- Vite development mode proxy occupancy -->",
      entry: "/src/main.js",
      debug: true,
    }),
  ],
});
```

### Advanced Usage: Custom Script/Link Filtering

```js
// vite.config.js
import { RegeExp } from "vite";
import viteDevProxy from "@xysfe/vite-plugin-dev-proxy";

export default defineConfig({
  plugins: [
    viteDevProxy({
      appHost: "example.com",
      // Filter by string prefix
      clearScriptCssPrefixes: "/static/global",
      // Or filter by multiple prefixes
      clearScriptCssPrefixes: ["/static/global", "/cdn/assets"],
      // Or filter by regex
      clearScriptCssPrefixes: /cdn\.example\.com/,
      // Or filter by custom function
      clearScriptCssPrefixes: (match) => {
        return match.includes("remove-me");
      },
    }),
  ],
});
```

### Coexisting with Other Proxy Configurations

```js
// vite.config.js
export default defineConfig({
  plugins: [
    viteDevProxy({
      appHost: "example.com",
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8080",
      },
    },
  },
});
```

## API

### `viteDevProxy(options?)`

#### Options

| Parameter                   | Type                                       | Default          | Required | Description                                                                                                                    |
| --------------------------- | ------------------------------------------ | ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `appHost`                   | `string`                                   | -                | ✅       | Target server address                                                                                                          |
| `https`                     | `boolean`                                  | `true`           | -        | Whether to be HTTPS for the target server                                                                                      |
| `staticPrefix`              | `string`                                   | `''`             | -        | Static resource prefix, used to build local entry path                                                                         |
| `bypassPrefixes`            | `string[]`                                 | `['/static']`    | -        | List of prefixes to bypass proxy, requests matching these prefixes will access remote resources                                |
| `clearScriptCssPrefixes`    | `string \| string[] \| RegExp \| Function` | `''`             | -        | Filter script/link tags to remove. Supports string prefix, array of prefixes, regex, or custom function                        |
| `developmentAgentOccupancy` | `string`                                   | `''`             | -        | Custom placeholder string to replace with local development script. If not set, script will be injected into div with id="app" |
| `entry`                     | `string`                                   | `'/src/main.js'` | -        | Local development entry file path                                                                                              |
| `isLib`                     | `boolean`                                  | `false`          | -        | Whether in component library mode, returns local HTML file when true                                                           |
| `localIndexHtml`            | `string`                                   | `'index.html'`   | -        | Local HTML file path (only used when isLib=true)                                                                               |
| `debug`                     | `boolean`                                  | `false`          | -        | Whether to enable debug logging                                                                                                |

## How It Works

### 1. Proxy Configuration

The plugin injects `server.proxy` configuration through Vite's `config` hook, proxying all requests to the target server.

### 2. HTML Processing

When detecting a browser page navigation request and the response is HTML:

- Matches all `<script>` and `<link>` tags in the HTML
- Removes tags based on `clearScriptCssPrefixes` configuration:
  - If string: removes tags where src/href starts with the prefix
  - If array: removes tags where src/href starts with any of the prefixes
  - If RegExp: removes tags matching the regex pattern
  - If Function: removes tags where the function returns true
- Inserts local development script entry:
  - If `developmentAgentOccupancy` is set, replaces that placeholder with the local script
  - Otherwise, injects the local script into `<div id="app">` element

### 3. Cookie Rewriting

Automatically removes `Secure`, `Domain`, and `SameSite` attributes from cookies to ensure proper functioning in the local development environment.

### 4. Redirect Handling

- Replaces remote domain names in redirect URLs with local domain names
- Fixes protocol mismatch issues (https://localhost -> http://localhost)

## Debugging

Enable the `debug` option to view detailed logs:

```js
viteDevProxy({
  appHost: "example.com",
  debug: true,
});
```

Log output example:

```
@xysfe/vite-plugin-dev-proxy: staticPrefix /dev/static
Proxy request: /admin/index (5ms)
HTML processed: /admin/index (23ms)
Bypass proxy: /static/js/app.js
Redirect handled: https://example.com/login -> http://localhost:3003/login (3ms)
```

## TypeScript Support

This plugin is written in TypeScript and provides full type definitions. You can import types for better development experience:

```typescript
import viteDevProxy, { ProxyOptions } from "@xysfe/vite-plugin-dev-proxy";

const config: ProxyOptions = {
  appHost: "example.com",
  https: true,
  debug: true,
};

export default defineConfig({
  plugins: [viteDevProxy(config)],
});
```

## Notes

1. `appHost` is a required parameter, not providing it will throw an error
2. The plugin will override `server.proxy` configuration in `vite.config.js`
3. Ensure the local development server port matches the port in redirect handling
4. Use `clearScriptCssPrefixes` to flexibly control which remote scripts and stylesheets to remove
5. Use `developmentAgentOccupancy` to specify a custom placeholder for script injection, or let the plugin automatically inject into `<div id="app">`

## Requirements

- Vite 5.0+
- Node.js 18+

## License

MIT © [aiwa](https://cnlhb.github.io/blog/)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Issues

If you encounter any issues, please report them on [GitHub Issues](https://github.com/CNLHB/@xysfe/vite-plugin-dev-proxy/issues).
