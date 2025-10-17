# Sistema de Payout Exceptions - Plan de Implementación Completo

## 📋 Resumen Ejecutivo

### ¿Qué es este sistema?
Un sistema de gestión de comisiones personalizado que permite configurar payouts específicos para:
- **Publishers individuales** dentro de un afiliado (prioridad ALTA)
- **Afiliados completos** (prioridad MEDIA)
- **Producto por defecto** (prioridad BAJA)

### Objetivo
Implementar un sistema jerárquico de payouts que se integre automáticamente con:
- ✅ Sistema de leads/órdenes
- ✅ Sistema de postbacks
- ✅ Sistema de transacciones
- ✅ Dashboard de productos

---

## 🏗️ Arquitectura del Sistema

### Jerarquía de Payouts (3 niveles)

```
┌─────────────────────────────────────────────┐
│  1. Publisher Específico (PRIORIDAD ALTA)   │
│  ────────────────────────────────────────── │
│  userId=3, productId=1, publisherId="pub123"│
│  → $35 por venta                            │
└─────────────────────────────────────────────┘
                    ↓ Si no existe
┌─────────────────────────────────────────────┐
│  2. Nivel Afiliado (PRIORIDAD MEDIA)        │
│  ────────────────────────────────────────── │
│  userId=3, productId=1, publisherId=NULL    │
│  → $30 por venta (todos sus publishers)    │
└─────────────────────────────────────────────┘
                    ↓ Si no existe
┌─────────────────────────────────────────────┐
│  3. Default del Producto (PRIORIDAD BAJA)   │
│  ────────────────────────────────────────── │
│  product.payoutPo = $25                     │
│  → Todos los demás casos                   │
└─────────────────────────────────────────────┘
```

### Flujo de Datos

```
Lead creado/actualizado
    ↓
¿Estado = "sale"?
    ↓ SÍ
Calcular payout (calculatePayoutAmount)
    ↓
1. Buscar excepción publisher específico
    ↓ No encontrado
2. Buscar excepción nivel afiliado
    ↓ No encontrado
3. Usar payout default del producto
    ↓
Crear transacción de payout
    ↓
Enviar postback con {payout} correcto
```

---

## 📁 Archivos a Crear/Modificar

### Archivos NUEVOS
- ✨ `client/src/components/payout-exceptions-dialog.tsx` - UI de gestión de excepciones

### Archivos a MODIFICAR
- 🔧 `shared/schema.ts` - Agregar tabla payoutExceptions
- 🔧 `server/storage.ts` - Agregar métodos CRUD y calculatePayoutAmount
- 🔧 `server/routes.ts` - Agregar 5 endpoints nuevos
- 🔧 `server/postback.ts` - Integrar cálculo jerárquico
- 🔧 `client/src/components/product-detail-dialog.tsx` - Agregar botón

---

## 🗄️ PASO 1: Base de Datos (Schema)

### 1.1 Nueva Tabla en `shared/schema.ts`

```typescript
// Payout Exceptions Schema - for hierarchical payout configuration
export const payoutExceptions = pgTable("payout_exceptions", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  publisherId: text("publisher_id"), // NULL = aplica a todo el afiliado
  payoutAmount: doublePrecision("payout_amount").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### 1.2 Schema de Validación (Zod)

```typescript
export const insertPayoutExceptionSchema = createInsertSchema(payoutExceptions, {
  payoutAmount: z.number().min(0, "El payout debe ser mayor o igual a 0"),
  publisherId: z.string().optional().nullable()
}).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertPayoutException = z.infer<typeof insertPayoutExceptionSchema>;
export type PayoutException = typeof payoutExceptions.$inferSelect;
```

### 1.3 Relaciones

```typescript
export const payoutExceptionsRelations = relations(payoutExceptions, ({ one }) => ({
  product: one(products, {
    fields: [payoutExceptions.productId],
    references: [products.id],
  }),
  user: one(users, {
    fields: [payoutExceptions.userId],
    references: [users.id],
  }),
}));
```

**✅ CHECKPOINT 1**: Migración de base de datos
```bash
npm run db:generate
npm run db:migrate
```

---

## 💾 PASO 2: Storage Layer (CRUD)

### 2.1 Actualizar Interface IStorage en `server/storage.ts`

```typescript
export interface IStorage {
  // ... métodos existentes ...

  // Payout Exception methods
  getPayoutExceptions(productId?: number, userId?: number): Promise<PayoutException[]>;
  createPayoutException(exception: InsertPayoutException): Promise<PayoutException>;
  updatePayoutException(id: number, exception: Partial<InsertPayoutException>): Promise<PayoutException | undefined>;
  deletePayoutException(id: number): Promise<boolean>;
  calculatePayoutAmount(productId: number, userId: number, publisherId?: string): Promise<number>;
}
```

### 2.2 Implementar Métodos en DatabaseStorage

#### 2.2.1 GET Exceptions (con filtros opcionales)

```typescript
async getPayoutExceptions(productId?: number, userId?: number): Promise<PayoutException[]> {
  let query = db.select().from(payoutExceptions);

  if (productId && userId) {
    query = query.where(and(
      eq(payoutExceptions.productId, productId),
      eq(payoutExceptions.userId, userId)
    ));
  } else if (productId) {
    query = query.where(eq(payoutExceptions.productId, productId));
  } else if (userId) {
    query = query.where(eq(payoutExceptions.userId, userId));
  }

  return await query.orderBy(desc(payoutExceptions.createdAt));
}
```

#### 2.2.2 CREATE Exception

```typescript
async createPayoutException(exception: InsertPayoutException): Promise<PayoutException> {
  const [newException] = await db
    .insert(payoutExceptions)
    .values(exception)
    .returning();
  return newException;
}
```

#### 2.2.3 UPDATE Exception

```typescript
async updatePayoutException(
  id: number,
  exception: Partial<InsertPayoutException>
): Promise<PayoutException | undefined> {
  const [updated] = await db
    .update(payoutExceptions)
    .set({ ...exception, updatedAt: new Date() })
    .where(eq(payoutExceptions.id, id))
    .returning();
  return updated;
}
```

#### 2.2.4 DELETE Exception

```typescript
async deletePayoutException(id: number): Promise<boolean> {
  const result = await db
    .delete(payoutExceptions)
    .where(eq(payoutExceptions.id, id));
  return result.rowCount > 0;
}
```

#### 2.2.5 ⭐ CALCULATE Payout (Lógica Jerárquica) - CRÍTICO

```typescript
async calculatePayoutAmount(
  productId: number,
  userId: number,
  publisherId?: string
): Promise<number> {
  // 1. Verificar excepción específica de publisher (prioridad MÁS ALTA)
  if (publisherId) {
    const publisherException = await db
      .select()
      .from(payoutExceptions)
      .where(and(
        eq(payoutExceptions.productId, productId),
        eq(payoutExceptions.userId, userId),
        eq(payoutExceptions.publisherId, publisherId)
      ))
      .limit(1);

    if (publisherException.length > 0) {
      console.log(`[Payout] Using publisher-specific exception: $${publisherException[0].payoutAmount}`);
      return publisherException[0].payoutAmount;
    }
  }

  // 2. Verificar excepción a nivel de afiliado (prioridad MEDIA)
  const affiliateException = await db
    .select()
    .from(payoutExceptions)
    .where(and(
      eq(payoutExceptions.productId, productId),
      eq(payoutExceptions.userId, userId),
      sql`${payoutExceptions.publisherId} IS NULL`
    ))
    .limit(1);

  if (affiliateException.length > 0) {
    console.log(`[Payout] Using affiliate-level exception: $${affiliateException[0].payoutAmount}`);
    return affiliateException[0].payoutAmount;
  }

  // 3. Usar payout por defecto del producto (prioridad MÁS BAJA)
  const product = await this.getProduct(productId);
  const defaultPayout = product?.payoutPo || 0;
  console.log(`[Payout] Using default product payout: $${defaultPayout}`);
  return defaultPayout;
}
```

**✅ CHECKPOINT 2**: Métodos de storage implementados y testeados

---

## 🌐 PASO 3: API Routes (5 Endpoints)

### 3.1 GET /api/payout-exceptions

```typescript
app.get("/api/payout-exceptions", requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const productId = req.query.productId ? Number(req.query.productId) : undefined;
    const userId = req.query.userId ? Number(req.query.userId) : undefined;

    // Affiliates can only see their own exceptions
    const finalUserId = req.user.role === 'affiliate' ? req.user.id : userId;

    const exceptions = await storage.getPayoutExceptions(productId, finalUserId);
    res.json(exceptions);
  } catch (error) {
    console.error("Error fetching payout exceptions:", error);
    res.status(500).json({ message: "Failed to fetch payout exceptions" });
  }
});
```

### 3.2 POST /api/payout-exceptions (Admin/Moderator only)

```typescript
app.post("/api/payout-exceptions", requireModerator, async (req, res) => {
  try {
    const parseResult = insertPayoutExceptionSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        message: "Invalid data",
        errors: parseResult.error.format()
      });
    }

    const exception = await storage.createPayoutException(parseResult.data);
    res.status(201).json(exception);
  } catch (error) {
    console.error("Error creating payout exception:", error);
    res.status(500).json({ message: "Failed to create payout exception" });
  }
});
```

### 3.3 PUT /api/payout-exceptions/:id (Admin/Moderator only)

```typescript
app.put("/api/payout-exceptions/:id", requireModerator, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parseResult = insertPayoutExceptionSchema.partial().safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        message: "Invalid data",
        errors: parseResult.error.format()
      });
    }

    const updated = await storage.updatePayoutException(id, parseResult.data);

    if (!updated) {
      return res.status(404).json({ message: "Exception not found" });
    }

    res.json(updated);
  } catch (error) {
    console.error("Error updating payout exception:", error);
    res.status(500).json({ message: "Failed to update payout exception" });
  }
});
```

### 3.4 DELETE /api/payout-exceptions/:id (Admin/Moderator only)

```typescript
app.delete("/api/payout-exceptions/:id", requireModerator, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const deleted = await storage.deletePayoutException(id);

    if (!deleted) {
      return res.status(404).json({ message: "Exception not found" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting payout exception:", error);
    res.status(500).json({ message: "Failed to delete payout exception" });
  }
});
```

### 3.5 GET /api/calculate-payout/:productId/:userId

```typescript
app.get("/api/calculate-payout/:productId/:userId", requireAuth, async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const userId = Number(req.params.userId);
    const publisherId = req.query.publisherId as string | undefined;

    const payout = await storage.calculatePayoutAmount(productId, userId, publisherId);

    res.json({
      productId,
      userId,
      publisherId: publisherId || null,
      payout
    });
  } catch (error) {
    console.error("Error calculating payout:", error);
    res.status(500).json({ message: "Failed to calculate payout" });
  }
});
```

**✅ CHECKPOINT 3**: Endpoints funcionando y testeados con Postman/Thunder Client

---

## 🔔 PASO 4: Integración con Postbacks

### 4.1 Modificar `server/postback.ts`

```typescript
// En el método calculatePayout()
private async calculatePayout(lead: Lead, userId: number): Promise<number> {
  try {
    // Obtener items del lead
    const leadItems = await storage.getLeadItems(lead.id);
    if (leadItems.length === 0) return 0;

    // Para simplificar, usar el primer producto
    const firstItem = leadItems[0];

    let product = null;
    if (lead.productId) {
      product = await storage.getProduct(lead.productId);
    }

    if (!product) return 0;

    // ⭐ CAMBIO CRÍTICO: Usar publisherId del lead
    const payoutAmount = await storage.calculatePayoutAmount(
      product.id,
      userId,
      lead.publisherId || undefined // Pasar publisherId para jerarquía
    );

    return payoutAmount;
  } catch (error) {
    console.error('Error calculating payout:', error);
    return 0;
  }
}
```

**✅ CHECKPOINT 4**: Postbacks enviando el payout correcto según jerarquía

---

## 🎨 PASO 5: Frontend - Componente de Gestión

### 5.1 Crear `client/src/components/payout-exceptions-dialog.tsx`

**Funcionalidades principales:**
- ✅ Listar excepciones del producto
- ✅ Crear nueva excepción (Admin/Moderator)
- ✅ Eliminar excepción (Admin/Moderator)
- ✅ Ver excepciones propias (Affiliate)
- ✅ Mostrar jerarquía de payouts

```typescript
// Ver código de referencia en:
// attached_assets/ManagePayouts/payout-exceptions-dialog.tsx
```

### 5.2 Integrar en ProductDetailDialog

```typescript
// En product-detail-dialog.tsx

import PayoutExceptionsDialog from "./payout-exceptions-dialog";

// State
const [payoutExceptionsOpen, setPayoutExceptionsOpen] = useState(false);

// Botón en DialogFooter (modo view)
{mode === "view" && (user?.role === 'admin' || user?.role === 'moderator') && (
  <Button
    variant="secondary"
    onClick={() => setPayoutExceptionsOpen(true)}
  >
    <DollarSign className="h-4 w-4 mr-2" />
    Manage Payouts
  </Button>
)}

// Diálogo
<PayoutExceptionsDialog
  product={product}
  isOpen={payoutExceptionsOpen}
  onClose={() => setPayoutExceptionsOpen(false)}
/>
```

**✅ CHECKPOINT 5**: UI funcionando y conectada a la API

---

## 🧪 PASO 6: Testing y Validación

### 6.1 Casos de Prueba

#### Test 1: Payout Default
```
Producto: ID=1, payoutPo=$25
Lead: userId=3, publisherId="pub123"
Excepciones: NINGUNA
→ Resultado esperado: $25
```

#### Test 2: Excepción Nivel Afiliado
```
Producto: ID=1, payoutPo=$25
Lead: userId=3, publisherId="pub123"
Excepciones:
  - userId=3, productId=1, publisherId=NULL, amount=$30
→ Resultado esperado: $30
```

#### Test 3: Excepción Publisher Específico
```
Producto: ID=1, payoutPo=$25
Lead: userId=3, publisherId="pub123"
Excepciones:
  - userId=3, productId=1, publisherId=NULL, amount=$30
  - userId=3, productId=1, publisherId="pub123", amount=$35
→ Resultado esperado: $35 (prioridad más alta)
```

#### Test 4: Publisher Diferente
```
Producto: ID=1, payoutPo=$25
Lead: userId=3, publisherId="pub999"
Excepciones:
  - userId=3, productId=1, publisherId=NULL, amount=$30
  - userId=3, productId=1, publisherId="pub123", amount=$35
→ Resultado esperado: $30 (usa nivel afiliado)
```

### 6.2 Checklist de Validación

- [ ] Tabla `payout_exceptions` creada en base de datos
- [ ] Métodos CRUD funcionando correctamente
- [ ] Jerarquía de cálculo (Publisher > Affiliate > Default) validada
- [ ] Endpoints API protegidos por roles
- [ ] Postbacks enviando payout correcto
- [ ] UI permite crear/ver/eliminar excepciones
- [ ] Affiliates solo ven sus propias excepciones
- [ ] Admin/Moderator pueden gestionar todas las excepciones
- [ ] Finance solo puede ver (no modificar)

---

## 📊 Permisos por Rol

| Acción | Admin | Moderator | Finance | Affiliate |
|--------|-------|-----------|---------|-----------|
| Ver excepciones | ✅ Todas | ✅ Todas | ✅ Todas | ✅ Propias |
| Crear excepción | ✅ | ✅ | ❌ | ❌ |
| Editar excepción | ✅ | ✅ | ❌ | ❌ |
| Eliminar excepción | ✅ | ✅ | ❌ | ❌ |
| Calcular payout | ✅ | ✅ | ✅ | ✅ |

---

## 🚀 Orden de Implementación Recomendado

1. ✅ **SCHEMA** → Tabla + validaciones + relaciones
2. ✅ **MIGRATION** → Generar y aplicar migración
3. ✅ **STORAGE** → Métodos CRUD + calculatePayoutAmount
4. ✅ **ROUTES** → 5 endpoints API
5. ✅ **POSTBACK** → Integración con cálculo jerárquico
6. ✅ **FRONTEND** → PayoutExceptionsDialog + integración
7. ✅ **TESTING** → Validar todos los casos de prueba

---

## 📝 Notas Importantes

### ⚠️ Consideraciones de Seguridad
- ✅ Validación de roles en TODOS los endpoints
- ✅ Affiliates solo pueden ver sus propias excepciones
- ✅ Validación de datos con Zod en frontend Y backend
- ✅ SQL injection protection (Drizzle ORM)

### 🔄 Sincronización con Postbacks
- El payout se calcula **automáticamente** cuando un lead cambia a "sale"
- Se usa el **publisherId del lead** para determinar la excepción correcta
- El payout se envía en la variable `{payout}` del postback

### 💡 Mejoras Futuras Sugeridas
1. Historial de cambios en excepciones (audit log)
2. Excepciones temporales con fecha de inicio/fin
3. Bulk operations (crear múltiples a la vez)
4. Import/Export de excepciones en Excel
5. Dashboard de análisis de payouts

---

## 🎯 Estado Actual del Proyecto

### ❌ NO Implementado (TODO)
- Tabla `payout_exceptions` en DB
- Métodos de storage para excepciones
- Endpoints API para gestión
- Integración jerárquica en postbacks
- UI de gestión de excepciones

### ✅ YA Existe en el Proyecto
- Sistema de leads/orders
- Sistema de postbacks
- Sistema de transacciones
- Roles y permisos
- ProductDetailDialog base
- Campo `publisherId` en leads

---

## 📚 Referencias

### Archivos de Referencia
- `attached_assets/ManagePayouts/PAYOUT_SYSTEM_DOCUMENTATION.md`
- `attached_assets/ManagePayouts/schema.ts` (líneas 233-262)
- `attached_assets/ManagePayouts/storage.ts` (líneas 597-676)
- `attached_assets/ManagePayouts/routes.ts` (líneas 489-580)
- `attached_assets/ManagePayouts/payout-exceptions-dialog.tsx`
- `attached_assets/ManagePayouts/product-detail-dialog.tsx`

### Endpoints Finales

```
GET    /api/payout-exceptions?productId=X&userId=Y
POST   /api/payout-exceptions
PUT    /api/payout-exceptions/:id
DELETE /api/payout-exceptions/:id
GET    /api/calculate-payout/:productId/:userId?publisherId=X
```

---

**🎉 FIN DEL PLAN DE IMPLEMENTACIÓN**

Este documento debe servir como guía completa para implementar el sistema de Payout Exceptions de principio a fin.
