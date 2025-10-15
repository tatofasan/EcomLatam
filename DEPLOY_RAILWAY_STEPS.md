# 🚀 Deploy a Railway - Pasos Rápidos

## ⚡ Quick Start

### 1️⃣ Aplicar Migración de Base de Datos (PRIMERO)

**Opción A: Con Railway CLI**
```bash
# Instalar CLI
npm i -g @railway/cli

# Login
railway login

# Conectar al proyecto
railway link

# Ejecutar migración
railway run node apply-commission-to-payout-migration.mjs
```

**Opción B: SQL Manual en Railway Dashboard**
1. Ir a Railway > Postgres > Data > Query
2. Copiar contenido de `migrations/commission-to-payout.sql`
3. Pegar y ejecutar

---

### 2️⃣ Deploy del Código

```bash
# Commit todos los cambios
git add .
git commit -m "feat: Add SKU copy button, show payout in USD, rename commission to payout"

# Push a main
git push origin main
```

Railway detectará el push y hará **auto-deploy**.

---

### 3️⃣ Verificar Deploy

1. **Dashboard**: https://ecomlatam-production.up.railway.app/
   - ✅ Debería mostrar "Payout" en lugar de "Commission"

2. **Productos**: https://ecomlatam-production.up.railway.app/products
   - ✅ Icono para copiar SKU al lado del SKU
   - ✅ "Payout: $XX.XX USD" debajo del precio

3. **Órdenes**: https://ecomlatam-production.up.railway.app/orders
   - ✅ Detalle muestra "Payout: $XX.XX"

---

## 📋 Cambios en esta Actualización

### Nuevas Funcionalidades
1. **Icono para copiar SKU** en las cards de productos (ambas vistas)
2. **Payout en USD** mostrado en las cards de productos
3. **Precio en ARS** (pesos argentinos) diferenciado del payout

### Terminología Actualizada
- ❌ "Commission" → ✅ "Payout"
- Todos los campos de base de datos renombrados
- Toda la UI actualizada
- APIs actualizadas

---

## 🔍 Verificación Post-Deploy

Ejecuta estos comandos para verificar:

```bash
# 1. Ver logs del deploy
railway logs

# 2. Ver variables de entorno (confirmar DATABASE_URL)
railway variables

# 3. Verificar que el servicio está corriendo
curl https://ecomlatam-production.up.railway.app/api/shopify/config
```

---

## 🆘 Si algo sale mal

### Rollback de código
```bash
git revert HEAD
git push origin main
```

### Rollback de base de datos
Ver instrucciones en: `RAILWAY_MIGRATION_COMMISSION_TO_PAYOUT.md`

---

## 📚 Documentación Completa

- **Migración detallada**: `RAILWAY_MIGRATION_COMMISSION_TO_PAYOUT.md`
- **Setup de Railway**: `RAILWAY_SETUP.md`
- **Deploy general**: `RAILWAY_DEPLOY.md`

---

## ✅ Checklist Final

- [ ] Migración ejecutada en Railway
- [ ] Código commiteado y pusheado
- [ ] Deploy completado (ver en Railway Dashboard)
- [ ] Dashboard muestra "Payout" ✓
- [ ] Productos muestran icono copiar SKU ✓
- [ ] Productos muestran payout en USD ✓
- [ ] Órdenes muestran "Payout" ✓
- [ ] Sin errores en los logs ✓

---

**Tiempo total estimado: 5-10 minutos** ⏱️
