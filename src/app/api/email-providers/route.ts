import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// 预设的邮箱服务商配置
const EMAIL_PROVIDERS = [
  {
    id: 'qq',
    name: 'QQ邮箱',
    smtpServer: 'smtp.qq.com',
    smtpPort: 465,
    description: '腾讯QQ邮箱服务',
    isDefault: true,
  },
  {
    id: 'gmail',
    name: 'Gmail',
    smtpServer: 'smtp.gmail.com',
    smtpPort: 465,
    description: 'Google Gmail服务',
    isDefault: true,
  },
  {
    id: '163',
    name: '网易163邮箱',
    smtpServer: 'smtp.163.com',
    smtpPort: 465,
    description: '网易163邮箱服务',
    isDefault: true,
  },
  {
    id: '126',
    name: '网易126邮箱',
    smtpServer: 'smtp.126.com',
    smtpPort: 465,
    description: '网易126邮箱服务',
    isDefault: true,
  },
  {
    id: 'sina',
    name: '新浪邮箱',
    smtpServer: 'smtp.sina.com',
    smtpPort: 465,
    description: '新浪邮箱服务',
    isDefault: true,
  },
  {
    id: 'outlook',
    name: 'Outlook',
    smtpServer: 'smtp-mail.outlook.com',
    smtpPort: 465,
    description: 'Microsoft Outlook服务',
    isDefault: true,
  },
  {
    id: 'exmail',
    name: '腾讯企业邮箱',
    smtpServer: 'smtp.exmail.qq.com',
    smtpPort: 465,
    description: '腾讯企业邮箱服务',
    isDefault: true,
  },
  {
    id: 'aliyun',
    name: '阿里云邮箱',
    smtpServer: 'smtp.mxhichina.com',
    smtpPort: 465,
    description: '阿里云企业邮箱服务',
    isDefault: true,
  },
];

// 获取邮箱服务商列表
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: '未授权访问' }, { status: 401 });
    }

    const url = new URL(request.url);
    const search = url.searchParams.get('search');

    let providers = EMAIL_PROVIDERS;

    // 如果有搜索参数，进行过滤
    if (search) {
      const searchLower = search.toLowerCase();
      providers = providers.filter(
        provider =>
          provider.name.toLowerCase().includes(searchLower) ||
          provider.smtpServer.toLowerCase().includes(searchLower) ||
          provider.description.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json({
      providers,
      total: providers.length,
    });
  } catch (error) {
    console.error('获取邮箱服务商列表失败:', error);
    return NextResponse.json(
      { message: '获取邮箱服务商列表失败' },
      { status: 500 }
    );
  }
}

// 根据邮箱地址自动检测服务商
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: '未授权访问' }, { status: 401 });
    }

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ message: '请提供邮箱地址' }, { status: 400 });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { message: '邮箱格式不正确' },
        { status: 400 }
      );
    }

    // 提取域名
    const domain = email.split('@')[1].toLowerCase();

    // 根据域名匹配服务商
    let detectedProvider = null;

    // 域名映射规则
    const domainMappings: { [key: string]: string } = {
      'qq.com': 'qq',
      'gmail.com': 'gmail',
      '163.com': '163',
      '126.com': '126',
      'sina.com': 'sina',
      'sina.cn': 'sina',
      'outlook.com': 'outlook',
      'hotmail.com': 'outlook',
      'live.com': 'outlook',
      'msn.com': 'outlook',
    };

    // 企业邮箱特殊处理
    if (domain.includes('exmail.qq.com') || domain.endsWith('.exmail.qq.com')) {
      detectedProvider = EMAIL_PROVIDERS.find(p => p.id === 'exmail');
    } else if (domain.includes('mxhichina.com') || domain.endsWith('.aliyun.com')) {
      detectedProvider = EMAIL_PROVIDERS.find(p => p.id === 'aliyun');
    } else {
      const providerId = domainMappings[domain];
      if (providerId) {
        detectedProvider = EMAIL_PROVIDERS.find(p => p.id === providerId);
      }
    }

    if (detectedProvider) {
      return NextResponse.json({
        detected: true,
        provider: detectedProvider,
        message: `检测到 ${detectedProvider.name} 配置`,
      });
    } else {
      // 返回默认配置建议
      const defaultProvider = EMAIL_PROVIDERS.find(p => p.id === 'qq');
      return NextResponse.json({
        detected: false,
        provider: defaultProvider,
        message: '未能自动检测服务商，建议手动选择或使用默认配置',
        suggestion: '对于企业邮箱，请联系管理员获取SMTP配置信息',
      });
    }
  } catch (error) {
    console.error('检测邮箱服务商失败:', error);
    return NextResponse.json(
      { message: '检测邮箱服务商失败' },
      { status: 500 }
    );
  }
}