/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['nodemailer', 'imap', 'mailparser']
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('nodemailer', 'imap', 'mailparser')
    }
    return config
  },
  // 优化构建
  swcMinify: true,
  // 处理环境变量
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  // 输出配置
  output: 'standalone'
}

module.exports = nextConfig