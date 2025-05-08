import crypto from 'crypto';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Función para generar un token de verificación
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Función para crear un token y configurar una fecha de expiración (24 horas)
export function createVerificationData(): { token: string; expires: Date } {
  const token = generateVerificationToken();
  const expires = new Date();
  expires.setHours(expires.getHours() + 24); // El token expira en 24 horas
  
  return {
    token,
    expires
  };
}

// Verificar token
export async function verifyUserEmail(token: string): Promise<boolean> {
  try {
    // Buscar usuario con este token
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.verificationToken, token));
    
    if (!user) {
      return false; // Token no encontrado
    }
    
    // Verificar si el token ha expirado
    if (user.verificationExpires && new Date(user.verificationExpires) < new Date()) {
      return false; // Token expirado
    }
    
    // Actualizar el usuario como verificado
    await db
      .update(users)
      .set({
        isEmailVerified: true,
        status: 'pending', // El usuario está verificado pero pendiente de aprobación
        verificationToken: null,
        verificationExpires: null
      })
      .where(eq(users.id, user.id));
    
    return true;
  } catch (error) {
    console.error('Error al verificar email:', error);
    return false;
  }
}

// Activar cuenta de usuario por un administrador
export async function activateUserAccount(userId: number): Promise<boolean> {
  try {
    await db
      .update(users)
      .set({
        status: 'active'
      })
      .where(eq(users.id, userId));
    
    return true;
  } catch (error) {
    console.error('Error al activar cuenta:', error);
    return false;
  }
}