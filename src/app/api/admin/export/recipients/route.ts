import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== 'admin') {
            return new NextResponse('Unauthorized', { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const userId = searchParams.get('userId')
        const formatType = searchParams.get('format') || 'json'

        if (!userId) {
            return new NextResponse('User ID is required', { status: 400 })
        }

        // Fetch recipients for the user
        // Note: Recipient table is linked to User via userId
        const recipients = await prisma.recipient.findMany({
            where: {
                userId: userId
            },
            select: {
                id: true,
                email: true,
                name: true,
                status: true,
                createdAt: true,
                // recipientLists: { select: { name: true } } // If needed
            },
            orderBy: {
                createdAt: 'desc'
            }
        })

        if (formatType === 'json') {
            return NextResponse.json(recipients)
        } else if (formatType === 'csv') {
            // Define CSV headers
            const headers = ['ID', 'Email', 'Name', 'Status', 'Created At']

            // Convert data to CSV rows
            const rows = recipients.map(r => [
                r.id,
                r.email,
                r.name || '',
                r.status,
                format(new Date(r.createdAt), 'yyyy-MM-dd HH:mm:ss')
            ])

            // Combine headers and rows
            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => {
                    // Escape quotes and wrap in quotes if necessary
                    const stringCell = String(cell)
                    if (stringCell.includes(',') || stringCell.includes('"') || stringCell.includes('\n')) {
                        return `"${stringCell.replace(/"/g, '""')}"`
                    }
                    return stringCell
                }).join(','))
            ].join('\n')

            // Return CSV response with BOM for Excel compatibility
            return new NextResponse('\uFEFF' + csvContent, {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="recipients-${userId}-${format(new Date(), 'yyyyMMddHHmmss')}.csv"`,
                },
            })
        }

        return new NextResponse('Invalid format', { status: 400 })

    } catch (error) {
        console.error('Export recipients error:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
