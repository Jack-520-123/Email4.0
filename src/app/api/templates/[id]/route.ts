import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 获取单个模板
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    const template = await prisma.template.findFirst({
      where: {
        id: params.id,
        userId: currentUser.id
      }
    })

    if (!template) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 })
    }

    return NextResponse.json(template)
  } catch (error) {
    console.error('获取模板失败:', error)
    return NextResponse.json({ error: '获取模板失败' }, { status: 500 })
  }
}

// 更新模板
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    const body = await request.json()
    const { name, subject, content, htmlContent } = body

    // 验证模板是否属于当前用户
    const existingTemplate = await prisma.template.findFirst({
      where: {
        id: params.id,
        userId: currentUser.id
      }
    })

    if (!existingTemplate) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 })
    }

    // 支持content和htmlContent两种字段名
    const contentToUpdate = content || htmlContent

    if (!name || !subject || !contentToUpdate) {
      return NextResponse.json(
        { error: '请提供模板名称、主题和内容' },
        { status: 400 }
      )
    }

    const template = await prisma.template.update({
      where: { id: params.id },
      data: {
        name,
        subject,
        htmlContent: contentToUpdate,
        updatedAt: new Date()
      }
    })

    return NextResponse.json(template)
  } catch (error) {
    console.error('更新模板失败:', error)
    return NextResponse.json({ error: '更新模板失败' }, { status: 500 })
  }
}

// 删除模板
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('DELETE请求到达 /api/templates/[id]，模板ID:', params.id)
  
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    // 验证模板是否属于当前用户
    console.log('查找要删除的模板...')
    const existingTemplate = await prisma.template.findFirst({
      where: {
        id: params.id,
        userId: currentUser.id
      }
    })

    if (!existingTemplate) {
      console.log('模板不存在或不属于当前用户')
      return NextResponse.json({ error: '模板不存在' }, { status: 404 })
    }

    // 检查模板是否被活动使用
    console.log('检查模板是否被活动使用...')
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
      console.log('模板被以下活动使用:', campaignNames)
      return NextResponse.json({ 
        error: `无法删除模板，以下活动正在使用此模板：${campaignNames}` 
      }, { status: 400 })
    }

    // 检查模板是否有已发送的邮件记录
    console.log('检查模板是否有已发送的邮件记录...')
    const sentEmailsCount = await prisma.sentEmail.count({
      where: {
        templateId: params.id
      }
    })

    if (sentEmailsCount > 0) {
      console.log('模板已被用于发送邮件，数量:', sentEmailsCount)
      return NextResponse.json({ 
        error: `无法删除模板，该模板已被用于发送 ${sentEmailsCount} 封邮件` 
      }, { status: 400 })
    }

    console.log('开始删除模板...')
    await prisma.template.delete({
      where: { id: params.id }
    })

    console.log('模板删除成功')
    return NextResponse.json({ 
      success: true,
      message: '模板删除成功' 
    })
  } catch (error) {
    console.error('删除模板失败:', error)
    console.error('错误详情：', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : '未知错误',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    })
    
    return NextResponse.json({ 
      error: '删除模板失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}