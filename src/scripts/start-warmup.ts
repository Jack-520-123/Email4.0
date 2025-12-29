import { prisma } from '../lib/prisma';
import { processWarmupCampaign, initializeWarmupEmails } from '../lib/email-warmup';

class WarmupService {
  private isRunning = false;
  private processing = false;

  async start() {
    console.log('正在启动邮件预热服务...');
    this.isRunning = true;

    // 初始化预设邮件内容
    await initializeWarmupEmails();

    // 设置信号处理
    this.setupSignalHandlers();

    // 立即执行一次，然后设置定时器
    this.runCycle();
    setInterval(() => this.runCycle(), 60 * 1000); // 每分钟检查一次

    console.log('邮件预热服务已启动，将定期检查并执行任务。');
    console.log('按 Ctrl+C 停止服务');
  }

  private async runCycle() {
    if (this.processing) {
      console.log('预热任务正在处理中，跳过此次循环。');
      return;
    }

    this.processing = true;
    try {
      console.log(`[${new Date().toISOString()}] 正在检查活动的预热任务...`);
      const activeCampaigns = await prisma.warmupCampaign.findMany({
        where: {
          status: 'active',
        },
      });

      if (activeCampaigns.length === 0) {
        console.log('没有活动的预热任务。');
        return;
      }

      console.log(`发现 ${activeCampaigns.length} 个活动的预热任务。`);

      for (const campaign of activeCampaigns) {
        console.log(`正在处理预热活动: ${campaign.name}`);
        // processWarmupCampaign 是异步的，但我们不在此处等待它完成
        // 它会在后台独立处理每个活动
        processWarmupCampaign(campaign.id);
      }
    } catch (error) {
      console.error('处理预热任务时出错:', error);
    } finally {
      this.processing = false;
    }
  }

  private setupSignalHandlers() {
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  private stop() {
    if (!this.isRunning) return;

    console.log('\n正在停止邮件预热服务...');
    this.isRunning = false;
    // 在这里可以添加任何需要的清理逻辑
    prisma.$disconnect();
    console.log('邮件预热服务已停止。');
    process.exit(0);
  }
}

if (require.main === module) {
  const service = new WarmupService();
  service.start().catch((error) => {
    console.error('启动邮件预热服务失败:', error);
    process.exit(1);
  });
}