import nodemailer from 'nodemailer';
import path from 'path';

// Crear el transporter para Gmail inmediatamente
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

// Verificar conexión
transporter.verify(function(error, success) {
  if (error) {
    console.error('Error en la configuración del email:', error);
  } else {
    console.log('Servidor de correo listo para enviar mensajes');
    console.log('Usando cuenta:', process.env.SMTP_USER);
  }
});

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
      from: `"EcomDrop" <${process.env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    
    console.log('Correo enviado: %s', info.messageId);
    
    return true;
  } catch (error) {
    console.error('Error al enviar email:', error);
    return false;
  }
}

// Función para enviar correo de verificación
export async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
  // Construir la URL usando el host de Replit si está disponible
  const baseUrl = process.env.REPL_SLUG 
    ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` 
    : (process.env.APP_URL || 'http://localhost:5000');
  
  const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
  
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