// vue.config.js - 完整调试版配置
const { VueCliPluginDevProxy } = require('dev-proxy-plugin');

const TARGET_HOST = 'beta-internal.cxmuc.com';
const USE_HTTPS = true;

const devProxy = VueCliPluginDevProxy({
  appHost: TARGET_HOST,
  https: USE_HTTPS,
  staticPrefix: '/dev/static',

  // 排除 WebSocket 和本地资源
  remotePrefixes: (url) => {
    // 调试：输出判断逻辑
    console.log(`[remotePrefixes] 判断 URL: ${url}`);

    // WebSocket 路径 - 必须排除
    if (url.startsWith('/ws')) {
      console.log(`  → WebSocket 路径，使用本地代理`);
      return false;
    }

    if (url.startsWith('/sockjs-node')) {
      console.log(`  → SockJS 路径，使用本地代理`);
      return false;
    }

    // 远程资源路径
    if (url.startsWith('/static/component')) {
      console.log(`  → 远程组件资源`);
      return true;
    }

    console.log(`  → 默认使用本地资源`);
    return false;
  },

  entry: ['/js/chunk-vendors.js', '/js/app.js'],
  clearScriptCssPrefixes: '/static',
  debug: true,
});

module.exports = {
  devServer: {
    port: 8081,
    host: '192.168.10.105',

    proxy: {
      // 1. WebSocket 代理（最高优先级）
      '/ws': {
        target: `${USE_HTTPS ? 'https' : 'http'}://${TARGET_HOST}`,
        ws: true,
        changeOrigin: true,
        secure: false,
        logLevel: 'debug',

        // WebSocket 升级钩子
        onProxyReqWs: (proxyReq, req, socket, options, head) => {
          console.log(`[WebSocket] 升级请求: ${req.url}`);
          console.log(`  → 目标: ${options.target}`);
        },

        // WebSocket 错误处理
        onError: (err, req, res) => {
          console.error(`[WebSocket错误] ${req.url}:`, err.message);
        },

        // 打开 WebSocket 连接
        onOpen: (proxySocket) => {
          console.log('[WebSocket] 连接已建立');
        },

        // 关闭 WebSocket 连接
        onClose: (res, socket, head) => {
          console.log('[WebSocket] 连接已关闭');
        },
      },

      // 2. SockJS WebSocket（如果使用）
      '/sockjs-node': {
        target: `${USE_HTTPS ? 'https' : 'http'}://${TARGET_HOST}`,
        ws: true,
        changeOrigin: true,
        secure: false,
        logLevel: 'debug',
      },

      // 3. HTTP 代理（最后，优先级最低）
      ...devProxy.devServer.proxy,
    },

    // 允许外部访问
    allowedHosts: 'all',
  },

  // 其他插件配置
  ...devProxy,
};
