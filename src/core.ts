import zlib from "zlib";
import { resolve } from "path";
import fs from "fs";
import { log } from "console";

// ==================== 类型定义 ====================

/**
 * 代理插件配置选项
 * @interface ProxyOptions
 */
export interface ProxyOptions {
  /** 是否使用HTTPS协议，默认true */
  https?: boolean;
  /** 代理目标主机地址（必填），如：'example.com' */
  appHost?: string;
  /** 本地HTML文件路径，默认'' */
  localIndexHtml?: string;
  /** 静态资源路径前缀，默认为空字符串 */
  staticPrefix?: string;
  /** 远程资源路径前缀规则，支持字符串、数组、函数、正则，默认['/static/component'] */
  remotePrefixes?: string | string[] | Function | RegExp;
  /** 清除脚本/CSS的前缀规则，支持字符串、数组、函数、正则 */
  clearScriptCssPrefixes?: string | string[] | Function | RegExp;
  /** 开发代理占位符，用于替换为入口脚本 */
  developmentAgentOccupancy?: string;
  /** 入口文件路径，支持单个或多个入口，默认'/src/main.js' */
  entry?: string | string[];
  /** 是否开启调试模式，开启后会输出详细日志，默认false */
  debug?: boolean;
}

/**
 * HTTP请求消息对象
 * @interface IncomingMessage
 */
export interface IncomingMessage {
  /** 请求URL */
  url?: string;
  /** 请求头 */
  headers: { [key: string]: string | string[] | undefined };
  /** 请求方法 */
  method?: string;
  /** 主机地址 */
  host?: string;
  /** Accept头 */
  accept?: string;
}

/**
 * 代理响应对象
 * @interface ProxyResponse
 */
export interface ProxyResponse {
  /** HTTP状态码 */
  statusCode: number;
  /** 响应头 */
  headers: { [key: string]: string | string[] | undefined };
  /** 监听事件 */
  on: (event: string, callback: (chunk?: Buffer) => void) => void;
  /** 管道传输 */
  pipe: (destination: any) => void;
}

/**
 * HTTP响应对象
 * @interface ServerResponse
 */
export interface ServerResponse {
  /** 写入响应头 */
  writeHead: (
    statusCode: number,
    headers?: { [key: string]: string | string[] | undefined },
  ) => void;
  /** 结束响应 */
  end: (data?: string) => void;
  /** 响应头是否已发送 */
  headersSent?: boolean;
}

// ==================== 常量配置 ====================

/** 匹配脚本和样式标签的正则表达式 */
export const SCRIPT_LINK_REGEX = /<(?:script[^>]*>.*?<\/script>|link[^>]*>)/g;

/** 匹配静态资源文件扩展名的正则表达式 */
export const ASSET_REGEX =
  /\.(js|mjs|ts|tsx|jsx|css|scss|sass|less|vue|json|woff2?|ttf|eot|ico|png|jpe?g|gif|svg|webp)(\?.*)?$/i;

/** 匹配静态资源路径的正则表达式 */
export const STATIC_PATH_REGEX = /^\/(static|assets|public|images|css|js)\//i;

/** 匹配需要本地处理的文件类型 */
export const BYPASS_REGEX =
  /\.(vue|js|mjs|ts|tsx|jsx|css|scss|sass|less|json|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot)$/i;

/** HTTP重定向状态码范围 */
export const REDIRECT_STATUS_MIN = 300;
export const REDIRECT_STATUS_MAX = 400;

/** 默认应用挂载点正则 */
export const DEFAULT_APP_DIV_REGEX = /<div[^>]*id=["']app["'][^>]*><\/div>/g;

/** HTTPS转HTTP的正则表达式（支持localhost和局域网IP） */
export const HTTPS_TO_HTTP_REGEX =
  /https:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?/gi;

// ==================== 工具函数 ====================

/**
 * 创建日志函数
 * @param {boolean} debug - 是否开启调试模式
 * @returns {Object} 包含log和logError的对象
 */
export function createLogger(debug: boolean) {
  return {
    log: debug ? console.log.bind(console) : () => {},
    logError: debug ? console.error.bind(console) : () => {},
  };
}

/**
 * 标准化路径，移除末尾的斜杠
 * @param {string} path - 原始路径
 * @returns {string} 标准化后的路径
 */
export function normalizePath(path: string): string {
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

/**
 * 生成入口脚本标签
 * @param {string|string[]} entry - 入口文件路径
 * @param {string} staticPrefix - 静态资源前缀
 * @returns {string} 完整的script标签
 */
export function generateEntryScript(
  entry: string | string[],
  staticPrefix: string,
): string {
  if (Array.isArray(entry)) {
    return entry
      .map(
        (e) =>
          `<script crossorigin type="module"  src="${staticPrefix + e}"></script>`,
      )
      .join("\n");
  }
  return `<script crossorigin type="module" src="${staticPrefix + entry}"></script>`;
}

/**
 * 重写Cookie，移除secure、domain、samesite属性
 * @param {any} headers - 响应头对象
 * @param {Function} log - 日志函数
 * @returns {any} 重写后的响应头
 */
export function rewriteCookies(
  headers: any,
  log: (...args: any[]) => void,
): any {
  const setCookie = headers["set-cookie"];
  if (setCookie) {
    headers["set-cookie"] = setCookie.map((cookie: any) => {
      const rewrittenCookie = cookie
        .replace(/;\s*secure\s*(;|$)/gi, "$1")
        .replace(/;\s*domain\s*=[^;]+(;|$)/gi, "$1")
        .replace(/;\s*samesite\s*=[^;]+(;|$)/gi, "$1")
        .replace(/;+/g, ";")
        .replace(/;\s*$/g, "");
      log("[rewrittenCookie]", rewrittenCookie);
      return rewrittenCookie;
    });
  }
  return headers;
}

/**
 * 解压缩Buffer数据
 * @param {Buffer} buffer - 压缩的Buffer
 * @param {string|undefined} encoding - 编码类型（gzip/deflate/br）
 * @returns {Buffer} 解压后的Buffer
 */
export function decompressBuffer(
  buffer: Buffer,
  encoding: string | undefined,
): Buffer {
  if (encoding === "gzip") {
    return zlib.gunzipSync(buffer);
  } else if (encoding === "deflate") {
    return zlib.inflateSync(buffer);
  } else if (encoding === "br") {
    return zlib.brotliDecompressSync(buffer);
  }
  return buffer;
}

/**
 * 判断是否应该清除脚本/CSS标签
 * @param {string} match - 匹配到的标签
 * @param {string|string[]|Function|RegExp} clearRule - 清除规则
 * @returns {boolean} 是否应该清除
 */
export function shouldClearScriptCss(
  match: string,
  clearRule: string | string[] | Function | RegExp,
): boolean {
  // 提取src或href属性
  const srcMatch = match.match(/src="([^"]+)"/i);
  const hrefMatch = match.match(/href="([^"]+)"/i);
  const srcOrHref = srcMatch ? srcMatch[1] : hrefMatch ? hrefMatch[1] : null;

  // 空字符串规则，不清除
  if (clearRule === "") {
    return false;
  }

  // 字符串规则：检查前缀
  if (typeof clearRule === "string") {
    return srcOrHref?.startsWith(clearRule) ?? false;
  }

  // 数组规则：检查是否匹配任一前缀
  if (Array.isArray(clearRule)) {
    return clearRule.some((prefix) => srcOrHref?.startsWith(prefix));
  }

  // 正则规则
  if (clearRule instanceof RegExp) {
    return clearRule.test(match);
  }

  // 函数规则
  if (typeof clearRule === "function") {
    return clearRule(match);
  }

  return false;
}

/**
 * 注入入口脚本到HTML
 * @param {string} html - 原始HTML
 * @param {string} fullEntry - 完整的入口脚本标签
 * @param {string} developmentAgentOccupancy - 开发代理占位符
 * @returns {string} 注入后的HTML
 */
export function injectEntryScript(
  html: string,
  fullEntry: string,
  developmentAgentOccupancy: string,
): string {
  if (developmentAgentOccupancy) {
    return html.replace(developmentAgentOccupancy, fullEntry);
  }
  return html.replace(DEFAULT_APP_DIV_REGEX, (match) => `${match}${fullEntry}`);
}

/**
 * 清理HTML中的脚本和样式标签
 * @param {string} html - 原始HTML
 * @param {string|string[]|Function|RegExp} clearRule - 清除规则
 * @returns {string} 清理后的HTML
 */
export function clearScriptCssTags(
  html: string,
  clearRule: string | string[] | Function | RegExp,
  log?: (...args: any[]) => void,
): string {
  return html.replace(SCRIPT_LINK_REGEX, (match) => {
    const isClear = shouldClearScriptCss(match, clearRule);
    if (isClear) {
      log?.(`[clearScriptCssTags]: ${match}`);
    }
    return isClear ? "" : match;
  });
}

/**
 * 判断是否为重定向响应
 * @param {ProxyResponse} proxyRes - 代理响应对象
 * @returns {boolean} 是否为重定向
 */
export function isRedirectResponse(proxyRes: ProxyResponse): boolean {
  return (
    proxyRes.statusCode >= REDIRECT_STATUS_MIN &&
    proxyRes.statusCode < REDIRECT_STATUS_MAX &&
    !!proxyRes.headers.location
  );
}

/**
 * 判断是否应该处理为HTML
 * @param {string} contentType - 内容类型
 * @param {string} acceptHeader - Accept请求头
 * @param {string} requestUrl - 请求URL
 * @param {boolean} isRedirect - 是否为重定向
 * @returns {boolean} 是否应该处理为HTML
 */
export function shouldProcessAsHtml(
  contentType: string,
  acceptHeader: string,
  requestUrl: string,
  isRedirect: boolean,
): boolean {
  const isNavigationRequest = acceptHeader.includes("text/html");
  const isAssetRequest = ASSET_REGEX.test(requestUrl);
  const isStaticPath = STATIC_PATH_REGEX.test(requestUrl);

  return (
    contentType.includes("text/html") &&
    isNavigationRequest &&
    !isAssetRequest &&
    !isStaticPath &&
    !isRedirect
  );
}

/**
 * 判断URL是否匹配远程资源规则
 * @param {string} url - 请求URL
 * @param {string|string[]|Function|RegExp} remoteRule - 远程资源规则
 * @returns {boolean} 是否匹配远程资源
 */
export function matchesRemoteResource(
  url: string,
  remoteRule: string | string[] | Function | RegExp,
): boolean {
  // 字符串规则：检查前缀
  if (typeof remoteRule === "string") {
    return url.startsWith(remoteRule);
  }

  // 数组规则：检查是否匹配任一前缀
  if (Array.isArray(remoteRule)) {
    return remoteRule.some((prefix) => url.startsWith(prefix));
  }

  // 正则规则
  if (remoteRule instanceof RegExp) {
    return remoteRule.test(url);
  }

  // 函数规则
  if (typeof remoteRule === "function") {
    return remoteRule(url);
  }

  return false;
}

/**
 * 判断请求是否应该使用本地资源
 * @param {string} url - 请求URL
 * @param {string} normalizedStaticPrefix - 标准化的静态资源前缀
 * @param {string|string[]|Function|RegExp} remotePrefixes - 远程资源规则
 * @returns {boolean} 是否使用本地资源
 */
export function shouldUseLocal(
  url: string,
  normalizedStaticPrefix: string,
  remotePrefixes: string | string[] | Function | RegExp,
): boolean {
  const pathname = url.split("?")[0];

  const isLocalResource =
    (normalizedStaticPrefix && url.startsWith(normalizedStaticPrefix)) ||
    url.startsWith("/@") ||
    url.startsWith("/src") ||
    url.startsWith("/node_modules") ||
    url.includes(".hot-update.") ||
    url.startsWith("/sockjs-node") || // Vue CLI/Webpack 热更新 WebSocket (3.x)
    url.startsWith("/ws") || // Vue CLI/Webpack 热更新 WebSocket (4.x+/Vite)
    // url === "/" ||  // 根路径处理,默认也走远程吧,走本地不处理,默认都读本地的html vue-cli配置的 indexPath: indexPath,
    BYPASS_REGEX.test(pathname);

  const isRemoteResource = matchesRemoteResource(url, remotePrefixes);

  return isLocalResource && !isRemoteResource;
}

/**
 * 处理重定向响应
 * @param {ProxyResponse} proxyRes - 代理响应对象
 * @param {IncomingMessage} req - 请求对象
 * @param {ServerResponse} res - 响应对象
 * @param {string} appHost - 应用主机地址
 * @param {Function} log - 日志函数
 * @param {number} startTime - 请求开始时间
 */
export function handleRedirect(
  proxyRes: ProxyResponse,
  req: IncomingMessage,
  res: ServerResponse,
  appHost: string,
  log: (...args: any[]) => void,
  startTime: number,
) {
  const redirectUrl = proxyRes.headers.location as string;
  const host = req.headers.host as string | undefined;
  const regex = new RegExp(appHost, "gi");

  let location = redirectUrl.replace(regex, host || "");
  location = location.replace(HTTPS_TO_HTTP_REGEX, "http://$1$2");

  const headers = rewriteCookies({ ...proxyRes.headers }, log);
  headers.location = location;

  res.writeHead(proxyRes.statusCode, headers);
  res.end();
  log(
    `Redirect handled: ${redirectUrl} -> ${location} (${Date.now() - startTime}ms)`,
  );
}

/**
 * 处理本地模式的HTML响应
 * @param {string} localIndexHtml - 本地HTML文件路径
 * @param {ServerResponse} res - 响应对象
 * @param {Function} log - 日志函数
 * @param {Function} logError - 错误日志函数
 * @param {number} startTime - 请求开始时间
 */
export function handleLibModeHtml(
  localIndexHtml: string,
  res: ServerResponse,
  log: (...args: any[]) => void,
  logError: (...args: any[]) => void,
  startTime: number,
) {
  try {
    const indexHtml = fs.readFileSync(
      resolve(__dirname, localIndexHtml),
      "utf-8",
    );
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
    });
    res.end(indexHtml);
    log(`Local HTML served: ${localIndexHtml} (${Date.now() - startTime}ms)`);
  } catch (err) {
    logError("Failed to read local HTML:", err);
    res.writeHead(500);
    res.end("Failed to read local HTML");
  }
}

/**
 * 处理HTML响应流
 * @param {ProxyResponse} proxyRes - 代理响应对象
 * @param {IncomingMessage} req - 请求对象
 * @param {ServerResponse} res - 响应对象
 * @param {Object} context - 处理上下文
 */
export function handleHtmlResponse(
  proxyRes: ProxyResponse,
  req: IncomingMessage,
  res: ServerResponse,
  context: {
    fullEntry: string;
    developmentAgentOccupancy: string;
    clearScriptCssPrefixes: string | string[] | Function | RegExp;
    log: (...args: any[]) => void;
    logError: (...args: any[]) => void;
    startTime: number;
  },
) {
  const encoding = proxyRes.headers["content-encoding"] as string | undefined;
  const requestUrl = req.url || "";
  const chunks: Buffer[] = [];

  proxyRes.on("data", (chunk: any) => {
    if (chunk) {
      chunks.push(chunk);
    }
  });

  proxyRes.on("end", () => {
    try {
      const buffer = Buffer.concat(chunks);
      const decompressed = decompressBuffer(buffer, encoding);
      let html = decompressed.toString("utf-8");

      // 清理脚本和样式标签
      html = clearScriptCssTags(
        html,
        context.clearScriptCssPrefixes,
        context.log,
      );

      // 注入入口脚本
      html = injectEntryScript(
        html,
        context.fullEntry,
        context.developmentAgentOccupancy,
      );
      // 准备响应头
      const headers = rewriteCookies({ ...proxyRes.headers }, context.log);
      headers["content-type"] = "text/html; charset=utf-8";
      delete headers["content-encoding"];
      delete headers["content-length"];

      res.writeHead(200, headers);
      res.end(html);
      context.log(
        `[HTML processed]: ${requestUrl} (${Date.now() - context.startTime}ms)`,
      );
    } catch (err) {
      context.logError("Decompress error:", err);
      context.logError("Request URL:", requestUrl);
      context.logError("Response headers:", proxyRes.headers);
      res.writeHead(500);
      res.end("Decompress error");
    }
  });
}

/**
 * 验证配置选项
 * @param {ProxyOptions} options - 配置选项
 * @param {string} pluginName - 插件名称
 * @throws {Error} 配置验证失败时抛出错误
 */
export function validateOptions(
  options: ProxyOptions,
  pluginName: string,
): void {
  const { appHost } = options;

  if (!appHost) {
    throw new Error(`${pluginName}: appHost is required`);
  }
}

/**
 * 处理配置选项，返回标准化的配置
 * @param {ProxyOptions} options - 原始配置选项
 * @param {boolean} isVite - 是否为Vite插件
 * @returns {Object} 标准化后的配置对象
 */
export function processOptions(options: ProxyOptions, isVite?: boolean) {
  let {
    https = true,
    appHost = "",
    localIndexHtml = "",
    staticPrefix = "/dev/static",
    remotePrefixes = ["/static/component"],
    developmentAgentOccupancy = "",
    clearScriptCssPrefixes = "",
    entry = isVite ? "/src/main.js" : ["/js/chunk-vendors.js", "/js/app.js"],
    debug = false,
  } = options;

  // 标准化 appHost
  appHost = normalizePath(appHost);

  // 标准化静态资源前缀
  const normalizedStaticPrefix = normalizePath(staticPrefix);

  // 生成入口脚本
  const fullEntry = generateEntryScript(entry, normalizedStaticPrefix);

  // 创建日志函数
  const { log, logError } = createLogger(debug);

  return {
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
  };
}
