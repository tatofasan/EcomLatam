# 🔧 Actualizar App URL en Shopify Partners

## ✅ Cambios Realizados

Se ha creado una **página especial de landing** para la app de Shopify que muestra **solo los pedidos ingresados desde Shopify en los últimos 7 días**.

### Características de la Nueva Página:
- ✅ **Vista exclusiva de pedidos de Shopify** (últimos 7 días)
- ✅ **Actualización automática** cada 30 segundos
- ✅ **Tarjetas de estadísticas**: Total pedidos, Ventas confirmadas, Valor total
- ✅ **Tabla detallada** con información completa de cada pedido
- ✅ **Notificación de instalación exitosa**
- ✅ **URL**: `/shopify/orders`

---

## 🎯 Configuración Requerida en Shopify Partners

Debes actualizar la **App URL** para que apunte a la nueva landing page.

### Paso 1: Ir a Shopify Partners Dashboard

1. Ve a [Shopify Partners Dashboard](https://partners.shopify.com/)
2. Haz clic en **Apps** → **GPloadPackage**
3. Ve a la sección **Configuration** (o **App Setup**)

### Paso 2: Actualizar App URL

Encuentra el campo **App URL** y cámbialo de:

❌ **Antes:**
```
https://ecomlatam-production.up.railway.app/
```

✅ **Ahora:**
```
https://ecomlatam-production.up.railway.app/shopify/orders
```

### Paso 3: Guardar Cambios

1. Haz clic en **Save** o **Guardar**
2. Verifica que los cambios se guardaron correctamente

---

## 🔄 ¿Qué Sucede Ahora?

### Para Nuevas Instalaciones:
1. Usuario instala la app desde Shopify Admin
2. Shopify redirige al callback de OAuth
3. **Automáticamente se redirige a** `/shopify/orders`
4. Usuario ve la página con pedidos de los últimos 7 días

### Para Instalaciones Existentes:
1. Si el usuario ya tiene la app instalada
2. Al hacer clic en la app desde Shopify Admin
3. Se abrirá directamente en `/shopify/orders`
4. Verá todos los pedidos de Shopify de los últimos 7 días

---

## 🧪 Probar la Configuración

### Opción 1: Nueva Instalación (Recomendado)

1. **Desinstala** la app de tu tienda de prueba:
   - Shopify Admin → Settings → Apps and sales channels
   - Encuentra GPloadPackage → Uninstall

2. **Reinstala** la app:
   - Ve a: `https://ecomlatam-production.up.railway.app/api/shopify/install?shop=TU-TIENDA.myshopify.com`
   - Autoriza la app
   - Deberías ser redirigido a `/shopify/orders?installed=true`
   - Verás una notificación verde de éxito

### Opción 2: Acceso Directo (Sin Reinstalar)

Si ya tienes la app instalada:
1. Ve directamente a: `https://ecomlatam-production.up.railway.app/shopify/orders`
2. Inicia sesión si es necesario
3. Verás la página de pedidos de Shopify

---

## 📊 Funcionalidades de la Página

### Métricas en Tiempo Real:
- **Total Pedidos**: Cantidad de pedidos de Shopify en últimos 7 días
- **Ventas Confirmadas**: Pedidos con status "sale"
- **Valor Total**: Suma de todos los pedidos

### Tabla de Pedidos:
Cada pedido muestra:
- **Número de pedido** (nombre de Shopify)
- **Tienda de origen**
- **Datos del cliente** (nombre, email, ciudad)
- **Productos** (hasta 2 visibles, con contador si hay más)
- **Estado** (con badge de color)
- **Valor total**
- **Fecha y hora** de creación

### Actualización Automática:
- Los datos se actualizan **cada 30 segundos** automáticamente
- No es necesario refrescar la página manualmente

---

## 🔍 Identificación de Pedidos de Shopify

Los pedidos se filtran por:
1. **leadNumber** empieza con `"SHOPIFY-"`
2. **utmSource** igual a `"shopify"`
3. **createdAt** dentro de los últimos 7 días
4. **userId** igual al usuario autenticado

---

## ⚙️ Configuración Técnica (Ya Implementada)

### Backend:
- ✅ Endpoint: `GET /api/orders/shopify/recent`
- ✅ Filtrado automático por fecha y fuente
- ✅ Incluye items de cada pedido
- ✅ Mapeo de campos para compatibilidad

### Frontend:
- ✅ Ruta: `/shopify/orders`
- ✅ Componente: `ShopifyOrdersPage`
- ✅ Auto-refresh cada 30 segundos
- ✅ Estados de carga, error y vacío

### Redirect:
- ✅ OAuth callback redirige a `/shopify/orders?installed=true`
- ✅ Notificación de instalación exitosa (auto-hide 5s)

---

## 🚨 Troubleshooting

### La app sigue abriendo en la página anterior
- **Causa**: Cache del navegador o sesión activa
- **Solución**: Cierra sesión y vuelve a iniciar, o abre en ventana incógnita

### No veo pedidos aunque sé que hay
- **Causa**: Los pedidos tienen más de 7 días
- **Solución**: El filtro es de 7 días, crea un nuevo pedido de prueba

### Error 401 al cargar pedidos
- **Causa**: No estás autenticado
- **Solución**: Inicia sesión en EcomLatam primero

### La página carga pero está vacía
- **Causa**: No hay pedidos de Shopify en los últimos 7 días
- **Solución**: Crea un pedido de prueba en tu tienda de Shopify

---

## ✅ Checklist Final

- [ ] **App URL actualizada** en Shopify Partners a `/shopify/orders`
- [ ] **Embed app deshabilitado** (should be `false`)
- [ ] **Credenciales correctas** en Railway
- [ ] **App reinstalada** en tienda de prueba
- [ ] **Redirect funciona** (va a `/shopify/orders`)
- [ ] **Página carga correctamente**
- [ ] **Pedidos se muestran** (si existen en últimos 7 días)
- [ ] **Auto-refresh funciona** (espera 30s y verifica)

---

## 📞 Soporte

Si encuentras problemas:
1. Verifica logs en Railway
2. Revisa la consola del navegador (F12)
3. Confirma que la App URL esté actualizada en Shopify
4. Prueba en ventana incógnita para evitar cache

---

**🚀 ¡Una vez actualices la App URL, tu landing page de Shopify estará lista!**
