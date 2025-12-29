import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 导出用户的邮件模板
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.email) {
            return NextResponse.json({ error: '未授权' }, { status: 401 })
        }

        // 检查是否为管理员
        const currentUser = await prisma.user.findUnique({
            where: { email: session.user.email }
        })

        if (!currentUser || currentUser.role !== 'admin') {
            return NextResponse.json({ error: '权限不足' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const userId = searchParams.get('userId')
        const format = searchParams.get('format') || 'json'

        if (!userId) {
            return NextResponse.json({ error: '缺少用户ID参数' }, { status: 400 })
        }

        // 获取用户的模板
        const templates = await prisma.template.findMany({
            where: { userId },
            select: {
                id: true,
                name: true,
                subject: true,
                htmlContent: true,
                isRichText: true,
                templateData: true,
                attachments: true,
                createdAt: true,
                updatedAt: true
            },
            orderBy: { createdAt: 'desc' }
        })

        // 获取用户信息
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, email: true }
        })

        if (format === 'csv') {
            // CSV格式导出
            const csvHeader = 'ID,名称,主题,是否富文本,创建时间,更新时间\n'
            const csvRows = templates.map(t =>
                `"${t.id}","${t.name}","${t.subject}","${t.isRichText ? '是' : '否'}","${t.createdAt.toISOString()}","${t.updatedAt.toISOString()}"`
            ).join('\n')

            const csvContent = csvHeader + csvRows

            return new NextResponse(csvContent, {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="templates_${userId}.csv"`
                }
            })
        } else {
            // JSON格式导出
            const exportData = {
                exportedAt: new Date().toISOString(),
                user: user,
                totalTemplates: templates.length,
                templates: templates
            }

            return new NextResponse(JSON.stringify(exportData, null, 2), {
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Disposition': `attachment; filename="templates_${userId}.json"`
                }
            })
        }
    } catch (error) {
        console.error('导出模板失败:', error)
        return NextResponse.json(
            { error: '导出模板失败' },
            { status: 500 }
        )
    }
}
