import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://email4-0.vercel.app'

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/'], // 禁止爬取 API 和 管理后台敏感目录
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
