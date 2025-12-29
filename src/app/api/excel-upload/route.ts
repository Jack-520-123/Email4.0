import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    const excelUploads = await prisma.excelUpload.findMany({
      where: {
        userId: currentUser.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(excelUploads)
  } catch (error) {
    console.error('获取Excel上传列表失败:', error)
    return NextResponse.json(
      { error: '获取Excel上传列表失败' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    
    const currentUser = session.user as { id: string }

    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: '请选择文件' }, { status: 400 })
    }

    // 验证文件类型
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ]
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: '只支持 Excel (.xlsx, .xls) 和 CSV 文件' }, { status: 400 })
    }

    // 读取文件内容
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet)

    if (data.length === 0) {
      return NextResponse.json({ error: '文件内容为空' }, { status: 400 })
    }

    // 检测文件类型（收件人或发件人）
    const firstRow = data[0] as any
    const isRecipientFile = 'email' in firstRow || 'name' in firstRow || '邮箱' in firstRow || '姓名' in firstRow
    const isSenderFile = 'smtp_host' in firstRow || 'smtp_port' in firstRow

    if (!isRecipientFile && !isSenderFile) {
      return NextResponse.json({ 
        error: '文件格式不正确。收件人文件需要包含 邮箱 和 姓名 列（或 email 和 name 列），发件人文件需要包含 smtp_host 和 smtp_port 列' 
      }, { status: 400 })
    }

    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    if (isRecipientFile) {
      // 获取或创建默认收件人列表
      let recipientList = await prisma.recipientList.findFirst({
        where: {
          userId: currentUser.id,
          name: '默认列表'
        }
      })

      if (!recipientList) {
        recipientList = await prisma.recipientList.create({
          data: {
            name: '默认列表',
            description: '系统默认收件人列表',
            userId: currentUser.id
          }
        })
      }

      // 处理收件人文件
      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any
        try {
          // 支持中文和英文字段名
          const email = row.email || row['邮箱']
          const name = row.name || row['姓名']
          const company = row.company || row['公司']
          const group = row.group || row['分组']
          const website = row.website || row['主页链接']

          if (!email || !name) {
            errors.push(`第 ${i + 1} 行：缺少必要字段 (邮箱, 姓名)`)
            errorCount++
            continue
          }

          // 检查邮箱是否已存在
          const existingRecipient = await prisma.recipient.findFirst({
            where: {
              email: email,
              userId: currentUser.id
            }
          })

          if (existingRecipient) {
            errors.push(`第 ${i + 1} 行：邮箱 ${email} 已存在`)
            errorCount++
            continue
          }

          await prisma.recipient.create({
            data: {
              email: email,
              name: name,
              company: company || null,
              group: group || null,
              website: website || null,
              recipientListId: recipientList.id,
              userId: currentUser.id
            }
          })
          successCount++
        } catch (error) {
          console.error(`处理第 ${i + 1} 行时出错:`, error)
          errors.push(`第 ${i + 1} 行：处理失败`)
          errorCount++
        }
      }
    } else if (isSenderFile) {
      // 处理发件人文件
      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any
        try {
          if (!row.smtp_host || !row.smtp_port || !row.email || !row.password) {
            errors.push(`第 ${i + 1} 行：缺少必要字段 (smtp_host, smtp_port, email, password)`)
            errorCount++
            continue
          }

          // 检查邮箱是否已存在
          const existingSender = await prisma.emailProfile.findFirst({
            where: {
              email: row.email,
              userId: currentUser.id
            }
          })

          if (existingSender) {
            errors.push(`第 ${i + 1} 行：邮箱 ${row.email} 已存在`)
            errorCount++
            continue
          }

          await prisma.emailProfile.create({
            data: {
              nickname: row.name || row.email,
              email: row.email,
              password: row.password,
              smtpServer: row.smtp_host,
              smtpPort: parseInt(row.smtp_port) || 587,
              userId: currentUser.id
            }
          })
          successCount++
        } catch (error) {
          console.error(`处理第 ${i + 1} 行时出错:`, error)
          errors.push(`第 ${i + 1} 行：处理失败`)
          errorCount++
        }
      }
    }

    // 创建ExcelUpload记录，存储解析后的数据
    const excelUpload = await prisma.excelUpload.create({
      data: {
        userId: currentUser.id,
        fileName: file.name,
        originalName: file.name,
        data: JSON.parse(JSON.stringify(data)), // 存储解析后的数据
        totalRecords: data.length,
        processedRecords: successCount,
        status: errorCount > 0 ? 'partial' : 'completed'
      }
    })

    return NextResponse.json({
      success: true,
      message: `导入完成：成功 ${successCount} 条，失败 ${errorCount} 条`,
      data: {
        successCount,
        errorCount,
        errors: errors.slice(0, 10) // 只返回前10个错误
      }
    })

  } catch (error) {
    console.error('文件上传处理失败:', error)
    return NextResponse.json(
      { error: '文件处理失败' },
      { status: 500 }
    )
  }
}