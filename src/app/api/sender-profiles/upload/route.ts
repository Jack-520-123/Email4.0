import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

// 批量上传发件人配置
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: '未授权访问' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ message: '用户不存在' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ message: '请选择文件' }, { status: 400 });
    }

    // 检查文件类型
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json(
        { message: '仅支持CSV和Excel文件格式' },
        { status: 400 }
      );
    }

    // 读取文件内容
    const buffer = await file.arrayBuffer();
    let data: any[][];

    if (fileName.endsWith('.csv')) {
      // 处理CSV文件
      const text = new TextDecoder('utf-8').decode(buffer);
      const lines = text.split('\n').filter(line => line.trim());
      data = lines.map(line => line.split(',').map(cell => cell.trim()));
    } else {
      // 处理Excel文件
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    }

    if (data.length < 2) {
      return NextResponse.json(
        { message: '文件内容为空或格式不正确' },
        { status: 400 }
      );
    }

    // 验证表头
    const headers = data[0].map(h => h?.toString().trim());
    const expectedHeaders = ['发件人姓名', '邮箱地址'];
    
    const hasValidHeaders = expectedHeaders.every(header => 
      headers.some(h => h === header)
    );

    if (!hasValidHeaders) {
      return NextResponse.json(
        { 
          message: `文件表头格式不正确，应包含：${expectedHeaders.join('、')}`,
          expectedHeaders,
          actualHeaders: headers
        },
        { status: 400 }
      );
    }

    // 获取列索引
    const nameIndex = headers.findIndex(h => h === '发件人姓名');
    const emailIndex = headers.findIndex(h => h === '邮箱地址');

    // 解析数据行
    const senderData = [];
    const errors = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const name = row[nameIndex]?.toString().trim();
      const email = row[emailIndex]?.toString().trim();

      if (!name || !email) {
        errors.push(`第${i + 1}行：发件人姓名和邮箱地址不能为空`);
        continue;
      }

      if (!emailRegex.test(email)) {
        errors.push(`第${i + 1}行：邮箱格式不正确 (${email})`);
        continue;
      }

      // 检查邮箱是否已存在
      const existingProfile = await prisma.emailProfile.findFirst({
        where: {
          userId: user.id,
          email: email,
        },
      });

      if (existingProfile) {
        errors.push(`第${i + 1}行：邮箱 ${email} 已存在配置`);
        continue;
      }

      senderData.push({
        nickname: name,
        email: email,
        // 临时密码，用户需要后续设置
        password: 'temp123456',
        // 默认使用QQ邮箱配置，用户需要后续修改
        smtpServer: 'smtp.qq.com',
        smtpPort: 587,
        userId: user.id,
      });
    }

    if (errors.length > 0 && senderData.length === 0) {
      return NextResponse.json(
        { 
          message: '所有数据都有错误，无法导入',
          errors 
        },
        { status: 400 }
      );
    }

    // 批量创建发件人配置
    let createdCount = 0;
    if (senderData.length > 0) {
      const result = await prisma.emailProfile.createMany({
        data: senderData,
        skipDuplicates: true,
      });
      createdCount = result.count;
    }

    const response: any = {
      message: `批量导入完成，成功导入 ${createdCount} 个发件人配置`,
      count: createdCount,
      total: data.length - 1,
    };

    if (errors.length > 0) {
      response.warnings = errors;
      response.message += `，${errors.length} 个数据有错误被跳过`;
    }

    if (createdCount > 0) {
      response.notice = '导入的发件人配置使用临时密码(temp123456)和默认SMTP配置，请及时修改';
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('批量上传发件人配置失败:', error);
    return NextResponse.json(
      { message: '批量上传失败' },
      { status: 500 }
    );
  }
}