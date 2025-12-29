import { ParsedEmail } from './email-parser';
import { prisma } from './prisma';

export class EmailReplyMatcher {
  private parsedEmail: ParsedEmail;

  constructor(parsedEmail: ParsedEmail) {
    this.parsedEmail = parsedEmail;
  }

  async findMatchingSentEmail(): Promise<{ id: string } | null> {
    // 1. Match by In-Reply-To header
    if (this.parsedEmail.inReplyTo) {
      const sentEmail = await this.findByMessageId(this.parsedEmail.inReplyTo);
      if (sentEmail) return sentEmail;
    }

    // 2. Match by References header
    if (this.parsedEmail.references && this.parsedEmail.references.length > 0) {
      for (const ref of this.parsedEmail.references) {
        const sentEmail = await this.findByMessageId(ref);
        if (sentEmail) return sentEmail;
      }
    }

    // 3. Match by subject and sender
    const sentEmailBySubject = await this.findBySubjectAndSender();
    if (sentEmailBySubject) return sentEmailBySubject;

    return null;
  }

  private async findByMessageId(messageId: string): Promise<{ id: string } | null> {
    return prisma.sentEmail.findFirst({
      where: { messageId },
      select: { id: true },
    });
  }

  private async findBySubjectAndSender(): Promise<{ id: string } | null> {
    const originalSubject = this.parsedEmail.subject.replace(/^(Re:|Fwd:|回复:|转发:)\s*/i, '').trim();
    const senderEmail = this.extractEmailAddress(this.parsedEmail.from);

    // 首先尝试精确匹配主题
    let sentEmail = await prisma.sentEmail.findFirst({
      where: {
        recipientEmail: senderEmail,
        subject: originalSubject,
      },
      orderBy: {
        sentAt: 'desc',
      },
      select: { id: true },
    });

    // 如果精确匹配失败，尝试包含匹配
    if (!sentEmail && originalSubject.length > 5) {
      sentEmail = await prisma.sentEmail.findFirst({
        where: {
          recipientEmail: senderEmail,
          subject: {
            contains: originalSubject,
            mode: 'insensitive',
          },
        },
        orderBy: {
          sentAt: 'desc',
        },
        select: { id: true },
      });
    }

    // 如果仍然没有匹配，尝试反向匹配（原邮件主题包含回复主题）
    if (!sentEmail && originalSubject.length > 3) {
      sentEmail = await prisma.sentEmail.findFirst({
        where: {
          recipientEmail: senderEmail,
          subject: {
            contains: originalSubject.substring(0, Math.min(originalSubject.length, 20)),
            mode: 'insensitive',
          },
          sentAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 最近30天内
          },
        },
        orderBy: {
          sentAt: 'desc',
        },
        select: { id: true },
      });
    }

    return sentEmail;
  }

  private extractEmailAddress(emailString: string): string {
    const match = emailString.match(/<([^>]+)>/);
    return match ? match[1] : emailString.trim();
  }
}