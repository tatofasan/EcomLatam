-- Migration: Add missing columns to leads table
-- This migration adds publisher_id and subacc fields that were added in recent schema updates

-- Add publisher_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'publisher_id'
    ) THEN
        ALTER TABLE leads ADD COLUMN publisher_id text;
    END IF;
END $$;

-- Add subacc1 column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'subacc1'
    ) THEN
        ALTER TABLE leads ADD COLUMN subacc1 text;
    END IF;
END $$;

-- Add subacc2 column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'subacc2'
    ) THEN
        ALTER TABLE leads ADD COLUMN subacc2 text;
    END IF;
END $$;

-- Add subacc3 column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'subacc3'
    ) THEN
        ALTER TABLE leads ADD COLUMN subacc3 text;
    END IF;
END $$;

-- Add subacc4 column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'subacc4'
    ) THEN
        ALTER TABLE leads ADD COLUMN subacc4 text;
    END IF;
END $$;

-- Add customer_postal_code column if it doesn't exist (from recent schema update)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'customer_postal_code'
    ) THEN
        ALTER TABLE leads ADD COLUMN customer_postal_code text;
    END IF;
END $$;

-- Create terms_and_conditions table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'terms_and_conditions'
    ) THEN
        CREATE TABLE terms_and_conditions (
            id SERIAL PRIMARY KEY,
            version TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            effective_date TIMESTAMP NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );

        -- Create indexes for active terms lookup
        CREATE INDEX idx_terms_is_active ON terms_and_conditions(is_active);
        CREATE INDEX idx_terms_effective_date ON terms_and_conditions(effective_date DESC);

        -- Insert initial terms and conditions
        INSERT INTO terms_and_conditions (version, title, content, effective_date, is_active)
        VALUES (
            '1.0',
            'Términos y Condiciones de Uso',
            '# Términos y Condiciones de Uso

## 1. Aceptación de los Términos

Al acceder y utilizar esta plataforma, usted acepta estar sujeto a estos términos y condiciones de uso.

## 2. Uso de la Plataforma

La plataforma está diseñada para la gestión de productos, órdenes y conexiones de e-commerce. El usuario se compromete a utilizar el servicio de manera responsable y conforme a la ley.

## 3. Cuentas de Usuario

- Los usuarios deben proporcionar información precisa y actualizada al registrarse.
- Cada usuario es responsable de mantener la confidencialidad de su cuenta.
- Los usuarios deben notificar inmediatamente cualquier uso no autorizado de su cuenta.

## 4. Roles y Permisos

La plataforma cuenta con diferentes roles de usuario (Admin, Moderador, Finance, Usuario) cada uno con permisos específicos.

## 5. Privacidad y Protección de Datos

Nos comprometemos a proteger su información personal de acuerdo con las leyes aplicables de protección de datos.

## 6. Propiedad Intelectual

Todo el contenido de la plataforma está protegido por derechos de propiedad intelectual.

## 7. Limitación de Responsabilidad

La plataforma se proporciona "tal cual" sin garantías de ningún tipo. No nos hacemos responsables por daños indirectos o consecuentes.

## 8. Modificaciones

Nos reservamos el derecho de modificar estos términos en cualquier momento. Las modificaciones entrarán en vigor al ser publicadas en la plataforma.

## 9. Contacto

Para cualquier pregunta sobre estos términos, por favor contacte al administrador de la plataforma.',
            NOW(),
            TRUE
        );
    END IF;
END $$;
