# 🔄 Railway Migration: Commission → Payout

## 📋 Resumen

Esta migración renombra todos los campos relacionados con "commission" a "payout" en la base de datos de producción en Railway, incluyendo:

- ✅ Columnas de base de datos
- ✅ Tipos enum
- ✅ Valores de datos existentes
- ✅ Código de la aplicación

**⚠️ IMPORTANTE:** Esta migración es segura y NO elimina datos. Solo renombra columnas.

---

## 🚀 Pasos para Aplicar la Migración en Railway

### Opción 1: Usando Railway CLI (Recomendado)

#### 1. Instalar Railway CLI (si no lo tienes)
```bash
npm i -g @railway/cli
```

#### 2. Login y conectar al proyecto
```bash
railway login
railway link
```

Selecciona el proyecto **EcomLatam** cuando se te pregunte.

#### 3. Ejecutar la migración
```bash
railway run node apply-commission-to-payout-migration.mjs
```

#### 4. Verificar que la migración fue exitosa
Deberías ver:
```
✅ Migration completed successfully!

Changes applied:
  ✓ leads.commission → leads.payout
  ✓ performance_reports.commission → performance_reports.payout
  ✓ users.commission_rate → users.payout_rate
  ✓ advertisers.commission_settings → advertisers.payout_settings
  ✓ transactions.type: "commission" → "payout"
  ✓ Created payout_type enum

🎉 Database schema updated successfully!
```

#### 5. Hacer commit y push de los cambios de código
```bash
git add .
git commit -m "feat: Rename commission to payout across application"
git push origin main
```

Railway detectará el push y hará auto-deploy con el nuevo código.

---

### Opción 2: Ejecutar SQL Manualmente en Railway Dashboard

#### 1. Ir a Railway Dashboard
1. Abre https://railway.app/
2. Ve a tu proyecto **EcomLatam**
3. Haz clic en el servicio **Postgres**
4. Ve a la pestaña **Data**

#### 2. Abrir el Query Editor
1. Haz clic en "Query"
2. Copia el contenido del archivo `migrations/commission-to-payout.sql`
3. Pega el SQL en el editor
4. Haz clic en "Run Query"

#### 3. Verificar que la migración fue exitosa
Ejecuta esta query para verificar:
```sql
-- Verificar que las columnas fueron renombradas
SELECT column_name, table_name
FROM information_schema.columns
WHERE column_name LIKE '%payout%'
  AND table_name IN ('leads', 'users', 'advertisers', 'performance_reports');
```

Deberías ver:
```
column_name          | table_name
---------------------|-------------------
payout               | leads
payout               | performance_reports
payout_rate          | users
payout_settings      | advertisers
```

#### 4. Hacer commit y push de los cambios de código
```bash
git add .
git commit -m "feat: Rename commission to payout across application"
git push origin main
```

---

## 🧪 Verificación Post-Migración

Después de aplicar la migración y el deploy:

### 1. Verificar el dashboard
Abre: `https://ecomlatam-production.up.railway.app/`

El dashboard debería mostrar:
- ✅ "Payout" en lugar de "Commission" en las métricas
- ✅ Los valores de payout correctos

### 2. Verificar la lista de órdenes
Abre: `https://ecomlatam-production.up.railway.app/orders`

En el detalle de una orden confirmada (sale), deberías ver:
- ✅ "Payout: $XX.XX" en lugar de "Commission: $XX.XX"

### 3. Verificar las cards de productos
Abre: `https://ecomlatam-production.up.railway.app/products`

En las cards de productos deberías ver:
- ✅ Icono para copiar SKU al lado del SKU
- ✅ "Payout: $XX.XX USD" mostrado debajo del precio

### 4. Verificar los logs de Railway
1. Ve a Railway Dashboard
2. Haz clic en tu servicio (backend)
3. Ve a "Deployments"
4. Haz clic en el último deployment
5. Revisa los logs - no debería haber errores relacionados con "commission"

---

## 🔄 Rollback (Si es necesario)

Si algo sale mal, puedes hacer rollback ejecutando:

```sql
-- ROLLBACK: Rename payout back to commission
ALTER TABLE leads RENAME COLUMN payout TO commission;
ALTER TABLE performance_reports RENAME COLUMN payout TO commission;
ALTER TABLE users RENAME COLUMN payout_rate TO commission_rate;
ALTER TABLE advertisers RENAME COLUMN payout_settings TO commission_settings;

UPDATE transactions SET type = 'commission' WHERE type = 'payout';
```

Luego, haz revert del commit en git:
```bash
git revert HEAD
git push origin main
```

---

## 📝 Cambios Realizados en el Código

### Backend
- ✅ `shared/schema.ts` - Renombrados campos y enums
- ✅ `server/storage.ts` - Actualizadas queries y métodos
- ✅ `server/routes.ts` - Actualizados cálculos y respuestas API
- ✅ `server/integrations/shopify/orders.ts` - Actualizada integración

### Frontend
- ✅ `client/src/types/index.ts` - Agregado campo `payoutPo`
- ✅ `client/src/components/product-card.tsx` - Icono copiar SKU + payout USD
- ✅ `client/src/pages/home-page.tsx` - Dashboard muestra "Payout"
- ✅ `client/src/pages/orders-page.tsx` - Detalle muestra "Payout"

---

## ⏱️ Tiempo Estimado

- **Migración de base de datos:** ~5 segundos
- **Deploy de código en Railway:** ~2-3 minutos
- **Verificación:** ~2 minutos

**Total:** ~5-10 minutos

---

## 🆘 Troubleshooting

### Error: "column leads.commission does not exist"
**Causa:** La aplicación ya fue desplegada pero la migración no se ejecutó.

**Solución:**
1. Ejecuta la migración primero: `railway run node apply-commission-to-payout-migration.mjs`
2. Railway hará auto-redeploy del código

### Error: "column leads.payout does not exist"
**Causa:** El código nuevo está corriendo pero la migración no se aplicó.

**Solución:**
1. Ejecuta la migración: `railway run node apply-commission-to-payout-migration.mjs`
2. Espera a que Railway complete el deploy

### Error en la migración: "relation ... already exists"
**Causa:** La migración ya fue aplicada anteriormente.

**Solución:**
- Esto es normal. La migración ya está completa.
- Solo asegúrate de que el código nuevo esté desplegado.

### Railway no detecta el cambio en git
**Causa:** Railway puede estar en pausa o tener auto-deploy deshabilitado.

**Solución:**
1. Ve a Railway Dashboard
2. Haz clic en tu servicio
3. Ve a "Deployments"
4. Haz clic en "Deploy"

---

## ✅ Checklist de Migración

- [ ] Hacer backup de la base de datos (opcional pero recomendado)
- [ ] Ejecutar migración SQL en Railway
- [ ] Verificar que las columnas fueron renombradas
- [ ] Commit y push de los cambios de código
- [ ] Esperar a que Railway complete el deploy
- [ ] Verificar dashboard (muestra "Payout")
- [ ] Verificar lista de órdenes (muestra "Payout")
- [ ] Verificar cards de productos (icono copiar SKU + payout USD)
- [ ] Revisar logs de Railway (sin errores)

---

## 📞 Soporte

Si encuentras problemas:
1. Revisa los logs en Railway Dashboard
2. Verifica que la migración se ejecutó completamente
3. Asegúrate de que el código nuevo esté desplegado
4. Si es necesario, haz rollback y contacta al equipo de desarrollo

---

**🎉 ¡Una vez completado, tu aplicación estará usando la terminología "Payout" en lugar de "Commission"!**
