import { withAuth } from 'next-auth/middleware'

export default withAuth(
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // 对于API路由和受保护页面，需要验证token
        if (req.nextUrl.pathname.startsWith('/api/') || 
            req.nextUrl.pathname.startsWith('/dashboard') ||
            req.nextUrl.pathname.startsWith('/templates') ||
            req.nextUrl.pathname.startsWith('/campaigns') ||
            req.nextUrl.pathname.startsWith('/sender-config') ||
            req.nextUrl.pathname.startsWith('/excel-upload') ||
            req.nextUrl.pathname.startsWith('/admin')) {
          return !!token
        }
        return true
      },
    },
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/templates/:path*',
    '/campaigns/:path*',
    '/sender-config/:path*',
    '/excel-upload/:path*',
    '/admin/:path*'
  ]
}