import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 创建富文本模板
export async function POST(request: NextRequest) {
  console.log('富文本模板POST请求到达')
  try {
    console.log('开始解析请求体')
    const { name, subject, content, templateData, attachments } = await request.json()
    console.log('请求数据：', { name, subject, content, templateData })

    if (!name || !subject || !content) {
      console.log('表单验证失败：缺少必要字段')
      return NextResponse.json({ 
        error: '请填写模板名称、主题和内容' 
      }, { status: 400 })
    }

    // 获取当前会话
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      console.log('未找到会话，返回401')
      return NextResponse.json({ message: '未授权访问' }, { status: 401 })
    }

    const currentUser = session.user as { id: string }

    console.log('开始创建富文本模板，用户ID:', currentUser.id)
    const template = await prisma.template.create({
      data: {
        name,
        subject,
        htmlContent: content,
        isRichText: true,
        userId: currentUser.id,
        templateData: templateData || null,
        attachments: attachments ? JSON.stringify(attachments) : null
      }
    })

    console.log('富文本模板创建成功，ID:', template.id)
    return NextResponse.json({
      success: true,
      template
    })

  } catch (error) {
    console.error('创建富文本模板失败:', error)
    return NextResponse.json(
      { error: '创建模板失败' },
      { status: 500 }
    )
  }
}

// 获取富文本模板列表
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const currentUser = session.user as { id: string }

    const templates = await prisma.template.findMany({
      where: {
        userId: currentUser.id,
        isRichText: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // 解析附件数据
    const templatesWithAttachments = templates.map(template => ({
      ...template,
      attachments: template.attachments ? JSON.parse(template.attachments) : []
    }))

    return NextResponse.json({
      success: true,
      templates: templatesWithAttachments
    })

  } catch (error) {
    console.error('获取富文本模板列表失败:', error)
    return NextResponse.json(
      { error: '获取模板列表失败' },
      { status: 500 }
    )
  }
}

// 更新富文本模板
export async function PUT(request: NextRequest) {
  try {
    const { id, name, subject, content, templateData, attachments } = await request.json()

    if (!id || !name || !subject || !content) {
      return NextResponse.json({ 
        error: '请填写模板ID、名称、主题和内容' 
      }, { status: 400 })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const currentUser = session.user as { id: string }

    // 检查模板是否属于当前用户
    const existingTemplate = await prisma.template.findFirst({
      where: {
        id,
        userId: currentUser.id,
        isRichText: true
      }
    })

    if (!existingTemplate) {
      return NextResponse.json(
        { error: '模板不存在或无权限' },
        { status: 404 }
      )
    }

    const template = await prisma.template.update({
      where: { id },
      data: {
        name,
        subject,
        htmlContent: content,
        templateData: templateData || null,
        attachments: attachments ? JSON.stringify(attachments) : null
      }
    })

    return NextResponse.json({
      success: true,
      template
    })

  } catch (error) {
    console.error('更新富文本模板失败:', error)
    return NextResponse.json(
      { error: '更新模板失败' },
      { status: 500 }
    )
  }
}

// 删除富文本模板
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: '模板ID不能为空' }, { status: 400 })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const currentUser = session.user as { id: string }

    // 检查模板是否属于当前用户
    const existingTemplate = await prisma.template.findFirst({
      where: {
        id,
        userId: currentUser.id,
        isRichText: true
      }
    })

    if (!existingTemplate) {
      return NextResponse.json(
        { error: '模板不存在或无权限' },
        { status: 404 }
      )
    }

    await prisma.template.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: '模板删除成功'
    })

  } catch (error) {
    console.error('删除富文本模板失败:', error)
    return NextResponse.json(
      { error: '删除模板失败' },
      { status: 500 }
    )
  }
}