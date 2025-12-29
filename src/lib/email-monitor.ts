import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { prisma } from './prisma';
import { EmailReplyMatcher } from './email-reply-matcher';
import { EmailParser, ParsedEmail } from './email-parser';

interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export class EmailMonitor {
  private imap: Imap;
  private isConnected = false;
  private isMonitoring = false;
  private emailProfileId: string;
  private userId: string;
  private userEmail: string;

  constructor(config: ImapConfig, emailProfileId: string, userId: string) {
    const imapConfigForClient = {
      user: config.auth.user,
      password: config.auth.pass,
      host: config.host,
      port: config.port,
      tls: config.secure,
      authTimeout: 10000, // 10 seconds
      connTimeout: 15000, // 15 seconds
    };
    this.imap = new Imap(imapConfigForClient);
    this.emailProfileId = emailProfileId;
    this.userId = userId;
    this.userEmail = config.auth.user;
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.imap.once('ready', () => {
      console.log('IMAP connection established');
      this.isConnected = true;
    });

    this.imap.once('error', (err: Error) => {
      console.error('IMAP connection error:', err);
      this.isConnected = false;
    });

    this.imap.once('end', () => {
      console.log('IMAP connection ended');
      this.isConnected = false;
    });
  }

  private async retryConnect(retries: number = 3, delay: number = 5000): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        if (this.isConnected) {
          await this.disconnect();
        }

        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Connection timeout'));
          }, 30000); // 30 seconds timeout

          this.imap.once('ready', () => {
            clearTimeout(timeoutId);
            this.isConnected = true;
            console.log(`IMAP connection established for ${this.emailProfileId}`);
            resolve();
          });

          this.imap.once('error', (err: Error) => {
            clearTimeout(timeoutId);
            this.isConnected = false;
            console.error(`IMAP connection error for ${this.emailProfileId}:`, err);
            reject(err);
          });

          this.imap.connect();
        });

        return; // 连接成功，直接返回
      } catch (error) {
        console.error(`Connection attempt ${i + 1}/${retries} failed:`, error);
        
        if (i < retries - 1) {
          console.log(`Waiting ${delay}ms before next retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw new Error(`Failed to connect after ${retries} attempts`);
        }
      }
    }
  }

  async connect(): Promise<void> {
    try {
      await this.retryConnect();
    } catch (error) {
      console.error(`Failed to establish IMAP connection for ${this.emailProfileId}:`, error);
      await this.sendNotification(
        'error',
        `邮箱 ${this.userEmail} 连接失败，请检查网络和IMAP设置`,
        '邮件监听连接失败'
      ).catch(notifyError => {
        console.error('Failed to send connection error notification:', notifyError);
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.isConnected) {
        this.imap.once('end', () => {
          this.isConnected = false;
          resolve();
        });
        this.imap.end();
      } else {
        resolve();
      }
    });
  }

  private monitoringInterval: NodeJS.Timeout | null = null;

  async startMonitoring(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    this.isMonitoring = true;
    console.log('Started monitoring email replies...');

    await this.checkNewEmails();

    const checkInterval = parseInt(process.env.EMAIL_CHECK_INTERVAL || '30000');
    // 清除可能存在的旧定时器
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    // 创建新的定时器并保存引用
    this.monitoringInterval = setInterval(async () => {
      if (this.isMonitoring) {
        try {
          await this.checkNewEmails();
        } catch (error) {
          console.error('检查新邮件时出错:', error);
          // 出错时尝试重新连接
          try {
            await this.connect();
          } catch (reconnectError) {
            console.error('重新连接失败:', reconnectError);
          }
        }
      }
    }, checkInterval);
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log('Stopped monitoring email replies.');
    this.disconnect();
  }

  private consecutiveErrors = 0;
  private readonly MAX_CONSECUTIVE_ERRORS = 5;
  private readonly ERROR_RESET_INTERVAL = 30 * 60 * 1000; // 30 minutes
  private lastErrorTime: number = 0;

  private async checkNewEmails(): Promise<void> {
    try {
      // 如果距离上次错误已经过了重置时间，重置连续错误计数
      if (Date.now() - this.lastErrorTime > this.ERROR_RESET_INTERVAL) {
        this.consecutiveErrors = 0;
      }

      await this.openInbox();
      const unseenEmails = await this.searchUnseenEmails();
      
      if (unseenEmails.length > 0) {
        console.log(`Found ${unseenEmails.length} new emails for ${this.userEmail}`);
        await this.processEmails(unseenEmails);
      }

      // 成功执行后重置错误计数
      this.consecutiveErrors = 0;
    } catch (error) {
      this.consecutiveErrors++;
      this.lastErrorTime = Date.now();
      
      console.error(`Error checking new emails (attempt ${this.consecutiveErrors}):`, error);

      // 发送错误通知
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      await this.sendNotification(
        'error',
        `检查新邮件时发生错误: ${errorMessage}`,
        '邮件监听错误'
      ).catch(notifyError => {
        console.error('Failed to send error notification:', notifyError);
      });

      // 如果连续错误次数达到阈值，尝试重新连接
      if (this.consecutiveErrors >= this.MAX_CONSECUTIVE_ERRORS) {
        console.log(`Attempting to reconnect after ${this.consecutiveErrors} consecutive errors...`);
        try {
          await this.connect();
          this.consecutiveErrors = 0; // 重置错误计数
          console.log('Reconnection successful');
        } catch (reconnectError) {
          console.error('Failed to reconnect:', reconnectError);
          // 如果重连失败，停止监听并通知
          this.stopMonitoring();
          await this.sendNotification(
            'error',
            `邮箱 ${this.userEmail} 连续出错，监听服务已停止`,
            '监听服务停止'
          ).catch(notifyError => {
            console.error('Failed to send service stop notification:', notifyError);
          });
        }
      }
    }
  }

  private async openInbox(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.imap.openBox('INBOX', false, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async searchUnseenEmails(): Promise<number[]> {
    return new Promise((resolve, reject) => {
      this.imap.search(['UNSEEN'], (err, results) => {
        if (err) reject(err);
        else {
          const maxEmails = parseInt(process.env.MAX_EMAILS_PER_CHECK || '50');
          resolve(results ? results.slice(0, maxEmails) : []);
        }
      });
    });
  }

  private async processEmails(emailIds: number[]): Promise<void> {
    const emailsToProcess = emailIds;

    for (const emailId of emailsToProcess) {
      try {
        await this.processEmail(emailId);
      } catch (error) {
        console.error(`Error processing email ${emailId}:`, error);
      }
    }

    if (emailsToProcess.length > 0) {
      await this.markAsRead(emailsToProcess);
    }
  }

  private async processEmail(emailId: number): Promise<void> {
    const emailData = await this.fetchEmail(emailId);
    const parsedEmail = await simpleParser(emailData);
    
    const customParsedEmail = {
      from: parsedEmail.from?.text || '',
      to: Array.isArray(parsedEmail.to) ? parsedEmail.to.map(t => t.text || '') : [parsedEmail.to?.text || ''],
      subject: parsedEmail.subject || '',
      text: parsedEmail.text || '',
      html: parsedEmail.html || '',
      date: parsedEmail.date || new Date(),
      messageId: parsedEmail.messageId || '',
      inReplyTo: parsedEmail.inReplyTo,
      references: parsedEmail.references,
    } as ParsedEmail;

    console.log(`Processing email from ${customParsedEmail.from}, subject: ${customParsedEmail.subject}`);
    console.log(`Email headers - MessageId: ${customParsedEmail.messageId}, InReplyTo: ${customParsedEmail.inReplyTo}, References: ${customParsedEmail.references}`);

    const matcher = new EmailReplyMatcher(customParsedEmail);
    const sentEmail = await matcher.findMatchingSentEmail();

    if (sentEmail) {
      console.log(`Found matching sent email: ${sentEmail.id}`);
      await this.createEmailReply(customParsedEmail, sentEmail.id);
    } else {
      console.log(`No matching sent email found for reply from ${customParsedEmail.from}`);
      await this.logUnmatchedEmail(customParsedEmail);
    }
  }

  private async fetchEmail(emailId: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const fetch = this.imap.fetch(emailId, { bodies: '' });
      let emailData = Buffer.alloc(0);

      fetch.on('message', (msg) => {
        msg.on('body', (stream) => {
          const chunks: Buffer[] = [];
          stream.on('data', (chunk) => chunks.push(chunk));
          stream.on('end', () => {
            emailData = Buffer.concat(chunks);
          });
        });
      });

      fetch.once('error', reject);
      fetch.once('end', () => resolve(emailData));
    });
  }

  private async createEmailReply(parsedEmail: ParsedEmail, sentEmailId: string): Promise<void> {
    try {
      if (!this.userId) {
        throw new Error('userId is not set');
      }

      if (!this.emailProfileId) {
        throw new Error('emailProfileId is not set');
      }

      console.log('Creating email reply with data:', {
        userId: this.userId,
        emailProfileId: this.emailProfileId,
        sentEmailId,
        from: parsedEmail.from,
        to: parsedEmail.to.join(', '),
        subject: parsedEmail.subject,
        receivedAt: parsedEmail.date,
      });

      const reply = await prisma.emailReply.create({
        data: {
          userId: this.userId,
          emailProfileId: this.emailProfileId,
          sentEmailId: sentEmailId,
          from: parsedEmail.from,
          to: parsedEmail.to.join(', '),
          subject: parsedEmail.subject,
          body: parsedEmail.text,
          receivedAt: parsedEmail.date,
          threadId: this.generateThreadId(parsedEmail),
        },
      });

      console.log(`Successfully created email reply record: ${reply.id}`);
      
      await this.sendNotification(
        'success',
        `收到来自 ${parsedEmail.from} 的新回复邮件`,
        '新邮件回复'
      );
    } catch (error) {
      console.error('Error creating email reply:', error);
      
      // 记录详细错误信息
      const errorDetails = error instanceof Error ? error.message : '未知错误';
      await this.sendNotification(
        'error',
        `处理邮件回复时出错: ${errorDetails}`,
        '邮件监听错误'
      ).catch(notifyError => {
        console.error('Failed to send error notification:', notifyError);
      });

      // 重新抛出错误，让上层处理
      throw error;
    }
  }

  private generateThreadId(parsedEmail: ParsedEmail): string {
    return parsedEmail.inReplyTo || parsedEmail.references?.[0] || parsedEmail.messageId;
  }

  private async logUnmatchedEmail(parsedEmail: ParsedEmail): Promise<void> {
    const senderEmail = this.extractEmailAddress(parsedEmail.from);
    const cleanSubject = parsedEmail.subject.replace(/^(Re:|Fwd:|回复:|转发:)\s*/i, '').trim();
    
    console.log(`=== UNMATCHED EMAIL DEBUG ===`);
    console.log(`From: ${parsedEmail.from}`);
    console.log(`Sender Email: ${senderEmail}`);
    console.log(`Subject: ${parsedEmail.subject}`);
    console.log(`Clean Subject: ${cleanSubject}`);
    console.log(`MessageId: ${parsedEmail.messageId}`);
    console.log(`InReplyTo: ${parsedEmail.inReplyTo}`);
    console.log(`References: ${parsedEmail.references}`);
    console.log(`Date: ${parsedEmail.date}`);
    
    // 查询是否有发送给该收件人的邮件
    const sentToSender = await prisma.sentEmail.findMany({
      where: {
        recipientEmail: senderEmail,
      },
      orderBy: {
        sentAt: 'desc',
      },
      take: 5,
      select: {
        id: true,
        subject: true,
        sentAt: true,
        messageId: true,
      },
    });
    
    console.log(`Recent emails sent to ${senderEmail}:`);
    sentToSender.forEach((email, index) => {
      console.log(`  ${index + 1}. Subject: "${email.subject}", Sent: ${email.sentAt}, MessageId: ${email.messageId}`);
    });
    console.log(`=== END DEBUG ===`);
    
    // 发送通知
    await this.sendNotification(
      'info',
      `收到无法匹配的邮件回复：来自 ${senderEmail}，主题：${parsedEmail.subject}`,
      '未匹配的邮件回复'
    ).catch(error => {
      console.error('Failed to send unmatched email notification:', error);
    });
  }

  private extractEmailAddress(emailString: string): string {
    const match = emailString.match(/<([^>]+)>/);
    return match ? match[1] : emailString.trim();
  }

  private async sendNotification(type: string, message: string, title: string): Promise<void> {
    try {
      await prisma.notification.create({
        data: {
          type,
          title,
          message,
          userId: this.userId,
        },
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  private async markAsRead(emailIds: number[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.imap.addFlags(emailIds, ['\Seen'], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export class EmailMonitorManager {
  private monitors: Map<string, EmailMonitor> = new Map();
  private isRunning = false;

  async startMonitoring(profileIds?: string[], userId?: string): Promise<void> {
    try {
      console.log('Starting email monitoring service...');
      
      const whereCondition: any = {
        enableMonitoring: true,
        imapServer: { not: null },
        imapPort: { not: null }
      };
      
      if (profileIds && profileIds.length > 0) {
        whereCondition.id = { in: profileIds };
      }

      if (userId) {
        whereCondition.userId = userId;
      }

      console.log('Querying email profiles with condition:', whereCondition);
      
      const emailProfiles = await prisma.emailProfile.findMany({
        where: whereCondition,
        include: { user: true }
      });

      if (emailProfiles.length === 0) {
        const message = profileIds && profileIds.length > 0 
          ? 'No specified email profiles found for monitoring.'
          : 'No email profiles with monitoring enabled found.';
        throw new Error(message);
      }

      console.log(`Found ${emailProfiles.length} email profiles to monitor.`);

      for (const profile of emailProfiles) {
        try {
          const config: ImapConfig = {
            host: profile.imapServer!,
            port: profile.imapPort || 993,
            secure: profile.imapSecure,
            auth: {
              user: profile.email,
              pass: profile.password
            }
          };

          const monitor = new EmailMonitor(config, profile.id, userId!);
          await monitor.connect();
          await monitor.startMonitoring();
          
          this.monitors.set(profile.id, monitor);
          console.log(`Monitoring started for ${profile.email}`);
        } catch (error) {
          console.error(`Failed to start monitoring for ${profile.email}:`, error);
        }
      }

      this.isRunning = true;
      console.log('Email monitoring service started.');
    } catch (error) {
      console.error('Failed to start email monitoring service:', error);
      throw error;
    }
  }

  async stopMonitoring(): Promise<void> {
    console.log('Stopping email monitoring service...');
    
    for (const [profileId, monitor] of this.monitors) {
      try {
        monitor.stopMonitoring();
        await monitor.disconnect();
        console.log(`Monitoring stopped for ${profileId}`);
      } catch (error) {
        console.error(`Failed to stop monitoring for ${profileId}:`, error);
      }
    }
    
    this.monitors.clear();
    this.isRunning = false;
    console.log('Email monitoring service stopped.');
  }

  async restartMonitoring(): Promise<void> {
    await this.stopMonitoring();
    await this.startMonitoring();
  }

  getStatus() {
    const monitorDetails = Array.from(this.monitors.entries()).map(([profileId, monitor]) => ({
      profileId,
      // @ts-ignore
      status: monitor.isMonitoring ? 'running' : 'stopped',
      // @ts-ignore
      error: monitor.lastError ? monitor.lastError.message : undefined
    }));

    return {
      isRunning: this.isRunning,
      monitorCount: this.monitors.size,
      monitors: monitorDetails
    };
  }

  async testConnection(profileId: string): Promise<boolean> {
    try {
      const profile = await prisma.emailProfile.findUnique({
        where: { id: profileId }
      });

      if (!profile || !profile.imapServer) {
        throw new Error('Email profile not found or IMAP not configured.');
      }

      const config: ImapConfig = {
        host: profile.imapServer,
        port: profile.imapPort || 993,
        secure: profile.imapSecure,
        auth: {
          user: profile.email,
          pass: profile.password
        }
      };

      const testMonitor = new EmailMonitor(config, profile.id, profile.userId);
      await testMonitor.connect();
      await testMonitor.disconnect();
      
      return true;
    } catch (error) {
      console.error('Failed to test email connection:', error);
      return false;
    }
  }
}

let managerInstance: EmailMonitorManager | null = null;

export function getEmailMonitorManager(): EmailMonitorManager {
  if (!managerInstance) {
    managerInstance = new EmailMonitorManager();
  }
  return managerInstance;
}