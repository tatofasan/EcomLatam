# Database Migrations

Este directorio contiene las migraciones SQL para la base de datos PostgreSQL del proyecto.

## ¿Cómo funciona el sistema de migraciones?

El sistema de migraciones se ejecuta automáticamente en cada deploy mediante el script `server/run-migrations.ts`, que es llamado en el comando `start` del `package.json`:

```json
"start": "tsx server/run-migrations.ts && node dist/index.js"
```

## Estructura de archivos

Las migraciones deben seguir este formato de nomenclatura:

```
XXXX_descripcion_corta.sql
```

Donde:
- `XXXX` es un número secuencial de 4 dígitos (ej: 0001, 0002, 0010)
- `descripcion_corta` describe brevemente qué hace la migración
- La extensión debe ser `.sql`

### Ejemplos:
- `0001_add_missing_columns.sql`
- `0009_add_phone_fields.sql`
- `0010_add_user_preferences.sql`

## Cómo agregar una nueva migración

### 1. Crear el archivo SQL

Crea un nuevo archivo en este directorio (`migrations/`) con el siguiente formato:

```sql
-- Migration: Título descriptivo
-- Created: YYYY-MM-DD
-- Description: Descripción detallada de lo que hace esta migración

-- Escribe tus cambios aquí
ALTER TABLE tabla ADD COLUMN IF NOT EXISTS nueva_columna TEXT;

-- Más cambios...
```

**IMPORTANTE:** Usa siempre `IF NOT EXISTS` o checks condicionales para hacer las migraciones idempotentes (que se puedan ejecutar múltiples veces sin errores).

### 2. Registrar la migración en run-migrations.ts

Edita el archivo `server/run-migrations.ts` y agrega tu migración al array:

```typescript
const migrations: Array<{ file: string; description: string }> = [
  {
    file: '0010_add_user_preferences.sql',
    description: 'Add user_preferences table and related columns'
  }
];
```

### 3. Probar localmente (opcional pero recomendado)

Puedes ejecutar las migraciones manualmente en tu entorno local:

```bash
npm run db:migrate
```

### 4. Commitear y deployar

Una vez que la migración esté lista:

1. Commitea tanto el archivo SQL como el `run-migrations.ts` actualizado
2. Haz push a GitHub
3. Railway ejecutará automáticamente las migraciones en el próximo deploy

## Migraciones ya aplicadas

Las siguientes migraciones ya fueron aplicadas en producción y han sido removidas del script para evitar ejecuciones innecesarias:

- ✅ `0001_add_missing_columns.sql` - publisher_id, subacc1-4, customer_postal_code columns + terms_and_conditions table
- ✅ `0009_add_phone_fields.sql` - customer_phone_original and customer_phone_formatted columns

## Mejores prácticas

### ✅ HACER:
- Usar `IF NOT EXISTS` en CREATE TABLE
- Usar `ADD COLUMN IF NOT EXISTS` en ALTER TABLE
- Usar bloques `DO $$` con checks condicionales para operaciones complejas
- Agregar comentarios descriptivos en el SQL
- Probar en desarrollo antes de production
- Mantener las migraciones pequeñas y enfocadas en un cambio específico
- Numerar secuencialmente las migraciones

### ❌ NO HACER:
- No usar `DROP TABLE` o `DROP COLUMN` sin checks condicionales
- No hacer cambios destructivos sin backup
- No modificar migraciones que ya fueron aplicadas
- No incluir datos de prueba en migraciones de producción

## Ejemplo completo de migración idempotente

```sql
-- Migration: Add email verification columns
-- Created: 2025-01-13
-- Description: Adds email verification tracking to users table

-- Add verification_token column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'verification_token'
    ) THEN
        ALTER TABLE users ADD COLUMN verification_token TEXT;
    END IF;
END $$;

-- Add verification_expires column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'verification_expires'
    ) THEN
        ALTER TABLE users ADD COLUMN verification_expires TIMESTAMP;
    END IF;
END $$;

-- Create index for faster token lookup
CREATE INDEX IF NOT EXISTS idx_users_verification_token
ON users(verification_token)
WHERE verification_token IS NOT NULL;
```

## Troubleshooting

### La migración falla en deploy

1. Revisa los logs de Railway para ver el error específico
2. Conéctate a la base de datos de producción para verificar el estado
3. Si es necesario, remueve la migración del array en `run-migrations.ts` temporalmente
4. Corrige el problema y vuelve a intentar

### Necesito revertir una migración

Crea una nueva migración que revierta los cambios (no modifiques la original):

```sql
-- Migration: Revert 0010 - Remove user_preferences
-- Created: 2025-01-13

DROP TABLE IF EXISTS user_preferences;
```

## Comandos útiles

```bash
# Ejecutar migraciones manualmente
npm run db:migrate

# Generar schema con Drizzle (no ejecuta migraciones)
npm run db:generate

# Push schema directamente (útil en desarrollo)
npm run db:push
```

## Referencias

- [Documentación PostgreSQL - ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Railway Deployment Docs](https://docs.railway.app/)
