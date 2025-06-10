# Script de Prueba de API de Ingesta y Consulta

Este script permite probar las APIs de ingesta de órdenes y consulta de estado de forma externa.

## Características de la API de Ingesta

### Endpoint
```
POST /api/external/orders
```

### Campos Soportados
- **productId** (obligatorio): ID del producto existente
- **quantity** (opcional): Cantidad del producto, por defecto 1 si está vacío
- **salePrice** (opcional): Precio de venta enviado, **se ignora y siempre se usa el precio configurado del producto**
- **customerName** (obligatorio): Nombre del cliente
- **customerPhone** (obligatorio): Teléfono del cliente
- **customerAddress** (opcional): Dirección del cliente
- **postalCode** (opcional): Código postal
- **city** (opcional): Ciudad
- **province** (opcional): Provincia
- **customerEmail** (opcional): Email del cliente
- **notes** (opcional): Notas adicionales

### Reglas de Negocio
1. **Campos obligatorios**: Solo productId, customerName y customerPhone
2. **Quantity por defecto**: Si quantity está vacío, se asume 1
3. **Precio siempre del producto**: Aunque se envíe salePrice, siempre se usa el precio configurado en el producto
4. **Dirección combinada**: Los campos de dirección se combinan automáticamente

## Características de la API de Consulta

### Endpoint
```
GET /api/external/orders/{orderNumber}/status
```

### Respuesta
Devuelve el estado completo de la orden incluyendo items y detalles del cliente.

## Instalación y Uso

### Requisitos
- Node.js instalado
- API Key válida (generar desde la aplicación)

### Obtener API Key
1. Inicia sesión en la aplicación
2. Ve a tu perfil/configuración
3. Haz clic en "Generar API Key"
4. Copia la clave generada

### Ejecutar el Script
```bash
# Formato básico
node test-api.cjs "TU_API_KEY" "BASE_URL"

# Ejemplo para desarrollo local
node test-api.cjs "d29fb280-9cce-4e4a-a751-74ad2..." "http://localhost:5000"

# Ejemplo para producción
node test-api.cjs "tu-api-key" "https://tu-dominio.replit.app"
```

## Casos de Prueba Incluidos

El script ejecuta automáticamente estos casos de prueba:

### Pruebas de Ingesta
1. **Orden completa**: Todos los campos incluidos
2. **Orden mínima**: Solo campos obligatorios
3. **Quantity vacía**: Verifica que se asume 1
4. **Producto inexistente**: Verifica manejo de errores
5. **Campos faltantes**: Verifica validación

### Pruebas de Consulta
1. **Órdenes existentes**: Consulta las órdenes creadas
2. **Orden inexistente**: Verifica error 404

## Ejemplo de Salida

```
🚀 Iniciando pruebas de API
Base URL: http://localhost:5000
API Key: d29fb280...

=== PRUEBA DE INGESTA DE ÓRDENES ===

1. Orden completa con todos los campos
Datos enviados: {
  "productId": 1,
  "quantity": 2,
  "salePrice": 999.99,
  "customerName": "Juan Pérez",
  "customerPhone": "+34612345678",
  "customerAddress": "Calle Mayor 123",
  "postalCode": "28001",
  "city": "Madrid",
  "province": "Madrid",
  "customerEmail": "juan.perez@email.com",
  "notes": "Entrega urgente"
}
Estado: 201
✅ Orden creada: ORD-1749561234567-4

=== PRUEBA DE CONSULTA DE ESTADO ===

1. Consultando orden: ORD-1749561234567-4
Estado: 200
✅ Estado consultado exitosamente

=== RESUMEN ===
✅ Órdenes creadas exitosamente: 3
🎉 Pruebas completadas
```

## Autenticación

El script utiliza el header `X-API-Key` para autenticar las peticiones. Asegúrate de tener una API Key válida antes de ejecutar las pruebas.

## Manejo de Errores

El script maneja automáticamente:
- Errores de conexión
- Errores de validación (400)
- Productos no encontrados (404)
- Errores de autenticación (401/403)
- Errores del servidor (500)

## Formatos de Datos

### Ejemplo de Orden Mínima
```json
{
  "productId": 1,
  "customerName": "María García",
  "customerPhone": "+34687654321"
}
```

### Ejemplo de Orden Completa
```json
{
  "productId": 1,
  "quantity": 2,
  "customerName": "Juan Pérez",
  "customerPhone": "+34612345678",
  "customerAddress": "Calle Mayor 123",
  "postalCode": "28001",
  "city": "Madrid",
  "province": "Madrid",
  "customerEmail": "juan.perez@email.com",
  "notes": "Entrega urgente"
}
```

## Soporte

Para problemas o dudas sobre la API, consulta la documentación de la aplicación o contacta al equipo de desarrollo.