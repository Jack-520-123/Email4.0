import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { recipientId, email, status, errorMessage } = await request.json()

    if (!recipientId && !email) {
      return NextResponse.json({ error: '必须提供收件人ID或邮箱地址' }, { status: 400 })
    }

    if (!status) {
      return NextResponse.json({ error: '必须提供状态' }, { status: 400 })
    }

    // 查找收件人
    let recipient
    if (recipientId) {
      recipient = await prisma.recipient.findUnique({
        where: { id: recipientId }
      })
    } else {
      recipient = await prisma.recipient.findFirst({
        where: { 
          email: email,
          userId: session.user.id
        }
      })
    }

    if (!recipient) {
      return NextResponse.json({ error: '收件人不存在' }, { status: 404 })
    }

    // 更新收件人状态
    const updateData: any = {
      emailStatus: status,
      lastSentAt: new Date(),
      updatedAt: new Date()
    }

    if (errorMessage) {
      updateData.lastFailureReason = errorMessage
    }

    // 根据状态更新计数器
    if (status === 'SUCCESS') {
      updateData.successCount = {
        increment: 1
      }
    } else if (status === 'FAILED' || status === 'REJECTED' || status === 'INVALID') {
      updateData.failureCount = {
        increment: 1
      }
    } else if (status === 'BOUNCED') {
      updateData.bounceCount = {
        increment: 1
      }
    }

    // 如果失败次数过多，自动加入黑名单
    if (status === 'BOUNCED' || status === 'REJECTED') {
      const currentRecipient = await prisma.recipient.findUnique({
        where: { id: recipient.id }
      })
      
      if (currentRecipient && (currentRecipient.bounceCount + currentRecipient.failureCount) >= 3) {
        updateData.isBlacklisted = true
        updateData.emailStatus = 'BLACKLISTED'
      }
    }

    const updatedRecipient = await prisma.recipient.update({
      where: { id: recipient.id },
      data: updateData
    })

    return NextResponse.json({ 
      success: true, 
      recipient: updatedRecipient 
    })

  } catch (error) {
    console.error('更新收件人状态失败:', error)
    return NextResponse.json(
      { error: '更新收件人状态失败' },
      { status: 500 }
    )
  }
}

// 批量更新收件人状态
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { updates } = await request.json()

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: '必须提供更新数据数组' }, { status: 400 })
    }

    const results = []

    for (const update of updates) {
      const { recipientId, email, status, errorMessage } = update

      try {
        // 查找收件人
        let recipient
        if (recipientId) {
          recipient = await prisma.recipient.findUnique({
            where: { id: recipientId }
          })
        } else if (email) {
          recipient = await prisma.recipient.findFirst({
            where: { 
              email: email,
              userId: session.user.id
            }
          })
        }

        if (!recipient) {
          results.push({ 
            recipientId: recipientId || email, 
            success: false, 
            error: '收件人不存在' 
          })
          continue
        }

        // 更新收件人状态
        const updateData: any = {
          emailStatus: status,
          lastSentAt: new Date(),
          updatedAt: new Date()
        }

        if (errorMessage) {
          updateData.lastFailureReason = errorMessage
        }

        // 根据状态更新计数器
        if (status === 'SUCCESS') {
          updateData.successCount = {
            increment: 1
          }
        } else if (status === 'FAILED' || status === 'REJECTED' || status === 'INVALID') {
          updateData.failureCount = {
            increment: 1
          }
        } else if (status === 'BOUNCED') {
          updateData.bounceCount = {
            increment: 1
          }
        }

        // 如果失败次数过多，自动加入黑名单
        if (status === 'BOUNCED' || status === 'REJECTED') {
          if ((recipient.bounceCount + recipient.failureCount) >= 2) {
            updateData.isBlacklisted = true
            updateData.emailStatus = 'BLACKLISTED'
          }
        }

        await prisma.recipient.update({
          where: { id: recipient.id },
          data: updateData
        })

        results.push({ 
          recipientId: recipient.id, 
          success: true 
        })

      } catch (error) {
        results.push({ 
          recipientId: recipientId || email, 
          success: false, 
          error: error instanceof Error ? error.message : '更新失败' 
        })
      }
    }

    return NextResponse.json({ 
      success: true, 
      results 
    })

  } catch (error) {
    console.error('批量更新收件人状态失败:', error)
    return NextResponse.json(
      { error: '批量更新收件人状态失败' },
      { status: 500 }
    )
  }
}