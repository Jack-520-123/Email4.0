/**
 * 邮件追踪工具函数
 */

/**
 * 在邮件HTML内容中插入打开追踪像素
 * @param htmlContent 原始HTML内容
 * @param emailId 邮件ID
 * @param baseUrl 基础URL
 * @returns 包含追踪像素的HTML内容
 */
export function addOpenTracking(htmlContent: string, emailId: string, baseUrl: string): string {
  const trackingPixel = `<img src="${baseUrl}/api/tracking?emailId=${emailId}&type=open" width="1" height="1" style="display:none;" alt="" />`
  
  // 尝试在</body>标签前插入追踪像素
  if (htmlContent.includes('</body>')) {
    return htmlContent.replace('</body>', `${trackingPixel}</body>`)
  }
  
  // 如果没有</body>标签，直接在末尾添加
  return htmlContent + trackingPixel
}

/**
 * 在邮件HTML内容中为所有链接添加点击追踪
 * @param htmlContent 原始HTML内容
 * @param emailId 邮件ID
 * @param baseUrl 基础URL
 * @returns 包含点击追踪的HTML内容
 */
export function addClickTracking(htmlContent: string, emailId: string, baseUrl: string): string {
  // 优化正则，兼容所有 <a> 标签格式
  const linkRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi
  return htmlContent.replace(linkRegex, (match, originalUrl) => {
    // 跳过已经是追踪链接的URL
    if (originalUrl.includes('/api/tracking')) {
      return match
    }
    // 跳过邮件地址链接
    if (originalUrl.startsWith('mailto:')) {
      return match
    }
    // 跳过锚点链接
    if (originalUrl.startsWith('#')) {
      return match
    }
    // 创建追踪URL
    const trackingUrl = `${baseUrl}/api/tracking?emailId=${emailId}&type=click&url=${encodeURIComponent(originalUrl)}`
    // 用追踪URL替换原始href
    return match.replace(originalUrl, trackingUrl)
  })
}

/**
 * 为邮件内容添加完整的追踪功能
 * @param htmlContent 原始HTML内容
 * @param emailId 邮件ID
 * @param baseUrl 基础URL（如：https://yourdomain.com）
 * @returns 包含完整追踪功能的HTML内容
 */
export function addEmailTracking(htmlContent: string, emailId: string, baseUrl: string): string {
  let trackedContent = htmlContent
  
  // 添加点击追踪
  trackedContent = addClickTracking(trackedContent, emailId, baseUrl)
  
  // 添加打开追踪
  trackedContent = addOpenTracking(trackedContent, emailId, baseUrl)
  
  return trackedContent
}

/**
 * 从URL中提取域名
 * @param url 完整URL
 * @returns 域名
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return `${urlObj.protocol}//${urlObj.host}`
  } catch {
    return 'http://localhost:3000' // 默认值
  }
}