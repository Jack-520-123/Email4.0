import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 导出用户的发件人配置
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

        // 获取用户的邮箱配置
        const emailProfiles = await prisma.emailProfile.findMany({
            where: { userId },
            select: {
                id: true,
                nickname: true,
                email: true,
                // 密码脱敏处理，不导出真实密码
                emailType: true,
                smtpServer: true,
                smtpPort: true,
                imapServer: true,
                imapPort: true,
                imapSecure: true,
                isDefault: true,
                isSystemAdmin: true,
                maxEmailsPerHour: true,
                sendInterval: true,
                randomInterval: true,
                enableMonitoring: true,
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

        // 脱敏处理：添加密码占位符
        const sanitizedProfiles = emailProfiles.map(profile => ({
            ...profile,
            password: '******' // 密码脱敏
        }))

        if (format === 'csv') {
            // CSV格式导出
            const csvHeader = 'ID,昵称,邮箱地址,邮箱类型,SMTP服务器,SMTP端口,是否默认,每小时最大发送量,创建时间\n'
            const csvRows = sanitizedProfiles.map(p =>
                `"${p.id}","${p.nickname}","${p.email}","${p.emailType || ''}","${p.smtpServer}","${p.smtpPort}","${p.isDefault ? '是' : '否'}","${p.maxEmailsPerHour}","${p.createdAt.toISOString()}"`
            ).join('\n')

            const csvContent = csvHeader + csvRows

            return new NextResponse(csvContent, {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="email-profiles_${userId}.csv"`
                }
            })
        } else {
            // JSON格式导出
            const exportData = {
                exportedAt: new Date().toISOString(),
                user: user,
                totalProfiles: sanitizedProfiles.length,
                emailProfiles: sanitizedProfiles,
                note: '密码已脱敏处理，不包含真实密码'
            }

            return new NextResponse(JSON.stringify(exportData, null, 2), {
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Disposition': `attachment; filename="email-profiles_${userId}.json"`
                }
            })
        }
    } catch (error) {
        console.error('导出发件人配置失败:', error)
        return NextResponse.json(
            { error: '导出发件人配置失败' },
            { status: 500 }
        )
    }
}
