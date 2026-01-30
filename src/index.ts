import zlib from "zlib";
import { resolve } from "path";
import fs from "fs";
import type { Plugin, UserConfig } from "vite";

interface ProxyOptions {
  https?: boolean;
  appHost?: string;
  isLib?: boolean;
  localIndexHtml?: string;
  staticPrefix?: string;
  bypassPrefixes?: string[];
  // scriptCssPrefix?: string;
  clearScriptCssPrefixes?: string | string[] | Function | RegExp;
  developmentAgentOccupancy?: string;
  entry?: string;
  debug?: boolean;
}

interface ProxyConfig {
  target: string;
  changeOrigin: boolean;
  secure: boolean;
  cookieDomainRewrite: { [key: string]: string };
  selfHandleResponse: boolean;
  configure: (proxy: any, options: any) => void;
  bypass?: (req: IncomingMessage) => string | null | undefined;
}

interface IncomingMessage {
  url?: string;
  headers: { [key: string]: string | string[] | undefined };
}

interface ProxyResponse {
  statusCode: number;
  headers: { [key: string]: string | string[] | undefined };
  on: (event: string, callback: (chunk?: Buffer) => void) => void;
  pipe: (destination: any) => void;
}

interface ServerResponse {
  writeHead: (
    statusCode: number,
    headers?: { [key: string]: string | string[] | undefined },
  ) => void;
  end: (data?: string) => void;
}

function createProxyConfig(options: ProxyOptions): Record<string, ProxyConfig> {
  const {
    https = true,
    appHost = "",
    isLib = false,
    localIndexHtml = "index.html",
    staticPrefix = "",
    bypassPrefixes = ["/static"],
    // scriptCssPrefix = "",
    developmentAgentOccupancy = "",
    clearScriptCssPrefixes = "",
    entry = "/src/main.js",
    debug = false,
  } = options;
  if (!appHost) {
    throw new Error("vite-plugin-dev-proxy: appHost is required");
  }

  if (!Array.isArray(bypassPrefixes)) {
    throw new Error("vite-plugin-dev-proxy: bypassPrefixes must be an array");
  }

  const log: (...args: any[]) => void = debug ? console.log : () => {};
  const logError: (...args: any[]) => void = debug ? console.error : () => {};

  const normalizedStaticPrefix = staticPrefix.endsWith("/")
    ? staticPrefix.slice(0, -1)
    : staticPrefix;
  log("vite-plugin-dev-proxy: staticPrefix", normalizedStaticPrefix);
  // log("vite-plugin-dev-proxy: scriptCssPrefix", scriptCssPrefix);
  const fullEntry = normalizedStaticPrefix + entry;

  // const scriptRegex = scriptCssPrefix
  //   ? new RegExp(
  //       `<script[^>]*type="module"[^>]*crossorigin[^>]*src="${scriptCssPrefix}[^"]+"[^>]*><\\/script>`,
  //       "g",
  //     )
  //   : /<script[^>]*type="module"[^>]*crossorigin[^>]*src="[^"]+"[^>]*><\/script>/g;

  // const linkRegex = scriptCssPrefix
  //   ? new RegExp(
  //       `<link[^>]*rel="stylesheet"[^>]*crossorigin[^>]*href="${scriptCssPrefix}[^"]+"[^>]*>`,
  //       "g",
  //     )
  //   : /<link[^>]*rel="stylesheet"[^>]*crossorigin[^>]*href="[^"]+"[^>]*>/g;

  const scriptLinkRegex = /<(?:script[^>]*>.*?<\/script>|link[^>]*>)/g;

  const assetRegex =
    /\.(js|mjs|ts|tsx|jsx|css|scss|sass|less|vue|json|woff2?|ttf|eot|ico|png|jpe?g|gif|svg|webp)(\?.*)?$/i;
  const staticPathRegex = /^\/(static|assets|public|images|css|js)\//i;
  const bypassRegex =
    /\.(vue|js|mjs|ts|tsx|jsx|css|scss|sass|less|json|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot)$/i;

  return {
    "/": {
      target: `${https ? "https" : "http"}://${appHost}`,
      changeOrigin: true,
      secure: false,
      cookieDomainRewrite: { "*": "localhost" },
      selfHandleResponse: true,
      configure: (proxy, options) => {
        const rewriteCookies = (headers: any) => {
          const setCookie = headers["set-cookie"];
          if (setCookie) {
            headers["set-cookie"] = setCookie.map((cookie: any) => {
              let rewrittenCookie = cookie
                .replace(/;\s*secure\s*(;|$)/gi, "$1")
                .replace(/;\s*domain\s*=[^;]+(;|$)/gi, "$1")
                .replace(/;\s*samesite\s*=[^;]+(;|$)/gi, "$1")
                .replace(/;+/g, ";")
                .replace(/;\s*$/g, "");
              log("vite-plugin-dev-proxy: rewrittenCookie", rewrittenCookie);
              return rewrittenCookie;
            });
          }
          return headers;
        };
        proxy.on(
          "proxyRes",
          (
            proxyRes: ProxyResponse,
            req: IncomingMessage,
            res: ServerResponse,
          ) => {
            const startTime: number = Date.now();
            const contentType: string =
              (proxyRes.headers["content-type"] as string) || "";
            const redirectUrl: string | undefined = proxyRes.headers
              .location as string | undefined;
            const requestUrl: string = req.url || "";
            const acceptHeader: string = (req.headers.accept as string) || "";
            const isRedirect =
              proxyRes.statusCode >= 300 &&
              proxyRes.statusCode < 400 &&
              redirectUrl;

            if (isRedirect) {
              const host: string | undefined = req.headers.host as
                | string
                | undefined;
              const regex: RegExp = new RegExp(appHost, "gi");
              let location: string = redirectUrl.replace(regex, host || "");
              location = location.replace(
                /https:\/\/(localhost|127\.0\.0\.1)(:\d+)?/gi,
                "http://$1$2",
              );
              const headers: { [key: string]: string | string[] | undefined } =
                rewriteCookies({ ...proxyRes.headers });
              headers.location = location;
              res.writeHead(proxyRes.statusCode, headers);
              res.end();
              log(
                `Redirect handled: ${redirectUrl} -> ${location} (${Date.now() - startTime}ms)`,
              );
              return;
            }

            const isNavigationRequest = acceptHeader.includes("text/html");
            const isAssetRequest = assetRegex.test(requestUrl);
            const isStaticPath = staticPathRegex.test(requestUrl);
            const shouldProcessHtml =
              contentType.includes("text/html") &&
              isNavigationRequest &&
              !isAssetRequest &&
              !isStaticPath &&
              !isRedirect;

            if (shouldProcessHtml) {
              if (isLib) {
                try {
                  const indexHtml = fs.readFileSync(
                    resolve(__dirname, localIndexHtml),
                    "utf-8",
                  );
                  res.writeHead(200, {
                    "Content-Type": "text/html; charset=utf-8",
                  });
                  res.end(indexHtml);
                  log(
                    `Local HTML served: ${localIndexHtml}） (${Date.now() - startTime}ms)`,
                  );
                } catch (err) {
                  logError("Failed to read local HTML:", err);
                  res.writeHead(500);
                  res.end("Failed to read local HTML");
                }
                return;
              }

              const encoding: string | undefined = proxyRes.headers[
                "content-encoding"
              ] as string | undefined;
              const chunks: Buffer[] = [];
              proxyRes.on(
                "data",
                (chunk: Buffer<ArrayBufferLike> | undefined) => {
                  if (chunk) {
                    chunks.push(chunk);
                  }
                },
              );
              proxyRes.on("end", () => {
                try {
                  let buffer: Buffer = Buffer.concat(chunks);
                  const decompress = (): Buffer => {
                    if (encoding === "gzip") {
                      return zlib.gunzipSync(buffer);
                    } else if (encoding === "deflate") {
                      return zlib.inflateSync(buffer);
                    } else if (encoding === "br") {
                      return zlib.brotliDecompressSync(buffer);
                    }
                    return buffer;
                  };
                  const decompressed: Buffer = decompress();
                  let html: string = decompressed.toString("utf-8");
                  // html = html.replace(scriptRegex, "");
                  // html = html.replace(linkRegex, "");
                  // <div id="app"></div>
                  if (developmentAgentOccupancy) {
                    html = html.replace(
                      developmentAgentOccupancy,
                      `<script crossorigin type="module" src="${fullEntry}"></script>`,
                    );
                  } else {
                    html = html.replace(
                      /<div[^>]*id=["']app["'][^>]*><\/div>/g,
                      (match) =>
                        `${match}<script crossorigin type="module" src="${fullEntry}"><\/script>`,
                    );
                  }

                  clearScriptCssPrefixes;
                  html = html.replace(scriptLinkRegex, (match) => {
                    const srcMatch = match.match(/src="([^"]+)"/i);
                    const hrefMatch = match.match(/href="([^"]+)"/i);
                    const srcOrHref = srcMatch
                      ? srcMatch[1]
                      : hrefMatch
                        ? hrefMatch[1]
                        : null;
                    if (typeof clearScriptCssPrefixes === "string") {
                      if (srcOrHref?.startsWith(clearScriptCssPrefixes)) {
                        return "";
                      }
                    }
                    if (Array.isArray(clearScriptCssPrefixes)) {
                      if (
                        clearScriptCssPrefixes.some((prefix) =>
                          srcOrHref?.startsWith(prefix),
                        )
                      ) {
                        return "";
                      }
                    }
                    if (clearScriptCssPrefixes instanceof RegExp) {
                      return clearScriptCssPrefixes.test(match) ? "" : match;
                    }
                    if (typeof clearScriptCssPrefixes === "function") {
                      return clearScriptCssPrefixes(match) ? "" : match;
                    }
                    return match;
                  });
                  if (html.indexOf(fullEntry) === -1) {
                    html = html.replace(
                      /<!--\sS 公共组件 提示信息\s-->/g,
                      `<script crossorigin type="module" src="${fullEntry}"></script>`,
                    );
                  }
                  const headers: {
                    [key: string]: string | string[] | undefined;
                  } = rewriteCookies({ ...proxyRes.headers });
                  headers["content-type"] = "text/html; charset=utf-8";
                  delete headers["content-encoding"];
                  delete headers["content-length"];
                  res.writeHead(200, headers);
                  res.end(html);
                  log(
                    `HTML processed: ${requestUrl} (${Date.now() - startTime}ms)`,
                  );
                } catch (err) {
                  logError("Decompress error:", err);
                  logError("Request URL:", requestUrl);
                  logError("Response headers:", proxyRes.headers);
                  res.writeHead(500);
                  res.end("Decompress error");
                }
              });
              return;
            }

            const headers: { [key: string]: string | string[] | undefined } =
              rewriteCookies({ ...proxyRes.headers });
            res.writeHead(proxyRes.statusCode, headers);
            proxyRes.pipe(res);
            log(`Proxy request: ${requestUrl} (${Date.now() - startTime}ms)`);
          },
        );
      },
      bypass: (req: IncomingMessage) => {
        const url: string = req.url || "";
        const pathname: string = url.split("?")[0];
        if (
          ((normalizedStaticPrefix &&
            url.startsWith(`${normalizedStaticPrefix}`)) ||
            url.startsWith("/@") ||
            url.startsWith("/src") ||
            url.startsWith("/node_modules") ||
            url.includes(".hot-update.") ||
            url === "/" ||
            bypassRegex.test(pathname)) &&
          !bypassPrefixes.some((prefix) => url.startsWith(prefix))
        ) {
          log(`Bypass proxy: ${url}`);
          return url;
        }
      },
    },
  };
}

export default function viteDevProxy(options: ProxyOptions = {}): Plugin {
  return {
    name: "vite-plugin-dev-proxy",
    config: (viteConfig: UserConfig): UserConfig => {
      const pluginProxy: Record<string, ProxyConfig> =
        createProxyConfig(options);
      const existingProxy: Record<string, any> =
        (viteConfig.server?.proxy as Record<string, any>) || {};
      const mergedProxy: Record<string, ProxyConfig> = {
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
