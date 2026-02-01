import type { Plugin, UserConfig } from "vite";
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
  /** 配置代理实例的钩子函数 */
  configure: (proxy: any, options: any) => void;
  /** 请求绕过函数，返回url则使用本地资源 */
  bypass?: (req: IncomingMessage) => string | null | undefined;
}

/**
 * 创建Vite开发服务器代理配置
 *
 * 此函数创建一个完整的代理配置，用于在开发环境下：
 * - 代理远程服务器的请求
 * - 自动注入本地入口脚本到HTML
 * - 处理Cookie、重定向等
 * - 支持本地资源和远程资源的混合使用
 *
 * @param {ProxyOptions} options - 代理配置选项
 * @returns {Record<string, ProxyConfig>} 返回代理配置对象
 * @throws {Error} 当 appHost 未提供或 remotePrefixes 不是数组时抛出错误
 *
 * @example
 * const proxyConfig = createProxyConfig({
 *   appHost: 'example.com',
 *   https: true,
 *   entry: '/src/main.js',
 *   debug: true
 * });
 */
function createProxyConfig(options: ProxyOptions): Record<string, ProxyConfig> {
  // 验证配置
  validateOptions(options, "vite-plugin-dev-proxy");

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
  } = processOptions(options, true);

  log("vite-plugin-dev-proxy: staticPrefix", normalizedStaticPrefix);
  const protocol = https ? "https://" : "http://";

  return {
    "/": {
      target: `${protocol}${appHost}`,
      changeOrigin: true,
      secure: false,
      cookieDomainRewrite: { "*": "localhost" },
      selfHandleResponse: true,
      configure: (proxy, _options) => {
        proxy.on(
          "proxyRes",
          (
            proxyRes: ProxyResponse,
            req: IncomingMessage,
            res: ServerResponse,
          ) => {
            const startTime = Date.now();
            const contentType =
              (proxyRes.headers["content-type"] as string) || "";
            const requestUrl = req.url || "";
            const acceptHeader = (req.headers.accept as string) || "";
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

            if (shouldProcessHtml) {
              // 本地模式：返回本地HTML
              if (localIndexHtml) {
                handleLibModeHtml(
                  localIndexHtml,
                  res,
                  log,
                  logError,
                  startTime,
                );
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
            log(`[Proxy request] ${requestUrl} (${Date.now() - startTime}ms)`);
          },
        );
      },
      bypass: (req: IncomingMessage) => {
        const url = req.url || "";
        if (shouldUseLocal(url, normalizedStaticPrefix, remotePrefixes)) {
          log(`shouldUseLocal: ${url}`);
          return url;
        }
      },
    },
  };
}

/**
 * Vite开发代理插件
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
 * @returns {Plugin} Vite插件对象
 *
 * @example
 * // vite.config.js
 * import viteDevProxy from 'vite-plugin-dev-proxy';
 *
 * export default {
 *   plugins: [
 *     viteDevProxy({
 *       appHost: 'example.com',
 *       https: true,
 *       entry: '/src/main.js',
 *       staticPrefix: '',
 *       remotePrefixes: ['/static'],
 *       clearScriptCssPrefixes: '/static',
 *       debug: true
 *     })
 *   ]
 * }
 */
export default function viteDevProxy(options: ProxyOptions = {}): Plugin {
  return {
    name: "vite-plugin-dev-proxy",
    config: (viteConfig: UserConfig): UserConfig => {
      if (process.env.NODE_ENV !== "development") {
        return {};
      }
      const pluginProxy = createProxyConfig(options);
      const existingProxy =
        (viteConfig.server?.proxy as Record<string, any>) || {};
      const mergedProxy = {
        ...existingProxy,
        ...pluginProxy,
      };
      return {
        server: {
          proxy: mergedProxy,
        },
      };
    },
  };
}
