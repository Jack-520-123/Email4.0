import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEmailMonitorManager } from '@/lib/email-monitor';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const monitorManager = getEmailMonitorManager();
    const status = monitorManager.getStatus();

    // 获取最近的回复记录
    const recentReplies = await prisma.emailReply.findMany({
      where: {
        emailProfile: {
          userId: session.user.id
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10,
      include: {
        sentEmail: {
          select: {
            id: true,
            subject: true,
            recipientEmail: true,
            sentAt: true,
            messageId: true
          }
        },
        emailProfile: {
          select: {
            email: true,
            nickname: true
          }
        }
      }
    });

    // 获取最近的发送邮件记录
    const recentSentEmails = await prisma.sentEmail.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: {
        sentAt: 'desc'
      },
      take: 10,
      select: {
        id: true,
        subject: true,
        recipientEmail: true,
        sentAt: true,
        messageId: true,
        status: true
      }
    });

    // 获取启用监听的邮箱配置
    const monitoringProfiles = await prisma.emailProfile.findMany({
      where: {
        userId: session.user.id,
        enableMonitoring: true
      },
      select: {
        id: true,
        email: true,
        nickname: true,
        imapServer: true,
        imapPort: true,
        imapSecure: true,
        enableMonitoring: true
      }
    });

    // 获取通知记录
    const recentNotifications = await prisma.notification.findMany({
      where: {
        userId: session.user.id,
        type: {
          in: ['info', 'error', 'success']
        },
        title: {
          contains: '邮件'
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20
    });

    return NextResponse.json({
      success: true,
      data: {
        monitorStatus: status,
        monitoringProfiles,
        recentReplies: recentReplies.map(reply => ({
          id: reply.id,
          from: reply.from,
          subject: reply.subject,
          receivedAt: reply.receivedAt,
          createdAt: reply.createdAt,
          sentEmail: reply.sentEmail,
          emailProfile: reply.emailProfile
        })),
        recentSentEmails,
        recentNotifications,
        statistics: {
          totalReplies: await prisma.emailReply.count({
            where: {
              emailProfile: {
                userId: session.user.id
              }
            }
          }),
          repliesLast24h: await prisma.emailReply.count({
            where: {
              emailProfile: {
                userId: session.user.id
              },
              createdAt: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
              }
            }
          }),
          totalSentEmails: await prisma.sentEmail.count({
            where: {
              userId: session.user.id
            }
          })
        }
      }
    });

  } catch (error) {
    console.error('Failed to get email monitor debug info:', error);
    return NextResponse.json({
      error: 'Failed to get debug info',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    const monitorManager = getEmailMonitorManager();

    switch (action) {
      case 'restart':
        await monitorManager.stopMonitoring();
        await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
        await monitorManager.startMonitoring(undefined, session.user.id);
        return NextResponse.json({ success: true, message: 'Monitor restarted' });

      case 'test_connection':
        const { profileId } = body;
        if (!profileId) {
          return NextResponse.json({ error: 'Profile ID required' }, { status: 400 });
        }
        const testResult = await monitorManager.testConnection(profileId);
        return NextResponse.json({ success: testResult, message: testResult ? 'Connection successful' : 'Connection failed' });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Failed to execute debug action:', error);
    return NextResponse.json({
      error: 'Action failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}