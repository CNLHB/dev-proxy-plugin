const zlib = require('zlib')
const { resolve } = require('path')
const fs = require('fs')

function createProxyConfig (options) {
  const {
    https = true,
    appHost = '',
    isLib = false,
    localIndexHtml = 'index.html',
    staticPrefix = '',
    bypassPrefixes = ['/static'],
    developmentAgentOccupancy = '',
    clearScriptCssPrefixes = '',
    entry = '/src/main.js',
    debug = false
  } = options

  if (!appHost) {
    throw new Error('vue-cli-plugin-dev-proxy: appHost is required')
  }
  if (!Array.isArray(bypassPrefixes)) {
    throw new Error('vue-cli-plugin-dev-proxy: bypassPrefixes must be an array')
  }

  const log = debug ? console.log : () => {}
  const logError = debug ? console.error : () => {}

  const normalizedStaticPrefix = staticPrefix.endsWith('/') ? staticPrefix.slice(0, -1) : staticPrefix
  log('vue-cli-plugin-dev-proxy: staticPrefix', normalizedStaticPrefix)
  let fullEntry = ''
  if (Array.isArray(entry)) {
    fullEntry = entry.map(e => `<script crossorigin type="module"  src="${normalizedStaticPrefix + e}"></script>`).join('\n')
  } else {
    fullEntry = `<script crossorigin type="module" src="${normalizedStaticPrefix + entry}"></script>`
  }
  const scriptLinkRegex = /<(?:script[^>]*>.*?<\/script>|link[^>]*>)/g
  const assetRegex = /\.(js|mjs|ts|tsx|jsx|css|scss|sass|less|vue|json|woff2?|ttf|eot|ico|png|jpe?g|gif|svg|webp)(\?.*)?$/i
  const staticPathRegex = /^\/(static|assets|public|images|css|js)\//i
  const bypassRegex = /\.(vue|js|mjs|ts|tsx|jsx|css|scss|sass|less|json|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot)$/i

  const rewriteCookies = (headers) => {
    const setCookie = headers['set-cookie']
    if (setCookie) {
      headers['set-cookie'] = setCookie.map((cookie) => {
        const rewrittenCookie = cookie
          .replace(/;\s*secure\s*(;|$)/gi, '$1')
          .replace(/;\s*domain\s*=[^;]+(;|$)/gi, '$1')
          .replace(/;\s*samesite\s*=[^;]+(;|$)/gi, '$1')
          .replace(/;+/g, ';')
          .replace(/;\s*$/g, '')
        log('vue-cli-plugin-dev-proxy: rewrittenCookie', rewrittenCookie)
        return rewrittenCookie
      })
    }
    return headers
  }

  return {
    '/': {
      target: `${https ? 'https' : 'http'}://${appHost}`,
      changeOrigin: true,
      secure: false,
      cookieDomainRewrite: { '*': 'localhost' },
      selfHandleResponse: true,

      // Vue CLI 使用 onProxyReq 而不是 configure + proxy.on('proxyReq')
      onProxyReq: (proxyReq, req, res) => {
        log(`[proxyReq] ${req.method} ${req.url} -> ${proxyReq.getHeader('host')}${proxyReq.path}`)
      },

      onError: (err, req, res) => {
        logError(`[proxyError] ${req.url}:`, err.message)
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain' })
          res.end('Proxy Error: ' + err.message)
        }
      },

      onProxyRes: (proxyRes, req, res) => {
        const startTime = Date.now()
        const contentType = proxyRes.headers['content-type'] || ''
        const redirectUrl = proxyRes.headers.location
        const requestUrl = req.url || ''
        const acceptHeader = req.headers.accept || ''

        log(`[proxyRes] ${requestUrl} - Status: ${proxyRes.statusCode}, ContentType: ${contentType}`)

        const isRedirect = proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && redirectUrl
        if (isRedirect) {
          const host = req.headers.host
          const regex = new RegExp(appHost, 'gi')
          let location = redirectUrl.replace(regex, host || '')
          location = location.replace(
            /https:\/\/(localhost|127\.0\.0\.1)(:\d+)?/gi,
            'http://$1$2'
          )
          const headers2 = rewriteCookies({ ...proxyRes.headers })
          headers2.location = location
          res.writeHead(proxyRes.statusCode, headers2)
          res.end()
          log(`Redirect handled: ${redirectUrl} -> ${location} (${Date.now() - startTime}ms)`)
          return
        }

        const isNavigationRequest = acceptHeader.includes('text/html')
        const isAssetRequest = assetRegex.test(requestUrl)
        const isStaticPath = staticPathRegex.test(requestUrl)
        const shouldProcessHtml = contentType.includes('text/html') && isNavigationRequest && !isAssetRequest && !isStaticPath && !isRedirect
        log('1', contentType.includes('text/html'), isNavigationRequest, !isAssetRequest, !isStaticPath, !isRedirect)
        log(`[shouldProcessHtml] ${shouldProcessHtml}, requestUrl: ${requestUrl}`)

        if (shouldProcessHtml) {
          if (isLib) {
            try {
              const indexHtml = fs.readFileSync(
                resolve(__dirname, localIndexHtml),
                'utf-8'
              )
              res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8'
              })
              res.end(indexHtml)
              log(`Local HTML served: ${localIndexHtml} (${Date.now() - startTime}ms)`)
            } catch (err) {
              logError('Failed to read local HTML:', err)
              res.writeHead(500)
              res.end('Failed to read local HTML')
            }
            return
          }

          const encoding = proxyRes.headers['content-encoding']
          const chunks = []

          proxyRes.on('data', (chunk) => {
            if (chunk) {
              chunks.push(chunk)
            }
          })

          proxyRes.on('end', () => {
            try {
              const buffer = Buffer.concat(chunks)
              const decompress = () => {
                if (encoding === 'gzip') {
                  return zlib.gunzipSync(buffer)
                } else if (encoding === 'deflate') {
                  return zlib.inflateSync(buffer)
                } else if (encoding === 'br') {
                  return zlib.brotliDecompressSync(buffer)
                }
                return buffer
              }
              const decompressed = decompress()
              let html = decompressed.toString('utf-8')
              if (developmentAgentOccupancy) {
                html = html.replace(
                  developmentAgentOccupancy,
                  fullEntry
                )
              } else {
                html = html.replace(
                  /<div[^>]*id=["']app["'][^>]*><\/div>/g,
                  (match) => `${match}${fullEntry}`
                )
              }

              html = html.replace(scriptLinkRegex, (match) => {
                const srcMatch = match.match(/src="([^"]+)"/i)
                const hrefMatch = match.match(/href="([^"]+)"/i)
                const srcOrHref = srcMatch ? srcMatch[1] : hrefMatch ? hrefMatch[1] : null

                if (typeof clearScriptCssPrefixes === 'string') {
                  if (srcOrHref?.startsWith(clearScriptCssPrefixes)) {
                    return ''
                  }
                }
                if (Array.isArray(clearScriptCssPrefixes)) {
                  if (clearScriptCssPrefixes.some(
                    (prefix) => srcOrHref?.startsWith(prefix)
                  )) {
                    return ''
                  }
                }
                if (clearScriptCssPrefixes instanceof RegExp) {
                  return clearScriptCssPrefixes.test(match) ? '' : match
                }
                if (typeof clearScriptCssPrefixes === 'function') {
                  return clearScriptCssPrefixes(match) ? '' : match
                }
                return match
              })

              const headers2 = rewriteCookies({ ...proxyRes.headers })
              headers2['content-type'] = 'text/html; charset=utf-8'
              delete headers2['content-encoding']
              delete headers2['content-length']
              res.writeHead(200, headers2)
              res.end(html)
              log(`HTML processed: ${requestUrl} (${Date.now() - startTime}ms)`)
            } catch (err) {
              logError('Decompress error:', err)
              logError('Request URL:', requestUrl)
              logError('Response headers:', proxyRes.headers)
              res.writeHead(500)
              res.end('Decompress error')
            }
          })
          return
        }

        const headers = rewriteCookies({ ...proxyRes.headers })
        res.writeHead(proxyRes.statusCode, headers)
        proxyRes.pipe(res)
        log(`Proxy request: ${requestUrl} (${Date.now() - startTime}ms)`)
      },

      bypass: (req) => {
        const url = req.url || ''
        const pathname = url.split('?')[0]

        // HTML 请求直接走本地
        // if (req.headers.accept?.includes('text/html')) {
        //   log(`[Bypass HTML] ${url}`)
        //   return '/index.html'
        // }

        const matchesLocalResource = (
          (normalizedStaticPrefix && url.startsWith(`${normalizedStaticPrefix}`)) ||
          url.startsWith('/@') ||
          url.startsWith('/src') ||
          url.startsWith('/node_modules') ||
          url.includes('.hot-update.') ||
          url === '/' ||
          bypassRegex.test(pathname)
        )

        const matchesBypassPrefix = bypassPrefixes.some((prefix) => url.startsWith(prefix))
        const shouldBypass = matchesLocalResource && !matchesBypassPrefix

        if (shouldBypass) {
          log(`[Bypass] ${url}`)
          return url
        }

        log(`[Proxy] ${url}`)
        return null
      }
    }
  }
}

/**
 * Vue CLI 代理插件
 * @param {Object} options - 插件配置选项
 * @returns {Object} Vue CLI 配置对象
 */
function vueCliDevProxy (options = {}) {
  if (process.env.NODE_ENV !== 'development') {
    return {}
  }

  const proxyConfig = createProxyConfig(options)

  return {
    devServer: {
      proxy: proxyConfig
    }
  }
}

module.exports = vueCliDevProxy
