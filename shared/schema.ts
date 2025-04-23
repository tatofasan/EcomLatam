import { pgTable, text, serial, integer, boolean, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User Schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
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
});

export const productSchema = createInsertSchema(products, {
  status: z.enum(["active", "inactive", "draft", "low"])
}).omit({ id: true });

export type InsertProduct = z.infer<typeof productSchema>;
export type Product = typeof products.$inferSelect;
