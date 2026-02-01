# Vite Example

This is a Vite project demonstrating the use of `vite-plugin-dev-proxy`.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Make sure the main plugin is built:
```bash
cd ../..
npm run build
```

## Run

Start the development server:
```bash
npm run dev
```

The server will run at `http://localhost:3000`

## Build

Build for production:
```bash
npm run build
```

## Configuration

The plugin is configured in `vite.config.ts`:

```typescript
viteDevProxy({
  appHost: 'example.com',
  https: true,
  staticPrefix: '/dev/static',
  bypassPrefixes: ['/static'],
  scriptCssPrefix: '/static/global',
  entry: '/src/main.js',
  debug: true,
})
```

## Features

- Vue 3 with Composition API
- Vite 5.x
- TypeScript support
- Hot Module Replacement
- Proxy configuration with vite-plugin-dev-proxy
