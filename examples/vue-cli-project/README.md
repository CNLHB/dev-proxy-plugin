# Vue-Cli Example

This is a Vue-Cli project demonstrating the use of `vite-plugin-dev-proxy`.

```js
    "@vue/cli-plugin-babel": "~4.5.0",
    "@vue/cli-plugin-eslint": "~4.5.0",
    "@vue/cli-service": "~4.5.0",
```

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
npm run serve
```

The server will run at `http://localhost:3001`

## Build

Build for production:

```bash
npm run build
```

## Configuration

The plugin is configured in `vue.config.js`:

```javascript
vueCliDevProxy({
  appHost: "example.com",
  https: true,
  staticPrefix: "/dev/static",
  bypassPrefixes: ["/static"],
  scriptCssPrefix: "/static/global",
  entry: "/src/main.js",
  debug: true,
});
```

## Features

- Vue 3 with Options API
- Vue CLI 5.x
- Traditional build setup
- Proxy configuration with vite-plugin-dev-proxy
