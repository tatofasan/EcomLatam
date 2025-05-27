
const { storage } = require('./server/storage');
const { hashPassword } = require('./server/auth');

async function createUserA1() {
  try {
    console.log('Creando usuario con credenciales a1/a1...');
    
    // Verificar si el usuario ya existe
    const existingUser = await storage.getUserByUsername('a1');
    if (existingUser) {
      console.log('El usuario "a1" ya existe en la base de datos');
      return;
    }
    
    // Hash de la contraseña
    const hashedPassword = await hashPassword('a1');
    
    // Crear el usuario
    const userData = {
      username: 'a1',
      password: hashedPassword,
      fullName: 'Usuario A1',
      email: 'a1@test.com',
      role: 'admin', // Le doy rol de admin para que tenga acceso completo
      status: 'active', // Activo directamente
      isEmailVerified: true // Email verificado
    };
    
    const newUser = await storage.createUser(userData);
    
    console.log('Usuario creado exitosamente:');
    console.log(`- Username: ${newUser.username}`);
    console.log(`- Email: ${newUser.email}`);
    console.log(`- Role: ${newUser.role}`);
    console.log(`- Status: ${newUser.status}`);
    console.log(`- ID: ${newUser.id}`);
    
  } catch (error) {
    console.error('Error al crear el usuario:', error);
  }
}

createUserA1();
