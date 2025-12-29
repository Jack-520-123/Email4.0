import { prisma } from './prisma';
import nodemailer from 'nodemailer';
import { addEmailTracking } from './email-tracking';

// 预热邮件模板
const WARMUP_TEMPLATES = [
  {
    subject: '工作汇报 - {date}',
    body: `您好！

这是今日的工作汇报，请查收。

主要完成事项：
1. 项目进度更新
2. 客户沟通跟进
3. 数据分析报告

如有任何问题，请随时联系。

祝好！`
  },
  {
    subject: '会议邀请 - {date}',
    body: `您好！

诚邀您参加我们的项目讨论会议。

会议时间：明天下午2点
会议地点：会议室A
会议主题：项目进展讨论

期待您的参与！

谢谢！`
  },
  {
    subject: '文档分享 - {date}',
    body: `您好！

分享一份重要文档供您参考。

文档内容包括：
- 项目规划
- 时间安排
- 资源配置

请查收并提供宝贵意见。

谢谢！`
  },
  {
    subject: '问候 - {date}',
    body: `您好！

希望您一切都好！

最近工作比较忙碌，想问候一下您的近况。
如果有时间的话，我们可以约个时间聊聊。

祝您工作顺利！

此致
敬礼！`
  }
];

// 全局预热任务管理
if (!global.warmupTasks) {
  global.warmupTasks = new Map();
}

// 全局预热轮询状态管理
if (!global.warmupRotationState) {
  global.warmupRotationState = new Map();
}

const warmupTasks = global.warmupTasks;
const warmupRotationState = global.warmupRotationState;

// 打乱数组的工具函数
const shuffleArray = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

interface WarmupPair {
  from: {
    id: string;
    email: string;
    password: string;
    smtpServer: string;
    smtpPort: number;
    nickname?: string;
  };
  to: {
    id: string;
    email: string;
  };
}

// 预热任务恢复服务
export class WarmupRecoveryService {
  private static instance: WarmupRecoveryService;
  private isInitialized = false;

  static getInstance(): WarmupRecoveryService {
    if (!WarmupRecoveryService.instance) {
      WarmupRecoveryService.instance = new WarmupRecoveryService();
    }
    return WarmupRecoveryService.instance;
  }

  // 初始化或获取轮询状态
  private getRotationState(campaignId: string, emailProfiles: any[]) {
    if (!warmupRotationState.has(campaignId)) {
      // 创建所有可能的发送对组合
      const pairs: Array<{fromIndex: number, toIndex: number}> = [];
      for (let i = 0; i < emailProfiles.length; i++) {
        for (let j = 0; j < emailProfiles.length; j++) {
          if (i !== j) {
            pairs.push({ fromIndex: i, toIndex: j });
          }
        }
      }
      
      // 打乱顺序以增加随机性
      const shuffledPairs = shuffleArray(pairs);
      
      warmupRotationState.set(campaignId, {
        pairs: shuffledPairs,
        currentIndex: 0,
        totalPairs: shuffledPairs.length
      });
      
      console.log(`[WarmupRecovery] 为活动 ${campaignId} 创建了 ${shuffledPairs.length} 个发送对`);
    }
    
    return warmupRotationState.get(campaignId);
  }

  // 获取下一个发送对
  private getNextWarmupPair(campaignId: string, emailProfiles: any[]): WarmupPair | null {
    const state = this.getRotationState(campaignId, emailProfiles);
    
    if (state.currentIndex >= state.totalPairs) {
      // 一轮完成，重新开始
      state.currentIndex = 0;
      // 重新打乱顺序
      state.pairs = shuffleArray(state.pairs);
      console.log(`[WarmupRecovery] 活动 ${campaignId} 完成一轮互相发送，开始新一轮`);
    }
    
    const currentPair = state.pairs[state.currentIndex];
    state.currentIndex++;
    
    const fromProfile = emailProfiles[currentPair.fromIndex];
    const toProfile = emailProfiles[currentPair.toIndex];
    
    console.log(`[WarmupRecovery] 轮询发送 (${state.currentIndex}/${state.totalPairs}): ${fromProfile.email} -> ${toProfile.email}`);
    
    return {
      from: fromProfile,
      to: toProfile
    };
  }

  async initialize() {
    if (this.isInitialized) {
      console.log('[WarmupRecovery] 预热任务恢复服务已初始化');
      return;
    }

    console.log('[WarmupRecovery] 初始化预热任务恢复服务');
    
    try {
      // 查找所有活跃的预热活动
      const activeCampaigns = await prisma.warmupCampaign.findMany({
        where: {
          status: 'active'
        },
        include: {
          emailProfiles: true
        }
      });

      console.log(`[WarmupRecovery] 发现 ${activeCampaigns.length} 个活跃的预热活动`);

      // 恢复每个活动
      for (const campaign of activeCampaigns) {
        await this.recoverWarmupCampaign(campaign);
      }

      this.isInitialized = true;
      console.log('[WarmupRecovery] 预热任务恢复服务初始化完成');
    } catch (error) {
      console.error('[WarmupRecovery] 初始化失败:', error);
    }
  }

  // 停止预热任务恢复服务
  async shutdown() {
    if (!this.isInitialized) {
      console.log('[WarmupRecovery] 预热任务恢复服务未初始化，无需停止');
      return;
    }

    console.log('[WarmupRecovery] 正在停止预热任务恢复服务...');
    
    try {
      // 停止所有运行中的预热任务
      const runningTaskIds = Array.from(warmupTasks.keys());
      for (const campaignId of runningTaskIds) {
        await this.stopWarmupCampaign(campaignId);
      }
      
      // 清理所有状态
      warmupTasks.clear();
      warmupRotationState.clear();
      
      this.isInitialized = false;
      console.log('[WarmupRecovery] 预热任务恢复服务已停止');
    } catch (error) {
      console.error('[WarmupRecovery] 停止预热任务恢复服务失败:', error);
    }
  }

  async recoverWarmupCampaign(campaign: any) {
    const campaignId = campaign.id;
    
    // 检查是否已经在运行
    if (warmupTasks.has(campaignId)) {
      console.log(`[WarmupRecovery] 预热活动 ${campaignId} 已在运行中`);
      return;
    }

    console.log(`[WarmupRecovery] 恢复预热活动: ${campaignId}`);

    // 记录启动日志
    try {
      await prisma.warmupLog.create({
        data: {
          warmupCampaignId: campaignId,
          fromEmail: 'system',
          toEmail: 'system',
          subject: '预热活动启动',
          body: `预热活动已启动 - 活动ID: ${campaignId}, 启动时间: ${new Date().toLocaleString('zh-CN')}, 邮箱数量: ${campaign.emailProfiles?.length || 0}`,
          status: 'info',
        },
      });
    } catch (error) {
      console.error('[WarmupRecovery] 记录启动日志失败:', error);
    }

    // 启动预热任务
    const taskInfo = {
      isRunning: true,
      startTime: new Date(),
      campaignId,
    };
    
    warmupTasks.set(campaignId, taskInfo);

    // 异步执行预热逻辑
    this.processWarmupCampaign(campaign).catch(error => {
      console.error(`[WarmupRecovery] 预热活动 ${campaignId} 执行失败:`, error);
      // 更新任务状态
      const task = warmupTasks.get(campaignId);
      if (task) {
        task.isRunning = false;
        task.error = error.message;
      }
    });
  }

  private async processWarmupCampaign(campaign: any) {
    const { id: campaignId, emailProfiles, minSendDelay, maxSendDelay } = campaign;
    
    console.log(`[WarmupRecovery] 启动预热活动循环: ${campaignId}`);
    
    // 持续发送循环
    while (true) {
      try {
        // 检查任务是否仍在运行
        const task = warmupTasks.get(campaignId);
        if (!task?.isRunning) {
          console.log(`[WarmupRecovery] 任务已停止: ${campaignId}`);
          break;
        }
        
        // 随机选择邮件模板
        const template = WARMUP_TEMPLATES[Math.floor(Math.random() * WARMUP_TEMPLATES.length)];
        
        // 使用轮询方式选择发件人和收件人
        const warmupPair = this.getNextWarmupPair(campaignId, emailProfiles);
        if (!warmupPair) {
          throw new Error('无法获取发送对');
        }
        
        console.log(`[WarmupRecovery] 轮询发送邮件: ${warmupPair.from.email} -> ${warmupPair.to.email}`);
        
        // 生成邮件内容
        const currentDate = new Date().toLocaleDateString('zh-CN');
        const subject = template.subject.replace('{date}', currentDate);
        const body = template.body;
        
        // 添加邮件追踪
        const emailId = `warmup-${campaignId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const trackedBody = addEmailTracking(body, emailId, baseUrl);
        
        // 创建邮件传输器
        const transporter = nodemailer.createTransport({
          host: warmupPair.from.smtpServer,
          port: warmupPair.from.smtpPort,
          secure: warmupPair.from.smtpPort === 465,
          auth: {
            user: warmupPair.from.email,
            pass: warmupPair.from.password,
          },
        });
        
        // 发送邮件
        const mailOptions = {
          from: `${warmupPair.from.nickname} <${warmupPair.from.email}>`,
          to: warmupPair.to.email,
          subject,
          html: trackedBody,
        };
        
        await transporter.sendMail(mailOptions);
        
        // 记录发送日志
        await prisma.warmupLog.create({
          data: {
            warmupCampaignId: campaignId,
            fromEmail: warmupPair.from.email,
            toEmail: warmupPair.to.email,
            subject,
            body: trackedBody,
            status: 'success',
          },
        });
        
        console.log(`[WarmupRecovery] 邮件发送成功: ${warmupPair.from.email} -> ${warmupPair.to.email}, 主题: ${subject}`);
        
        // 记录详细的成功日志
        await prisma.warmupLog.create({
          data: {
            warmupCampaignId: campaignId,
            fromEmail: 'system',
            toEmail: 'system',
            subject: '预热进度更新',
            body: `成功发送邮件 - 发送方: ${warmupPair.from.email}, 接收方: ${warmupPair.to.email}, 主题: ${subject}, 时间: ${new Date().toLocaleString('zh-CN')}`,
            status: 'info',
          },
        });
        
        // 计算下次发送时间（分钟）
        const delay = Math.floor(Math.random() * (maxSendDelay - minSendDelay + 1)) + minSendDelay;
        console.log(`[WarmupRecovery] 等待 ${delay} 分钟后发送下一封邮件`);
        
        // 记录等待日志
        await prisma.warmupLog.create({
          data: {
            warmupCampaignId: campaignId,
            fromEmail: 'system',
            toEmail: 'system',
            subject: '等待发送下一封邮件',
            body: `等待 ${delay} 分钟后发送下一封邮件 - 时间: ${new Date().toLocaleString('zh-CN')}`,
            status: 'info',
          },
        });
        
        // 等待指定时间
        await new Promise(resolve => setTimeout(resolve, delay * 60 * 1000));
        
      } catch (error) {
        console.error('[WarmupRecovery] 邮件发送失败:', error);
        
        // 记录失败日志
        try {
          await prisma.warmupLog.create({
            data: {
              warmupCampaignId: campaignId,
              fromEmail: campaign.emailProfiles[0]?.email || 'unknown',
              toEmail: campaign.emailProfiles[1]?.email || 'unknown',
              subject: '发送失败',
              body: '',
              status: 'failed',
              error: error instanceof Error ? error.message : String(error),
            },
          });
        } catch (logError) {
          console.error('[WarmupRecovery] 记录失败日志失败:', logError);
        }
        
        // 发送失败后等待一段时间再重试
        console.log('[WarmupRecovery] 发送失败，等待5分钟后重试');
        await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
      }
    }
    
    console.log(`[WarmupRecovery] 预热活动循环结束: ${campaignId}`);
  }

  // 停止预热活动
  async stopWarmupCampaign(campaignId: string) {
    console.log(`[WarmupRecovery] 停止预热活动: ${campaignId}`);
    
    // 记录停止日志
    try {
      await prisma.warmupLog.create({
        data: {
          warmupCampaignId: campaignId,
          fromEmail: 'system',
          toEmail: 'system',
          subject: '预热活动停止',
          body: `预热活动已停止 - 活动ID: ${campaignId}, 停止时间: ${new Date().toLocaleString('zh-CN')}`,
          status: 'info',
        },
      });
    } catch (error) {
      console.error('[WarmupRecovery] 记录停止日志失败:', error);
    }
    
    if (warmupTasks.has(campaignId)) {
      const task = warmupTasks.get(campaignId);
      if (task && task.timeoutId) {
        clearTimeout(task.timeoutId);
      }
      warmupTasks.delete(campaignId);
      console.log(`[WarmupRecovery] 预热任务已停止: ${campaignId}`);
    }
    
    // 清理轮询状态
    if (warmupRotationState.has(campaignId)) {
      warmupRotationState.delete(campaignId);
      console.log(`[WarmupRecovery] 轮询状态已清理: ${campaignId}`);
    }
  }

  // 获取运行中的任务
  getRunningTasks() {
    return Array.from(warmupTasks.entries()).map(([id, task]) => ({
      campaignId: id,
      ...task
    }));
  }
}

// 导出单例实例
export const warmupRecoveryService = WarmupRecoveryService.getInstance();