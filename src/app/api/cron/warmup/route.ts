import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processWarmupCampaign } from '@/lib/email-warmup';

// Ensure this route is dynamic and not cached
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // specific checking: either nextRunAt is in the past, or it is null (never run)
        const activeCampaigns = await prisma.warmupCampaign.findMany({
            where: {
                status: 'active',
                OR: [
                    { nextRunAt: { lte: new Date() } },
                    { nextRunAt: null }
                ]
            },
        });

        console.log(`[Cron] Found ${activeCampaigns.length} warmup campaigns due for processing`);

        const results = await Promise.allSettled(
            activeCampaigns.map(campaign => processWarmupCampaign(campaign.id))
        );

        const successCount = results.filter(r => r.status === 'fulfilled').length;

        return NextResponse.json({
            success: true,
            processed: activeCampaigns.length,
            successful: successCount
        });
    } catch (error) {
        console.error('[Cron] Warmup trigger failed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
