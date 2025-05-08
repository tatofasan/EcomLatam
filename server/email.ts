import nodemailer from 'nodemailer';
import path from 'path';

// Variable para almacenar el transporter
let transporter: nodemailer.Transporter;

// Función para configurar el transporter con Ethereal
async function setupEtherealTransporter() {
  try {
    // Crear cuenta de prueba de Ethereal
    const testAccount = await nodemailer.createTestAccount();
    
    console.log('Cuenta Ethereal creada para pruebas:', {
      user: testAccount.user,
      pass: testAccount.pass,
      previewURL: 'https://ethereal.email/login'
    });
    
    // Crear transporter con la cuenta de prueba
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    
    console.log('Servicio de email configurado con Ethereal para entorno de desarrollo');
    return true;
  } catch (error) {
    console.error('Error al configurar Ethereal:', error);
    return false;
  }
}

// Inicializar transporter
setupEtherealTransporter();

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