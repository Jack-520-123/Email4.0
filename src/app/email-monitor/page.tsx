'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Play, Square, Settings, Mail, Clock, CheckCircle, AlertCircle, Home, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface EmailProfile {
  id: string;
  email: string;
  imapServer?: string;
  imapPort?: number;
  imapSecure?: boolean;
  enableMonitoring: boolean;
}

interface MonitorData {
  monitor: {
    isRunning: boolean;
    monitorCount: number;
    monitors: { profileId: string; status: string; error?: string }[];
  };
  statistics: {
    recentReplies: number;
    totalReplies: number;
    lastReplyAt: string | null;
  };
  configuration: {
    emailProfiles: EmailProfile[];
    totalProfiles: number;
    enabledProfiles: number;
  };
}

export default function EmailMonitorPage() {
  const [status, setStatus] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [allProfiles, setAllProfiles] = useState<EmailProfile[]>([]);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/email-monitor');
      if (response.ok) {
        const apiResponse = await response.json();
        if (apiResponse.success) {
          setStatus(apiResponse.data);
          const profiles = apiResponse.data.configuration.emailProfiles;
          if (profiles) {
            setAllProfiles(profiles);
            if (selectedProfiles.length === 0) {
              const enabledIds = profiles
                .filter((p: EmailProfile) => p.enableMonitoring)
                .map((p: EmailProfile) => p.id);
              setSelectedProfiles(enabledIds);
            }
          }
        } else {
          toast.error(`获取监听状态失败: ${apiResponse.error || '未知错误'}`);
        }
      } else {
        toast.error('获取监听状态失败');
      }
    } catch (error) {
      console.error('获取状态失败:', error);
      toast.error('获取监听状态失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/email-monitor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action,
          ...(selectedProfiles.length > 0 ? { profileIds: selectedProfiles } : {})
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message || `${action === 'start' ? '启动' : action === 'stop' ? '停止' : '重启'}监听服务成功`);
        // 延迟一下再刷新状态，让服务有时间启动
        setTimeout(() => {
          fetchStatus();
        }, 1000);
      } else {
        const error = await response.json();
        toast.error(error.error || '操作失败');
      }
    } catch (error) {
      console.error('操作失败:', error);
      toast.error('操作失败，请检查网络连接');
    } finally {
      setActionLoading(false);
    }
  };



  useEffect(() => {
    fetchStatus();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 面包屑导航 */}
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Link href="/dashboard" className="flex items-center hover:text-foreground transition-colors">
          <Home className="h-4 w-4 mr-1" />
          仪表盘
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">邮件监听</span>
      </nav>
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">邮件监听服务</h1>
          <p className="text-muted-foreground mt-2">
            监听IMAP邮箱，自动解析邮件并存入数据库
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchStatus}
          disabled={actionLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${actionLoading ? 'animate-spin' : ''}`} />
          刷新状态
        </Button>
      </div>

      {/* 服务状态卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            服务状态
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${status?.monitor.isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                <Badge 
                  variant={status?.monitor.isRunning ? 'default' : 'secondary'}
                  className={`${status?.monitor.isRunning ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'} text-sm font-medium`}
                >
                  {status?.monitor.isRunning ? (
                    <><CheckCircle className="h-3 w-3 mr-1" />监听服务运行中</>
                  ) : (
                    <><AlertCircle className="h-3 w-3 mr-1" />监听服务已停止</>
                  )}
                </Badge>
              </div>
              {!status?.monitor.isRunning && (
                <span className="text-sm text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200">
                  点击启动按钮开始监听新邮件
                </span>
              )}
            </div>
            
            <div className="flex gap-2">
              {status?.monitor.isRunning ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction('restart')}
                    disabled={actionLoading}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    重启
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleAction('stop')}
                    disabled={actionLoading}
                  >
                    <Square className="h-4 w-4 mr-2" />
                    停止
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handleAction('start')}
                  disabled={actionLoading || selectedProfiles.length === 0}
                >
                  <Play className="h-4 w-4 mr-2" />
                  启动
                </Button>
              )}
            </div>
          </div>

          <Separator className="my-4" />

          {/* 详细监控状态 */}
          {status?.monitor?.monitors && status.monitor.monitors.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">具体监听状态:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {status.monitor.monitors.map((monitor) => {
                  const profile = allProfiles.find(p => p.id === monitor.profileId);
                  return (
                    <div key={monitor.profileId} className="border rounded-lg p-3 text-xs">
                      <div className="font-medium truncate mb-1" title={profile?.email}>{profile?.email || '未知配置'}</div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={monitor.status === 'running' ? 'default' : 'destructive'}
                          className={`${monitor.status === 'running' ? 'bg-green-600' : 'bg-red-600'} text-white`}
                        >
                          {monitor.status === 'running' ? '运行中' : '失败'}
                        </Badge>
                        {monitor.error && (
                          <p className="text-red-600 truncate" title={monitor.error}>错误: {monitor.error}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Separator className="my-4" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{status?.statistics.totalReplies ?? 0}</p>
              <p className="text-sm text-muted-foreground">总解析数</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{status?.statistics.recentReplies ?? 0}</p>
              <p className="text-sm text-muted-foreground">24小时内</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {status?.statistics.lastReplyAt ? new Date(status.statistics.lastReplyAt).toLocaleString() : '暂无解析'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">最后解析时间</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 邮箱配置卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            邮箱配置
          </CardTitle>
          <CardDescription>
            当前共有 {status?.configuration.totalProfiles ?? 0} 个发件人配置，其中 {status?.configuration.enabledProfiles ?? 0} 个启用了IMAP监听。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium">总配置数</label>
                <div className="text-2xl font-bold">{status?.configuration.totalProfiles || 0}</div>
              </div>
              <div>
                <label className="text-sm font-medium">启用监听</label>
                <div className="text-2xl font-bold text-green-600">{status?.configuration.enabledProfiles || 0}</div>
              </div>
              <div>
                <label className="text-sm font-medium">活跃连接</label>
                <div className="text-2xl font-bold text-blue-600">{status?.monitor?.monitorCount || 0}</div>
              </div>
            </div>
          </div>
          
          {status?.configuration.emailProfiles && status.configuration.emailProfiles.length > 0 ? (
            <div className="space-y-4">
              {/* 批量选择操作 */}
              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium">批量操作:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const enabledIds = allProfiles
                      .filter(p => p.enableMonitoring && p.imapServer)
                      .map(p => p.id);
                    setSelectedProfiles(enabledIds);
                  }}
                >
                  全选可用
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedProfiles([])}
                >
                  清空选择
                </Button>
                <span className="text-sm text-muted-foreground">
                  已选择 {selectedProfiles.length} 个配置
                </span>
              </div>
              
              {/* 发件人配置列表 */}
              <div className="space-y-3">
                {status.configuration.emailProfiles.map((profile) => {
                  const isSelected = selectedProfiles.includes(profile.id);
                  const canSelect = profile.enableMonitoring && profile.imapServer;
                  
                  return (
                    <div 
                      key={profile.id} 
                      className={`border rounded-lg p-3 transition-colors ${
                        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      } ${
                        canSelect ? 'cursor-pointer hover:border-gray-300' : 'opacity-60'
                      }`}
                      onClick={() => {
                        if (!canSelect) return;
                        
                        if (isSelected) {
                          setSelectedProfiles(prev => prev.filter(id => id !== profile.id));
                        } else {
                          setSelectedProfiles(prev => [...prev, profile.id]);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!canSelect}
                              onChange={() => {}} // 由父元素的onClick处理
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <Mail className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="font-medium">{profile.email}</div>
                            <div className="text-sm text-muted-foreground">
                              {profile.imapServer ? `${profile.imapServer}:${profile.imapPort}` : '未配置IMAP'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isSelected && (
                            <Badge className="bg-blue-500 text-white">
                              已选择
                            </Badge>
                          )}
                          <Badge 
                            variant={profile.enableMonitoring ? 'default' : 'secondary'}
                            className={profile.enableMonitoring ? 'bg-green-500' : 'bg-gray-500'}
                          >
                            {profile.enableMonitoring ? '已启用' : '已禁用'}
                          </Badge>
                          {profile.imapServer && (
                            <Badge variant="outline">
                              {profile.imapSecure ? 'SSL' : '普通'}
                            </Badge>
                          )}
                          {!profile.imapServer && (
                            <Badge variant="destructive">
                              未配置
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                暂无邮箱配置，请先在发件人管理中添加邮箱并配置IMAP设置。
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">功能说明</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• 自动监听IMAP邮箱中的新邮件</li>
              <li>• 解析邮件内容并存入数据库</li>
              <li>• 自动记录邮件的基础信息</li>
            </ul>
          </div>
          
          <Separator />
          
          <div>
            <h4 className="font-medium mb-2">配置说明</h4>
            <p className="text-sm text-muted-foreground">
              邮件监听功能使用数据库中的发件人配置，无需额外的环境变量配置。请在发件人管理页面配置IMAP设置并启用监听功能。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}