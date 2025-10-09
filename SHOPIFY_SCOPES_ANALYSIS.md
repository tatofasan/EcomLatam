# Shopify Scopes - Análisis y Decisión de Implementación

## Resumen Ejecutivo

**Decisión:** Migrar a modelo de **Fulfillment Service** con scopes específicos.

**Scopes Actualizados:**
```
read_products, write_products
read_assigned_fulfillment_orders, write_assigned_fulfillment_orders
write_fulfillments
```

## ¿Por qué el Cambio?

### Situación Anterior (read_orders)
- ✅ Acceso a toda la información de órdenes
- ❌ Demasiado amplio (todas las órdenes, no solo las asignadas)
- ❌ Menos específico para un fulfillment service
- ❌ Requiere justificación más amplia a Shopify

### Situación Nueva (read_assigned_fulfillment_orders)
- ✅ **Más específico**: Solo órdenes asignadas a tu servicio
- ✅ **Mejor privacidad**: Principio de mínimo privilegio
- ✅ **Más fácil aprobación**: Rol claro como fulfillment service
- ✅ **Mismo acceso a datos**: Incluye shipping address, name, phone, email
- ✅ **Arquitectura correcta**: Diseñado específicamente para fulfillment services

## Datos Protegidos en Shopify

### Nivel 1: Protected Customer Data
Incluye cualquier dato relacionado con un cliente:
- Total de orden
- Line items
- Eventos de envío
- Historial de compras

**Requisitos:** 9 requerimientos básicos de seguridad y privacidad

### Nivel 2: Protected Customer Fields
Campos específicos que requieren **requisitos adicionales**:

#### Campos Protegidos:
1. **Nombre**
   - first_name
   - last_name

2. **Dirección**
   - address1
   - address2
   - city
   - zip
   - province

3. **Contacto**
   - email
   - phone

**Requisitos:** Los 9 del Nivel 1 + 6 adicionales (15 total)

### Requisitos de Nivel 1 (9)
1. Procesar mínimo de datos personales requeridos
2. Informar a merchants sobre procesamiento de datos
3. Limitar procesamiento a propósitos declarados
4. Respetar consentimiento del cliente
5. Hacer acuerdos de privacidad
6. Aplicar períodos de retención de datos
7. Encriptar datos en tránsito
8. Encriptar datos en reposo
9. Implementar controles de acceso

### Requisitos de Nivel 2 (6 adicionales)
1. Encriptar backups de datos
2. Separar datos de test y producción
3. Implementar estrategia de prevención de pérdida de datos
4. Limitar acceso del staff a datos
5. Requerir contraseñas fuertes para el staff
6. Mantener logs de acceso
7. Crear política de respuesta a incidentes de seguridad

## ⚠️ Realidad Importante

**NO hay forma de evitar los requisitos de Protected Customer Data** si necesitas:
- Nombre del cliente
- Dirección de envío
- Teléfono
- Email

Estos campos están protegidos **independientemente del scope** que uses.

## Comparación de Scopes

### Opción 1: read_orders (Anterior)
```
✅ Acceso a: shipping_address, billing_address, customer info
✅ Solo en contexto de órdenes
✅ API establecida y documentada
❌ Demasiado amplio (todas las órdenes)
❌ Requiere: Protected Customer Data Level 1 + Level 2
❌ Más difícil de justificar a Shopify
```

### Opción 2: read_assigned_fulfillment_orders (ELEGIDA)
```
✅ Acceso a: destination address, customer name, phone, email
✅ Solo órdenes asignadas a tu fulfillment service
✅ Más específico y limitado (mejor para privacidad)
✅ Más fácil de justificar (eres un fulfillment service)
✅ Principio de mínimo privilegio
❌ Requiere: Protected Customer Data Level 1 + Level 2
❌ Requiere registrarse como Fulfillment Service
```

### Opción 3: read_customers (NO RECOMENDADO)
```
❌ Acceso a: Base de datos COMPLETA de clientes
❌ Excesivo para el caso de uso
❌ Requiere: Protected Customer Data Level 1 + Level 2
❌ Muy difícil de justificar a Shopify
❌ No se recomienda para fulfillment
```

## Arquitectura de Fulfillment Service

### Flujo de Trabajo

1. **Merchant instala la app**
   - Autoriza scopes necesarios
   - Asigna EcomLatam como fulfillment service a una location

2. **Nueva orden creada en Shopify**
   - Shopify asigna la orden a la location de EcomLatam
   - Webhook `orders/create` notifica a EcomLatam
   - EcomLatam obtiene `fulfillment_orders` de esa orden

3. **EcomLatam procesa la orden**
   - Lee datos del cliente desde `fulfillment_order.destination`
   - Asigna a afiliado
   - Prepara fulfillment

4. **Afiliado completa fulfillment**
   - EcomLatam marca fulfillment como completo en Shopify
   - Agrega tracking info (opcional)
   - Notifica al cliente (opcional)

### Endpoints Disponibles

#### FulfillmentOrder API (Nueva)
- `GET /assigned_fulfillment_orders` - Ver órdenes asignadas
- `GET /orders/:id/fulfillment_orders` - Ver fulfillment orders de una orden
- `GET /fulfillment_orders/:id` - Ver un fulfillment order específico
- `POST /fulfillments` - Crear fulfillment

#### Order API (Legacy, aún disponible)
- `GET /orders` - Ver todas las órdenes
- `GET /orders/:id` - Ver orden específica

## Cambios Implementados

### 1. Configuración (✅ Completado)
- **.env.example** - Nuevos scopes configurados
- **config.ts** - REQUIRED_SCOPES actualizado

### 2. Tipos TypeScript (✅ Completado)
- **types.ts** - Agregados interfaces para:
  - `ShopifyFulfillmentOrder`
  - `ShopifyFulfillmentDestination`
  - `ShopifyFulfillmentOrderLineItem`
  - `ShopifyAssignedFulfillmentOrder`

### 3. API Client (✅ Completado)
- **api.ts** - Nuevas funciones:
  - `getAssignedFulfillmentOrders()`
  - `getOrderFulfillmentOrders()`
  - `getFulfillmentOrder()`
  - `createFulfillmentForOrder()`

### 4. Lógica de Órdenes (✅ Completado)
- **orders.ts** - Nuevas funciones:
  - `convertFulfillmentOrderToEcomLatamLead()`
  - `importAssignedFulfillmentOrders()`

### 5. Routes (✅ Completado)
- **routes-shopify.ts** - Nuevo endpoint:
  - `POST /api/shopify/fulfillment-orders/import` (Recomendado)
  - `POST /api/shopify/orders/import` (Legacy, aún funciona)

### 6. Webhooks (✅ Compatible)
- Los webhooks `orders/create` y `orders/cancelled` siguen funcionando
- El flujo ahora obtiene `fulfillment_orders` de la orden recibida

## Pasos para Implementar en Producción

### 1. En Shopify Partners Dashboard

1. **Actualizar App Configuration**
   - Ir a https://partners.shopify.com/
   - Seleccionar tu app
   - Ir a "Configuration" > "API access"

2. **Cambiar Scopes**
   - Remover:
     - `read_orders`
     - `write_orders`
   - Agregar:
     - `read_assigned_fulfillment_orders`
     - `write_assigned_fulfillment_orders`

3. **Configurar Protected Customer Data**
   - Ir a "Distribution" > "Protected customer data"
   - Responder el cuestionario:
     - **¿Por qué necesitas acceso?** "Para procesar órdenes como fulfillment service y enviar productos a clientes"
     - **¿Qué campos necesitas?** Name, Address, Phone, Email
     - **¿Cómo proteges los datos?** Describir encriptación, acceso limitado, logs, etc.
   - Proveer evidencia de cumplimiento de los 15 requisitos

4. **Registrar como Fulfillment Service**
   - Seguir guía: https://shopify.dev/docs/apps/build/orders-fulfillment/fulfillment-service-apps
   - La app necesita estar aprobada para esto

### 2. En tu Código

1. **Actualizar .env**
```env
SHOPIFY_SCOPES=read_products,write_products,read_assigned_fulfillment_orders,write_assigned_fulfillment_orders,write_fulfillments
```

2. **Re-instalar app en tiendas de prueba**
   - Las tiendas existentes necesitarán re-autorizar con los nuevos scopes
   - Usar el flujo OAuth nuevamente

3. **Configurar Location**
   - Merchant debe asignar EcomLatam como fulfillment service a una location
   - Esto se hace desde Shopify Admin > Settings > Locations

### 3. Testing

1. **Crear orden de prueba**
   - En tienda de desarrollo, crear orden
   - Verificar que llega a `/api/shopify/webhooks/orders-create`

2. **Importar fulfillment orders**
```bash
POST /api/shopify/fulfillment-orders/import
{
  "shop": "tu-tienda.myshopify.com",
  "assignmentStatus": "fulfillment_requested"
}
```

3. **Verificar datos de cliente**
   - Confirmar que `destination` incluye address, name, phone, email
   - Verificar que lead se crea correctamente en EcomLatam

## Ventajas de la Nueva Arquitectura

### Seguridad y Privacidad
✅ Acceso limitado solo a órdenes asignadas
✅ Principio de mínimo privilegio
✅ Más fácil cumplir con GDPR/CCPA
✅ Menos superficie de ataque

### Facilidad de Aprobación
✅ Justificación clara (fulfillment service)
✅ Uso apropiado de scopes
✅ Siguiendo mejores prácticas de Shopify
✅ Más probable aprobación de app pública

### Escalabilidad
✅ Arquitectura correcta desde el inicio
✅ Preparado para Shopify Plus features
✅ Compatible con multi-location
✅ Fácil agregar features de fulfillment

## Documentación de Referencia

- **Shopify Access Scopes:** https://shopify.dev/docs/api/usage/access-scopes
- **Protected Customer Data:** https://shopify.dev/docs/apps/launch/protected-customer-data
- **Fulfillment Service Apps:** https://shopify.dev/docs/apps/build/orders-fulfillment/fulfillment-service-apps
- **FulfillmentOrder API:** https://shopify.dev/docs/api/admin-rest/latest/resources/fulfillmentorder

## Conclusión

La migración a modelo de Fulfillment Service con scopes específicos:

✅ **Mejora la seguridad y privacidad**
✅ **Facilita la aprobación de Shopify**
✅ **Sigue mejores prácticas de la industria**
✅ **Mantiene acceso a todos los datos necesarios**
✅ **Prepara la arquitectura para escalar**

Los requisitos de Protected Customer Data son los mismos en ambos casos, pero la nueva arquitectura es la forma correcta y recomendada por Shopify para fulfillment services.
