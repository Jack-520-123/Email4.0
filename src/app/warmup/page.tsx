'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';

import Link from 'next/link';
import { Eye, X } from 'lucide-react';
import BreadcrumbNav from '@/components/ui/breadcrumb-nav';

interface EmailProfile {
  id: string;
  nickname: string;
  email: string;
}

interface WarmupCampaign {
  id: string;
  name: string;
  status: string;
  minSendDelay: number;
  maxSendDelay: number;
  emailProfiles: EmailProfile[];
  createdAt: string;
  logs: WarmupLog[];
}

interface WarmupLog {
  id: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  status: string;
  sentAt: string;
}

export default function WarmupPage() {
  const [emailProfiles, setEmailProfiles] = useState<EmailProfile[]>([]);
  const [campaigns, setCampaigns] = useState<WarmupCampaign[]>([]);
  const [loading, setLoading] = useState(false);

  // 实时日志相关状态
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [realTimeLogs, setRealTimeLogs] = useState<WarmupLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // 新建预热活动的表单状态
  const [formData, setFormData] = useState({
    name: '',
    selectedEmails: [] as string[],
    minSendDelay: 2,
    maxSendDelay: 30
  });

  // 获取邮箱配置列表
  const fetchEmailProfiles = async () => {
    try {
      const response = await fetch('/api/sender-profiles');
      if (response.ok) {
        const data = await response.json();
        setEmailProfiles(data.profiles || []);
      }
    } catch (error) {
      console.error('获取邮箱配置失败:', error);
    }
  };

  // 获取预热活动列表
  const fetchCampaigns = async () => {
    try {
      const response = await fetch('/api/warmup');
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data);
      }
    } catch (error) {
      console.error('获取预热活动失败:', error);
    }
  };

  useEffect(() => {
    fetchEmailProfiles();
    fetchCampaigns();
  }, []);

  // 创建新的预热活动
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.selectedEmails.length < 2) {
      toast({
        title: "错误",
        description: "至少需要选择2个邮箱进行预热",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/warmup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          emailProfileIds: formData.selectedEmails,
          minSendDelay: formData.minSendDelay,
          maxSendDelay: formData.maxSendDelay,
        }),
      });

      if (response.ok) {
        toast({
          title: "成功",
          description: "预热活动创建成功",
        });

        // 重置表单
        setFormData({
          name: '',
          selectedEmails: [],
          minSendDelay: 2,
          maxSendDelay: 30
        });

        // 刷新列表
        fetchCampaigns();
      } else {
        const error = await response.json();
        toast({
          title: "错误",
          description: error.error || '创建失败',
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('创建预热活动失败:', error);
      toast({
        title: "错误",
        description: '网络错误，请重试',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 启动预热活动
  const handleStartCampaign = async (campaignId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/warmup/${campaignId}/start`, {
        method: 'POST',
      });

      if (response.ok) {
        toast({
          title: "成功",
          description: "预热活动已启动",
        });
        fetchCampaigns();
      } else {
        const error = await response.json();
        toast({
          title: "错误",
          description: error.error || '启动失败',
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('启动预热活动失败:', error);
      toast({
        title: "错误",
        description: '网络错误，请重试',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 停止预热活动
  const handleStopCampaign = async (campaignId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/warmup/${campaignId}/start`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "成功",
          description: "预热活动已停止",
        });
        fetchCampaigns();
      } else {
        const error = await response.json();
        toast({
          title: "错误",
          description: error.error || '停止失败',
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('停止预热活动失败:', error);
      toast({
        title: "错误",
        description: '网络错误，请重试',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 删除预热活动
  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm('确定要删除这个预热活动吗？此操作不可撤销。')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/warmup/${campaignId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "成功",
          description: "预热活动已删除",
        });
        fetchCampaigns();
      } else {
        const error = await response.json();
        toast({
          title: "错误",
          description: error.error || '删除失败',
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('删除预热活动失败:', error);
      toast({
        title: "错误",
        description: '网络错误，请重试',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 打开实时日志窗口
  const handleOpenLogs = async (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    setShowLogsModal(true);
    await fetchRealTimeLogs(campaignId);
  };

  // 获取实时日志
  const fetchRealTimeLogs = async (campaignId: string) => {
    setLogsLoading(true);
    try {
      const response = await fetch(`/api/warmup/${campaignId}/logs`);
      if (response.ok) {
        const data = await response.json();
        setRealTimeLogs(data.logs || []);
      } else {
        console.error('获取日志失败');
        toast({
          title: "错误",
          description: "获取日志失败",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('获取日志失败:', error);
      toast({
        title: "错误",
        description: "获取日志失败，请重试",
        variant: "destructive",
      });
    } finally {
      setLogsLoading(false);
    }
  };

  // 关闭日志窗口
  const handleCloseLogs = () => {
    setShowLogsModal(false);
    setSelectedCampaignId(null);
    setRealTimeLogs([]);
  };

  // 自动刷新日志（每5秒）
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showLogsModal && selectedCampaignId) {
      interval = setInterval(() => {
        fetchRealTimeLogs(selectedCampaignId);
      }, 5000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [showLogsModal, selectedCampaignId]);

  // 重试预热活动
  const handleRetryCampaign = async (campaignId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/warmup/${campaignId}/retry`, {
        method: 'POST',
      });

      if (response.ok) {
        toast({
          title: "成功",
          description: "预热活动已重置，可以重新启动",
        });
        fetchCampaigns();
      } else {
        const error = await response.json();
        toast({
          title: "错误",
          description: error.error || '重试失败',
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('重试预热活动失败:', error);
      toast({
        title: "错误",
        description: '网络错误，请重试',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 面包屑导航 */}
      <BreadcrumbNav
        title="邮件预热"
        showBackButton={true}
        showHomeButton={true}
        customBackPath="/dashboard"
      />

      <Card>
        <CardHeader>
          <CardTitle>创建邮件预热活动</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">活动名称</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>选择参与预热的邮箱（至少选择2个）</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData({ ...formData, selectedEmails: emailProfiles.map(p => p.id) })}
                  >
                    全选
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData({ ...formData, selectedEmails: [] })}
                  >
                    取消全选
                  </Button>
                  <Badge variant="secondary">已选择 {formData.selectedEmails.length} / {emailProfiles.length} 个</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 border rounded-md max-h-60 overflow-y-auto">
                  {Array.isArray(emailProfiles) && emailProfiles.map((profile) => (
                    <div key={profile.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50">
                      <Checkbox
                        id={`profile-${profile.id}`}
                        checked={formData.selectedEmails.includes(profile.id)}
                        onCheckedChange={(checked) => {
                          const newSelected = checked
                            ? [...formData.selectedEmails, profile.id]
                            : formData.selectedEmails.filter(id => id !== profile.id);
                          setFormData({ ...formData, selectedEmails: newSelected });
                        }}
                      />
                      <Label htmlFor={`profile-${profile.id}`} className="cursor-pointer">
                        <div className="font-medium">{profile.nickname}</div>
                        <div className="text-sm text-gray-500">{profile.email}</div>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minDelay">最小发送间隔（分钟）</Label>
                <Input
                  id="minDelay"
                  type="number"
                  min={1}
                  max={formData.maxSendDelay}
                  value={formData.minSendDelay}
                  onChange={(e) => setFormData({ ...formData, minSendDelay: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxDelay">最大发送间隔（分钟）</Label>
                <Input
                  id="maxDelay"
                  type="number"
                  min={formData.minSendDelay}
                  value={formData.maxSendDelay}
                  onChange={(e) => setFormData({ ...formData, maxSendDelay: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? '创建中...' : '创建预热活动'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>预热活动列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <Card key={campaign.id}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{campaign.name}</h3>
                      <p className="text-sm text-gray-500">
                        创建时间: {new Date(campaign.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm">
                        状态: <span className={`font-semibold ${campaign.status === 'active' ? 'text-green-600' : 'text-gray-600'}`}>
                          {campaign.status === 'active' ? '运行中' : '已暂停'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenLogs(campaign.id)}
                          disabled={loading}
                          title="查看实时日志"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {campaign.status === 'active' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStopCampaign(campaign.id)}
                            disabled={loading}
                          >
                            停止
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleStartCampaign(campaign.id)}
                            disabled={loading}
                          >
                            启动
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetryCampaign(campaign.id)}
                          disabled={loading}
                        >
                          重试
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteCampaign(campaign.id)}
                          disabled={loading}
                        >
                          删除
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm">
                      发送间隔: {campaign.minSendDelay}-{campaign.maxSendDelay} 分钟
                    </p>
                    <p className="text-sm">
                      参与邮箱: {campaign.emailProfiles?.map(p => p.email).join(', ') || '无'}
                    </p>
                  </div>

                  {campaign.logs?.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold mb-2">最近的预热记录</h4>
                      <div className="space-y-2">
                        {campaign.logs?.map((log) => (
                          <div key={log.id} className="text-sm">
                            <span className={log.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                              {log.status === 'success' ? '✓' : '✗'}
                            </span>
                            {' '}{new Date(log.sentAt).toLocaleString()}
                            {' '}{log.fromEmail} → {log.toEmail}
                            {' '}{log.subject}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 实时日志弹窗 */}
      {showLogsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
            {/* 弹窗头部 */}
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-semibold">实时预热日志</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCloseLogs}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* 日志内容 */}
            <div className="flex-1 overflow-auto p-6">
              {logsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-500">加载中...</div>
                </div>
              ) : realTimeLogs.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-500">暂无日志记录</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {realTimeLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-4 rounded-lg border ${log.status === 'success'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block w-2 h-2 rounded-full ${log.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                              }`}
                          ></span>
                          <span className="font-medium">
                            {log.status === 'success' ? '发送成功' : '发送失败'}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {new Date(log.sentAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm space-y-1">
                        <div>
                          <span className="font-medium">发件人:</span> {log.fromEmail}
                        </div>
                        <div>
                          <span className="font-medium">收件人:</span> {log.toEmail}
                        </div>
                        <div>
                          <span className="font-medium">主题:</span> {log.subject}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 弹窗底部 */}
            <div className="p-6 border-t bg-gray-50">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  共 {realTimeLogs.length} 条记录，每5秒自动刷新
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedCampaignId && fetchRealTimeLogs(selectedCampaignId)}
                  disabled={logsLoading}
                >
                  {logsLoading ? '刷新中...' : '手动刷新'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}