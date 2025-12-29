import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEmailMonitorManager } from '../../../lib/email-monitor';
import { prisma } from '../../../lib/prisma';

const monitorManager = getEmailMonitorManager();

async function getLastReplyTime(userId: string): Promise<Date | null> {
  const lastReply = await prisma.emailReply.findFirst({
    where: {
      emailProfile: {
        userId: userId
      }
    },
    orderBy: {
      receivedAt: 'desc',
    },
    select: {
      receivedAt: true,
    },
  });
  return lastReply?.receivedAt || null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentReplies = await prisma.emailReply.count({
      where: {
        emailProfile: {
          userId: session.user.id
        },
        receivedAt: {
          gte: twentyFourHoursAgo,
        },
      },
    });

    const totalReplies = await prisma.emailReply.count({
      where: {
        emailProfile: {
          userId: session.user.id
        }
      }
    });
    const lastReplyAt = await getLastReplyTime(session.user.id);

    const monitorStatus = monitorManager.getStatus();
    
    const emailProfiles = await prisma.emailProfile.findMany({
      where: {
        userId: session.user.id,
        enableMonitoring: true,
        imapServer: { not: null }
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

    return NextResponse.json({
      success: true,
      data: {
        monitor: {
          isRunning: monitorStatus.isRunning,
          monitorCount: monitorStatus.monitorCount,
          monitors: monitorStatus.monitors
        },
        statistics: {
          recentReplies,
          totalReplies,
          lastReplyAt
        },
        configuration: {
          emailProfiles,
          totalProfiles: emailProfiles.length,
          enabledProfiles: emailProfiles.filter(p => p.enableMonitoring).length
        }
      }
    });

  } catch (error) {
    console.error('Failed to get monitor status:', error);
    return NextResponse.json({
      error: 'Failed to get monitor status',
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
    const { action, profileIds = [] } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    if (action === 'start') {
      return await startMonitoring(profileIds, session.user.id);
    } else if (action === 'stop') {
      return await stopMonitoring();
    } else if (action === 'restart') {
      await stopMonitoring();
      return await startMonitoring(profileIds, session.user.id);
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Failed to operate email monitor:', error);
    return NextResponse.json({
      error: 'Operation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function startMonitoring(profileIds?: string[], userId?: string) {
  try {
    const status = monitorManager.getStatus();
    if (status.isRunning) {
      return NextResponse.json({
        error: 'Email monitor is already running'
      }, { status: 400 });
    }

    if (profileIds && profileIds.length > 0) {
      const profiles = await prisma.emailProfile.findMany({
        where: {
          id: { in: profileIds },
          userId: userId,
          enableMonitoring: true,
          imapServer: { not: null }
        }
      });
      
      if (profiles.length === 0) {
        return NextResponse.json({
          error: 'No available email profiles found'
        }, { status: 400 });
      }
      
      console.log(`Starting email monitor for profiles: ${profiles.map(p => p.email).join(', ')}`);
    }

    // 异步启动，无需等待
    monitorManager.startMonitoring(profileIds, userId);

    console.log('Email monitoring has been initiated');

    return NextResponse.json({
      success: true,
      message: `Email monitoring has been initiated${profileIds ? ` for ${profileIds.length} profile(s)` : ''}`,
      data: monitorManager.getStatus()
    });

  } catch (error) {
    console.error('Failed to start email monitor:', error);
    
    return NextResponse.json({
      error: 'Failed to start email monitor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function stopMonitoring() {
  try {
    const status = monitorManager.getStatus();
    if (!status.isRunning) {
      return NextResponse.json({
        error: 'Email monitor is not running'
      }, { status: 400 });
    }

    await monitorManager.stopMonitoring();
    
    console.log('Email monitor stopped');

    return NextResponse.json({
      success: true,
      message: 'Email monitor stopped'
    });

  } catch (error) {
    console.error('Failed to stop email monitor:', error);
    
    return NextResponse.json({
      error: 'Failed to stop email monitor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { profileId } = body;

    if (!profileId) {
      return NextResponse.json({
        error: 'Missing profileId'
      }, { status: 400 });
    }

    const success = await monitorManager.testConnection(profileId);
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Email server connection test successful'
      });
    } else {
      return NextResponse.json({
        error: 'Email server connection test failed',
        details: 'Please check your IMAP settings'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Failed to test email connection:', error);
    return NextResponse.json({
      error: 'Failed to test connection',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}