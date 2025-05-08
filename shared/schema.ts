import { pgTable, text, serial, integer, boolean, doublePrecision, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// User Schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name"),
  email: text("email"),
  role: text("role").default("user"), // admin, user, moderator, finance
  status: text("status").default("active"), // active, inactive
  createdAt: timestamp("created_at").defaultNow(),
  lastLogin: timestamp("last_login"),
  settings: jsonb("settings"),
});

export const insertUserSchema = createInsertSchema(users, {
  role: z.enum(["admin", "user", "moderator", "finance"]),
  status: z.enum(["active", "inactive"]).default("active")
}).pick({
  username: true,
  password: true,
  fullName: true,
  email: true,
  role: true,
  status: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Product Schema
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: doublePrecision("price").notNull(),
  stock: integer("stock").notNull().default(0),
  status: text("status").notNull().default("draft"), // active, inactive, draft, low
  sku: text("sku").notNull().unique(),
  imageUrl: text("image_url").notNull(),
  additionalImages: text("additional_images").array(),
  weight: doublePrecision("weight"),
  dimensions: text("dimensions"),
  category: text("category"),
  specifications: jsonb("specifications"),
  reference: text("reference"),
  provider: text("provider"),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const productSchema = createInsertSchema(products, {
  status: z.enum(["active", "inactive", "draft", "low"]),
  additionalImages: z.array(z.string()).optional().nullable()
}).omit({ id: true, userId: true, createdAt: true, updatedAt: true });

export type InsertProduct = z.infer<typeof productSchema>;
export type Product = typeof products.$inferSelect;

// Order Schema
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  userId: integer("user_id").references(() => users.id),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  shippingAddress: text("shipping_address").notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, shipped, delivered, cancelled
  totalAmount: doublePrecision("total_amount").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  notes: text("notes"),
});

export const insertOrderSchema = createInsertSchema(orders, {
  status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"])
}).omit({ id: true, userId: true, createdAt: true, updatedAt: true });

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// Order Items Schema
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  price: doublePrecision("price").notNull(),
  subtotal: doublePrecision("subtotal").notNull(),
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});

export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

// Connection Schema (for integrations with e-commerce platforms)
export const connections = pgTable("connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  platform: text("platform").notNull(), // shopify, woocommerce, mercadolibre, etc.
  name: text("name").notNull(),
  apiKey: text("api_key"),
  apiSecret: text("api_secret"),
  status: text("status").notNull().default("active"), // active, inactive, error
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  settings: jsonb("settings"),
});

export const insertConnectionSchema = createInsertSchema(connections, {
  status: z.enum(["active", "inactive", "error"])
}).omit({ id: true, userId: true, createdAt: true, updatedAt: true });

export type InsertConnection = z.infer<typeof insertConnectionSchema>;
export type Connection = typeof connections.$inferSelect;

// Wallet/Transaction Schema
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // withdrawal, bonus, discount
  amount: doublePrecision("amount").notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, paid, failed, cancelled
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  reference: text("reference"), // order_id, payment_id, etc.
  settings: jsonb("settings") // Used to store additional data like payment proof
});

export const insertTransactionSchema = createInsertSchema(transactions, {
  type: z.enum(["withdrawal", "bonus", "discount"]),
  status: z.enum(["pending", "processing", "paid", "failed", "cancelled"])
}).omit({ id: true, userId: true, createdAt: true, settings: true });

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

// Define relationships
export const productsRelations = relations(products, ({ one, many }) => ({
  user: one(users, {
    fields: [products.userId],
    references: [users.id]
  }),
  orderItems: many(orderItems)
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id]
  }),
  items: many(orderItems)
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id]
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id]
  })
}));

export const connectionsRelations = relations(connections, ({ one }) => ({
  user: one(users, {
    fields: [connections.userId],
    references: [users.id]
  })
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id]
  })
}));
