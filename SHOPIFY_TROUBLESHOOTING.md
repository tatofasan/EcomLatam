# 🔍 Troubleshooting: Pedidos de Shopify No Aparecen

## ❓ Problema
Estás creando pedidos manualmente en Shopify pero no aparecen en EcomLatam.

---

## 🧪 Diagnóstico Paso a Paso

### **Paso 1: Verificar que la App está Instalada**

Ejecuta esta query en Railway (o localmente si tienes acceso a la DB):

```sql
SELECT * FROM shopify_stores WHERE status = 'active';
```

**¿Qué esperar?**
- ✅ Debe haber al menos 1 fila con tu tienda
- ✅ `status` debe ser `'active'`
- ✅ `accessToken` no debe ser NULL
- ✅ `shop` debe ser tu tienda (ej: `mi-tienda.myshopify.com`)

**Si no hay filas:**
- La app no está instalada correctamente
- Ve al Paso 6: Reinstalar la App

---

### **Paso 2: Verificar Auto-Import**

Por defecto, el auto-import podría estar **desactivado**. Revisemos el código:

```typescript
// En server/integrations/shopify/webhooks.ts línea 148-152
const settings = store.settings as any;
if (!settings?.autoImportOrders) {
  console.log(`Auto-import disabled for shop: ${shop}`);
  return;
}
```

**Solución temporal:** Activar auto-import manualmente en la DB:

```sql
UPDATE shopify_stores
SET settings = '{"autoImportOrders": true}'::jsonb
WHERE shop = 'tu-tienda.myshopify.com';
```

---

### **Paso 3: Verificar Webhooks Registrados**

Verifica que los webhooks estén registrados en Shopify:

**Opción A: Desde Shopify Admin**
1. Ve a: Settings → Notifications → Webhooks
2. Deberías ver webhooks apuntando a:
   - `https://ecomlatam-production.up.railway.app/api/shopify/webhooks/orders-create`
   - `https://ecomlatam-production.up.railway.app/api/shopify/webhooks/orders-cancelled`
   - `https://ecomlatam-production.up.railway.app/api/shopify/webhooks/app-uninstalled`

**Opción B: Usando la DB**
```sql
SELECT webhook_ids FROM shopify_stores WHERE shop = 'tu-tienda.myshopify.com';
```

**Si no hay webhooks:**
- Ve al Paso 7: Registrar Webhooks Manualmente

---

### **Paso 4: Ver Logs de Railway**

1. Ve a Railway Dashboard → Tu proyecto → Deployments
2. Haz clic en el deployment activo → Logs
3. Crea un nuevo pedido en Shopify
4. **Busca en los logs:**
   - ✅ `POST /api/shopify/webhooks/orders-create`
   - ✅ `Processing order created webhook for shop: ...`
   - ✅ `Successfully imported order`

**Si ves errores 401:**
- El `SHOPIFY_API_SECRET` en Railway es incorrecto
- Ve al Paso 8: Verificar Credenciales

**Si no ves NADA:**
- Los webhooks no están registrados o Shopify no está enviándolos
- Ve al Paso 7

---

### **Paso 5: Verificar Pedidos en la Base de Datos**

```sql
SELECT id, lead_number, customer_name, created_at, utm_source
FROM leads
WHERE utm_source = 'shopify'
ORDER BY created_at DESC
LIMIT 10;
```

**¿Qué esperar?**
- Si hay filas: Los webhooks SÍ funcionan, el problema está en el frontend
- Si NO hay filas: Los webhooks NO están funcionando

---

## 🔧 Soluciones

### **Paso 6: Reinstalar la App (Recomendado)**

1. **Desinstalar:**
   - Shopify Admin → Settings → Apps and sales channels
   - Encuentra "GPloadPackage" → Uninstall

2. **Limpiar DB (opcional):**
   ```sql
   DELETE FROM shopify_stores WHERE shop = 'tu-tienda.myshopify.com';
   ```

3. **Reinstalar:**
   - Ve a: `https://ecomlatam-production.up.railway.app/api/shopify/install?shop=tu-tienda.myshopify.com`
   - Autoriza la app
   - Deberías ser redirigido a `/shopify/orders?installed=true`

4. **Activar auto-import:**
   ```sql
   UPDATE shopify_stores
   SET settings = '{"autoImportOrders": true}'::jsonb
   WHERE shop = 'tu-tienda.myshopify.com';
   ```

5. **Crear pedido de prueba** en Shopify

---

### **Paso 7: Registrar Webhooks Manualmente**

Si reinstalar no funcionó, registra webhooks manualmente vía API.

**Crear script de registro:**

```typescript
// register-webhooks-manual.ts
import { registerWebhooks } from './server/integrations/shopify/webhooks';

const shop = 'tu-tienda.myshopify.com';
const accessToken = 'tu-access-token'; // Obtener de la DB

registerWebhooks(shop, accessToken)
  .then(() => console.log('Webhooks registrados!'))
  .catch(err => console.error('Error:', err));
```

**O usando curl:**

```bash
curl -X POST "https://tu-tienda.myshopify.com/admin/api/2025-10/webhooks.json" \
  -H "X-Shopify-Access-Token: TU_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "topic": "orders/create",
      "address": "https://ecomlatam-production.up.railway.app/api/shopify/webhooks/orders-create",
      "format": "json"
    }
  }'
```

---

### **Paso 8: Verificar Credenciales en Railway**

Asegúrate de que estas variables estén correctas:

```env
SHOPIFY_API_KEY=ff547460211ab153a0676242040ad6ba
SHOPIFY_API_SECRET=cf017a5e431ea0195240114f6f185106
```

**Cómo verificar:**
1. Railway Dashboard → Variables
2. Confirma que ambas coinciden con Shopify Partners
3. Si cambiaste algo, redeploy

---

### **Paso 9: Probar Webhook Manualmente**

Crea un webhook de prueba usando la herramienta de Shopify:

1. **Shopify Admin** → Settings → Notifications → Webhooks
2. Haz clic en un webhook existente
3. Click en "Send test notification"

**Revisa los logs en Railway** para ver si llega.

---

### **Paso 10: Importar Pedidos Manualmente (Workaround)**

Si los webhooks no funcionan, puedes importar pedidos manualmente vía API:

**Endpoint:**
```
POST https://ecomlatam-production.up.railway.app/api/shopify/orders/import
```

**Headers:**
```
Cookie: connect.sid=TU_SESSION_ID
Content-Type: application/json
```

**Body:**
```json
{
  "shop": "tu-tienda.myshopify.com",
  "status": "any",
  "limit": 50
}
```

**Usando curl:**
```bash
curl -X POST "https://ecomlatam-production.up.railway.app/api/shopify/orders/import" \
  -H "Cookie: connect.sid=TU_SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "shop": "tu-tienda.myshopify.com",
    "status": "any",
    "limit": 50
  }'
```

---

## 🐛 Errores Comunes

### Error: "Invalid HMAC signature"
**Causa:** `SHOPIFY_API_SECRET` incorrecto en Railway
**Solución:** Verifica en Shopify Partners → Apps → GPloadPackage → Client secret

### Error: "Shop not found"
**Causa:** La tienda no está en la tabla `shopify_stores`
**Solución:** Reinstala la app (Paso 6)

### Error: "Auto-import disabled"
**Causa:** `settings.autoImportOrders` es `false` o `undefined`
**Solución:** Ejecuta el UPDATE del Paso 2

### Los pedidos llegan pero no los veo en `/shopify/orders`
**Causa:** Filtro de 7 días - pedidos más antiguos no se muestran
**Solución:** Crea un pedido nuevo o cambia el filtro en el código

---

## ✅ Checklist de Verificación

Antes de crear un pedido de prueba, verifica:

- [ ] App instalada en Shopify (ver en Settings → Apps)
- [ ] Fila en `shopify_stores` con `status = 'active'`
- [ ] `autoImportOrders = true` en settings
- [ ] Webhooks registrados (ver en Shopify Admin → Notifications)
- [ ] Credenciales correctas en Railway
- [ ] Logs de Railway están abiertos para monitorear
- [ ] Usuario logueado en EcomLatam

**Ahora crea un pedido de prueba y observa los logs en tiempo real.**

---

## 📞 Comandos Útiles

**Ver pedidos de Shopify en DB:**
```sql
SELECT * FROM leads WHERE utm_source = 'shopify' ORDER BY created_at DESC LIMIT 5;
```

**Ver tiendas conectadas:**
```sql
SELECT id, shop, status, settings, installed_at FROM shopify_stores;
```

**Ver webhooks registrados:**
```sql
SELECT shop, webhook_ids, last_sync_at FROM shopify_stores;
```

**Activar auto-import para todas las tiendas:**
```sql
UPDATE shopify_stores SET settings = '{"autoImportOrders": true}'::jsonb;
```

---

## 🎯 Flujo Esperado (Cuando Funciona)

1. Usuario crea pedido en Shopify Admin
2. Shopify envía webhook a: `/api/shopify/webhooks/orders-create`
3. Backend verifica HMAC
4. Backend busca tienda en `shopify_stores`
5. Backend verifica `settings.autoImportOrders = true`
6. Backend convierte pedido Shopify → Lead de EcomLatam
7. Backend inserta en tabla `leads` con `utm_source = 'shopify'`
8. Frontend (cada 30s) consulta `/api/orders/shopify/recent`
9. Usuario ve el pedido en `/shopify/orders`

**Si algún paso falla, el pedido no aparece.**

---

¡Buena suerte con el troubleshooting! 🚀
