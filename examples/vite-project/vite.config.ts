import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import viteDevProxy from '../../dist/index.mjs'

export default defineConfig({
  plugins: [
    vue(),
    viteDevProxy({
      appHost: 'example.com',
      https: true,
      staticPrefix: '/dev/static',
      bypassPrefixes: ['/static'],
      scriptCssPrefix: '/static/global',
      entry: '/src/main.js',
      debug: true,
    })
  ],
  server: {
    port: 3000
  }
})
