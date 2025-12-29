import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const customGroup = formData.get('customGroup') as string
    
    if (!file) {
      return NextResponse.json({ error: '请选择文件' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let data: any[][]

    // 解析文件
    if (file.name.endsWith('.csv')) {
      const text = buffer.toString('utf-8')
      // 使用 Papa Parse 正确解析 CSV，支持包含逗号的字段
      const parseResult = Papa.parse(text, {
        skipEmptyLines: true,
        transform: (value) => value.trim() // 自动去除空格
      })
      
      if (parseResult.errors.length > 0) {
        console.error('CSV解析错误:', parseResult.errors)
        return NextResponse.json({ 
          error: 'CSV文件格式错误', 
          details: parseResult.errors.map(e => e.message).join('; ')
        }, { status: 400 })
      }
      
      data = parseResult.data as string[][]
    } else if (file.name.endsWith('.xlsx')) {
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      data = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
    } else {
      return NextResponse.json({ error: '不支持的文件格式' }, { status: 400 })
    }

    if (data.length < 2) {
      return NextResponse.json({ error: '文件内容为空或格式错误' }, { status: 400 })
    }

    // 验证表头
    const headers = data[0].map(h => h ? h.toString().trim() : '')
    console.log('解析到的表头:', headers)
    console.log('数据行数:', data.length)
    
    const nameIndex = headers.findIndex(h => h === '姓名' || h.toLowerCase().includes('name'))
    const emailIndex = headers.findIndex(h => h === '邮箱' || h.toLowerCase().includes('email'))
    const companyIndex = headers.findIndex(h => h === '公司' || h.toLowerCase().includes('company'))
    const groupIndex = headers.findIndex(h => h === '分组' || h.toLowerCase().includes('group'))
    const websiteIndex = headers.findIndex(h => h === '主页链接' || h.toLowerCase().includes('website'))
    
    console.log('列索引映射:', { nameIndex, emailIndex, companyIndex, groupIndex, websiteIndex })
    
    if (nameIndex === -1 || emailIndex === -1) {
      return NextResponse.json({ 
        error: '文件格式错误，必须包含姓名和邮箱列',
        details: `当前表头: [${headers.join(', ')}]，请确保包含"姓名"和"邮箱"列`
      }, { status: 400 })
    }

    // 获取用户信息
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    // 获取或创建默认收件人列表
    let recipientList = await prisma.recipientList.findFirst({
      where: {
        userId: user.id,
        name: '默认列表'
      }
    })

    if (!recipientList) {
      recipientList = await prisma.recipientList.create({
        data: {
          name: '默认列表',
          description: '系统默认收件人列表',
          userId: user.id
        }
      })
    }

    // 处理数据行
    const validRecipients = []
    const errors = []
    
    console.log('开始处理数据行，总行数:', data.length)
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i]
      console.log(`处理第${i + 1}行数据:`, row)
      
      if (!row || row.length === 0) {
        console.log(`第${i + 1}行为空，跳过`)
        continue
      }
      
      const name = row[nameIndex] ? row[nameIndex].toString().trim() : ''
      const email = row[emailIndex] ? row[emailIndex].toString().trim() : ''
      const company = row[companyIndex] ? row[companyIndex].toString().trim() : ''
      const group = customGroup || (groupIndex !== -1 && row[groupIndex] ? row[groupIndex].toString().trim() : '') || ''
      const website = websiteIndex !== -1 && row[websiteIndex] ? row[websiteIndex].toString().trim() : ''
      
      console.log(`第${i + 1}行解析结果:`, { name, email, company, group, website })
      
      // 验证姓名和邮箱
      if (!name || !email) {
        const error = `第${i + 1}行：姓名或邮箱为空 (姓名: "${name}", 邮箱: "${email}")`
        errors.push(error)
        console.log('验证失败:', error)
        continue
      }
      
      // 验证邮箱格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        const error = `第${i + 1}行：邮箱格式不正确 (${email})`
        errors.push(error)
        console.log('邮箱格式错误:', error)
        continue
      }
      
      // 检查邮箱在同一分组内是否已存在
      const existingRecipient = await prisma.recipient.findFirst({
        where: {
          email,
          userId: user.id,
          group: group || null // 如果分组为空，则检查分组为null的记录
        }
      })
      
      if (existingRecipient) {
        const groupInfo = group ? `分组"${group}"` : '无分组'
        const error = `第${i + 1}行：邮箱在${groupInfo}中已存在 (${email})`
        errors.push(error)
        console.log('邮箱在同一分组内重复:', error)
        continue
      }
      
      validRecipients.push({
        name,
        email,
        company,
        group,
        website,
        recipientListId: recipientList.id,
        userId: user.id
      })
      
      console.log(`第${i + 1}行数据有效，已添加到待导入列表`)
    }

    // 批量插入收件人
    if (validRecipients.length > 0) {
      await prisma.recipient.createMany({
        data: validRecipients,
        skipDuplicates: true
      })
    }

    return NextResponse.json({
      success: true,
      count: validRecipients.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `成功导入${validRecipients.length}个收件人${errors.length > 0 ? `，${errors.length}个错误` : ''}`
    })

  } catch (error) {
    console.error('批量导入收件人失败:', error)
    return NextResponse.json(
      { 
        error: '批量导入失败', 
        details: error instanceof Error ? error.message : '未知错误',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : '') : undefined
      },
      { status: 500 }
    )
  }
}