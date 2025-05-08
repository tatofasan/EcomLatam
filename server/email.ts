import nodemailer from 'nodemailer';
import path from 'path';

// Create the transporter for Gmail immediately
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

// Verify connection
transporter.verify(function(error, success) {
  if (error) {
    console.error('Error in email configuration:', error);
  } else {
    console.log('Email server ready to send messages');
    console.log('Using account:', process.env.SMTP_USER);
  }
});

interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

// Function to send an email
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  try {
    const info = await transporter.sendMail({
      from: `"EcomLatam" <${process.env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    
    console.log('Email sent: %s', info.messageId);
    
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

// Function to send verification email
export async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
  // Build the URL using Replit domains if available
  const baseUrl = process.env.REPLIT_DOMAINS
    ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
    : (process.env.APP_URL || 'http://localhost:5000');
  
  const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px; border-radius: 10px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #3c98e0; font-size: 28px; margin-bottom: 5px;">EcomLatam</h1>
        <div style="width: 50px; height: 4px; background-color: #4aaeed; margin: 0 auto;"></div>
      </div>
      <h2 style="color: #4a4a4a; text-align: center;">Welcome to EcomLatam</h2>
      <p style="font-size: 16px; line-height: 1.5; color: #666;">Thank you for registering. Please confirm your email address by clicking the button below:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationUrl}" style="display: inline-block; padding: 12px 25px; background-color: #3c98e0; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">Verify My Email</a>
      </div>
      <p style="font-size: 14px; color: #666;">Or copy and paste the following link in your browser:</p>
      <p style="font-size: 14px; color: #3c98e0; background-color: #e8f4fd; padding: 10px; border-radius: 5px; word-break: break-all;">${verificationUrl}</p>
      <p style="font-size: 14px; color: #666;">This link will expire in 24 hours.</p>
      <p style="font-size: 14px; color: #666;">If you didn't request this verification, you can ignore this email.</p>
      <hr style="border: 1px solid #eee; margin: 20px 0;">
      <p style="color: #999; font-size: 12px; text-align: center;">This is an automated email, please do not reply to this message.</p>
      <p style="color: #999; font-size: 12px; text-align: center;">&copy; ${new Date().getFullYear()} EcomLatam. All rights reserved.</p>
    </div>
  `;
  
  return sendEmail({
    to: email,
    subject: 'Email Verification - EcomLatam',
    html,
  });
}