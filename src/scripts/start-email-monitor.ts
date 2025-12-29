#!/usr/bin/env node

import { getEmailMonitorManager } from '../lib/email-monitor';
import { prisma } from '../lib/prisma';

/**
 * 邮件监听服务启动脚本
 */
class EmailMonitorService {
  private manager: any;
  private isRunning = false;

  async start() {
    try {
      console.log('正在启动邮件监听服务...');
      
      // 检查数据库配置
      await this.validateConfiguration();
      
      // 初始化监听管理器
      this.manager = getEmailMonitorManager();
      
      // 设置信号处理
      this.setupSignalHandlers();
      
      // 启动监听
      await this.manager.startMonitoring();
      this.isRunning = true;
      
      console.log('邮件监听服务已启动');
      console.log('按 Ctrl+C 停止服务');
      
      // 保持进程运行
      this.keepAlive();
      
    } catch (error) {
      console.error('启动邮件监听服务失败:', error);
      process.exit(1);
    }
  }

  private async validateConfiguration() {
    try {
      // 检查是否有启用监听的邮箱配置
      const enabledProfiles = await prisma.emailProfile.findMany({
        where: {
          enableMonitoring: true,
          imapServer: { not: null }
        }
      });

      if (enabledProfiles.length === 0) {
        throw new Error('没有找到启用监听的邮箱配置。请在发件人配置中：\n1. 配置IMAP服务器信息\n2. 启用邮件监听功能');
      }

      console.log(`找到 ${enabledProfiles.length} 个启用监听的邮箱配置`);
      
      // 检查配置完整性
      const incompleteProfiles = enabledProfiles.filter(profile => 
        !profile.imapServer || !profile.email || !profile.password
      );
      
      if (incompleteProfiles.length > 0) {
        console.warn(`警告: ${incompleteProfiles.length} 个邮箱配置不完整，将被跳过`);
      }
    } catch (error) {
      console.error('验证邮箱配置失败:', error);
      throw error;
    }
  }

  // 移除旧的环境变量验证方法

  private setupSignalHandlers() {
    // 优雅关闭
    process.on('SIGINT', () => {
      console.log('\n收到停止信号，正在关闭邮件监听服务...');
      this.stop();
    });

    process.on('SIGTERM', () => {
      console.log('收到终止信号，正在关闭邮件监听服务...');
      this.stop();
    });

    // 错误处理
    process.on('uncaughtException', (error) => {
      console.error('未捕获的异常:', error);
      this.stop();
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('未处理的Promise拒绝:', reason);
      this.stop();
    });
  }

  private async stop() {
    if (!this.isRunning) return;
    
    try {
      console.log('正在停止邮件监听...');
      
      if (this.manager) {
        await this.manager.stopMonitoring();
      }
      
      await prisma.$disconnect();
      
      console.log('邮件监听服务已停止');
      this.isRunning = false;
      
      process.exit(0);
    } catch (error) {
      console.error('停止服务时出错:', error);
      process.exit(1);
    }
  }

  private keepAlive() {
    // 定期输出状态信息
    setInterval(() => {
      if (this.isRunning) {
        console.log(`[${new Date().toISOString()}] 邮件监听服务运行中...`);
      }
    }, 5 * 60 * 1000); // 每5分钟输出一次
  }
}

// 启动服务
if (require.main === module) {
  const service = new EmailMonitorService();
  service.start().catch(error => {
    console.error('服务启动失败:', error);
    process.exit(1);
  });
}

export { EmailMonitorService };