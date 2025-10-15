import { 
  users, type User, type InsertUser,
  advertisers, type Advertiser, type InsertAdvertiser,
  products, type Product, type InsertProduct,
  campaigns, type Campaign, type InsertCampaign,
  leads, type Lead, type InsertLead,
  leadItems, type LeadItem, type InsertLeadItem,
  transactions, type Transaction, type InsertTransaction,
  postbacks, type Postback,
  clickTracking, type ClickTrack,
  performanceReports, type PerformanceReport,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, asc, sql, inArray, gte, lte, count, sum } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import crypto from "crypto";

export interface IStorage {
  // User methods
  getAllUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByApiKey(apiKey: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<InsertUser> | { lastLogin?: Date; apiKey?: string }): Promise<User | undefined>;
  generateApiKey(userId: number): Promise<string>;
  
  // Advertiser methods
  getAllAdvertisers(): Promise<Advertiser[]>;
  getAdvertiser(id: number): Promise<Advertiser | undefined>;
  createAdvertiser(advertiser: InsertAdvertiser): Promise<Advertiser>;
  updateAdvertiser(id: number, advertiser: Partial<InsertAdvertiser>): Promise<Advertiser | undefined>;
  deleteAdvertiser(id: number): Promise<boolean>;
  
  // Product methods
  getAllProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
  
  // Campaign methods (renamed from Connection methods)
  getUserCampaigns(userId: number): Promise<Campaign[]>;
  getAllCampaigns(): Promise<Campaign[]>;
  getCampaign(id: number): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign, userId: number): Promise<Campaign>;
  updateCampaignStatus(id: number, status: string): Promise<Campaign | undefined>;
  deleteCampaign(id: number): Promise<boolean>;

  // Lead methods (renamed from Order methods)
  getAllLeads(userId?: number): Promise<Lead[]>;
  getLead(id: number): Promise<Lead | undefined>;
  createLead(lead: InsertLead, userId: number): Promise<Lead>;
  updateLeadStatus(id: number, status: string): Promise<Lead | undefined>;
  
  // Lead Items methods (renamed from Order Items methods)
  getLeadItems(leadId: number): Promise<LeadItem[]>;
  addLeadItem(item: InsertLeadItem): Promise<LeadItem>;
  
  // Transaction methods
  getUserTransactions(userId: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction, userId: number): Promise<Transaction>;
  updateTransactionStatus(id: number, status: string, paymentProof?: string): Promise<Transaction | undefined>;
  getUserBalance(userId: number): Promise<number>;
  createWithdrawalWithLock(userId: number, amount: number, withdrawal: InsertTransaction): Promise<{ success: boolean; transaction?: Transaction; error?: string }>;
  
  // Click tracking methods
  trackClick(clickData: Partial<ClickTrack>): Promise<ClickTrack>;
  getClickStats(userId: number, startDate?: Date, endDate?: Date): Promise<any>;
  
  // Postback methods
  createPostback(postbackData: Partial<Postback>): Promise<Postback>;
  getPendingPostbacks(): Promise<Postback[]>;
  updatePostbackStatus(id: number, status: string, response?: any): Promise<void>;
  
  // Performance reporting
  generatePerformanceReport(userId: number, date: Date): Promise<PerformanceReport>;
  getPerformanceReports(userId: number, startDate?: Date, endDate?: Date): Promise<PerformanceReport[]>;
  
  // Lead conversion methods
  convertLead(leadId: number, conversionData: { value: number; commission: number }): Promise<void>;
  
  // Legacy compatibility methods
  getAllProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: InsertProduct): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
  getAllOrders(userId?: number): Promise<Order[]>;
  getOrder(id: number): Promise<Order | undefined>;
  createOrder(order: InsertOrder, userId: number): Promise<Order>;
  updateOrderStatus(id: number, status: string): Promise<Order | undefined>;
  getOrderItems(orderId: number): Promise<OrderItem[]>;
  addOrderItem(item: InsertOrderItem): Promise<OrderItem>;
  getUserConnections(userId: number): Promise<Connection[]>;
  getAllConnections(): Promise<Connection[]>;
  getConnection(id: number): Promise<Connection | undefined>;
  createConnection(connection: InsertConnection, userId: number): Promise<Connection>;
  updateConnectionStatus(id: number, status: string): Promise<Connection | undefined>;
  deleteConnection(id: number): Promise<boolean>;
  
  // Demo data methods
  seedDemoProducts(): Promise<void>;
  seedDemoLeads(userId: number): Promise<void>;
  seedDemoCampaigns(userId: number): Promise<void>;
  seedDemoTransactions(userId: number): Promise<void>;

  // Session store
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    const PostgresSessionStore = connectPg(session);
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  // User methods
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(asc(users.id));
  }
  
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByApiKey(apiKey: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.apiKey, apiKey));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, userData: Partial<InsertUser> | { lastLogin?: Date; apiKey?: string }): Promise<User | undefined> {
    const updateData: any = { ...userData };
    if (updateData.lastLogin) {
      updateData.updatedAt = new Date();
    }
    
    const [user] = await db.update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async generateApiKey(userId: number): Promise<string> {
    const apiKey = crypto.randomBytes(32).toString('hex');
    await this.updateUser(userId, { apiKey });
    return apiKey;
  }

  // Advertiser methods
  async getAllAdvertisers(): Promise<Advertiser[]> {
    return await db.select().from(advertisers).orderBy(asc(advertisers.id));
  }

  async getAdvertiser(id: number): Promise<Advertiser | undefined> {
    const [advertiser] = await db.select().from(advertisers).where(eq(advertisers.id, id));
    return advertiser || undefined;
  }

  async createAdvertiser(advertiser: InsertAdvertiser): Promise<Advertiser> {
    const [created] = await db.insert(advertisers).values(advertiser).returning();
    return created;
  }

  async updateAdvertiser(id: number, advertiserData: Partial<InsertAdvertiser>): Promise<Advertiser | undefined> {
    const updateData = { ...advertiserData, updatedAt: new Date() };
    const [advertiser] = await db.update(advertisers)
      .set(updateData)
      .where(eq(advertisers.id, id))
      .returning();
    return advertiser || undefined;
  }

  async deleteAdvertiser(id: number): Promise<boolean> {
    const result = await db.delete(advertisers).where(eq(advertisers.id, id));
    return result.rowCount > 0;
  }

  // Product methods
  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products).orderBy(desc(products.createdAt));
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.sku, sku));
    return product || undefined;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [created] = await db.insert(products).values(product).returning();
    return created;
  }

  async updateProduct(id: number, updateData: Partial<InsertProduct>): Promise<Product | undefined> {
    const data = { ...updateData, updatedAt: new Date() };
    const [product] = await db.update(products)
      .set(data)
      .where(eq(products.id, id))
      .returning();
    return product || undefined;
  }

  async deleteProduct(id: number): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id));
    return result.rowCount > 0;
  }

  // Campaign methods
  async getUserCampaigns(userId: number): Promise<Campaign[]> {
    return await db.select().from(campaigns)
      .where(eq(campaigns.userId, userId))
      .orderBy(desc(campaigns.createdAt));
  }

  async getAllCampaigns(): Promise<Campaign[]> {
    return await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  }

  async getCampaign(id: number): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return campaign || undefined;
  }

  async createCampaign(campaign: InsertCampaign, userId: number): Promise<Campaign> {
    const campaignData = { ...campaign, userId };
    const [created] = await db.insert(campaigns).values(campaignData).returning();
    return created;
  }

  async updateCampaignStatus(id: number, status: string): Promise<Campaign | undefined> {
    const updateData = { status, updatedAt: new Date() };
    const [campaign] = await db.update(campaigns)
      .set(updateData)
      .where(eq(campaigns.id, id))
      .returning();
    return campaign || undefined;
  }

  async deleteCampaign(id: number): Promise<boolean> {
    // Delete related records first to avoid foreign key constraint violations

    // 1. Delete click tracking records
    await db.delete(clickTracking).where(eq(clickTracking.campaignId, id));

    // 2. Delete performance reports
    await db.delete(performanceReports).where(eq(performanceReports.campaignId, id));

    // 3. Delete leads associated with this campaign (set campaignId to null instead)
    await db.update(leads)
      .set({ campaignId: null })
      .where(eq(leads.campaignId, id));

    // 4. Finally, delete the campaign
    const result = await db.delete(campaigns).where(eq(campaigns.id, id));
    return result.rowCount > 0;
  }

  // Lead methods
  async getAllLeads(userId?: number): Promise<Lead[]> {
    const query = db.select().from(leads);
    if (userId) {
      return await query.where(eq(leads.userId, userId)).orderBy(desc(leads.createdAt));
    }
    return await query.orderBy(desc(leads.createdAt));
  }

  async getLead(id: number): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead || undefined;
  }

  async createLead(lead: InsertLead, userId: number): Promise<Lead> {
    const leadNumber = `LEAD-${Date.now()}-${userId}`;
    const leadData = { ...lead, userId, leadNumber };
    const [created] = await db.insert(leads).values(leadData).returning();
    return created;
  }

  async updateLeadStatus(id: number, status: string): Promise<Lead | undefined> {
    const updateData: { status: string; updatedAt?: Date } = { status };
    if (status === "sale") {
      updateData.updatedAt = new Date();
    }
    
    const [lead] = await db.update(leads)
      .set(updateData)
      .where(eq(leads.id, id))
      .returning();
    return lead || undefined;
  }

  // Lead Items methods
  async getLeadItems(leadId: number): Promise<LeadItem[]> {
    return await db.select().from(leadItems).where(eq(leadItems.leadId, leadId));
  }

  async addLeadItem(item: InsertLeadItem): Promise<LeadItem> {
    const [created] = await db.insert(leadItems).values(item).returning();
    return created;
  }

  // Transaction methods
  async getUserTransactions(userId: number): Promise<Transaction[]> {
    return await db.select().from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt));
  }

  async createTransaction(transaction: InsertTransaction | { 
    type: any; 
    amount: string; 
    description?: string; 
    status?: any;
    leadId?: number;
  }, userId: number): Promise<Transaction> {
    const transactionData = { 
      ...transaction, 
      userId,
      amount: typeof transaction.amount === 'string' ? transaction.amount : transaction.amount.toString()
    };
    const [created] = await db.insert(transactions).values(transactionData).returning();
    return created;
  }

  async updateTransactionStatus(id: number, status: string, paymentProof?: string): Promise<Transaction | undefined> {
    const updateData: any = { status, updatedAt: new Date() };
    if (paymentProof) {
      updateData.paymentProof = paymentProof;
    }
    if (status === "completed") {
      updateData.processedAt = new Date();
    }
    
    const [transaction] = await db.update(transactions)
      .set(updateData)
      .where(eq(transactions.id, id))
      .returning();
    return transaction || undefined;
  }

  async getUserBalance(userId: number): Promise<number> {
    const result = await db.select({
      balance: sql<number>`COALESCE(SUM(CASE
        WHEN type IN ('deposit', 'commission', 'bonus') THEN CAST(amount AS DECIMAL)
        WHEN type IN ('withdrawal', 'adjustment') THEN -CAST(amount AS DECIMAL)
        ELSE 0 END), 0)`
    })
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      eq(transactions.status, "completed" as any)
    ));

    return Number(result[0]?.balance || 0);
  }

  /**
   * SECURITY FIX: Creates a withdrawal with database-level locking to prevent race conditions
   *
   * This method uses a pessimistic lock (SELECT FOR UPDATE) to ensure that the balance
   * cannot be modified by concurrent transactions. This prevents double-spending attacks
   * where multiple withdrawal requests could be processed simultaneously.
   *
   * @param userId - User ID requesting the withdrawal
   * @param amount - Withdrawal amount (positive number)
   * @param withdrawal - Withdrawal transaction data
   * @returns Result object with success flag, transaction, or error message
   */
  async createWithdrawalWithLock(
    userId: number,
    amount: number,
    withdrawal: InsertTransaction
  ): Promise<{ success: boolean; transaction?: Transaction; error?: string }> {
    try {
      // Use a database transaction with row-level locking
      const result = await db.transaction(async (tx) => {
        // 1. Lock all completed transactions for this user (SELECT FOR UPDATE)
        // This prevents other transactions from reading/writing balance until we commit
        const balanceResult = await tx
          .select({
            balance: sql<number>`COALESCE(SUM(CASE
              WHEN type IN ('deposit', 'commission', 'bonus') THEN CAST(amount AS DECIMAL)
              WHEN type IN ('withdrawal', 'adjustment') THEN -CAST(amount AS DECIMAL)
              ELSE 0 END), 0)`
          })
          .from(transactions)
          .where(and(
            eq(transactions.userId, userId),
            eq(transactions.status, "completed" as any)
          ))
          .for('update'); // PESSIMISTIC LOCK - crucial for preventing race conditions

        const currentBalance = Number(balanceResult[0]?.balance || 0);

        console.log('[Withdrawal] Balance check with lock:', {
          userId,
          currentBalance,
          requestedAmount: amount,
          timestamp: new Date().toISOString()
        });

        // 2. Verify balance is sufficient (with lock held)
        if (amount > currentBalance) {
          console.warn('[Withdrawal] Insufficient balance detected:', {
            userId,
            currentBalance,
            requestedAmount: amount
          });
          throw new Error("Insufficient balance");
        }

        // 3. Create withdrawal transaction (lock still held)
        const [transaction] = await tx
          .insert(transactions)
          .values({ ...withdrawal, userId })
          .returning();

        console.log('[Withdrawal] Transaction created with lock:', {
          transactionId: transaction.id,
          userId,
          amount,
          newBalance: currentBalance - amount
        });

        // 4. Commit transaction (releases lock)
        return { success: true, transaction };
      });

      return result;
    } catch (error) {
      console.error('[Withdrawal] Transaction failed:', {
        userId,
        amount,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Click tracking methods
  async trackClick(clickData: Partial<ClickTrack>): Promise<ClickTrack> {
    const clickId = clickData.clickId || crypto.randomUUID();
    const data = { ...clickData, clickId };
    const [tracked] = await db.insert(clickTracking).values(data).returning();
    return tracked;
  }

  async getClickStats(userId: number, startDate?: Date, endDate?: Date): Promise<any> {
    let query = db.select({
      totalClicks: count(),
      uniqueClicks: sql<number>`COUNT(DISTINCT ip_address)`,
      conversions: sql<number>`COUNT(*) FILTER (WHERE is_converted = true)`
    }).from(clickTracking).where(eq(clickTracking.userId, userId));

    if (startDate && endDate) {
      query = query.where(and(
        eq(clickTracking.userId, userId),
        gte(clickTracking.createdAt, startDate),
        lte(clickTracking.createdAt, endDate)
      ));
    }

    const [stats] = await query;
    return stats;
  }

  // Postback methods
  async createPostback(postbackData: Partial<Postback>): Promise<Postback> {
    const [postback] = await db.insert(postbacks).values(postbackData).returning();
    return postback;
  }

  async getPendingPostbacks(): Promise<Postback[]> {
    return await db.select().from(postbacks)
      .where(eq(postbacks.status, "pending"))
      .orderBy(asc(postbacks.createdAt));
  }

  async updatePostbackStatus(id: number, status: string, response?: any): Promise<void> {
    const updateData: any = { 
      status, 
      lastAttempt: new Date(),
      attempts: sql`attempts + 1`
    };
    if (response) {
      updateData.response = response;
    }
    
    await db.update(postbacks)
      .set(updateData)
      .where(eq(postbacks.id, id));
  }

  // Performance reporting
  async generatePerformanceReport(userId: number, date: Date): Promise<PerformanceReport> {
    // Implementation would aggregate stats for the given date
    const reportData = {
      userId,
      date,
      clicks: 0,
      leads: 0,
      sales: 0,
      revenue: "0.00",
      commission: "0.00",
      conversionRate: "0.00",
      costPerLead: "0.00",
      returnOnInvestment: "0.00"
    };
    
    const [report] = await db.insert(performanceReports).values(reportData).returning();
    return report;
  }

  async getPerformanceReports(userId: number, startDate?: Date, endDate?: Date): Promise<PerformanceReport[]> {
    let query = db.select().from(performanceReports).where(eq(performanceReports.userId, userId));
    
    if (startDate && endDate) {
      query = query.where(and(
        eq(performanceReports.userId, userId),
        gte(performanceReports.date, startDate),
        lte(performanceReports.date, endDate)
      ));
    }
    
    return await query.orderBy(desc(performanceReports.date));
  }

  // Lead conversion
  async convertLead(leadId: number, conversionData: { value: number; commission: number }): Promise<void> {
    await db.update(leads)
      .set({
        status: "sale" as any,
        isConverted: true,
        conversionTime: new Date(),
        conversionValue: conversionData.value.toString(),
        commission: conversionData.commission.toString(),
        updatedAt: new Date()
      })
      .where(eq(leads.id, leadId));
  }


  async getAllOrders(userId?: number): Promise<Order[]> {
    return await this.getAllLeads(userId) as Order[];
  }

  async getOrder(id: number): Promise<Order | undefined> {
    return await this.getLead(id) as Order | undefined;
  }

  async createOrder(order: InsertOrder, userId: number): Promise<Order> {
    return await this.createLead(order as InsertLead, userId) as Order;
  }

  async updateOrderStatus(id: number, status: string): Promise<Order | undefined> {
    return await this.updateLeadStatus(id, status) as Order | undefined;
  }

  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    return await this.getLeadItems(orderId) as OrderItem[];
  }

  async addOrderItem(item: InsertOrderItem): Promise<OrderItem> {
    return await this.addLeadItem(item as InsertLeadItem) as OrderItem;
  }

  async getUserConnections(userId: number): Promise<Connection[]> {
    return await this.getUserCampaigns(userId) as Connection[];
  }

  async getAllConnections(): Promise<Connection[]> {
    return await this.getAllCampaigns() as Connection[];
  }

  async getConnection(id: number): Promise<Connection | undefined> {
    return await this.getCampaign(id) as Connection | undefined;
  }

  async createConnection(connection: InsertConnection, userId: number): Promise<Connection> {
    return await this.createCampaign(connection as InsertCampaign, userId) as Connection;
  }

  async updateConnectionStatus(id: number, status: string): Promise<Connection | undefined> {
    return await this.updateCampaignStatus(id, status) as Connection | undefined;
  }

  async deleteConnection(id: number): Promise<boolean> {
    return await this.deleteCampaign(id);
  }

  // Demo data seeding
  async seedDemoProducts() {
    const demoProducts = [
      {
        name: "iPhone 15 Pro",
        description: "Latest iPhone with advanced camera system",
        category: "Electronics",
        sku: "IPHONE15PRO",
        price: "999.00",
        commission: "50.00",
        commissionType: "fixed" as any,
        landingPageUrl: "https://example.com/iphone15",
        isActive: true
      },
      {
        name: "Curso de Marketing Digital",
        description: "Aprende marketing digital desde cero",
        category: "Education",
        sku: "MKTCOURSE01",
        price: "297.00", 
        commission: "89.10",
        commissionType: "percentage" as any,
        landingPageUrl: "https://example.com/marketing-course",
        isActive: true
      }
    ];

    for (const product of demoProducts) {
      await this.createProduct(offer);
    }
  }

  async seedDemoLeads(userId: number) {
    // Get first offer to associate with leads
    const products = await this.getAllProducts();
    const firstProduct = products[0];
    
    if (!firstProduct) {
      console.warn("No products found for demo leads. Skipping lead seeding.");
      return;
    }

    const demoLeads = [
      {
        customerName: "Juan Pérez",
        customerEmail: "juan@example.com",
        customerPhone: "+34666777888",
        customerCity: "Madrid",
        customerCountry: "Spain",
        productId: firstProduct.id,
        status: "sale" as any,
        quality: "premium",
        value: "50.00",
        commission: "15.00",
        isConverted: false,
        postbackSent: false
      },
      {
        customerName: "María García",
        customerEmail: "maria@example.com", 
        customerPhone: "+34666777889",
        customerCity: "Barcelona",
        customerCountry: "Spain",
        productId: firstProduct.id,
        status: "hold" as any,
        quality: "standard",
        value: "30.00",
        commission: "9.00",
        isConverted: false,
        postbackSent: false
      }
    ];

    for (const lead of demoLeads) {
      await this.createLead(lead, userId);
    }
  }

  async seedDemoCampaigns(userId: number) {
    const demoCampaigns = [
      {
        name: "Facebook Campaign",
        description: "Campaña promocional en Facebook",
        status: "active" as any,
        budget: "1000.00",
        spent: "250.00"
      },
      {
        name: "Google Ads Campaign", 
        description: "Campaña de Google Ads para leads",
        status: "active" as any,
        budget: "2000.00", 
        spent: "500.00"
      }
    ];

    for (const campaign of demoCampaigns) {
      await this.createCampaign(campaign, userId);
    }
  }

  async seedDemoTransactions(userId: number) {
    const demoTransactions = [
      {
        type: "commission" as any,
        amount: "15.00",
        status: "completed" as any,
        description: "Comisión por venta exitosa"
      },
      {
        type: "commission" as any,
        amount: "9.00", 
        status: "pending" as any,
        description: "Comisión pendiente de aprobación"
      }
    ];

    for (const transaction of demoTransactions) {
      await this.createTransaction(transaction, userId);
    }
  }

  // Legacy aliases (removed duplicate seedDemoProducts to avoid recursion)
  async seedDemoOrders(userId: number): Promise<void> {
    await this.seedDemoLeads(userId);
  }

  async seedDemoConnections(userId: number): Promise<void> {
    await this.seedDemoCampaigns(userId);
  }
}

export const storage = new DatabaseStorage();