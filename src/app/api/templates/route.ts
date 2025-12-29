import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 获取用户的邮件模板列表
export async function GET() {
  try {
    console.log('GET请求开始')
    
    // 获取当前会话
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      console.log('未找到会话，返回401')
      return NextResponse.json({ message: '未授权访问' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }
    
    console.log('找到会话用户，获取模板列表，用户ID:', currentUser.id)
    const templates = await prisma.template.findMany({
      where: {
        userId: currentUser.id
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })
    
    console.log('获取到的模板：', templates)
    return NextResponse.json({ templates })
  } catch (error) {
    console.error('获取模板失败：', error)
    return NextResponse.json({ error: '获取模板失败' }, { status: 500 })
  }
}

// 创建新模板
export async function POST(request: NextRequest) {
  try {
    console.log('POST请求开始')
    
    // 获取当前会话
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      console.log('未找到会话，返回401')
      return NextResponse.json({ message: '未授权访问' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }
    
    const { name, subject, content, type = 'PLAIN' } = await request.json()
    
    if (!name || !subject || !content) {
      return NextResponse.json(
        { error: '模板名称、主题和内容不能为空' },
        { status: 400 }
      )
    }
    
    console.log('开始创建模板，用户ID:', currentUser.id)
    const template = await prisma.template.create({
      data: {
        name,
        subject,
        htmlContent: content,
        isRichText: type === 'RICH',
        userId: currentUser.id
      }
    })
    
    console.log('模板创建成功：', template)
    return NextResponse.json({ 
      success: true,
      template 
    })
  } catch (error) {
    console.error('创建模板失败：', error)
    return NextResponse.json({ error: '创建模板失败' }, { status: 500 })
  }
}

// 更新模板
export async function PUT(request: NextRequest) {
  try {
    console.log('PUT请求开始')
    
    // 获取当前会话
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      console.log('未找到会话，返回401')
      return NextResponse.json({ message: '未授权访问' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }
    
    const { id, name, subject, content } = await request.json()
    
    if (!id || !name || !subject || !content) {
      return NextResponse.json(
        { error: '模板ID、名称、主题和内容不能为空' },
        { status: 400 }
      )
    }
    
    // 检查模板是否属于当前用户
    const existingTemplate = await prisma.template.findFirst({
      where: {
        id,
        userId: currentUser.id
      }
    })
    
    if (!existingTemplate) {
      return NextResponse.json(
        { error: '模板不存在或无权限' },
        { status: 404 }
      )
    }
    
    console.log('开始更新模板，用户ID:', currentUser.id)
    const template = await prisma.template.update({
      where: { id },
      data: {
        name,
        subject,
        htmlContent: content
      }
    })
    
    console.log('模板更新成功：', template)
    return NextResponse.json({ 
      success: true,
      template 
    })
  } catch (error) {
    console.error('更新模板失败：', error)
    return NextResponse.json({ error: '更新模板失败' }, { status: 500 })
  }
}

// 删除模板
export async function DELETE(request: NextRequest) {
  try {
    console.log('DELETE请求开始')
    
    // 获取当前会话
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      console.log('未找到会话，返回401')
      return NextResponse.json({ message: '未授权访问' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }
    
    const { id } = await request.json()
    
    if (!id) {
      return NextResponse.json(
        { error: '模板ID不能为空' },
        { status: 400 }
      )
    }
    
    // 检查模板是否属于当前用户
    const existingTemplate = await prisma.template.findFirst({
      where: {
        id,
        userId: currentUser.id
      }
    })
    
    if (!existingTemplate) {
      return NextResponse.json(
        { error: '模板不存在或无权限' },
        { status: 404 }
      )
    }
    
    console.log('开始删除模板，用户ID:', currentUser.id)
    await prisma.template.delete({
      where: { id }
    })
    
    console.log('模板删除成功')
    return NextResponse.json({ 
      success: true,
      message: '模板删除成功'
    })
  } catch (error) {
    console.error('删除模板失败：', error)
    return NextResponse.json({ error: '删除模板失败' }, { status: 500 })
  }
}