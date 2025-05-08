import nodemailer from 'nodemailer';
import path from 'path';

// Crear un transporter para enviar correos electrónicos
// Nota: Para entornos de producción, necesitarás configurar un servicio SMTP real
let transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email', // Para pruebas, usamos Ethereal Email si no hay configuración
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

// Si estamos en desarrollo, configuramos una cuenta de prueba de Ethereal
if (process.env.NODE_ENV !== 'production' && !process.env.SMTP_USER) {
  console.log('Configurando cuenta de prueba para email...');
  // Usamos la cuenta de Ethereal que ya fue creada y mostrada en consola
  const etherealUser = 'riduuu24ti3jhukx@ethereal.email';
  const etherealPass = 'j64MHUY7XsFdgGSC4n';
  
  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: etherealUser,
      pass: etherealPass,
    },
  });
  
  console.log('Servicio de email configurado con cuenta Ethereal para pruebas');
}

interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

// Función para enviar un correo electrónico
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"EcomDrop" <noreply@ecomdrop.com>',
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    
    console.log('Correo enviado: %s', info.messageId);
    
    // Si estamos usando Ethereal, mostramos la URL para ver el email (solo en dev)
    if (process.env.NODE_ENV !== 'production' && info.messageId) {
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
    
    return true;
  } catch (error) {
    console.error('Error al enviar email:', error);
    return false;
  }
}

// Función para enviar correo de verificación
export async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
  const verificationUrl = `${process.env.APP_URL || 'http://localhost:5000'}/verify-email?token=${token}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4a4a4a;">Bienvenido a EcomDrop</h2>
      <p>Gracias por registrarte. Por favor confirma tu dirección de correo electrónico haciendo clic en el siguiente enlace:</p>
      <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #0070f3; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">Verificar mi correo</a>
      <p>O copia y pega el siguiente enlace en tu navegador:</p>
      <p style="color: #666;">${verificationUrl}</p>
      <p>Este enlace expirará en 24 horas.</p>
      <p>Si no has solicitado esta verificación, puedes ignorar este correo.</p>
      <hr style="border: 1px solid #eee; margin: 20px 0;">
      <p style="color: #999; font-size: 12px;">Este es un correo automático, por favor no respondas a este mensaje.</p>
    </div>
  `;
  
  return sendEmail({
    to: email,
    subject: 'Verificación de correo electrónico - EcomDrop',
    html,
  });
}