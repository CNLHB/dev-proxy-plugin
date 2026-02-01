// vue.config.js - WebSocket 配置示例
const { VueCliPluginDevProxy } = require('dev-proxy-plugin');

const devProxy = VueCliPluginDevProxy({
  appHost: 'beta-internal.cxmuc.com',
  https: true,
  staticPrefix: '/dev/static',

  // 关键：使用函数排除 WebSocket 路径
  remotePrefixes: (url) => {
    // WebSocket 路径不经过插件代理
    if (url.startsWith('/ws')) {
      return false;  // 返回 false，让请求走本地代理
    }
    if (url.startsWith('/sockjs-node')) {
      return false;
    }

    // 其他需要从远程加载的资源
    return url.startsWith('/static/component');
  },

  entry: ['/js/chunk-vendors.js', '/js/app.js'],
  clearScriptCssPrefixes: '/static',
  debug: true,
});

module.exports = {
  devServer: {
    // 端口配置
    port: 8081,

    proxy: {
      // WebSocket 代理配置（必须在最前面！）
      '/ws': {
        target: 'https://beta-internal.cxmuc.com',
        ws: true,              // 启用 WebSocket
        changeOrigin: true,
        secure: false,         // 如果是自签名证书，设为 false
        logLevel: 'debug',
      },

      // SockJS WebSocket（如果需要）
      '/sockjs-node': {
        target: 'https://beta-internal.cxmuc.com',
        ws: true,
        changeOrigin: true,
        secure: false,
        logLevel: 'debug',
      },

      // HTTP 代理配置（来自插件，必须在最后）
      ...devProxy.devServer.proxy,
    },
  },

  // 其他插件配置
  ...devProxy,
};
