'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Play, Square, RotateCcw, CheckCircle, XCircle, AlertTriangle, Mail, Users, Activity, TrendingUp } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface MonitorStatus {
  isRunning: boolean;
  monitorCount: number;
  health: 'healthy' | 'warning' | 'error';
  sentEmails: {
    total: number;
    last24h: number;
    last7d: number;
  };
  replies: {
    total: number;
    last24h: number;
    last7d: number;
  };
  replyRate: number;
  lastSentEmail?: {
    id: string;
    subject: string;
    sentAt: string;
  };
  lastReply?: {
    id: string;
    from: string;
    subject: string;
    receivedAt: string;
  };
  emailProfiles: {
    total: number;
    enabled: number;
    configured: number;
  };
  activeMonitors?: Array<{
    profileId: string;
    email: string;
    status: string;
  }>;
}

interface DiagnosticResult {
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  checks: Array<{
    name: string;
    status: 'passed' | 'failed' | 'warning';
    message: string;
    details?: any;
  }>;
  recommendations: string[];
}

export default function EmailMonitorDashboard() {
  const [status, setStatus] = useState<MonitorStatus | null>(null);
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/monitor/status?detailed=true');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      } else {
        throw new Error('Failed to fetch status');
      }
    } catch (error) {
      console.error('Error fetching status:', error);
      toast({
        title: '获取状态失败',
        description: '无法获取邮件监听状态，请检查服务是否正常运行',
        variant: 'destructive',
      });
    }
  };

  const fetchDiagnostic = async () => {
    try {
      const response = await fetch('/api/monitor/diagnose');
      if (response.ok) {
        const data = await response.json();
        setDiagnostic(data);
      } else {
        throw new Error('Failed to fetch diagnostic');
      }
    } catch (error) {
      console.error('Error fetching diagnostic:', error);
      toast({
        title: '诊断失败',
        description: '无法获取系统诊断信息',
        variant: 'destructive',
      });
    }
  };

  const handleMonitorAction = async (action: 'start' | 'stop' | 'restart') => {
    setActionLoading(action);
    try {
      const response = await fetch('/api/email-monitor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: '操作成功',
          description: result.message || `邮件监听已${action === 'start' ? '启动' : action === 'stop' ? '停止' : '重启'}`,
        });
        await fetchStatus();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Operation failed');
      }
    } catch (error) {
      console.error('Error performing action:', error);
      toast({
        title: '操作失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStatus(), fetchDiagnostic()]);
      setLoading(false);
    };

    loadData();
    
    // 每30秒刷新一次状态
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return <CheckCircle className="h-5 w-5" />;
      case 'warning': return <AlertTriangle className="h-5 w-5" />;
      case 'error': return <XCircle className="h-5 w-5" />;
      default: return <Activity className="h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">加载中...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">邮件监听控制台</h1>
          <p className="text-muted-foreground mt-2">
            监控和管理邮件发送与回复统计功能
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => handleMonitorAction('start')}
            disabled={status?.isRunning || actionLoading === 'start'}
            className="bg-green-600 hover:bg-green-700"
          >
            {actionLoading === 'start' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            启动监听
          </Button>
          <Button
            onClick={() => handleMonitorAction('stop')}
            disabled={!status?.isRunning || actionLoading === 'stop'}
            variant="destructive"
          >
            {actionLoading === 'stop' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Square className="h-4 w-4 mr-2" />
            )}
            停止监听
          </Button>
          <Button
            onClick={() => handleMonitorAction('restart')}
            disabled={actionLoading === 'restart'}
            variant="outline"
          >
            {actionLoading === 'restart' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            重启监听
          </Button>
        </div>
      </div>

      {/* 状态概览 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">监听状态</CardTitle>
            <div className={getHealthColor(status?.health || 'error')}>
              {getHealthIcon(status?.health || 'error')}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge variant={status?.isRunning ? 'default' : 'secondary'}>
                {status?.isRunning ? '运行中' : '已停止'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {status?.monitorCount || 0} 个活跃监听器
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">发送统计</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.sentEmails.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              今日: {status?.sentEmails.last24h || 0} | 本周: {status?.sentEmails.last7d || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">回复统计</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.replies.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              今日: {status?.replies.last24h || 0} | 本周: {status?.replies.last7d || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">回复率</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.replyRate ? `${(status.replyRate * 100).toFixed(1)}%` : '0%'}
            </div>
            <p className="text-xs text-muted-foreground">
              基于总发送量计算
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="monitors">监听器</TabsTrigger>
          <TabsTrigger value="diagnostic">诊断</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>最近活动</CardTitle>
                <CardDescription>最新的邮件发送和回复记录</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {status?.lastSentEmail && (
                  <div className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-medium">最后发送邮件</h4>
                    <p className="text-sm text-muted-foreground">{status.lastSentEmail.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(status.lastSentEmail.sentAt).toLocaleString()}
                    </p>
                  </div>
                )}
                {status?.lastReply && (
                  <div className="border-l-4 border-green-500 pl-4">
                    <h4 className="font-medium">最新回复</h4>
                    <p className="text-sm text-muted-foreground">
                      来自: {status.lastReply.from}
                    </p>
                    <p className="text-sm text-muted-foreground">{status.lastReply.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(status.lastReply.receivedAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>邮箱配置</CardTitle>
                <CardDescription>邮箱配置和监听状态</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>总邮箱数:</span>
                    <span className="font-medium">{status?.emailProfiles.total || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>已启用监听:</span>
                    <span className="font-medium">{status?.emailProfiles.enabled || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>已配置IMAP:</span>
                    <span className="font-medium">{status?.emailProfiles.configured || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="monitors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>活跃监听器</CardTitle>
              <CardDescription>当前正在运行的邮件监听器列表</CardDescription>
            </CardHeader>
            <CardContent>
              {status?.activeMonitors && status.activeMonitors.length > 0 ? (
                <div className="space-y-2">
                  {status.activeMonitors.map((monitor, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">{monitor.email}</p>
                        <p className="text-sm text-muted-foreground">ID: {monitor.profileId}</p>
                      </div>
                      <Badge variant={monitor.status === 'running' ? 'default' : 'secondary'}>
                        {monitor.status === 'running' ? '运行中' : '已停止'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">暂无活跃的监听器</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diagnostic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>系统诊断</CardTitle>
              <CardDescription>邮件监听系统健康检查结果</CardDescription>
            </CardHeader>
            <CardContent>
              {diagnostic && (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold">{diagnostic.summary.total}</div>
                      <div className="text-sm text-muted-foreground">总检查项</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">{diagnostic.summary.passed}</div>
                      <div className="text-sm text-muted-foreground">通过</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-yellow-600">{diagnostic.summary.warnings}</div>
                      <div className="text-sm text-muted-foreground">警告</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-600">{diagnostic.summary.failed}</div>
                      <div className="text-sm text-muted-foreground">失败</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {diagnostic.checks.map((check, index) => (
                      <Alert key={index} className={`border-l-4 ${
                        check.status === 'passed' ? 'border-green-500' :
                        check.status === 'warning' ? 'border-yellow-500' : 'border-red-500'
                      }`}>
                        <AlertDescription>
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{check.name}</span>
                            <Badge variant={
                              check.status === 'passed' ? 'default' :
                              check.status === 'warning' ? 'secondary' : 'destructive'
                            }>
                              {check.status === 'passed' ? '通过' :
                               check.status === 'warning' ? '警告' : '失败'}
                            </Badge>
                          </div>
                          <p className="text-sm mt-1">{check.message}</p>
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>

                  {diagnostic.recommendations.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">建议</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {diagnostic.recommendations.map((rec, index) => (
                          <li key={index}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}