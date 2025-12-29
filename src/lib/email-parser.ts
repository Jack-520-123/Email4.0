import { simpleParser, ParsedMail } from 'mailparser';

export interface ParsedEmail {
  messageId: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  date: Date;
  inReplyTo?: string;
  references?: string[];
  attachments?: any[];
}

export class EmailParser {
  static async parse(emailData: Buffer): Promise<ParsedEmail> {
    const parsed: ParsedMail = await simpleParser(emailData);

    const fromText = Array.isArray(parsed.from) ? parsed.from[0]?.text : parsed.from?.text;
    
    let toArray: string[] = [];
    if (parsed.to) {
      if (Array.isArray(parsed.to)) {
        toArray = parsed.to.map(addr => addr.text || '').filter(Boolean);
      } else {
        toArray = parsed.to.text ? [parsed.to.text] : [];
      }
    }

    let references: string[] = [];
    if (typeof parsed.references === 'string') {
      references = [parsed.references];
    } else if (Array.isArray(parsed.references)) {
      references = parsed.references;
    }

    return {
      messageId: parsed.messageId || '',
      from: fromText || '',
      to: toArray,
      subject: parsed.subject || '',
      text: parsed.text || '',
      html: parsed.html || undefined,
      date: parsed.date || new Date(),
      inReplyTo: parsed.inReplyTo,
      references: references,
      attachments: parsed.attachments || [],
    };
  }
}