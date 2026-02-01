import {
  type ProxyOptions,
  type IncomingMessage,
  type ProxyResponse,
  type ServerResponse,
  validateOptions,
  processOptions,
  isRedirectResponse,
  shouldProcessAsHtml,
  shouldUseLocal,
  handleRedirect,
  handleLibModeHtml,
  handleHtmlResponse,
  rewriteCookies,
} from "./core";

/**
 * 代理配置对象
 * @interface ProxyConfig
 */
interface ProxyConfig {
  /** 代理目标地址 */
  target: string;
  /** 是否改变origin头 */
  changeOrigin: boolean;
  /** 是否验证SSL证书 */
  secure: boolean;
  /** Cookie域名重写配置 */
  cookieDomainRewrite: { [key: string]: string };
  /** 是否自行处理响应 */
  selfHandleResponse: boolean;
  ws?: boolean;
  /** 代理请求钩子 */
  onProxyReq?: (
    proxyReq: any,
    req: IncomingMessage,
    res: ServerResponse,
  ) => void;
  /** 代理错误钩子 */
  onError?: (err: Error, req: IncomingMessage, res: ServerResponse) => void;
  /** 代理响应钩子 */
  onProxyRes?: (
    proxyRes: ProxyResponse,
    req: IncomingMessage,
    res: ServerResponse,
  ) => void;
  /** 请求绕过函数，返回url则使用本地资源 */
  bypass?: (req: IncomingMessage) => string | null | undefined;
}

/**
 * Vue CLI配置对象
 * @interface VueCliConfig
 */
interface VueCliConfig {
  devServer?: {
    proxy?: Record<string, ProxyConfig>;
  };
}

/**
 * 创建Vue CLI开发服务器代理配置
 *
 * @param {ProxyOptions} options - 代理配置选项
 * @returns {Record<string, ProxyConfig>} 返回代理配置对象
 * @throws {Error} 当 appHost 未提供或 remotePrefixes 不是数组时抛出错误
 */
function createProxyConfig(options: ProxyOptions): Record<string, ProxyConfig> {
  // 验证配置
  validateOptions(options, "vue-cli-plugin-dev-proxy");

  // 处理配置
  const {
    https,
    appHost,
    localIndexHtml,
    normalizedStaticPrefix,
    remotePrefixes,
    developmentAgentOccupancy,
    clearScriptCssPrefixes,
    fullEntry,
    log,
    logError,
  } = processOptions(options);

  log("vue-cli-plugin-dev-proxy: staticPrefix", normalizedStaticPrefix);
  const protocol = https ? "https://" : "http://";
  return {
    "/": {
      target: `${protocol}${appHost}`,
      changeOrigin: true,
      secure: false,
      ws: false, //5.x 版本需要设置，否则会报错 Invalid frame header，4.x 版本不需要设置
      cookieDomainRewrite: { "*": "localhost" },
      selfHandleResponse: true,
      onProxyReq: (
        proxyReq: any,
        req: IncomingMessage,
        res: ServerResponse,
      ) => {
        const upgradeHeader = req.headers.upgrade as string;
        const isWebSocket =
          upgradeHeader && upgradeHeader.toLowerCase() === "websocket";

        if (isWebSocket) {
          log(
            `[WebSocket] ${req.method} ${req.url} -> ${protocol}${proxyReq.getHeader("host")}${proxyReq.path}`,
          );
        } else {
          log(
            `[proxyReq] ${req.method} ${req.url} -> ${protocol}${proxyReq.getHeader("host")}${proxyReq.path}`,
          );
        }
      },

      onError: (err: Error, req: IncomingMessage, res: ServerResponse) => {
        const upgradeHeader = req.headers.upgrade as string;
        const isWebSocket =
          upgradeHeader && upgradeHeader.toLowerCase() === "websocket";

        if (isWebSocket) {
          logError(`[WebSocket Error] ${req.url}:`, err.message);
        } else {
          logError(`[proxyError] ${req.url}:`, err.message);
        }

        if (!res.headersSent && !isWebSocket) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Proxy Error: " + err.message);
        }
      },

      onProxyRes: (
        proxyRes: ProxyResponse,
        req: IncomingMessage,
        res: ServerResponse,
      ) => {
        const upgradeHeader = req.headers.upgrade as string;
        const isWebSocket =
          upgradeHeader && upgradeHeader.toLowerCase() === "websocket";

        if (isWebSocket) {
          log(`[WebSocket Response] ${req.url}`);
          const headers = rewriteCookies({ ...proxyRes.headers }, log);
          res.writeHead(proxyRes.statusCode, headers);
          proxyRes.pipe(res);
          return;
        }

        const startTime = Date.now();
        const contentType = (proxyRes.headers["content-type"] as string) || "";
        const requestUrl = req.url || "";
        const acceptHeader = (req.headers.accept as string) || "";

        log(
          `[proxyRes] ${requestUrl} - Status: ${proxyRes.statusCode}, ContentType: ${contentType}`,
        );

        const isRedirect = isRedirectResponse(proxyRes);

        // 处理重定向
        if (isRedirect) {
          handleRedirect(proxyRes, req, res, appHost, log, startTime);
          return;
        }

        // 判断是否需要处理HTML
        const shouldProcessHtml = shouldProcessAsHtml(
          contentType,
          acceptHeader,
          requestUrl,
          isRedirect,
        );

        log(
          `[shouldProcessHtml] ${shouldProcessHtml}, requestUrl: ${requestUrl}`,
        );

        if (shouldProcessHtml) {
          // 本地模式：返回本地HTML
          if (localIndexHtml) {
            handleLibModeHtml(localIndexHtml, res, log, logError, startTime);
            return;
          }

          // 标准模式：处理远程HTML
          handleHtmlResponse(proxyRes, req, res, {
            fullEntry,
            developmentAgentOccupancy,
            clearScriptCssPrefixes,
            log,
            logError,
            startTime,
          });
          return;
        }

        // 其他资源：直接代理
        const headers = rewriteCookies({ ...proxyRes.headers }, log);
        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(res);
        log(`[Proxy request]: ${requestUrl} (${Date.now() - startTime}ms)`);
      },

      bypass: (req: IncomingMessage): string | null | undefined => {
        const url = req.url || "";

        if (shouldUseLocal(url, normalizedStaticPrefix, remotePrefixes)) {
          log(`[shouldUseLocal] ${url}`);
          return url;
        }

        log(`[Proxy] ${url}`);
        return null;
      },
    },
  };
}

/**
 * Vue CLI开发代理插件
 *
 * 用于在开发环境下代理远程服务器，同时支持本地模块热更新。
 * 主要特性：
 * - 自动代理远程服务器的HTML、API等请求
 * - 自动注入本地入口脚本到远程HTML
 * - 支持清除远程HTML中的脚本和样式标签
 * - 处理Cookie、重定向等，确保本地开发体验
 * - 支持多入口配置
 * - 支持库模式，使用本地HTML文件
 *
 * @param {ProxyOptions} options - 插件配置选项
 * @returns {VueCliConfig} Vue CLI配置对象
 *
 * @example
 * // vue.config.js
 * const vueCliDevProxy = require('vite-plugin-dev-proxy/vue-cli');
 *
 * module.exports = vueCliDevProxy({
 *   appHost: 'example.com',
 *   https: true,
 *   entry: '/src/main.js',
 *   staticPrefix: '',
 *   remotePrefixes: ['/static'],
 *   clearScriptCssPrefixes: '/static',
 *   debug: true
 * });
 */
function vueCliDevProxy(options: ProxyOptions = {}): VueCliConfig {
  if (process.env.NODE_ENV !== "development") {
    return {};
  }

  const proxyConfig = createProxyConfig(options);

  return {
    devServer: {
      proxy: proxyConfig,
    },
  };
}

export default vueCliDevProxy;
export {
  vueCliDevProxy,
  createProxyConfig,
  ProxyOptions,
  ProxyConfig,
  VueCliConfig,
};
