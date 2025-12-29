import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 获取单个富文本模板
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const template = await prisma.template.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
        isRichText: true
      }
    })

    if (!template) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 })
    }

    return NextResponse.json(template)
  } catch (error) {
    console.error('获取富文本模板失败:', error)
    return NextResponse.json({ error: '获取富文本模板失败' }, { status: 500 })
  }
}

// 更新富文本模板
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const body = await request.json()
    const { name, subject, content, templateData } = body

    if (!name || !subject || !content) {
      return NextResponse.json(
        { error: '请提供模板名称、主题和内容' },
        { status: 400 }
      )
    }

    // 验证模板是否存在且属于当前用户
    const existingTemplate = await prisma.template.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
        isRichText: true
      }
    })

    if (!existingTemplate) {
      return NextResponse.json({ error: '富文本模板不存在' }, { status: 404 })
    }

    // 更新模板
    const updatedTemplate = await prisma.template.update({
      where: {
        id: params.id
      },
      data: {
        name,
        subject,
        htmlContent: content,
        templateData: templateData || existingTemplate.templateData,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      template: updatedTemplate,
      message: '富文本模板更新成功'
    })
  } catch (error) {
    console.error('更新富文本模板失败:', error)
    return NextResponse.json({ error: '更新富文本模板失败' }, { status: 500 })
  }
}

// 删除富文本模板
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    // 验证模板是否存在且属于当前用户
    const existingTemplate = await prisma.template.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
        isRichText: true
      }
    })

    if (!existingTemplate) {
      return NextResponse.json({ error: '富文本模板不存在' }, { status: 404 })
    }

    // 检查模板是否被活动使用
    const campaignsUsingTemplate = await prisma.campaign.findMany({
      where: {
        templateId: params.id
      },
      select: {
        id: true,
        name: true
      }
    })

    if (campaignsUsingTemplate.length > 0) {
      const campaignNames = campaignsUsingTemplate.map(c => c.name).join(', ')
      return NextResponse.json({ 
        error: `无法删除模板，以下活动正在使用此模板：${campaignNames}` 
      }, { status: 400 })
    }

    // 检查模板是否有已发送的邮件记录
    const sentEmailsCount = await prisma.sentEmail.count({
      where: {
        templateId: params.id
      }
    })

    if (sentEmailsCount > 0) {
      return NextResponse.json({ 
        error: `无法删除模板，该模板已被用于发送 ${sentEmailsCount} 封邮件` 
      }, { status: 400 })
    }

    // 删除模板
    await prisma.template.delete({
      where: {
        id: params.id
      }
    })

    return NextResponse.json({
      success: true,
      message: '富文本模板删除成功'
    })
  } catch (error) {
    console.error('删除富文本模板失败:', error)
    return NextResponse.json({ error: '删除富文本模板失败' }, { status: 500 })
  }
}