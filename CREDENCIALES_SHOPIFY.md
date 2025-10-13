# 🔑 Credenciales Requeridas para Shopify Integration

## ✅ Estado Actual - CONFIGURACIÓN COMPLETA

### Base de Datos
- ✅ **Tabla `shopify_stores` creada correctamente**
- ✅ **Enum `shopify_store_status` creado**
- ✅ **Índices creados para optimización**
- ✅ **Migraciones aplicadas exitosamente**

### Código
- ✅ **Integración completa implementada**
- ✅ **Webhooks configurados (excepto orders/updated que fue deshabilitado)**
- ✅ **Rutas API creadas**
- ✅ **Variables en .env agregadas**

### Credenciales
- ✅ **Client ID configurado**: `ff547460211ab153a0676242040ad6ba`
- ✅ **Client Secret configurado**: `cf017a5e431ea0195240114f6f185106`
- ✅ **App URL configurada**: `https://ecomlatam-production.up.railway.app`
- ✅ **Embed app deshabilitado** en Shopify Partners

## 🎯 Próximos Pasos (Railway)

Ahora solo falta configurar las mismas credenciales en Railway. Sigue las instrucciones en **RAILWAY_SETUP.md**.

### Resumen de Variables para Railway

Agrega estas variables en Railway Dashboard:

```env
SHOPIFY_API_KEY=ff547460211ab153a0676242040ad6ba
SHOPIFY_API_SECRET=cf017a5e431ea0195240114f6f185106
SHOPIFY_APP_URL=https://ecomlatam-production.up.railway.app
SHOPIFY_SCOPES=read_assigned_fulfillment_orders,read_orders,read_products,write_assigned_fulfillment_orders,write_fulfillments,write_products
```

## 📚 Documentación Original (Referencia)

### 1. SHOPIFY_API_KEY (✅ CONFIGURADA)

**¿Qué es?**
Es la clave API pública de tu aplicación de Shopify. Identifica tu app ante Shopify.

**¿Dónde obtenerla?**
1. Ve a [Shopify Partners](https://partners.shopify.com/)
2. Inicia sesión o crea una cuenta de Partners
3. Ve a "Apps" → "Create app"
4. Selecciona "Public app" o "Custom app"
5. Completa la información básica:
   - **App name:** EcomLatam Dropshipping
   - **App URL:** `http://localhost:5000` (desarrollo) o `https://tu-dominio.com` (producción)
   - **Allowed redirection URL(s):** `http://localhost:5000/api/shopify/callback` (desarrollo) o `https://tu-dominio.com/api/shopify/callback` (producción)
6. Una vez creada la app, encontrarás el **API key** en la sección "App credentials"

**Formato:**
```
SHOPIFY_API_KEY=abcd1234efgh5678ijkl9012mnop3456
```

### 2. SHOPIFY_API_SECRET (Requerida)

**¿Qué es?**
Es la clave secreta de tu aplicación. Se usa para firmar requests y verificar webhooks.

**¿Dónde obtenerla?**
1. En la misma página de "App credentials" donde obtuviste el API key
2. Busca "API secret key"
3. Haz click en "Show" para revelar la clave

**⚠️ IMPORTANTE:**
- **NUNCA** compartas esta clave
- **NO** la commits en Git
- Guárdala en un lugar seguro (password manager)

**Formato:**
```
SHOPIFY_API_SECRET=1234567890abcdefghijklmnopqrstuvwxyz12345678901234567890abcd
```

## 📋 Checklist de Configuración

### Paso 1: Crear App en Shopify Partners
- [ ] Crear cuenta en [Shopify Partners](https://partners.shopify.com/)
- [ ] Crear nueva app
- [ ] Configurar App URL y Redirect URL
- [ ] Copiar API Key
- [ ] Copiar API Secret

### Paso 2: Configurar Scopes (Permisos)
En la configuración de tu app, asegúrate de solicitar estos scopes:

- [ ] `read_products` - Leer productos
- [ ] `write_products` - Crear/editar productos
- [ ] `read_orders` - Leer órdenes
- [ ] `write_orders` - Modificar órdenes
- [ ] `read_fulfillments` - Leer fulfillments
- [ ] `write_fulfillments` - Crear fulfillments

Estos scopes ya están configurados en `.env`:
```
SHOPIFY_SCOPES=read_products,write_products,read_orders,write_orders,read_fulfillments,write_fulfillments
```

### Paso 3: Actualizar .env
Una vez obtengas las credenciales, actualiza tu archivo `.env`:

```env
# Shopify Integration
SHOPIFY_API_KEY=tu-api-key-aqui          # ← Reemplazar con tu API Key
SHOPIFY_API_SECRET=tu-api-secret-aqui    # ← Reemplazar con tu API Secret
SHOPIFY_APP_URL=http://localhost:5000    # ← Cambiar a tu dominio en producción
SHOPIFY_SCOPES=read_products,write_products,read_orders,write_orders,read_fulfillments,write_fulfillments
```

### Paso 4: Configurar Webhooks (Automático)
Los webhooks se registran automáticamente cuando conectas una tienda, pero debes asegurarte de que tu app pueda recibirlos:

**Para desarrollo local:**
Necesitarás exponer tu localhost usando una herramienta como:
- [ngrok](https://ngrok.com/)
- [localtunnel](https://localtunnel.github.io/www/)
- [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/tunnel-guide/)

Ejemplo con ngrok:
```bash
ngrok http 5000
```

Luego actualiza `SHOPIFY_APP_URL` con la URL de ngrok:
```env
SHOPIFY_APP_URL=https://abc123.ngrok.io
```

**Para producción:**
Usa tu dominio real:
```env
SHOPIFY_APP_URL=https://ecomlatam.com
```

### Paso 5: Verificar Configuración
Puedes verificar si la configuración está correcta visitando:
```
http://localhost:5000/api/shopify/config
```

Respuesta esperada:
```json
{
  "configured": true,
  "errors": []
}
```

Si `configured: false`, revisa los errores en el array `errors`.

## 🧪 Testing

### 1. Conectar una Tienda de Desarrollo
Shopify ofrece tiendas de desarrollo gratuitas para testing:

1. En Shopify Partners, ve a "Stores" → "Add store"
2. Selecciona "Development store"
3. Completa la información y crea la tienda
4. Una vez creada, tendrás un dominio como `mi-tienda-dev.myshopify.com`

### 2. Instalar tu App
1. Ve a: `http://localhost:5000/api/shopify/install?shop=mi-tienda-dev.myshopify.com`
2. Serás redirigido a Shopify para autorizar la app
3. Después de autorizar, volverás a EcomLatam
4. La tienda quedará conectada

### 3. Probar Webhooks
1. Crea una orden en tu tienda de desarrollo
2. Verifica en los logs de EcomLatam que el webhook fue recibido
3. Verifica que la orden se importó a EcomLatam como lead

## 📞 URLs Importantes

- **Shopify Partners Dashboard:** https://partners.shopify.com/
- **Documentación API Shopify:** https://shopify.dev/docs/api
- **Documentación OAuth:** https://shopify.dev/docs/apps/auth/oauth
- **Documentación Webhooks:** https://shopify.dev/docs/apps/webhooks

## 🔒 Seguridad

### Variables que NUNCA deben compartirse:
1. `SHOPIFY_API_SECRET` - Secreto de la app
2. `access_token` (almacenado en DB) - Token de acceso de cada tienda

### Buenas prácticas:
- ✅ Usa variables de entorno para credenciales
- ✅ Nunca hagas commit de `.env` en Git
- ✅ Usa `.env.example` como plantilla
- ✅ Rota las credenciales periódicamente
- ✅ Usa HTTPS en producción

## 📝 Notas Adicionales

### Webhooks Activos
- ✅ `orders/create` - Importa nuevas órdenes automáticamente
- ❌ `orders/updated` - DESHABILITADO (previene conflictos con cambios del afiliado)
- ✅ `orders/cancelled` - Marca órdenes como canceladas
- ✅ `app/uninstalled` - Desactiva tienda desinstalada

### Configuración Actual en .env
```bash
# Variables ya configuradas:
SHOPIFY_APP_URL=http://localhost:5000
SHOPIFY_SCOPES=read_products,write_products,read_orders,write_orders,read_fulfillments,write_fulfillments

# Variables que necesitas agregar:
# SHOPIFY_API_KEY=tu-api-key-aqui
# SHOPIFY_API_SECRET=tu-api-secret-aqui
```

## ✅ Resumen

**Completado:**
- ✅ Código implementado
- ✅ Base de datos migrada
- ✅ Variables de entorno agregadas
- ✅ Documentación creada

**Pendiente (requiere acción tuya):**
1. Crear app en Shopify Partners
2. Obtener API Key y API Secret
3. Actualizar .env con las credenciales
4. (Opcional para desarrollo) Configurar ngrok u otra herramienta de tunneling
5. Probar la integración con una tienda de desarrollo

Una vez completes estos pasos, la integración estará 100% funcional! 🚀
