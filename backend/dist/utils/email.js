"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const host = process.env.SMTP_HOST;
const port = parseInt(process.env.SMTP_PORT || '587');
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.SMTP_FROM || 'no-reply@saarlekha.com';
let transporter = null;
if (host && user && pass) {
    transporter = nodemailer_1.default.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
    });
}
async function sendEmail({ to, subject, html, text }) {
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
        }
        catch (error) {
            console.error(`Failed to send email to ${to}:`, error);
            throw error;
        }
    }
    else {
        console.log('========================================');
        console.log(`Email Sent (Development Console Fallback)`);
        console.log(`To:      ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Text:\n${text}`);
        console.log(`HTML:\n${html}`);
        console.log('========================================');
    }
}
