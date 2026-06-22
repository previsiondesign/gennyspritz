// Outbound notification email via Resend. Gracefully no-ops until the
// RESEND_API_KEY secret is set (and the sending domain is verified there).
const FROM_DEFAULT = 'genny <notifications@gennyspritz.com>';

export interface Attachment { filename: string; content: string /* base64 */ }

export async function sendEmail(opts: {
  to: string; subject: string; text: string;
  html?: string; from?: string; replyTo?: string; bcc?: string;
  attachments?: Attachment[];
}): Promise<{ sent: boolean; reason?: string }> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return { sent: false, reason: 'no-provider' };
  try {
    const payload: Record<string, unknown> = {
      from: opts.from ?? Deno.env.get('NOTIFY_FROM') ?? FROM_DEFAULT,
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
    };
    if (opts.html) payload.html = opts.html;
    if (opts.replyTo) payload.reply_to = opts.replyTo;
    if (opts.bcc) payload.bcc = [opts.bcc];
    if (opts.attachments) payload.attachments = opts.attachments;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { sent: false, reason: 'send-failed-' + res.status };
    return { sent: true };
  } catch {
    return { sent: false, reason: 'network' };
  }
}
