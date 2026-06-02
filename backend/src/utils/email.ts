import nodemailer from 'nodemailer';

const host = process.env.SMTP_HOST;
const port = parseInt(process.env.SMTP_PORT || '587');
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.SMTP_FROM || 'no-reply@saarlekha.com';

let transporter: nodemailer.Transporter | null = null;

if (host && user && pass) {
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }) {
  if (transporter) {
    try {
      await transporter.sendMail({
        from,
        to,
        subject,
        html,
        text
      });
      console.log(`Email sent successfully to ${to}`);
    } catch (error) {
      console.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
  } else {
    console.log('========================================');
    console.log(`Email Sent (Development Console Fallback)`);
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Text:\n${text}`);
    console.log(`HTML:\n${html}`);
    console.log('========================================');
  }
}
