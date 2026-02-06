import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://email4-0.vercel.app'

  // 定义主要公开页面
  const routes = [
    '',
    '/auth/login',
    '/auth/register',
    '/dashboard',
    '/campaigns',
    '/templates',
    '/warmup',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1 : 0.8,
  }))

  return routes
}
