const {VueCliPluginDevProxy} = require('../../dist/index.cjs')
const path = require('path')
const fs = require('fs')
const argv = require('minimist')(process.argv.slice(2))
const lint = !!argv.watch
const productionSourceMap = !!argv.sourceMap
const isDev = process.env.NODE_ENV === 'development'
const srcFiles = fs.readdirSync(path.resolve(__dirname, 'src/'))
// 项目名称
const projectName = path.resolve(__dirname).split(path.sep).pop()
// 公共地址
// 根据环境配置 在.env.development 和 .env.production 中配置
const publicPath = process.env.VUE_APP_STATIC_URL || '/static'
// 生产环境构建文件的目录
const outputDir = `dist/${projectName}/`
// 页面片路径
const indexPath = srcFiles.find(file => path.extname(file) === '.html')
// 入口路径 (相对路径)
const entryPath = './src/main.js'

/**
 * 从构建产物的 HTML 文件中动态提取 script 入口文件
 * @param {string} htmlPath - HTML 文件路径
 * @param {string} staticPrefix - 静态资源前缀
 * @returns {string[]} - 入口文件路径数组
 */
function extractEntryFromHtml (htmlPath, staticPrefix) {
  try {
    // 如果 HTML 文件不存在，返回默认值
    if (!fs.existsSync(htmlPath)) {
      console.warn('[vue.config.js] HTML file not found: ' + htmlPath + ', using default entry')
      return ['/js/app.js']
    }
    console.log('[vue.config.js] HTML file found: ' + htmlPath)
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8')
    const scriptRegex = /<script[^>]+src=["']([^"']+\.js)["'][^>]*>/g
    const entries = []
    let match

    // 提取所有 script 标签的 src 属性
    while ((match = scriptRegex.exec(htmlContent)) !== null) {
      const src = match[1]
      // 移除 staticPrefix 前缀，只保留相对路径
      if (src.startsWith(staticPrefix)) {
        entries.push(src.substring(staticPrefix.length))
      } else if (src.startsWith('/static/')) {
        // 处理绝对路径
        entries.push(src.replace(/^\/static\/[^/]+/, ''))
      }
    }

    // 如果没有提取到任何入口，返回默认值
    if (entries.length === 0) {
      console.warn('[vue.config.js] No entries found in HTML, using default entry')
      return ['/js/app.js']
    }

    console.log('[vue.config.js] Extracted entries from HTML:', entries)
    return entries
  } catch (error) {
    console.error('[vue.config.js] Error extracting entries from HTML:', error)
    return ['/js/app.js']
  }
}

// 静态资源前缀
const staticPrefix = '/static/contract'
// 动态提取入口文件
const distHtmlPath = path.resolve(__dirname, outputDir, indexPath)
const dynamicEntry = extractEntryFromHtml(distHtmlPath, staticPrefix)

const devProxy = VueCliPluginDevProxy({
  appHost: 'beta-internal.cxmuc.com',
  https: true,
  staticPrefix: staticPrefix,
  clearScriptCssPrefixes: ['//sslstatic.xiaoyusan.com/contract'],
  remotePrefixes: ['/static/component','/static/pc','/static/js'],
  // entry: dynamicEntry,
  debug: true
})
module.exports = {
  outputDir: outputDir,
  indexPath: indexPath,
  publicPath: staticPrefix,
  lintOnSave: lint,
  runtimeCompiler: true,
  productionSourceMap,
  crossorigin: 'anonymous',
  devServer: {
    proxy: devProxy.devServer.proxy
  },
  chainWebpack: config => {
    config.plugin('html')
      .tap(args => {
        args[0].minify = false
        args[0].filename = indexPath
        args[0].template = path.join(__dirname, `src/${indexPath}`)
        return args
      })
    if (isDev) {
      config.plugins.delete('preload')
      config.plugins.delete('prefetch')
      if (isDev) {
        config.devtool('inline-source-map')
      }
    }
  },
  configureWebpack: config => {
    config.entry.app[0] = entryPath
    if (isDev) {
      config.output.filename = 'js/[name].js'
      config.output.chunkFilename = 'js/[name].js'
      // 禁用代码分割，所有代码打包到 app.js
      // config.optimization = {
      //   splitChunks: false,
      //   runtimeChunk: false
      // }
    }
  }
}

