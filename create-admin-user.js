import { db } from './server/db.js';
import { users } from './shared/schema.js';
import { hashPassword } from './server/auth.js';
import { eq } from 'drizzle-orm';

async function createAdminUser() {
  try {
    // Check if admin user already exists
    const existingAdmin = await db.select().from(users).where(eq(users.username, 'u1'));
    
    if (existingAdmin.length > 0) {
      console.log('Admin user already exists');
      return;
    }

    // Hash the password
    const hashedPassword = await hashPassword('admin');
    
    // Create admin user
    const adminUser = await db.insert(users).values({
      username: 'u1',
      password: hashedPassword,
      fullName: 'Administrator',
      email: 'admin@example.com',
      role: 'admin',
      status: 'active',
      isEmailVerified: true,
      commissionRate: '0.00'
    }).returning();

    console.log('Admin user created successfully:', adminUser[0]);
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}

createAdminUser();