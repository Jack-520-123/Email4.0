'use client'

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, Plus, Download, Send, Home, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface EmailProvider {
  id: string;
  name: string;
  smtpServer: string;
  smtpPort: number;
  description: string;
}

interface SenderProfile {
  id: string;
  nickname: string;
  email: string;
  password: string;
  smtpServer: string;
  smtpPort: number;
  imapServer?: string;
  imapPort?: number;
  imapSecure?: boolean;
  enableMonitoring?: boolean;
  createdAt: string;
}

const defaultProviders: EmailProvider[] = [
  {
    id: 'qq',
    name: 'QQ邮箱',
    smtpServer: 'smtp.qq.com',
    smtpPort: 465,
    description: '腾讯QQ邮箱服务'
  },
  {
    id: '163',
    name: '163邮箱',
    smtpServer: 'smtp.163.com',
    smtpPort: 465,
    description: '网易163邮箱服务'
  },
  {
    id: 'exmail',
    name: '企业微信邮箱',
    smtpServer: 'smtp.exmail.qq.com',
    smtpPort: 465,
    description: '腾讯企业微信邮箱服务'
  },
  {
    id: 'gmail',
    name: 'Gmail',
    smtpServer: 'smtp.gmail.com',
    smtpPort: 465,
    description: 'Google Gmail服务'
  }
];

export default function SenderConfigPage() {
  const { data: session } = useSession();
  const [providers, setProviders] = useState<EmailProvider[]>(defaultProviders);
  const [senderProfiles, setSenderProfiles] = useState<SenderProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // 新增发件人表单
  const [newSender, setNewSender] = useState({
    nickname: '',
    email: '',
    password: '',
    providerId: '',
    imapServer: '',
    imapPort: 993,
    imapSecure: true,
    enableMonitoring: false
  });
  const [showPassword, setShowPassword] = useState(false);

  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState('');
  
  // 自定义提供商表单
  const [customProvider, setCustomProvider] = useState({
    name: '',
    smtpServer: '',
    smtpPort: 465,
    description: ''
  });
  const [autoDetectedProvider, setAutoDetectedProvider] = useState<any>(null);

  useEffect(() => {
    if (session?.user) {
      fetchSenderProfiles();
      fetchProviders();
    }
  }, [session]);

  const fetchSenderProfiles = async () => {
    try {
      const response = await fetch('/api/sender-profiles');
      if (response.ok) {
        const data = await response.json();
        setSenderProfiles(data.profiles || data);
      }
    } catch (error) {
      console.error('获取发件人配置失败:', error);
    }
  };

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/email-providers');
      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers || data);
      }
    } catch (error) {
      console.error('获取邮箱提供商失败:', error);
      // 如果API失败，使用默认提供商
      setProviders(defaultProviders);
    }
  };

  // 邮箱自动检测配置
  const detectEmailProvider = (email: string) => {
    const domain = email.split('@')[1]?.toLowerCase()
    if (!domain) return null

    const emailProviders: { [key: string]: { name: string, smtpServer: string, smtpPort: number, imapServer: string, imapPort: number, description: string } } = {
      'gmail.com': { name: 'Gmail', smtpServer: 'smtp.gmail.com', smtpPort: 465, imapServer: 'imap.gmail.com', imapPort: 993, description: 'Google Gmail' },
      'outlook.com': { name: 'Outlook', smtpServer: 'smtp-mail.outlook.com', smtpPort: 465, imapServer: 'outlook.office365.com', imapPort: 993, description: 'Microsoft Outlook' },
      'hotmail.com': { name: 'Hotmail', smtpServer: 'smtp-mail.outlook.com', smtpPort: 465, imapServer: 'outlook.office365.com', imapPort: 993, description: 'Microsoft Hotmail' },
      'live.com': { name: 'Live', smtpServer: 'smtp-mail.outlook.com', smtpPort: 465, imapServer: 'outlook.office365.com', imapPort: 993, description: 'Microsoft Live' },
      'yahoo.com': { name: 'Yahoo', smtpServer: 'smtp.mail.yahoo.com', smtpPort: 465, imapServer: 'imap.mail.yahoo.com', imapPort: 993, description: 'Yahoo Mail' },
      'qq.com': { name: 'QQ邮箱', smtpServer: 'smtp.qq.com', smtpPort: 465, imapServer: 'imap.qq.com', imapPort: 993, description: '腾讯QQ邮箱' },
      '163.com': { name: '163邮箱', smtpServer: 'smtp.163.com', smtpPort: 465, imapServer: 'imap.163.com', imapPort: 993, description: '网易163邮箱' },
      '126.com': { name: '126邮箱', smtpServer: 'smtp.126.com', smtpPort: 465, imapServer: 'imap.126.com', imapPort: 993, description: '网易126邮箱' },
      'sina.com': { name: '新浪邮箱', smtpServer: 'smtp.sina.com', smtpPort: 465, imapServer: 'imap.sina.com', imapPort: 993, description: '新浪邮箱' },
      'sohu.com': { name: '搜狐邮箱', smtpServer: 'smtp.sohu.com', smtpPort: 465, imapServer: 'imap.sohu.com', imapPort: 993, description: '搜狐邮箱' },
      'aliyun.com': { name: '阿里云邮箱', smtpServer: 'smtp.aliyun.com', smtpPort: 465, imapServer: 'imap.aliyun.com', imapPort: 993, description: '阿里云企业邮箱' },
      'foxmail.com': { name: 'Foxmail', smtpServer: 'smtp.qq.com', smtpPort: 465, imapServer: 'imap.qq.com', imapPort: 993, description: 'Foxmail邮箱' }
    }

    return emailProviders[domain] || null
  }

  const handleEmailChange = (email: string) => {
    setNewSender({ ...newSender, email })
    
    const detected = detectEmailProvider(email)
    setAutoDetectedProvider(detected)
    
    if (detected) {
      // 查找是否已有匹配的提供商
      const existingProvider = providers.find(p => 
        p.smtpServer === detected.smtpServer && p.smtpPort === detected.smtpPort
      )
      
      if (existingProvider) {
        setNewSender(prev => ({ 
          ...prev, 
          providerId: existingProvider.id,
          imapServer: detected.imapServer,
          imapPort: detected.imapPort
        }))
      } else {
        // 如果没有匹配的提供商，也自动填充IMAP信息
        setNewSender(prev => ({ 
          ...prev,
          imapServer: detected.imapServer,
          imapPort: detected.imapPort
        }))
      }
    }
  }

  const handleAddSender = async () => {
    if (!newSender.nickname || !newSender.email || !newSender.password || !newSender.providerId) {
      toast.error('请填写完整的发件人信息');
      return;
    }

    const provider = providers.find(p => p.id === newSender.providerId);
    if (!provider) {
      toast.error('请选择有效的邮箱提供商');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/sender-profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nickname: newSender.nickname,
          email: newSender.email,
          password: newSender.password,
          smtpServer: provider.smtpServer,
          smtpPort: provider.smtpPort,
          imapServer: newSender.imapServer,
          imapPort: newSender.imapPort,
          imapSecure: newSender.imapSecure,
          enableMonitoring: newSender.enableMonitoring
        }),
      });

      if (response.ok) {
        toast.success('发件人配置添加成功');
        setNewSender({ 
          nickname: '', 
          email: '', 
          password: '', 
          providerId: '',
          imapServer: '',
          imapPort: 993,
          imapSecure: true,
          enableMonitoring: false
        });
        setAutoDetectedProvider(null);
        fetchSenderProfiles();
      } else {
        const error = await response.json();
        toast.error(error.message || '添加失败');
      }
    } catch (error) {
      toast.error('添加发件人配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSender = async (id: string) => {
    // 找到要删除的配置信息
    const profile = senderProfiles.find(p => p.id === id);
    const profileInfo = profile ? `${profile.nickname} (${profile.email})` : '该发件人配置';
    
    if (!confirm(`确定要删除 ${profileInfo} 吗？\n\n⚠️ 警告：删除操作将同时删除：\n• 该发件人的所有历史活动\n• 相关的已发送邮件记录\n• 所有统计数据\n\n删除后将无法恢复，请谨慎操作！`)) {
      return;
    }

    try {
      console.log(`开始删除发件人配置: ID=${id}`);
      
      const response = await fetch(`/api/sender-profiles/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      console.log('删除响应:', result);

      if (response.ok) {
        toast.success(`${profileInfo} 删除成功`);
        fetchSenderProfiles();
      } else {
        console.error('删除失败:', result);
        toast.error(result.message || '删除失败');
      }
    } catch (error) {
      console.error('删除发件人配置失败:', error);
      toast.error('网络错误，删除失败，请重试');
    }
  };

  const [testingEmails, setTestingEmails] = useState<Set<string>>(new Set());

  const handleTestEmail = async (profile: SenderProfile) => {
    const testEmail = prompt('请输入测试邮箱地址:');
    if (!testEmail) return;

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
      toast.error('请输入有效的邮箱地址');
      return;
    }

    // 添加到发送中状态
    setTestingEmails(prev => new Set([...prev, profile.id]));
    
    try {
      toast.info(`正在发送测试邮件到 ${testEmail}...`, {
        duration: 2000,
      });

      const response = await fetch('/api/sender-profiles/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profileId: profile.id,
          testEmail: testEmail
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`✅ 测试邮件发送成功！\n收件人：${result.testEmail}\n发件人：${result.senderEmail}`, {
          duration: 5000,
        });
      } else {
        const error = await response.json();
        toast.error(`❌ 测试邮件发送失败\n${error.error || '未知错误'}`, {
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('测试邮件发送失败:', error);
      toast.error('❌ 网络错误，测试邮件发送失败', {
        duration: 5000,
      });
    } finally {
      // 移除发送中状态
      setTestingEmails(prev => {
        const newSet = new Set(prev);
        newSet.delete(profile.id);
        return newSet;
      });
    }
  };

  const handleUpdatePassword = async (id: string) => {
    if (!editPassword.trim()) {
      toast.error('请输入新的授权码');
      return;
    }

    try {
      // 首先获取当前配置信息
      const getResponse = await fetch(`/api/sender-profiles/${id}`);
      if (!getResponse.ok) {
        toast.error('获取配置信息失败');
        return;
      }
      
      const currentProfile = await getResponse.json();
      
      // 更新密码
      const response = await fetch(`/api/sender-profiles/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nickname: currentProfile.nickname,
          email: currentProfile.email,
          password: editPassword,
          smtpServer: currentProfile.smtpServer,
          smtpPort: currentProfile.smtpPort,
        }),
      });

      if (response.ok) {
        toast.success('授权码更新成功');
        setEditingProfile(null);
        setEditPassword('');
        fetchSenderProfiles();
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || '更新失败');
      }
    } catch (error) {
      console.error('更新授权码失败:', error);
      toast.error('更新授权码失败');
    }
  };

  const handleAddCustomProvider = () => {
    if (!customProvider.name || !customProvider.smtpServer) {
      toast.error('请填写完整的提供商信息');
      return;
    }

    const newProvider: EmailProvider = {
      id: `custom_${Date.now()}`,
      name: customProvider.name,
      smtpServer: customProvider.smtpServer,
      smtpPort: customProvider.smtpPort,
      description: '自定义邮箱服务'
    };

    setProviders([...providers, newProvider]);
    setCustomProvider({ name: '', smtpServer: '', smtpPort: 587, description: '' });
    toast.success('自定义邮箱提供商添加成功');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
      toast.error('请上传CSV或Excel文件');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/sender-profiles/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`批量导入成功，共导入${result.count}个发件人配置`);
        fetchSenderProfiles();
      } else {
        const error = await response.json();
        toast.error(error.message || '批量导入失败');
      }
    } catch (error) {
      toast.error('批量导入失败');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const downloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/templates/sender-template.csv';
    link.download = 'sender-template.csv';
    link.click();
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>请先登录</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* 面包屑导航 */}
      <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
        <Link href="/dashboard" className="flex items-center hover:text-foreground transition-colors">
          <Home className="w-4 h-4 mr-1" />
          仪表盘
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-foreground font-medium">发件人配置管理</span>
      </div>
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold">发件人配置管理</h1>
        <p className="text-muted-foreground mt-2">
          管理您的邮箱发件人配置，支持多种邮箱服务商
        </p>
      </div>

      <Tabs defaultValue="profiles" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profiles">发件人配置</TabsTrigger>
          <TabsTrigger value="providers">邮箱服务商</TabsTrigger>
        </TabsList>

        <TabsContent value="profiles" className="space-y-6">
          {/* 批量导入 */}
          <Card>
            <CardHeader>
              <CardTitle>批量导入发件人</CardTitle>
              <CardDescription>
                支持通过CSV或Excel文件批量导入发件人配置
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button onClick={downloadTemplate} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  下载模板
                </Button>
                <div className="flex-1">
                  <Input
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </div>
              </div>
              <Alert>
                <AlertDescription>
                  模板格式：发件人姓名,邮箱地址。上传后需要为每个邮箱配置密码和选择服务商。
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* 添加发件人 */}
          <Card>
            <CardHeader>
              <CardTitle>添加发件人配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nickname">发件人姓名</Label>
                  <Input
                    id="nickname"
                    value={newSender.nickname}
                    onChange={(e) => setNewSender({ ...newSender, nickname: e.target.value })}
                    placeholder="请输入发件人姓名"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <Label htmlFor="email">邮箱地址</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newSender.email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="请输入邮箱地址"
                    autoComplete="off"
                  />
                  {autoDetectedProvider && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                      <div className="text-blue-800 font-medium">✓ 自动识别邮箱服务商</div>
                      <div className="text-blue-600">
                        {autoDetectedProvider.name} - {autoDetectedProvider.smtpServer}:{autoDetectedProvider.smtpPort}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="password">邮箱密码/授权码</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={newSender.password}
                      onChange={(e) => setNewSender({ ...newSender, password: e.target.value })}
                      placeholder="请输入邮箱密码或授权码"
                      className="pr-10"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464m1.414 1.414L8.464 8.464m5.656 5.656l1.415 1.415m-1.415-1.415l1.415 1.415M14.828 14.828L16.243 16.243" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="provider">邮箱服务商</Label>
                  <Select value={newSender.providerId} onValueChange={(value) => setNewSender({ ...newSender, providerId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择邮箱服务商" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {provider.name} ({provider.smtpServer}:{provider.smtpPort})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {autoDetectedProvider && !providers.find(p => p.smtpServer === autoDetectedProvider.smtpServer) && (
                    <div className="mt-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setCustomProvider({
                            name: autoDetectedProvider.name,
                            smtpServer: autoDetectedProvider.smtpServer,
                            smtpPort: autoDetectedProvider.smtpPort,
                            description: autoDetectedProvider.description
                          })
                        }}
                      >
                        添加 {autoDetectedProvider.name} 为自定义服务商
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* IMAP配置 */}
                <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">邮件监听配置 (IMAP)</Label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="enableMonitoring"
                        checked={newSender.enableMonitoring}
                        onChange={(e) => setNewSender({ ...newSender, enableMonitoring: e.target.checked })}
                        className="rounded"
                      />
                      <Label htmlFor="enableMonitoring" className="text-sm">启用邮件监听</Label>
                    </div>
                  </div>
                  
                  {newSender.enableMonitoring && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="imapServer">IMAP服务器</Label>
                        <Input
                          id="imapServer"
                          type="text"
                          value={newSender.imapServer}
                          onChange={(e) => setNewSender({ ...newSender, imapServer: e.target.value })}
                          placeholder="例如: imap.gmail.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor="imapPort">IMAP端口</Label>
                        <Input
                          id="imapPort"
                          type="number"
                          value={newSender.imapPort}
                          onChange={(e) => setNewSender({ ...newSender, imapPort: parseInt(e.target.value) || 993 })}
                          placeholder="993"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="imapSecure"
                            checked={newSender.imapSecure}
                            onChange={(e) => setNewSender({ ...newSender, imapSecure: e.target.checked })}
                            className="rounded"
                          />
                          <Label htmlFor="imapSecure" className="text-sm">使用SSL/TLS安全连接</Label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <Button onClick={handleAddSender} disabled={loading}>
                <Plus className="w-4 h-4 mr-2" />
                {loading ? '添加中...' : '添加发件人'}
              </Button>
            </CardContent>
          </Card>

          {/* 发件人列表 */}
          <Card>
            <CardHeader>
              <CardTitle>已配置的发件人 ({senderProfiles.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {senderProfiles.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  暂无发件人配置，请添加发件人配置
                </p>
              ) : (
                <div className="space-y-4">
                  {senderProfiles.map((profile) => (
                    <div key={profile.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{profile.nickname}</div>
                          <div className="text-sm text-muted-foreground">{profile.email}</div>
                          <div className="text-xs text-muted-foreground">
                            SMTP: {profile.smtpServer}:{profile.smtpPort}
                          </div>
                          {profile.enableMonitoring && profile.imapServer && (
                            <div className="text-xs text-muted-foreground">
                              IMAP: {profile.imapServer}:{profile.imapPort} 
                              <span className="ml-2 px-1 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                                监听已启用
                              </span>
                            </div>
                          )}
                          {!profile.enableMonitoring && (
                            <div className="text-xs text-muted-foreground">
                              <span className="px-1 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                监听未启用
                              </span>
                            </div>
                          )}
                          
                          {/* 授权码显示和编辑 */}
                          <div className="mt-2">
                            <div className="text-xs text-muted-foreground mb-1">授权码:</div>
                            {editingProfile === profile.id ? (
                              <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                  <input
                                    type={showPassword ? "text" : "password"}
                                    value={editPassword}
                                    onChange={(e) => setEditPassword(e.target.value)}
                                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 pr-8"
                                    placeholder="输入新的授权码"
                                    autoComplete="new-password"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-1 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                  >
                                    {showPassword ? (
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464m1.414 1.414L8.464 8.464m5.656 5.656l1.415 1.415m-1.415-1.415l1.415 1.415M14.828 14.828L16.243 16.243" />
                                      </svg>
                                    ) : (
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                    )}
                                  </button>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUpdatePassword(profile.id)}
                                  className="text-xs px-2 py-1 h-auto"
                                >
                                  保存
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingProfile(null);
                                    setEditPassword('');
                                  }}
                                  className="text-xs px-2 py-1 h-auto"
                                >
                                  取消
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                                  {profile.password}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingProfile(profile.id);
                                    setEditPassword('');
                                  }}
                                  className="text-xs px-2 py-1 h-auto"
                                >
                                  修改
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestEmail(profile)}
                            disabled={testingEmails.has(profile.id)}
                            title={testingEmails.has(profile.id) ? "正在发送测试邮件..." : "发送测试邮件"}
                          >
                            {testingEmails.has(profile.id) ? (
                              <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteSender(profile.id)}
                            title="删除发件人配置"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="providers" className="space-y-6">
          {/* 添加自定义提供商 */}
          <Card>
            <CardHeader>
              <CardTitle>添加自定义邮箱服务商</CardTitle>
              <CardDescription>
                如果您使用的邮箱服务商不在默认列表中，可以添加自定义配置
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="providerName">服务商名称</Label>
                  <Input
                    id="providerName"
                    value={customProvider.name}
                    onChange={(e) => setCustomProvider({ ...customProvider, name: e.target.value })}
                    placeholder="例如：自定义邮箱"
                  />
                </div>
                <div>
                  <Label htmlFor="smtpServer">SMTP服务器</Label>
                  <Input
                    id="smtpServer"
                    value={customProvider.smtpServer}
                    onChange={(e) => setCustomProvider({ ...customProvider, smtpServer: e.target.value })}
                    placeholder="例如：smtp.example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="smtpPort">SMTP端口</Label>
                  <Input
                    id="smtpPort"
                    type="number"
                    value={customProvider.smtpPort}
                    onChange={(e) => setCustomProvider({ ...customProvider, smtpPort: parseInt(e.target.value) || 587 })}
                    placeholder="587"
                  />
                </div>
              </div>
              <Button onClick={handleAddCustomProvider}>
                <Plus className="w-4 h-4 mr-2" />
                添加自定义服务商
              </Button>
            </CardContent>
          </Card>

          {/* 邮箱服务商列表 */}
          <Card>
            <CardHeader>
              <CardTitle>支持的邮箱服务商</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {providers.map((provider) => (
                  <div key={provider.id} className="p-4 border rounded-lg">
                    <div className="font-medium">{provider.name}</div>
                    <div className="text-sm text-muted-foreground">{provider.description}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      SMTP: {provider.smtpServer}:{provider.smtpPort}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}