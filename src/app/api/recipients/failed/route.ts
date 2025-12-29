import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status') // 可选的状态过滤
    const recipientListId = searchParams.get('recipientListId') // 可选的收件人列表过滤
    const export_format = searchParams.get('export') // 是否导出

    const skip = (page - 1) * limit

    // 构建查询条件
    const where: any = {
      userId: session.user.id,
      OR: [
        { emailStatus: 'FAILED' },
        { emailStatus: 'BOUNCED' },
        { emailStatus: 'REJECTED' },
        { emailStatus: 'INVALID' },
        { emailStatus: 'BLACKLISTED' },
        { isBlacklisted: true }
      ]
    }

    // 如果指定了状态，则只查询该状态
    if (status && status !== 'ALL') {
      delete where.OR
      where.emailStatus = status
    }

    // 如果指定了收件人列表，则只查询该列表
    if (recipientListId) {
      where.recipientListId = recipientListId
    }

    // 获取总数
    const total = await prisma.recipient.count({ where })

    // 获取数据
    const recipients = await prisma.recipient.findMany({
      where,
      include: {
        recipientList: {
          select: {
            name: true
          }
        },
        sentEmails: {
          where: {
            status: {
              in: ['FAILED', 'failed', 'bounced', 'rejected']
            }
          },
          orderBy: {
            sentAt: 'desc'
          },
          take: 1,
          select: {
            sentAt: true,
            status: true,
            errorMessage: true,
            emailProfile: {
              select: {
                nickname: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      skip: export_format ? 0 : skip,
      take: export_format ? undefined : limit
    })

    // 如果是导出格式，返回CSV数据
    if (export_format === 'csv') {
      const csvHeaders = [
        '姓名',
        '邮箱',
        '公司',
        '分组',
        '收件人列表',
        '邮箱状态',
        '成功次数',
        '失败次数',
        '退回次数',
        '是否黑名单',
        '最后发送时间',
        '最后失败原因',
        '最后错误信息',
        '发件箱昵称',
        '发件箱邮箱'
      ]

      const csvRows = recipients.map(recipient => [
        recipient.name || '',
        recipient.email || '',
        recipient.company || '',
        recipient.group || '',
        recipient.recipientList?.name || '',
        recipient.emailStatus || '',
        recipient.successCount || 0,
        recipient.failureCount || 0,
        recipient.bounceCount || 0,
        recipient.isBlacklisted ? '是' : '否',
        recipient.lastSentAt ? new Date(recipient.lastSentAt).toLocaleString('zh-CN') : '',
        recipient.lastFailureReason || '',
        recipient.sentEmails[0]?.errorMessage || '',
        recipient.sentEmails[0]?.emailProfile?.nickname || '',
        recipient.sentEmails[0]?.emailProfile?.email || ''
      ])

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
        .join('\n')

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="failed-recipients-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    // 统计信息
    const stats = await prisma.recipient.groupBy({
      by: ['emailStatus'],
      where: {
        userId: session.user.id,
        emailStatus: {
          in: ['FAILED', 'BOUNCED', 'REJECTED', 'INVALID', 'BLACKLISTED']
        }
      },
      _count: {
        id: true
      }
    })

    const blacklistedCount = await prisma.recipient.count({
      where: {
        userId: session.user.id,
        isBlacklisted: true
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        recipients: recipients.map(recipient => ({
          id: recipient.id,
          name: recipient.name,
          email: recipient.email,
          company: recipient.company,
          group: recipient.group,
          recipientList: recipient.recipientList?.name,
          emailStatus: recipient.emailStatus,
          successCount: recipient.successCount,
          failureCount: recipient.failureCount,
          bounceCount: recipient.bounceCount,
          isBlacklisted: recipient.isBlacklisted,
          lastSentAt: recipient.lastSentAt,
          lastFailureReason: recipient.lastFailureReason,
          lastError: recipient.sentEmails[0]?.errorMessage,
          lastErrorTime: recipient.sentEmails[0]?.sentAt,
          senderNickname: recipient.sentEmails[0]?.emailProfile?.nickname,
          senderEmail: recipient.sentEmails[0]?.emailProfile?.email
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        stats: {
          ...stats.reduce((acc, stat) => {
            acc[stat.emailStatus.toLowerCase()] = stat._count.id
            return acc
          }, {} as Record<string, number>),
          blacklisted: blacklistedCount
        }
      }
    })

  } catch (error) {
    console.error('获取失败收件人列表失败:', error)
    return NextResponse.json(
      { error: '获取失败收件人列表失败' },
      { status: 500 }
    )
  }
}

// 批量移除黑名单
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { recipientIds, action } = await request.json()

    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
      return NextResponse.json({ error: '必须提供收件人ID数组' }, { status: 400 })
    }

    if (!action || !['remove_blacklist', 'add_blacklist', 'reset_status'].includes(action)) {
      return NextResponse.json({ error: '无效的操作类型' }, { status: 400 })
    }

    let updateData: any = {}

    switch (action) {
      case 'remove_blacklist':
        updateData = {
          isBlacklisted: false,
          emailStatus: 'UNKNOWN'
        }
        break
      case 'add_blacklist':
        updateData = {
          isBlacklisted: true,
          emailStatus: 'BLACKLISTED'
        }
        break
      case 'reset_status':
        updateData = {
          emailStatus: 'UNKNOWN',
          isBlacklisted: false,
          successCount: 0,
          failureCount: 0,
          bounceCount: 0,
          lastFailureReason: null
        }
        break
    }

    const result = await prisma.recipient.updateMany({
      where: {
        id: {
          in: recipientIds
        },
        userId: session.user.id
      },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      updatedCount: result.count
    })

  } catch (error) {
    console.error('批量操作失败:', error)
    return NextResponse.json(
      { error: '批量操作失败' },
      { status: 500 }
    )
  }
}