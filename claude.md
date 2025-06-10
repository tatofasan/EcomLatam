# Ecomdrop - Arquitectura de la Aplicación

## Resumen Ejecutivo

Ecomdrop es una plataforma de e-commerce avanzada construida con una arquitectura full-stack moderna que permite la gestión completa de productos, órdenes, conexiones con plataformas externas y transacciones financieras. La aplicación está diseñada para ser escalable, segura y mantenible.

## Stack Tecnológico

### Frontend
- **Framework**: React 18 con TypeScript
- **Routing**: Wouter (alternativa ligera a React Router)
- **UI Components**: Shadcn/ui + Radix UI primitives
- **Styling**: Tailwind CSS con CSS custom properties
- **State Management**: TanStack Query (React Query v5) para estado del servidor
- **Forms**: React Hook Form con validación Zod
- **Charts**: Recharts para visualización de datos
- **Icons**: Lucide React + React Icons
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Database**: PostgreSQL 16
- **ORM**: Drizzle ORM con Drizzle Kit
- **Authentication**: Passport.js con estrategia local
- **Session Management**: express-session con connect-pg-simple
- **File Upload**: Multer
- **Email**: SendGrid y Nodemailer
- **API Documentation**: Zod schemas para validación

### DevOps y Deployment
- **Hosting**: Replit con autoscaling
- **Database**: PostgreSQL manejado
- **Build**: Vite + esbuild
- **Environment**: Desarrollo y producción separados

## Arquitectura de la Aplicación

### Estructura del Proyecto

```
proyecto/
├── client/                    # Frontend React
│   ├── src/
│   │   ├── components/       # Componentes reutilizables
│   │   │   ├── ui/          # Componentes base de Shadcn
│   │   │   └── layout/      # Layouts específicos
│   │   ├── pages/           # Páginas de la aplicación
│   │   ├── hooks/           # Hooks personalizados
│   │   ├── lib/             # Utilidades y configuración
│   │   └── types/           # Tipos TypeScript
├── server/                   # Backend Express
│   ├── auth.ts             # Sistema de autenticación
│   ├── db.ts               # Configuración de base de datos
│   ├── routes.ts           # Definición de rutas API
│   ├── storage.ts          # Capa de acceso a datos
│   ├── email.ts            # Sistema de emails
│   └── verification.ts     # Verificación de emails
├── shared/                  # Código compartido
│   └── schema.ts           # Esquemas de base de datos y validación
└── uploads/                # Archivos subidos
```

### Arquitectura de Capas

#### 1. Capa de Presentación (Frontend)
- **Responsabilidades**: UI/UX, gestión de estado local, validación de forms
- **Componentes principales**:
  - `DashboardLayout`: Layout principal con sidebar y navegación
  - `ProductCard`: Visualización de productos con modos grid/list
  - `ProductDetailDialog`: Modal para CRUD de productos
  - `Pagination`: Componente reutilizable de paginación
  - `SidebarNav`: Navegación lateral con roles

#### 2. Capa de API (Backend)
- **Responsabilidades**: Lógica de negocio, autenticación, autorización
- **Middlewares**:
  - `requireAuth`: Autenticación básica
  - `requireApiKey`: Autenticación por API key
  - `requireAdmin/Moderator/Finance`: Autorización por roles
- **Endpoints principales**:
  - `/api/auth/*`: Autenticación y registro
  - `/api/products`: CRUD de productos
  - `/api/orders`: Gestión de órdenes
  - `/api/connections`: Integraciones externas
  - `/api/transactions`: Sistema de transacciones

#### 3. Capa de Datos (Database)
- **Responsabilidades**: Persistencia, integridad referencial
- **Tablas principales**:
  - `users`: Usuarios con roles y verificación email
  - `products`: Catálogo de productos con categorías
  - `orders` + `order_items`: Sistema de órdenes
  - `connections`: Integraciones con plataformas
  - `transactions`: Sistema de wallet/transacciones

## Modelos de Datos

### Usuarios (users)
```typescript
{
  id: serial,
  username: text (unique),
  password: text (hashed),
  fullName: text,
  email: text,
  role: "admin" | "user" | "moderator" | "finance",
  status: "active" | "inactive" | "pending" | "email_verification",
  apiKey: text (unique),
  verificationToken: text,
  verificationExpires: timestamp,
  isEmailVerified: boolean,
  settings: jsonb,
  createdAt: timestamp,
  lastLogin: timestamp
}
```

### Productos (products)
```typescript
{
  id: serial,
  name: text,
  description: text,
  price: doublePrecision,
  stock: integer,
  status: "active" | "inactive" | "draft" | "low",
  sku: text (unique),
  imageUrl: text,
  additionalImages: text[],
  weight: doublePrecision,
  dimensions: text,
  category: text,
  specifications: jsonb,
  reference: text,
  provider: text,
  userId: foreign_key,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Órdenes (orders + order_items)
```typescript
// Orden principal
{
  id: serial,
  orderNumber: text (unique),
  userId: foreign_key,
  customerName: text,
  customerEmail: text,
  customerPhone: text,
  shippingAddress: text,
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled",
  totalAmount: doublePrecision,
  notes: text,
  createdAt: timestamp,
  updatedAt: timestamp
}

// Items de la orden
{
  id: serial,
  orderId: foreign_key,
  productId: foreign_key,
  quantity: integer,
  price: doublePrecision,
  subtotal: doublePrecision
}
```

### Conexiones (connections)
```typescript
{
  id: serial,
  userId: foreign_key,
  platform: text, // "shopify", "woocommerce", "mercadolibre"
  name: text,
  apiKey: text,
  apiSecret: text,
  status: "active" | "inactive" | "error",
  settings: jsonb,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Transacciones (transactions)
```typescript
{
  id: serial,
  userId: foreign_key,
  type: "withdrawal" | "bonus" | "discount",
  amount: doublePrecision,
  status: "pending" | "processing" | "paid" | "failed" | "cancelled",
  description: text,
  reference: text,
  settings: jsonb, // Para comprobantes de pago
  createdAt: timestamp
}
```

## Funcionalidades Principales

### 1. Sistema de Autenticación y Autorización
- **Login/Registro**: Con verificación de email usando SendGrid
- **Roles granulares**: admin, user, moderator, finance
- **API Keys**: Para integración externa de órdenes
- **Sesiones**: Manejadas con PostgreSQL store

### 2. Gestión de Productos
- **CRUD completo**: Crear, leer, actualizar, eliminar
- **Múltiples imágenes**: Imagen principal + imágenes adicionales
- **Categorización**: Sistema de categorías flexible
- **Estados**: draft, active, inactive, low (stock)
- **Especificaciones**: JSON flexible para datos adicionales
- **Import masivo**: Desde archivos Excel

### 3. Sistema de Órdenes
- **Ingesta de órdenes**: API endpoint para sistemas externos
- **Estados de orden**: Workflow completo de pending a delivered
- **Items múltiples**: Soporte para órdenes con múltiples productos
- **Dashboard analytics**: Métricas y gráficos de ventas
- **Export**: Funcionalidad de exportar órdenes a Excel

### 4. Integraciones (Conexiones)
- **Plataformas soportadas**: Shopify, WooCommerce, MercadoLibre
- **Configuración flexible**: API keys y settings por plataforma
- **Estados**: active, inactive, error para monitoreo

### 5. Sistema de Wallet/Transacciones
- **Tipos**: withdrawal, bonus, discount
- **Estados**: pending → processing → paid/failed/cancelled
- **Comprobantes**: Upload de archivos de pago
- **Balance**: Cálculo automático por usuario

### 6. Dashboard y Analytics
- **Métricas clave**: Productos, órdenes, revenue
- **Gráficos interactivos**: Ventas por mes, distribución de estados
- **Categorías**: Análisis de productos por categoría
- **Órdenes recientes**: Lista en tiempo real

## Seguridad y Autenticación

### Implementación de Seguridad
1. **Password Hashing**: scrypt con salt aleatorio
2. **Session Security**: Cookies HTTPOnly con expiración
3. **CSRF Protection**: Implementado via sessions
4. **API Key Authentication**: Para integraciones externas
5. **Role-based Access Control**: Middleware de autorización

### Roles y Permisos
- **Admin**: Acceso completo a todas las funcionalidades
- **Moderator**: Gestión de productos y órdenes
- **Finance**: Acceso a transacciones y wallet
- **User**: Funcionalidades básicas según configuración

## Escalabilidad y Rendimiento

### Arquitectura Actual
- **Monolito modular**: Backend único con separación de responsabilidades
- **Frontend SPA**: Aplicación de página única con routing client-side
- **Base de datos PostgreSQL**: Con índices optimizados
- **Session store**: PostgreSQL para escalabilidad horizontal

### Estrategias de Escalabilidad Implementadas

#### 1. Frontend
- **Code splitting**: Vite maneja automáticamente
- **Lazy loading**: Componentes cargados bajo demanda
- **React Query**: Cache inteligente y sincronización
- **Optimistic updates**: Mejora la percepción de rendimiento

#### 2. Backend
- **Middleware modulares**: Fácil extensión de funcionalidades
- **Storage interface**: Abstracción para múltiples implementaciones
- **Drizzle ORM**: Queries optimizadas y type-safe
- **Express sessions**: Escalabilidad horizontal con PostgreSQL store

#### 3. Base de Datos
- **Relaciones normalizadas**: Evita duplicación de datos
- **Índices estratégicos**: En claves foráneas y campos de búsqueda
- **Transacciones**: Para operaciones críticas
- **Migrations**: Versionado de esquema con Drizzle Kit

## Guías de Escalamiento

### Escalamiento Horizontal (Recomendado)

#### 1. Microservicios (Próximo paso)
```
Separación sugerida:
├── auth-service/          # Autenticación y usuarios
├── product-service/       # Catálogo de productos
├── order-service/         # Gestión de órdenes
├── integration-service/   # Conexiones externas
├── payment-service/       # Transacciones y wallet
└── notification-service/  # Emails y notificaciones
```

#### 2. API Gateway
- **Implementar**: Nginx o Kong
- **Beneficios**: Load balancing, rate limiting, SSL termination
- **Routing**: Dirigir requests a servicios específicos

#### 3. Base de Datos
- **Read Replicas**: Para consultas de solo lectura
- **Sharding**: Por tenant/usuario para multi-tenancy
- **Cache Layer**: Redis para sesiones y datos frecuentes

#### 4. Frontend
- **CDN**: Para assets estáticos y mejores tiempos de carga
- **Micro-frontends**: Separar por dominio de negocio
- **Progressive Web App**: Para experiencia móvil nativa

### Escalamiento Vertical (Temporal)

#### 1. Optimizaciones de Base de Datos
```sql
-- Índices críticos para rendimiento
CREATE INDEX idx_products_user_status ON products(userId, status);
CREATE INDEX idx_orders_user_date ON orders(userId, createdAt);
CREATE INDEX idx_order_items_order ON order_items(orderId);
CREATE INDEX idx_transactions_user_status ON transactions(userId, status);
```

#### 2. Query Optimization
- **Pagination**: Implementada con offset/limit
- **Eager loading**: Relaciones cargadas eficientemente
- **Query batching**: Para reducir N+1 queries

#### 3. Caching Strategies
```typescript
// Implementar cache en puntos críticos
const productCache = new Map();
const dashboardMetricsCache = new Map();

// Cache invalidation en mutations
await queryClient.invalidateQueries({ queryKey: ['products'] });
```

### Implementación de Multi-tenancy

#### 1. Database per Tenant
```typescript
// Modificar conexión por tenant
export function getTenantDb(tenantId: string) {
  return drizzle({
    client: new Pool({
      connectionString: `${process.env.DATABASE_URL}_${tenantId}`
    }),
    schema
  });
}
```

#### 2. Shared Database with Tenant ID
```typescript
// Agregar tenantId a todas las tablas
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  // ... otros campos
});

// Middleware para filtrar por tenant
const requireTenant = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  req.tenantId = tenantId;
  next();
};
```

### Monitoreo y Observabilidad

#### 1. Logging
```typescript
// Implementar structured logging
import winston from 'winston';

const logger = winston.createLogger({
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'app.log' }),
    new winston.transports.Console()
  ]
});
```

#### 2. Métricas
```typescript
// Implementar métricas de negocio
const metrics = {
  ordersCreated: 0,
  productsViewed: 0,
  usersRegistered: 0,
  apiLatency: []
};
```

#### 3. Health Checks
```typescript
// Endpoint de health check
app.get('/health', async (req, res) => {
  const checks = {
    database: await checkDbConnection(),
    email: await checkEmailService(),
    storage: await checkFileStorage()
  };
  
  res.json({ status: 'healthy', checks });
});
```

## Mejores Prácticas de Desarrollo

### 1. Estructura de Código
- **Separación de responsabilidades**: Cada módulo tiene una función específica
- **Tipos compartidos**: Schema definido en `/shared/schema.ts`
- **Validación consistente**: Zod schemas para frontend y backend
- **Error handling**: Manejo centralizado de errores

### 2. Testing Strategy (Recomendado)
```typescript
// Unit tests para lógica de negocio
describe('Product Service', () => {
  test('should create product with valid data', async () => {
    const product = await storage.createProduct(validProduct);
    expect(product.id).toBeDefined();
  });
});

// Integration tests para APIs
describe('Product API', () => {
  test('POST /api/products should create product', async () => {
    const response = await request(app)
      .post('/api/products')
      .send(validProduct)
      .expect(201);
  });
});
```

### 3. CI/CD Pipeline (Sugerido)
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run tests
        run: npm test
      - name: Build
        run: npm run build
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Replit
        run: # deployment script
```

## Configuración de Entorno

### Variables de Entorno Requeridas
```env
# Base de datos
DATABASE_URL=postgresql://...

# Autenticación
SESSION_SECRET=your-secret-key

# Email (SendGrid)
SENDGRID_API_KEY=your-sendgrid-key
FROM_EMAIL=noreply@yourdomain.com

# Email alternativo (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Replit específico
REPLIT_DOMAINS=your-domain.replit.app
```

### Scripts de Desarrollo
```json
{
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start": "NODE_ENV=production node dist/index.js",
    "db:push": "drizzle-kit push",
    "db:migrate": "drizzle-kit migrate"
  }
}
```

## Consideraciones de Seguridad Adicionales

### 1. Input Validation
- **Zod schemas**: Validación en todas las entradas
- **File upload**: Restricciones de tipo y tamaño
- **SQL Injection**: Prevención con Drizzle ORM

### 2. Rate Limiting (Recomendado)
```typescript
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', apiLimiter);
```

### 3. CORS Configuration
```typescript
import cors from 'cors';

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
}));
```

## Estado Actual y Próximos Pasos

### Estado Actual ✅
- Arquitectura base implementada y funcional
- Sistema de autenticación completo
- CRUD de productos con UI avanzada
- Sistema de órdenes con analytics
- Integraciones básicas preparadas
- Sistema de transacciones/wallet
- Dashboard con métricas en tiempo real

### Próximos Pasos Sugeridos 🔄

#### Corto Plazo (1-2 meses)
1. **Testing**: Implementar suite de tests unitarios e integración
2. **Error Monitoring**: Integrar Sentry o similar
3. **Performance**: Optimizar queries y agregar índices
4. **Security**: Audit de seguridad y penetration testing

#### Mediano Plazo (3-6 meses)
1. **Microservicios**: Separar en servicios independientes
2. **Cache Layer**: Implementar Redis para mejor rendimiento
3. **API Versioning**: Versionado de APIs para compatibilidad
4. **Mobile App**: Desarrollo de aplicación móvil

#### Largo Plazo (6+ meses)
1. **Multi-tenancy**: Soporte para múltiples clientes
2. **Machine Learning**: Recomendaciones y analytics avanzados
3. **Blockchain**: Integración para transparencia en supply chain
4. **Global Scale**: CDN y despliegue multi-región

## Conclusión

Ecomdrop presenta una arquitectura sólida y bien estructurada que balancea funcionalidad, mantenibilidad y escalabilidad. La aplicación está construida con tecnologías modernas y siguiendo mejores prácticas de desarrollo, proporcionando una base robusta para crecimiento futuro.

La separación clara de responsabilidades, el uso de TypeScript para type safety, y la implementación de patrones de diseño modernos hacen que el código sea fácil de mantener y extender. El sistema está preparado para escalar tanto vertical como horizontalmente según las necesidades del negocio.