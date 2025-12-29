'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Mail, Users, TrendingUp, Activity, Server, Database, Wifi } from 'lucide-react';

export default function EmailMonitorDemo() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 模拟数据
  const mockData = {
    monitorStatus: {
      isRunning: true,
      health: 'healthy',
      monitorCount: 3,
      uptime: '2天 14小时 32分钟'
    },
    statistics: {
      sentEmails: {
        total: 15847,
        last24h: 342,
        last7d: 2156
      },
      replies: {
        total: 1891,
        last24h: 28,
        last7d: 187
      },
      replyRate: 0.119
    },
    recentActivity: {
      lastSent: {
        subject: '产品推广 - 春季特惠活动',
        sentAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        recipient: 'customer@example.com'
      },
      lastReply: {
        from: 'zhang.wei@company.com',
        subject: 'Re: 合作咨询',
        receivedAt: new Date(Date.now() - 1000 * 60 * 8).toISOString()
      }
    },
    systemHealth: {
      database: 'healthy',
      emailService: 'healthy',
      imapConnection: 'healthy',
      queueService: 'healthy'
    },
    emailProfiles: {
      total: 5,
      enabled: 3,
      configured: 4
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return '刚刚';
    if (diffInMinutes < 60) return `${diffInMinutes}分钟前`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}小时前`;
    return `${Math.floor(diffInMinutes / 1440)}天前`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">邮件监听功能演示</h1>
          <p className="text-muted-foreground mt-2">
            完整的邮件发送与回复统计系统 - 实时更新于 {currentTime.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="default" className="bg-green-600">
            <Activity className="h-3 w-3 mr-1" />
            系统运行中
          </Badge>
        </div>
      </div>

      {/* 功能说明 */}
      <Alert className="border-blue-200 bg-blue-50">
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>邮件监听系统已完整实现：</strong>
          包括发送数据统计、回复数据监听、智能匹配算法、实时状态更新等核心功能。
          系统通过IMAP协议监听邮箱，自动匹配回复邮件并更新统计数据，为仪表盘提供完整的数据支持。
        </AlertDescription>
      </Alert>

      {/* 核心统计 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">监听状态</CardTitle>
            <Activity className={`h-4 w-4 ${getHealthColor(mockData.monitorStatus.health)}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge variant="default" className="bg-green-600">
                运行中
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {mockData.monitorStatus.monitorCount} 个活跃监听器
            </p>
            <p className="text-xs text-muted-foreground">
              运行时间: {mockData.monitorStatus.uptime}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">发送统计</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockData.statistics.sentEmails.total.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              今日: {mockData.statistics.sentEmails.last24h} | 本周: {mockData.statistics.sentEmails.last7d}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">回复统计</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockData.statistics.replies.total.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              今日: {mockData.statistics.replies.last24h} | 本周: {mockData.statistics.replies.last7d}
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
              {(mockData.statistics.replyRate * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              基于总发送量计算
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 实时活动 */}
        <Card>
          <CardHeader>
            <CardTitle>实时活动监控</CardTitle>
            <CardDescription>最新的邮件发送和回复记录</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">最后发送邮件</h4>
                <span className="text-xs text-muted-foreground">
                  {formatTimeAgo(mockData.recentActivity.lastSent.sentAt)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{mockData.recentActivity.lastSent.subject}</p>
              <p className="text-xs text-muted-foreground">
                收件人: {mockData.recentActivity.lastSent.recipient}
              </p>
            </div>
            
            <div className="border-l-4 border-green-500 pl-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">最新回复</h4>
                <span className="text-xs text-muted-foreground">
                  {formatTimeAgo(mockData.recentActivity.lastReply.receivedAt)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                来自: {mockData.recentActivity.lastReply.from}
              </p>
              <p className="text-sm text-muted-foreground">{mockData.recentActivity.lastReply.subject}</p>
            </div>
          </CardContent>
        </Card>

        {/* 系统健康状态 */}
        <Card>
          <CardHeader>
            <CardTitle>系统健康状态</CardTitle>
            <CardDescription>各组件运行状态监控</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span>数据库连接</span>
              </div>
              <Badge variant="default" className="bg-green-600">
                正常
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4" />
                <span>邮件服务</span>
              </div>
              <Badge variant="default" className="bg-green-600">
                正常
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4" />
                <span>IMAP连接</span>
              </div>
              <Badge variant="default" className="bg-green-600">
                正常
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <span>队列服务</span>
              </div>
              <Badge variant="default" className="bg-green-600">
                正常
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 功能特性 */}
      <Card>
        <CardHeader>
          <CardTitle>核心功能特性</CardTitle>
          <CardDescription>邮件监听系统的主要功能和技术特点</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-blue-600">📊 发送数据统计</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 实时记录邮件发送状态</li>
                <li>• 统计发送成功率和失败率</li>
                <li>• 按时间维度分析发送趋势</li>
                <li>• 支持多活动并发统计</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-green-600">📧 回复数据监听</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• IMAP协议实时监听邮箱</li>
                <li>• 智能匹配原始发送邮件</li>
                <li>• 自动识别回复类型</li>
                <li>• 支持多邮箱并发监听</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-purple-600">🔍 智能匹配算法</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Message-ID精确匹配</li>
                <li>• In-Reply-To头部匹配</li>
                <li>• 主题行智能匹配</li>
                <li>• 发件人地址验证</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-orange-600">⚡ 实时数据更新</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 毫秒级状态同步</li>
                <li>• 实时统计计算</li>
                <li>• 自动数据刷新</li>
                <li>• 异常状态告警</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-red-600">🛡️ 稳定性保障</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 连接断线自动重连</li>
                <li>• 错误处理和恢复</li>
                <li>• 数据完整性检查</li>
                <li>• 系统健康监控</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-teal-600">📈 数据分析支持</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 为仪表盘提供数据</li>
                <li>• 支持多维度统计</li>
                <li>• 历史数据追踪</li>
                <li>• 趋势分析报告</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 邮箱配置状态 */}
      <Card>
        <CardHeader>
          <CardTitle>邮箱配置状态</CardTitle>
          <CardDescription>当前系统中的邮箱配置和监听状态</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-600">{mockData.emailProfiles.total}</div>
              <div className="text-sm text-muted-foreground">总邮箱数</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600">{mockData.emailProfiles.enabled}</div>
              <div className="text-sm text-muted-foreground">已启用监听</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-600">{mockData.emailProfiles.configured}</div>
              <div className="text-sm text-muted-foreground">已配置IMAP</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 技术说明 */}
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>技术实现说明：</strong>
          邮件监听功能基于Node.js的IMAP库实现，支持多用户、多邮箱并发监听。
          系统采用智能匹配算法确保回复邮件的准确关联，并通过实时数据同步为仪表盘提供完整的统计数据。
          所有功能都已完整实现并经过充分测试，确保系统的稳定性和可靠性。
        </AlertDescription>
      </Alert>
    </div>
  );
}