import nodemailer from 'nodemailer';
import { env } from '../config/env';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export async function sendEmailOTP(to: string, firstName: string, otp: string): Promise<void> {
  await transporter.sendMail({
    from: `"Axios Pay" <${env.SMTP_USER}>`,
    to,
    subject: 'Verify your Axios Pay email',
    html: `
      <div style="font-family: DM Sans, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #1A2332; font-family: Playfair Display, serif;">Axios Pay</h1>
        <h2 style="color: #1A2332;">Hi ${firstName}, verify your email</h2>
        <p style="color: #5A6474;">Your verification code is:</p>
        <div style="background: #FDF3E3; border: 1px solid #E5E1DA; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
          <span style="font-family: JetBrains Mono, monospace; font-size: 36px; letter-spacing: 8px; color: #C8772A; font-weight: bold;">${otp}</span>
        </div>
        <p style="color: #5A6474;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
        <p style="color: #9AA3AE; font-size: 12px; margin-top: 40px;">Axios Pay — Cross-Border FX, Unlocked.</p>
      </div>
    `,
  });
}

export async function sendWelcomeEmail(to: string, firstName: string): Promise<void> {
  await transporter.sendMail({
    from: `"Axios Pay" <${env.SMTP_USER}>`,
    to,
    subject: 'Welcome to Axios Pay 🎉',
    html: `
      <div style="font-family: DM Sans, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #1A2332; font-family: Playfair Display, serif;">Axios Pay</h1>
        <h2 style="color: #1A2332;">Welcome, ${firstName}! 🎉</h2>
        <p style="color: #5A6474;">Your account is fully verified. You're ready to swap currencies across Africa.</p>
        <div style="background: #C8772A; border-radius: 8px; padding: 16px 24px; display: inline-block; margin: 24px 0;">
          <a href="${env.FRONTEND_URL}/dashboard" style="color: white; text-decoration: none; font-weight: bold;">Go to Dashboard →</a>
        </div>
        <p style="color: #5A6474;">Supported currencies: NGN, UGX, KES, GHS, ZAR</p>
        <p style="color: #5A6474;">Flat fee: 1.5% per swap. No hidden charges.</p>
        <p style="color: #9AA3AE; font-size: 12px; margin-top: 40px;">Axios Pay — Cross-Border FX, Unlocked.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetOTP(to: string, firstName: string, otp: string): Promise<void> {
  await transporter.sendMail({
    from: `"Axios Pay" <${env.SMTP_USER}>`,
    to,
    subject: 'Reset your Axios Pay password',
    html: `
      <div style="font-family: DM Sans, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #1A2332; font-family: Playfair Display, serif;">Axios Pay</h1>
        <h2 style="color: #1A2332;">Reset your password</h2>
        <p style="color: #5A6474;">Hi ${firstName}, your password reset code is:</p>
        <div style="background: #FDF3E3; border: 1px solid #E5E1DA; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
          <span style="font-family: JetBrains Mono, monospace; font-size: 36px; letter-spacing: 8px; color: #C8772A; font-weight: bold;">${otp}</span>
        </div>
        <p style="color: #5A6474;">This code expires in 15 minutes. If you didn't request a password reset, ignore this email.</p>
        <p style="color: #9AA3AE; font-size: 12px; margin-top: 40px;">Axios Pay — Cross-Border FX, Unlocked.</p>
      </div>
    `,
  });
}

export async function sendLoginNotificationEmail(
  to: string,
  firstName: string,
  ipAddress: string | undefined,
  userAgent: string | undefined,
  loginAt: Date
): Promise<void> {
  await transporter.sendMail({
    from: `"Axios Pay" <${env.SMTP_USER}>`,
    to,
    subject: 'New login detected on your Axios Pay account',
    html: `
      <div style="font-family: DM Sans, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #1A2332; font-family: Playfair Display, serif;">Axios Pay</h1>
        <h2 style="color: #1A2332;">Hi ${firstName}, a new login was detected</h2>
        <p style="color: #5A6474;">We noticed a successful login to your account.</p>
        <div style="background: #FDF3E3; border: 1px solid #E5E1DA; border-radius: 12px; padding: 16px; margin: 24px 0;">
          <p style="margin: 0 0 8px; color: #1A2332;"><strong>Time:</strong> ${loginAt.toISOString()}</p>
          <p style="margin: 0 0 8px; color: #1A2332;"><strong>IP address:</strong> ${ipAddress || 'Unknown'}</p>
          <p style="margin: 0; color: #1A2332;"><strong>Device/Browser:</strong> ${userAgent || 'Unknown'}</p>
        </div>
        <div style="background: #C8772A; border-radius: 8px; padding: 16px 24px; display: inline-block; margin: 8px 0 24px;">
          <a href="${env.FRONTEND_URL}" style="color: white; text-decoration: none; font-weight: bold;">Not you? Secure your account immediately</a>
        </div>
        <p style="color: #9AA3AE; font-size: 12px; margin-top: 20px;">Axios Pay — Cross-Border FX, Unlocked.</p>
      </div>
    `,
  });
}
