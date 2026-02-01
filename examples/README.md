# Examples

This directory contains example projects demonstrating how to use `dev-proxy-plugin` with different build tools.

## Available Examples

### 1. Vite Project
A modern Vite project with Vue 3 using the plugin.

**Location:** `examples/vite-project`

**Features:**
- Vue 3 with Composition API
- Vite 5.x
- TypeScript support
- Hot Module Replacement (HMR)

**Run the example:**
```bash
cd examples/vite-project
npm install
npm run dev
```

The dev server will start at `http://localhost:3000`

### 2. Vue-Cli Project
A Vue-Cli project demonstrating traditional Vue development workflow.

**Location:** `examples/vue-cli-project`

**Features:**
- Vue 3 with Options API
- Vue CLI 5.x
- Traditional build setup

**Run the example:**
```bash
cd examples/vue-cli-project
npm install
npm run serve
```

The dev server will start at `http://localhost:3001`

### 3. Webpack Project
A pure Webpack project showing how to use the plugin with custom Webpack configuration.

**Location:** `examples/webpack-project`

**Features:**
- Vue 3
- Webpack 5.x
- Custom webpack configuration
- Vue Loader setup

**Run the example:**
```bash
cd examples/webpack-project
npm install
npm run dev
```

The dev server will start at `http://localhost:3002`

## Common Features Across All Examples

All example projects include:
- Plugin configuration with `appHost: 'example.com'`
- HTTPS proxy support
- Custom static resource prefixes
- Debug logging enabled
- Demo component with fetch functionality

## Plugin Configuration

Each example uses the following plugin configuration:

```javascript
{
  appHost: 'example.com',
  https: true,
  staticPrefix: '/dev/static',
  bypassPrefixes: ['/static'],
  scriptCssPrefix: '/static/global',
  entry: '/src/main.js',
  debug: true,
}
```

## Notes

1. Make sure to build the main project first before running examples:
   ```bash
   npm run build
   ```

2. The examples import the plugin from the built distribution files:
   - Vite: `../../dist/index.mjs`
   - Vue-Cli/Webpack: `../../dist/index.cjs`

3. Each example runs on a different port to avoid conflicts:
   - Vite: 3000
   - Vue-Cli: 3001
   - Webpack: 3002

4. The demo includes a "Fetch Data" button that demonstrates proxy functionality.

## Troubleshooting

If you encounter issues:

1. Ensure the main project is built: `npm run build`
2. Check that all dependencies are installed: `npm install`
3. Verify the plugin is correctly imported from the dist folder
4. Enable debug mode to see detailed logs
5. Check that the target server (`example.com`) is accessible

## Customization

You can modify the plugin configuration in each example's config file:
- Vite: `vite.config.ts`
- Vue-Cli: `vue.config.js`
- Webpack: `webpack.config.js`

For more information about plugin options, see the main [README.md](../README.md).
