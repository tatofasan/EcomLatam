# 🚂 Railway Deployment Configuration

## ✅ Variables de Entorno Requeridas

Para que la aplicación de Shopify funcione correctamente en Railway, debes configurar las siguientes variables de entorno:

### 1. Ir a Railway Dashboard

1. Ve a [Railway Dashboard](https://railway.app/)
2. Selecciona tu proyecto **EcomLatam**
3. Haz clic en el servicio (backend)
4. Ve a la pestaña **Variables**

### 2. Agregar/Actualizar Variables

Agrega o actualiza estas variables exactamente como se muestran:

```env
# Database
DATABASE_URL=postgresql://...  # (Ya debería estar configurada)

# Session
SESSION_SECRET=production-secret-key-change-this-to-something-secure

# Shopify Integration - App: GPloadPackage
SHOPIFY_API_KEY=ff547460211ab153a0676242040ad6ba
SHOPIFY_API_SECRET=cf017a5e431ea0195240114f6f185106
SHOPIFY_APP_URL=https://ecomlatam-production.up.railway.app
SHOPIFY_SCOPES=read_assigned_fulfillment_orders,read_orders,read_products,write_assigned_fulfillment_orders,write_fulfillments,write_products

# Node Environment
NODE_ENV=production
```

### 3. Variables Opcionales (Email)

Si quieres habilitar el envío de emails:

```env
# Opción 1: SendGrid
SENDGRID_API_KEY=tu-sendgrid-api-key
FROM_EMAIL=noreply@tudominio.com

# Opción 2: SMTP (Gmail, Outlook, etc)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-app-password
```

## 🔄 Redeploy

Después de agregar las variables:

1. Haz clic en **Deploy** o espera el autodeploy
2. Revisa los logs para verificar que no haya errores
3. Verifica que el servicio esté corriendo en: `https://ecomlatam-production.up.railway.app`

## 🧪 Verificar Configuración

Una vez deployado, verifica que todo funciona:

### 1. Health Check
```bash
curl https://ecomlatam-production.up.railway.app/api/shopify/config
```

Deberías ver:
```json
{
  "configured": true,
  "errors": []
}
```

### 2. Probar Instalación de App

1. Ve a tu tienda de Shopify
2. Intenta instalar la app desde: `https://ecomlatam-production.up.railway.app/api/shopify/install?shop=tu-tienda.myshopify.com`
3. Autoriza la app
4. Deberías ser redirigido de vuelta a `/connections?shopify=installed`

## 🔧 Troubleshooting

### Error 401 en Webhooks
- **Causa**: Client Secret incorrecto
- **Solución**: Verifica que `SHOPIFY_API_SECRET` sea exactamente: `cf017a5e431ea0195240114f6f185106`

### App No Carga (Cloudflare Error)
- **Causa**: "Embed app" habilitado
- **Solución**: Ya está deshabilitado ✅

### Database Connection Error
- **Causa**: `DATABASE_URL` incorrecta o base de datos inaccesible
- **Solución**: Verifica la variable `DATABASE_URL` en Railway

### 500 Internal Server Error
- **Causa**: Falta alguna variable de entorno
- **Solución**: Revisa los logs en Railway y verifica todas las variables

## 📊 Monitoreo

Puedes ver los logs en tiempo real en Railway:
1. Ve a tu servicio
2. Pestaña **Deployments**
3. Haz clic en el deployment activo
4. Verás los logs en vivo

## 🔒 Seguridad

### ⚠️ IMPORTANTE: Cambiar SESSION_SECRET

El `SESSION_SECRET` actual es un placeholder. Cámbialo por algo seguro:

```bash
# Genera un secret seguro (ejecuta en terminal):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Luego actualiza en Railway:
```env
SESSION_SECRET=[el-valor-generado]
```

### Variables Sensibles

Estas variables NUNCA deben compartirse públicamente:
- ❌ `SHOPIFY_API_SECRET`
- ❌ `SESSION_SECRET`
- ❌ `DATABASE_URL`
- ❌ `SENDGRID_API_KEY` / `SMTP_PASS`

## ✅ Checklist de Deployment

- [x] Variables de entorno configuradas
- [x] Client ID y Secret correctos
- [x] App URL apunta a Railway
- [x] "Embed app" deshabilitado en Shopify
- [ ] SESSION_SECRET cambiado a valor seguro
- [ ] Email configurado (opcional)
- [ ] App instalada en tienda de prueba
- [ ] Webhooks funcionando correctamente

## 📞 Soporte

Si encuentras problemas:
1. Revisa los logs en Railway
2. Verifica que todas las variables estén configuradas
3. Prueba el endpoint `/api/shopify/config`
4. Revisa la configuración en Shopify Partners Dashboard

---

**🚀 Una vez completados estos pasos, tu app de Shopify estará 100% funcional en producción!**
