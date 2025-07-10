/**
 * Configuration module
 */

module.exports = {
  github: {
    repository: process.env.GITHUB_REPOSITORY || 'PublicFreeSuffix/PublicFreeSuffix',
    templateUrl: 'https://raw.githubusercontent.com/PublicFreeSuffix/PublicFreeSuffix/refs/heads/main/.github/PULL_REQUEST_TEMPLATE/WHOIS_FILE_OPERATION.md',
    labels: {
      validationPassed: 'validation-passed',
      validationFailed: 'validation-failed'
    }
  },
  validation: {
    maxFileCount: 1,
    filePathPattern: /^whois\/[^\/]+\.json$/,
    minDescriptionLength: 1300,
    titlePattern: /^(Registration|Update|Remove):\s+([a-zA-Z0-9-]+)\.(.+)$/
  },
  sld: {
    // SLD列表文件的本地路径
    localPath: '../../public_sld_list.json',
    
    // 缓存配置
    cache: {
      timeout: 24 * 60 * 60 * 1000, // 24 hours
      filename: 'sld_cache.json'     // 缓存文件名
    },

    // SLD状态定义
    status: {
      live: 'live'  // 可用状态的值
    }
  },
  reservedWords: {
    localPath: '../../reserved_words.txt',
    cacheTimeout: 24 * 60 * 60 * 1000, // 24 hours
    // 保留字列表（当文件读取失败时使用）
    fallbackWords: [
      'api', 'admin', 'administrator', 'root', 'master', 'www', 'ftp', 'mail', 'email',
      'support', 'help', 'blog', 'news', 'about', 'contact', 'legal', 'privacy',
      'terms', 'login', 'signin', 'signup', 'register', 'logout', 'auth', 'security',
      'http', 'https', 'ssl', 'tls', 'ssh', 'smtp', 'pop', 'imap', 'dns', 'cdn',
      'backup', 'cache', 'config', 'database', 'db', 'server', 'host', 'localhost',
      'static', 'assets', 'uploads', 'download', 'files', 'images', 'css', 'js',
      'shop', 'store', 'cart', 'checkout', 'payment', 'billing', 'sales', 'order',
      'business', 'enterprise', 'corp', 'company', 'official', 'service', 'status',
      'facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'google', 'apple',
      'microsoft', 'amazon', 'github', 'gitlab', 'discord', 'slack', 'teams',
      'home', 'index', 'main', 'default', 'public', 'private', 'user', 'users',
      'profile', 'account', 'dashboard', 'settings', 'preferences', 'test', 'demo',
      'beta', 'alpha', 'dev', 'development', 'staging', 'production', 'live'
    ]
  },
  logging: {
    levels: {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    },
    colors: {
      error: '\x1b[31m', // red
      warn: '\x1b[33m',  // yellow
      info: '\x1b[36m',  // cyan
      debug: '\x1b[90m'  // gray
    }
  }
}; 