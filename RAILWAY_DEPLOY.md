# 🚂 Deploy a Railway - Guía Paso a Paso

## Paso 1: Crear Proyecto en Railway

1. **Ir a Railway:**
   - https://railway.app/
   - Login con GitHub

2. **Crear Nuevo Proyecto:**
   - Click en "New Project"
   - Seleccionar "Deploy from GitHub repo"
   - Buscar y seleccionar: `tatofasan/EcomLatam`
   - Click en "Deploy Now"

3. **Agregar PostgreSQL:**
   - En el proyecto, click en "+ New"
   - Seleccionar "Database" > "Add PostgreSQL"
   - Railway creará automáticamente la base de datos

## Paso 2: Configurar Variables de Entorno

En el dashboard del proyecto, ir a tu servicio > "Variables" y agregar:

### Variables Requeridas

```env
# Database (Railway lo genera automáticamente al agregar PostgreSQL)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Session
SESSION_SECRET=generate_random_string_here

# Shopify
SHOPIFY_API_KEY=ff547460211ab153a0676242040ad6ba
SHOPIFY_API_SECRET=cf017a5e431ea0195240114f6f185106
SHOPIFY_APP_URL=${{RAILWAY_PUBLIC_DOMAIN}}
SHOPIFY_SCOPES=read_products,write_products,read_assigned_fulfillment_orders,write_assigned_fulfillment_orders,write_fulfillments

# Node
NODE_ENV=production
```

### Variables Opcionales (Email)

```env
# SendGrid (si tienes)
SENDGRID_API_KEY=your_sendgrid_key
FROM_EMAIL=noreply@yourdomain.com

# O SMTP (Gmail, etc)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

### Generar SESSION_SECRET

Ejecuta esto en tu terminal local:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copia el resultado y úsalo como `SESSION_SECRET`.

## Paso 3: Configurar el Dominio

1. **Generar Dominio Público:**
   - Railway te asignará un dominio automáticamente
   - Formato: `tu-proyecto.up.railway.app`
   - Lo verás en "Settings" > "Networking" > "Public Networking"

2. **Copiar URL del Dominio:**
   - Ejemplo: `https://ecomlatam-production.up.railway.app`
   - Esta será tu `SHOPIFY_APP_URL`

## Paso 4: Aplicar Migraciones de Base de Datos

Railway debería ejecutar las migraciones automáticamente. Si no:

1. **Ir a tu servicio > "Settings" > "Deploy"**
2. **Agregar comando de build:**
   ```
   npm run build && npm run db:push
   ```

O ejecutar manualmente desde el CLI de Railway:
```bash
railway run npm run db:push
```

## Paso 5: Verificar el Deploy

1. **Check Logs:**
   - Ir a tu servicio > "Deployments" > Click en el último deploy
   - Ver logs para verificar que no hay errores

2. **Verificar endpoints:**
   - Abrir: `https://TU-DOMINIO.up.railway.app/api/shopify/config`
   - Debería responder con el estado de configuración de Shopify

## Paso 6: Configurar Shopify

1. **Ir a Shopify Partners:**
   - https://partners.shopify.com/
   - Seleccionar tu app

2. **Actualizar URLs:**
   - **App URL:** `https://TU-DOMINIO.up.railway.app`
   - **Redirect URI:** `https://TU-DOMINIO.up.railway.app/api/shopify/callback`

3. **Actualizar Scopes:**
   - Ir a "Configuration" > "API access"
   - Cambiar scopes a:
     ```
     read_products
     write_products
     read_assigned_fulfillment_orders
     write_assigned_fulfillment_orders
     write_fulfillments
     ```

4. **Guardar Cambios**

## Paso 7: Probar la Integración

1. **Instalar App en Tienda de Desarrollo:**
   ```
   https://TU-DOMINIO.up.railway.app/api/shopify/install?shop=tu-tienda.myshopify.com
   ```

2. **Verificar OAuth:**
   - Deberías ser redirigido a Shopify para autorizar
   - Después del OAuth, deberías volver a `/connections?shopify=installed`

3. **Verificar Webhooks:**
   - En Shopify Admin > Settings > Notifications > Webhooks
   - Deberías ver webhooks registrados automáticamente

## Comandos Útiles de Railway CLI (Opcional)

Si instalas Railway CLI (`npm i -g @railway/cli`):

```bash
# Login
railway login

# Link to project
railway link

# Ver logs en tiempo real
railway logs

# Abrir servicio
railway open

# Ejecutar comandos
railway run npm run db:push
railway run npm run db:seed

# Ver variables
railway variables
```

## Troubleshooting

### Error: "Cannot connect to database"
- Verifica que la variable `DATABASE_URL` esté configurada
- Railway la genera automáticamente al agregar PostgreSQL
- Formato: `${{Postgres.DATABASE_URL}}`

### Error: "Port already in use"
- Railway asigna el puerto automáticamente via `$PORT`
- No necesitas configurarlo manualmente

### Error en Shopify OAuth
- Verifica que la `SHOPIFY_APP_URL` coincida con tu dominio de Railway
- Verifica que la Redirect URI esté configurada en Shopify Partners
- Debe terminar en `/api/shopify/callback`

### Migraciones no se ejecutan
- Ejecuta manualmente: `railway run npm run db:push`
- O agrega al build command en Settings

## Costos Estimados

**Railway Hobby Plan:**
- $5 gratis mensuales (suficiente para desarrollo)
- Después: $0.000231/GB-hour (aprox $5-10/mes para prod pequeño)

**PostgreSQL:**
- Incluido en el plan
- 1GB gratis, después $0.02/GB

## Siguientes Pasos

Una vez deployado exitosamente:

1. ✅ Crear usuario admin en la app
2. ✅ Conectar tienda de Shopify
3. ✅ Exportar productos a Shopify
4. ✅ Probar importación de órdenes
5. ✅ Verificar webhooks funcionando

---

**¿Preguntas o problemas?** Revisa los logs en Railway Dashboard.
