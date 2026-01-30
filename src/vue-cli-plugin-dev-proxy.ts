import zlib from "zlib";
import { resolve } from "path";
import fs from "fs";

interface ProxyOptions {
  https?: boolean;
  appHost?: string;
  isLib?: boolean;
  localIndexHtml?: string;
  staticPrefix?: string;
  bypassPrefixes?: string[];
  developmentAgentOccupancy?: string;
  clearScriptCssPrefixes?: string | string[] | Function | RegExp;
  entry?: string | string[];
  debug?: boolean;
}

interface IncomingMessage {
  url?: string;
  headers: { [key: string]: string | string[] | undefined };
  method?: string;
  host?: string;
  accept?: string;
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
  headersSent: boolean;
}

interface ProxyConfig {
  target: string;
  changeOrigin: boolean;
  secure: boolean;
  cookieDomainRewrite: { [key: string]: string };
  selfHandleResponse: boolean;
  onProxyReq?: (
    proxyReq: any,
    req: IncomingMessage,
    res: ServerResponse,
  ) => void;
  onError?: (err: Error, req: IncomingMessage, res: ServerResponse) => void;
  onProxyRes?: (
    proxyRes: ProxyResponse,
    req: IncomingMessage,
    res: ServerResponse,
  ) => void;
  bypass?: (req: IncomingMessage) => string | null | undefined;
}

interface VueCliConfig {
  devServer?: {
    proxy?: Record<string, ProxyConfig>;
  };
}

function createProxyConfig(options: ProxyOptions): Record<string, ProxyConfig> {
  const {
    https = true,
    appHost = "",
    isLib = false,
    localIndexHtml = "index.html",
    staticPrefix = "",
    bypassPrefixes = ["/staticstatic"],
    developmentAgentOccupancy = "",
    clearScriptCssPrefixes = "",
    entry = "/src/main.js",
    debug = false,
  } = options;

  if (!appHost) {
    throw new Error("vue-cli-plugin-dev-proxy: appHost is required");
  }
  if (!Array.isArray(bypassPrefixes)) {
    throw new Error(
      "vue-cli-plugin-dev-proxy: bypassPrefixes must be an array",
    );
  }

  const log: (...argsargs: any[]) => void = debug ? console.log : () => {};
  const logError: (...args: any[]) => void = debug ? console.error : () => {};

  const normalizedStaticPrefix = staticPrefix.endsWith("/")
    ? staticPrefix.slice(0, -1)
    : staticPrefix;
  log("vue-cli-plugin-dev-proxy: staticPrefix", normalizedStaticPrefix);
  let fullEntry = "";
  if (Array.isArray(entry)) {
    fullEntry = entry
      .map(
        (e: string) =>
          `<script crossorigin type="module"  src="${normalizedStaticPrefix + e}"></script>`,
      )
      .join("\n");
  } else {
    fullEntry = `<script crossorigin type="module" src="${normalizedStaticPrefix + entry}"></script>`;
  }
  const scriptLinkRegex = /<(?:script[^>]*>.*?<\/script>|link[^>]*>)/g;
  const assetRegex =
    /\.(js|mjs|ts|tsx|jsx|css|scss|sass|less|vue|json|woff2?|ttf|eot|ico|png|jpe?g|gif|svg|webp)(\?.*)?$/i;
  const staticPathRegex = /^\/(static|assets|public|images|css|js)\//i;
  const bypassRegex =
    /\.(vue|js|mjs|ts|tsx|jsx|css|scss|sass|less|json|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot)$/i;

  const rewriteCookies = (headers: any): any => {
    const setCookie = headers["set-cookie"];
    if (setCookie) {
      headers["set-cookie"] = setCookie.map((cookie: string) => {
        const rewrittenCookie = cookie
          .replace(/;\s*secure\s*(;|$)/gi, "$1")
          .replace(/;\s*domain\s*=[^;]+(;|$)/gi, "$1")
          .replace(/;\s*samesite\s*=[^;]+(;|$)/gi, "$1")
          .replace(/;+/g, ";")
          .replace(/;\s*$/g, "");
        log("vue-cli-plugin-dev-proxy: rewrittenCookie", rewrittenCookie);
        return rewrittenCookie;
      });
    }
    return headers;
  };

  return {
    "/": {
      target: `${https ? "https" : "http"}://${appHost}`,
      changeOrigin: true,
      secure: false,
      cookieDomainRewrite: { "*": "localhost" },
      selfHandleResponse: true,

      onProxyReq: (
        proxyReq: any,
        req: IncomingMessage,
        res: ServerResponse,
      ) => {
        log(
          `[proxyReq] ${req.method} ${req.url} -> ${proxyReq.getHeader("host")}${proxyReq.path}`,
        );
      },

      onError: (err: Error, req: IncomingMessage, res: ServerResponse) => {
        logError(`[proxyError] ${req.url}:`, err.message);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Proxy Error: " + err.message);
        }
      },

      onProxyRes: (
        proxyRes: ProxyResponse,
        req: IncomingMessage,
        res: ServerResponse,
      ) => {
        const startTime = Date.now();
        const contentType = proxyRes.headers["content-type"] || "";
        const redirectUrl = proxyRes.headers.location;
        const requestUrl = req.url || "";
        const acceptHeader = req.headers.accept || "";

        log(
          `[proxyRes] ${requestUrl} - Status: ${proxyRes.statusCode}, ContentType: ${contentType}`,
        );

        const isRedirect =
          proxyRes.statusCode >= 300 &&
          proxyRes.statusCode < 400 &&
          redirectUrl;
        if (isRedirect) {
          const host = req.headers.host;
          const regex = new RegExp(appHost, "gi");
          let location = (redirectUrl as any).replace(regex, host || "");
          location = location.replace(
            /https:\/\/(localhost|127\.0\.0\.1)(:\d+)?/gi,
            "http://$1$2",
          );
          const headers2 = rewriteCookies({ ...proxyRes.headers });
          headers2.location = location;
          res.writeHead(proxyRes.statusCode, headers2);
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
        log(
          "1",
          contentType.includes("text/html"),
          isNavigationRequest,
          !isAssetRequest,
          !isStaticPath,
          !isRedirect,
        );
        log(
          `[shouldProcessHtml] ${shouldProcessHtml}, requestUrl: ${requestUrl}`,
        );

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
                `Local HTML served: ${localIndexHtml} (${Date.now() - startTime}ms)`,
              );
            } catch (err) {
              logError("Failed to read local HTML:", err);
              res.writeHead(500);
              res.end("Failed to read local HTML");
            }
            return;
          }

          const encoding = proxyRes.headers["content-encoding"];
          const chunks: Buffer[] = [];

          proxyRes.on("data", (chunk: any) => {
            if (chunk) {
              chunks.push(chunk);
            }
          });

          proxyRes.on("end", () => {
            try {
              const buffer = Buffer.concat(chunks);
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
              const decompressed = decompress();
              let html = decompressed.toString("utf-8");
              if (developmentAgentOccupancy) {
                html = html.replace(developmentAgentOccupancy, fullEntry);
              } else {
                html = html.replace(
                  /<div[^>]*id=["']app["'][^>]*><\/div>/g,
                  (match) => `${match}${fullEntry}`,
                );
              }

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

              const headers2 = rewriteCookies({ ...proxyRes.headers });
              headers2["content-type"] = "text/html; charset=utf-8";
              delete headers2["content-encoding"];
              delete headers2["content-length"];
              res.writeHead(200, headers2);
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

        const headers = rewriteCookies({ ...proxyRes.headers });
        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(res);
        log(`Proxy request: ${requestUrl} (${Date.now() - startTime}ms)`);
      },

      bypass: (req: IncomingMessage): string | null | undefined => {
        const url = req.url || "";
        const pathname = url.split("?")[0];

        const matchesLocalResource =
          (normalizedStaticPrefix &&
            url.startsWith(`${normalizedStaticPrefix}`)) ||
          url.startsWith("/@") ||
          url.startsWith("/src") ||
          url.startsWith("/node_modules") ||
          url.includes(".hot-update.") ||
          url === "/" ||
          bypassRegex.test(pathname);

        const matchesBypassPrefix = bypassPrefixes.some((prefix) =>
          url.startsWith(prefix),
        );
        const shouldBypass = matchesLocalResource && !matchesBypassPrefix;

        if (shouldBypass) {
          log(`[Bypass] ${url}`);
          return url;
        }

        log(`[Proxy] ${url}`);
        return null;
      },
    },
  };
}

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
