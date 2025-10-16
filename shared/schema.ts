import { pgTable, text, integer, timestamp, decimal, boolean, serial, pgEnum, json } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["user", "admin", "moderator", "finance"]);
export const userStatusEnum = pgEnum("user_status", ["pending", "active", "inactive", "suspended"]);
export const leadStatusEnum = pgEnum("lead_status", ["sale", "hold", "rejected", "trash"]);
export const campaignStatusEnum = pgEnum("campaign_status", ["active", "paused", "completed", "draft"]);
export const offerStatusEnum = pgEnum("offer_status", ["active", "inactive", "pending_approval"]);
export const payoutTypeEnum = pgEnum("payout_type", ["fixed", "percentage", "tiered"]);
export const trafficSourceEnum = pgEnum("traffic_source", ["organic", "paid", "social", "email", "direct", "referral"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["deposit", "withdrawal", "payout", "bonus", "adjustment"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "completed", "failed", "cancelled"]);
export const shopifyStoreStatusEnum = pgEnum("shopify_store_status", ["active", "inactive", "error", "pending"]);

// Users Table - Affiliates and Admins
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name"),
  email: text("email").notNull().unique(),
  role: userRoleEnum("role").default("user"),
  status: userStatusEnum("status").default("pending"),
  apiKey: text("api_key").unique(),
  payoutRate: decimal("payout_rate", { precision: 5, scale: 2 }).default("0.00"), // Default payout %
  referralCode: text("referral_code").unique(),
  country: text("country"),
  phone: text("phone"),
  paymentMethods: json("payment_methods"), // Stripe, PayPal, Bank, etc.
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  verificationToken: text("verification_token"),
  verificationExpires: timestamp("verification_expires"),
  isEmailVerified: boolean("is_email_verified").default(false),
  settings: json("settings"), // JSON for user preferences
});

// Advertisers Table - Companies providing offers
export const advertisers = pgTable("advertisers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  website: text("website"),
  status: text("status").default("active"), // active, inactive, suspended
  payoutSettings: json("payout_settings"), // Default payout rules
  postbackUrl: text("postback_url"), // URL to notify conversions
  apiCredentials: json("api_credentials"), // API keys for integration
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Products Table - Existing products/services (now with SKU support)
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }),
  imageUrl: text("image_url"),
  category: text("category"),
  stock: integer("stock").default(0),
  status: text("status").default("active"),
  sku: text("sku").notNull().unique(), // Unique product identifier
  additionalImages: text("additional_images").array(),
  weight: decimal("weight", { precision: 10, scale: 2 }),
  dimensions: text("dimensions"),
  specifications: json("specifications"),
  reference: text("reference"),
  provider: text("provider"),
  userId: integer("user_id").references(() => users.id),
  payoutPo: decimal("payout_po", { precision: 10, scale: 2 }).default("0"),
  trending: boolean("trending").default(false),
  vertical: text("vertical"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Campaigns Table - Marketing campaigns
export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  productId: integer("product_id").references(() => products.id),
  name: text("name").notNull(),
  description: text("description"),
  status: campaignStatusEnum("status").default("draft"),
  budget: decimal("budget", { precision: 10, scale: 2 }),
  spent: decimal("spent", { precision: 10, scale: 2 }).default("0.00"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  targetAudience: json("target_audience"), // Demographics, interests, etc.
  trackingParams: json("tracking_params"), // UTM parameters, custom params
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Leads Table - Individual lead records (renamed from orders)
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  leadNumber: text("lead_number").notNull().unique(),
  userId: integer("user_id").references(() => users.id),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  productId: integer("product_id").references(() => products.id),
  
  // Customer Information
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone").notNull(), // Formatted phone number
  customerPhoneOriginal: text("customer_phone_original"), // Original phone as received
  customerPhoneFormatted: text("customer_phone_formatted"), // Fully formatted phone with area code
  customerAddress: text("customer_address"),
  customerCity: text("customer_city"),
  customerCountry: text("customer_country"),
  
  // Lead Details
  status: leadStatusEnum("status").default("hold"),
  quality: text("quality").default("standard"), // premium, standard, basic
  value: decimal("value", { precision: 10, scale: 2 }),
  payout: decimal("payout", { precision: 10, scale: 2 }),
  
  // Tracking Information
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  referrerUrl: text("referrer_url"),
  landingPage: text("landing_page"),
  utmSource: text("utm_source"), // UTM tracking: source (e.g., 'shopify', 'facebook', 'google')
  utmMedium: text("utm_medium"), // UTM tracking: medium (e.g., 'cpc', 'email', 'banner')
  utmCampaign: text("utm_campaign"), // UTM tracking: campaign name
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
  clickId: text("click_id"), // Unique click identifier
  subId: text("sub_id"), // Affiliate's tracking ID

  // Affiliate tracking fields for reporting
  publisherId: text("publisher_id"), // Publisher/Affiliate identifier
  subacc1: text("subacc1"), // Sub-account 1 for reporting
  subacc2: text("subacc2"), // Sub-account 2 for reporting
  subacc3: text("subacc3"), // Sub-account 3 for reporting
  subacc4: text("subacc4"), // Sub-account 4 for reporting
  
  // Conversion Tracking
  conversionTime: timestamp("conversion_time"),
  conversionValue: decimal("conversion_value", { precision: 10, scale: 2 }),
  isConverted: boolean("is_converted").default(false),
  postbackSent: boolean("postback_sent").default(false),
  
  // Additional Data
  notes: text("notes"),
  customFields: json("custom_fields"), // Flexible additional data
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Lead Items Table - Products within a lead
export const leadItems = pgTable("lead_items", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").default(1),
  price: decimal("price", { precision: 10, scale: 2 }),
  total: decimal("total", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Postbacks Table - Conversion notifications
export const postbacks = pgTable("postbacks", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id),
  advertiserId: integer("advertiser_id").references(() => advertisers.id),
  url: text("url").notNull(),
  method: text("method").default("GET"), // GET, POST
  payload: json("payload"), // Data sent in postback
  response: json("response"), // Response from advertiser
  status: text("status").default("pending"), // pending, sent, failed
  attempts: integer("attempts").default(0),
  lastAttempt: timestamp("last_attempt"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Transactions Table - Financial records
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  leadId: integer("lead_id").references(() => leads.id),
  type: transactionTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: transactionStatusEnum("status").default("pending"),
  description: text("description"),
  paymentMethod: text("payment_method"), // stripe, paypal, bank_transfer
  paymentProof: text("payment_proof"), // URL to payment proof image
  reference: text("reference"), // Transaction reference number
  fees: decimal("fees", { precision: 10, scale: 2 }).default("0.00"),
  netAmount: decimal("net_amount", { precision: 10, scale: 2 }),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Click Tracking Table - Track all clicks
export const clickTracking = pgTable("click_tracking", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  productId: integer("product_id").references(() => products.id),
  clickId: text("click_id").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  referrerUrl: text("referrer_url"),
  landingPage: text("landing_page"),
  country: text("country"),
  device: text("device"), // mobile, desktop, tablet
  browser: text("browser"),
  os: text("os"),
  isBot: boolean("is_bot").default(false),
  isConverted: boolean("is_converted").default(false),
  conversionTime: timestamp("conversion_time"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Performance Reports Table - Cached statistics
export const performanceReports = pgTable("performance_reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  productId: integer("product_id").references(() => products.id),
  date: timestamp("date").notNull(),
  clicks: integer("clicks").default(0),
  leads: integer("leads").default(0),
  sales: integer("sales").default(0),
  revenue: decimal("revenue", { precision: 10, scale: 2 }).default("0.00"),
  payout: decimal("payout", { precision: 10, scale: 2 }).default("0.00"),
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }).default("0.00"),
  costPerLead: decimal("cost_per_lead", { precision: 10, scale: 2 }).default("0.00"),
  returnOnInvestment: decimal("roi", { precision: 5, scale: 2 }).default("0.00"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Shopify Stores Table - Connected Shopify stores for dropshipping integration
export const shopifyStores = pgTable("shopify_stores", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  shop: text("shop").notNull().unique(), // mystore.myshopify.com
  accessToken: text("access_token").notNull(), // OAuth access token (encrypted)
  status: shopifyStoreStatusEnum("status").default("pending"),
  scopes: text("scopes"), // Comma-separated authorized scopes
  installedAt: timestamp("installed_at").defaultNow(),
  uninstalledAt: timestamp("uninstalled_at"),
  settings: json("settings"), // Auto-sync, fulfillment settings, etc.
  webhookIds: json("webhook_ids"), // Registered webhook IDs for cleanup
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Terms and Conditions Table
export const termsAndConditions = pgTable("terms_and_conditions", {
  id: serial("id").primaryKey(),
  version: text("version").notNull().unique(), // e.g., "1.0", "1.1"
  title: text("title").notNull(),
  content: text("content").notNull(), // Main content in markdown or HTML
  effectiveDate: timestamp("effective_date").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Postback Configurations Table - User-specific postback URL settings
export const postbackConfigurations = pgTable("postback_configurations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  isEnabled: boolean("is_enabled").default(false),
  saleUrl: text("sale_url"), // URL for successful sales
  holdUrl: text("hold_url"), // URL for leads on hold
  rejectedUrl: text("rejected_url"), // URL for rejected leads
  trashUrl: text("trash_url"), // URL for trashed leads
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Postback Notifications Table - Log of all postback attempts
export const postbackNotifications = pgTable("postback_notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  leadId: integer("lead_id").references(() => leads.id).notNull(),
  url: text("url").notNull(),
  status: text("status").default("pending"), // success, failed, pending
  httpStatus: integer("http_status"),
  responseBody: text("response_body"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Schema validation
export const insertUserSchema = createInsertSchema(users, {
  role: z.enum(["user", "admin", "moderator", "finance"]).default("user"),
  status: z.enum(["pending", "active", "inactive", "suspended"]).default("pending"),
  email: z.string().email("Por favor ingresa un correo electrónico válido"),
  payoutRate: z.string().transform(val => parseFloat(val)),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLogin: true,
});

export const insertAdvertiserSchema = createInsertSchema(advertisers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductSchema = createInsertSchema(products, {
  sku: z.string().min(1, "SKU is required"),
  price: z.union([z.string(), z.number()]).transform(val => typeof val === 'number' ? val.toString() : val),
  weight: z.union([z.string(), z.number()]).transform(val => typeof val === 'number' ? val.toString() : val).optional(),
  payoutPo: z.union([z.string(), z.number()]).transform(val => typeof val === 'number' ? val.toString() : val).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadSchema = createInsertSchema(leads, {
  status: z.enum(["sale", "hold", "rejected", "trash"]).default("hold"),
  value: z.string().transform(val => parseFloat(val)),
  payout: z.string().transform(val => parseFloat(val)),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadItemSchema = createInsertSchema(leadItems).omit({
  id: true,
  createdAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions, {
  type: z.enum(["deposit", "withdrawal", "payout", "bonus", "adjustment"]),
  status: z.enum(["pending", "completed", "failed", "cancelled"]).default("pending"),
  amount: z.string().transform(val => parseFloat(val)),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShopifyStoreSchema = createInsertSchema(shopifyStores, {
  status: z.enum(["active", "inactive", "error", "pending"]).default("pending"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  installedAt: true,
});

export const insertTermsSchema = createInsertSchema(termsAndConditions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPostbackConfigurationSchema = createInsertSchema(postbackConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPostbackNotificationSchema = createInsertSchema(postbackNotifications).omit({
  id: true,
  createdAt: true,
});

// Legacy schema aliases for backward compatibility
export const insertConnectionSchema = insertCampaignSchema;
export const insertOrderSchema = insertLeadSchema;
export const insertOrderItemSchema = insertLeadItemSchema;

// API schemas for external integrations
export const apiLeadSchema = z.object({
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().min(1),
  customerAddress: z.string().optional(),
  customerCity: z.string().optional(),
  customerCountry: z.string().optional(),
  productId: z.number().positive(),
  campaignId: z.number().positive().optional(),
  value: z.number().positive().optional(),
  trafficSource: z.enum(["organic", "paid", "social", "email", "direct", "referral"]).optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  clickId: z.string().optional(),
  subId: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  customFields: z.record(z.any()).optional(),
});

export const apiLeadStatusSchema = z.object({
  status: z.enum(["sale", "hold", "rejected", "trash"]),
  notes: z.string().optional(),
});

// API Lead Ingest Schema - supports either productId or productSku (exclusively)
// Enhanced version with mandatory shipping fields
export const apiLeadIngestSchema = z.object({
  // Customer information (required)
  customerName: z.string()
    .min(2, "Customer name must be at least 2 characters")
    .max(100, "Customer name too long"),

  customerEmail: z.string()
    .email("Invalid email format")
    .toLowerCase()
    .optional(),

  customerPhone: z.string()
    .min(8, "Phone number must be at least 8 characters")
    .max(20, "Phone number too long"),

  // Shipping information (REQUIRED for product delivery)
  // Country is always Argentina, no need to send it
  customerAddress: z.string()
    .min(5, "Address must be at least 5 characters")
    .max(200, "Address too long"),

  customerCity: z.string()
    .min(2, "City must be at least 2 characters")
    .max(100, "City name too long"),

  customerPostalCode: z.string()
    .min(3, "Postal code must be at least 3 characters")
    .max(20, "Postal code too long"),

  // Product identification (one of the two required)
  productId: z.number().positive().optional(),
  productSku: z.string().min(1).optional(),

  // Additional information
  campaignId: z.number().positive().optional(),
  quantity: z.number().int().positive().max(100).default(1),
  productPrice: z.number().positive().optional(), // Optional: if provided, will be validated against catalog
  // Note: if productPrice not provided, catalog price will be used automatically

  // Tracking information (optional)
  publisherId: z.string().max(200).optional(),
  clickId: z.string().max(100).optional(),
  subacc1: z.string().max(200).optional(),
  subacc2: z.string().max(200).optional(),
  subacc3: z.string().max(200).optional(),
  subacc4: z.string().max(200).optional(),

  ipAddress: z.string()
    .ip({ version: "v4" })
    .or(z.string().ip({ version: "v6" }))
    .optional(),

  userAgent: z.string().max(500).optional(),
  customFields: z.record(z.any()).optional(),
}).refine(
  (data) => (!!data.productId) !== (!!data.productSku),
  {
    message: "Provide either productId or productSku (exclusively, not both)",
    path: ["productId", "productSku"]
  }
);

// Type exports
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type SelectUser = typeof users.$inferSelect;

export type InsertAdvertiser = z.infer<typeof insertAdvertiserSchema>;
export type Advertiser = typeof advertisers.$inferSelect;


export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export type InsertLeadItem = z.infer<typeof insertLeadItemSchema>;
export type LeadItem = typeof leadItems.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export type InsertShopifyStore = z.infer<typeof insertShopifyStoreSchema>;
export type ShopifyStore = typeof shopifyStores.$inferSelect;

export type InsertTerms = z.infer<typeof insertTermsSchema>;
export type TermsAndConditions = typeof termsAndConditions.$inferSelect;

export type InsertPostbackConfiguration = z.infer<typeof insertPostbackConfigurationSchema>;
export type PostbackConfiguration = typeof postbackConfigurations.$inferSelect;

export type InsertPostbackNotification = z.infer<typeof insertPostbackNotificationSchema>;
export type PostbackNotification = typeof postbackNotifications.$inferSelect;

export type ClickTrack = typeof clickTracking.$inferSelect;
export type Postback = typeof postbacks.$inferSelect;
export type PerformanceReport = typeof performanceReports.$inferSelect;

export type ApiLead = z.infer<typeof apiLeadSchema>;
export type ApiLeadIngest = z.infer<typeof apiLeadIngestSchema>;

// Type exports for products
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Order = Lead;
export type InsertOrder = InsertLead;
export type OrderItem = LeadItem;
export type InsertOrderItem = InsertLeadItem;
export type Connection = Campaign;
export type InsertConnection = InsertCampaign;

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  leads: many(leads),
  campaigns: many(campaigns),
  transactions: many(transactions),
  clickTracking: many(clickTracking),
  shopifyStores: many(shopifyStores),
  postbackConfiguration: one(postbackConfigurations),
  postbackNotifications: many(postbackNotifications),
}));

export const advertisersRelations = relations(advertisers, ({ many }) => ({
  products: many(products),
  postbacks: many(postbacks),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  user: one(users, {
    fields: [products.userId],
    references: [users.id],
  }),
  campaigns: many(campaigns),
  leads: many(leads),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  user: one(users, {
    fields: [campaigns.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [campaigns.productId],
    references: [products.id],
  }),
  leads: many(leads),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  user: one(users, {
    fields: [leads.userId],
    references: [users.id],
  }),
  campaign: one(campaigns, {
    fields: [leads.campaignId],
    references: [campaigns.id],
  }),
  product: one(products, {
    fields: [leads.productId],
    references: [products.id],
  }),
  items: many(leadItems),
  transactions: many(transactions),
  postbacks: many(postbacks),
}));

export const leadItemsRelations = relations(leadItems, ({ one }) => ({
  lead: one(leads, {
    fields: [leadItems.leadId],
    references: [leads.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  lead: one(leads, {
    fields: [transactions.leadId],
    references: [leads.id],
  }),
}));

export const postbacksRelations = relations(postbacks, ({ one }) => ({
  lead: one(leads, {
    fields: [postbacks.leadId],
    references: [leads.id],
  }),
  advertiser: one(advertisers, {
    fields: [postbacks.advertiserId],
    references: [advertisers.id],
  }),
}));

export const clickTrackingRelations = relations(clickTracking, ({ one }) => ({
  user: one(users, {
    fields: [clickTracking.userId],
    references: [users.id],
  }),
  campaign: one(campaigns, {
    fields: [clickTracking.campaignId],
    references: [campaigns.id],
  }),
  product: one(products, {
    fields: [clickTracking.productId],
    references: [products.id],
  }),
}));

export const shopifyStoresRelations = relations(shopifyStores, ({ one }) => ({
  user: one(users, {
    fields: [shopifyStores.userId],
    references: [users.id],
  }),
}));

export const postbackConfigurationsRelations = relations(postbackConfigurations, ({ one }) => ({
  user: one(users, {
    fields: [postbackConfigurations.userId],
    references: [users.id],
  }),
}));

export const postbackNotificationsRelations = relations(postbackNotifications, ({ one }) => ({
  user: one(users, {
    fields: [postbackNotifications.userId],
    references: [users.id],
  }),
  lead: one(leads, {
    fields: [postbackNotifications.leadId],
    references: [leads.id],
  }),
}));

// Legacy relations for backward compatibility
export const ordersRelations = leadsRelations;
export const orderItemsRelations = leadItemsRelations;
export const connectionsRelations = campaignsRelations;