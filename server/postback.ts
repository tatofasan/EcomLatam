import { storage } from "./storage";
import type { Lead, PostbackConfiguration, InsertPostbackNotification } from "@shared/schema";

export interface PostbackVariables {
  leadId: number;
  status: string;
  payout: number;
  publisherId: string;
  producto: string;
}

export class PostbackService {
  private static instance: PostbackService;

  public static getInstance(): PostbackService {
    if (!PostbackService.instance) {
      PostbackService.instance = new PostbackService();
    }
    return PostbackService.instance;
  }

  /**
   * Replace variables in URL template with actual values
   */
  private replaceVariables(url: string, variables: PostbackVariables): string {
    return url
      .replace(/\{leadId\}/g, variables.leadId.toString())
      .replace(/\{leadid\}/g, variables.leadId.toString())  // Support lowercase
      .replace(/\{status\}/g, variables.status)
      .replace(/\{payout\}/g, variables.payout.toString())
      .replace(/\{publisherId\}/g, variables.publisherId)
      .replace(/\{publisherid\}/g, variables.publisherId)  // Support lowercase
      .replace(/\{producto\}/g, encodeURIComponent(variables.producto))
      .replace(/\{product\}/g, encodeURIComponent(variables.producto));  // Support English variant
  }

  /**
   * Send HTTP request to postback URL
   */
  private async sendHttpRequest(url: string, userId: number, leadId: number): Promise<{
    success: boolean;
    httpStatus?: number;
    responseBody?: string;
    errorMessage?: string;
  }> {
    try {
      console.log(`Sending postback to: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Lead-Management-System/1.0',
          'Content-Type': 'application/json'
        },
        // Timeout de 30 segundos
        signal: AbortSignal.timeout(30000)
      });

      const responseBody = await response.text();
      const isSuccess = response.ok;

      // Log the notification in database
      await storage.createPostbackNotification({
        userId,
        leadId,
        url,
        status: isSuccess ? 'success' : 'failed',
        httpStatus: response.status,
        responseBody: responseBody.substring(0, 1000), // Limit response body length
        errorMessage: isSuccess ? null : `HTTP ${response.status}: ${response.statusText}`,
        retryCount: 0
      });

      return {
        success: isSuccess,
        httpStatus: response.status,
        responseBody,
        errorMessage: isSuccess ? undefined : `HTTP ${response.status}: ${response.statusText}`
      };

    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error occurred';

      console.error(`Postback failed for URL ${url}:`, error);

      // Log the failed notification
      await storage.createPostbackNotification({
        userId,
        leadId,
        url,
        status: 'failed',
        httpStatus: null,
        responseBody: null,
        errorMessage,
        retryCount: 0
      });

      return {
        success: false,
        errorMessage
      };
    }
  }

  /**
   * Calculate payout amount for a lead using hierarchical logic
   * Priority: Publisher-specific > Affiliate-level > Default product payout
   */
  private async calculatePayout(lead: Lead, userId: number): Promise<number> {
    try {
      // Get lead items to find the product(s)
      const leadItems = await storage.getLeadItems(lead.id);
      if (leadItems.length === 0) return 0;

      // For now, use the first product's payout amount
      // In the future, this could be enhanced to handle multiple products
      const firstItem = leadItems[0];

      // Try to get product by ID first
      let product = null;
      if (lead.productId) {
        product = await storage.getProduct(lead.productId);
      }

      if (!product) return 0;

      // Calculate payout using hierarchical logic with publisherId
      // This will automatically check:
      // 1. Publisher-specific exception (if publisherId provided)
      // 2. Affiliate-level exception (publisherId=NULL)
      // 3. Default product payout (product.payoutPo)
      const payoutAmount = await storage.calculatePayoutAmount(
        product.id,
        userId,
        lead.publisherId || undefined
      );

      return payoutAmount;
    } catch (error) {
      console.error('Error calculating payout:', error);
      return 0;
    }
  }

  /**
   * Send postback notification for a lead status change
   */
  public async sendPostback(lead: Lead, oldStatus?: string): Promise<void> {
    try {
      console.log(`Processing postback for lead ${lead.id}, status: ${lead.status}`);

      // Get user's postback configuration
      const config = await storage.getPostbackConfiguration(lead.userId);

      if (!config || !config.isEnabled) {
        console.log(`Postback disabled for user ${lead.userId}`);
        return;
      }

      // Determine which URL to use based on status
      let targetUrl: string | null = null;
      switch (lead.status) {
        case 'sale':
          targetUrl = config.saleUrl;
          break;
        case 'hold':
          targetUrl = config.holdUrl;
          break;
        case 'rejected':
          targetUrl = config.rejectedUrl;
          break;
        case 'trash':
          targetUrl = config.trashUrl;
          break;
        default:
          console.log(`No postback URL configured for status: ${lead.status}`);
          return;
      }

      if (!targetUrl) {
        console.log(`No URL configured for status ${lead.status} for user ${lead.userId}`);
        return;
      }

      // Calculate payout amount
      const payoutAmount = await this.calculatePayout(lead, lead.userId);

      // Get product information for the lead
      const product = await storage.getProduct(lead.productId);

      // Prepare variables for URL replacement
      const variables: PostbackVariables = {
        leadId: lead.id,
        status: lead.status,
        payout: payoutAmount,
        publisherId: lead.publisherId || lead.userId?.toString() || '',
        producto: product?.name || 'Unknown Product'
      };

      // Replace variables in URL
      const finalUrl = this.replaceVariables(targetUrl, variables);

      // Send the HTTP request
      await this.sendHttpRequest(finalUrl, lead.userId, lead.id);

    } catch (error) {
      console.error('Error in sendPostback:', error);
    }
  }

  /**
   * Test a postback URL with sample data
   */
  public async testPostbackUrl(url: string, userId: number): Promise<{
    success: boolean;
    httpStatus?: number;
    responseBody?: string;
    errorMessage?: string;
    testUrl?: string;
  }> {
    // Validate URL format first
    try {
      // Replace template variables with dummy values for URL validation
      const urlWithoutTemplates = url
        .replace(/\{leadId\}/g, '123')
        .replace(/\{leadid\}/g, '123')  // Support lowercase
        .replace(/\{status\}/g, 'sale')
        .replace(/\{payout\}/g, '25.00')
        .replace(/\{publisherId\}/g, 'pub123')
        .replace(/\{publisherid\}/g, 'pub123')  // Support lowercase
        .replace(/\{producto\}/g, 'product')
        .replace(/\{product\}/g, 'product');  // Support English variant

      new URL(urlWithoutTemplates);
    } catch (urlError) {
      return {
        success: false,
        errorMessage: 'Invalid URL format. Please check your URL syntax.'
      };
    }

    // Create sample variables for testing
    const testVariables: PostbackVariables = {
      leadId: 999999,
      status: 'sale',
      payout: 25.00,
      publisherId: userId.toString(),
      producto: 'Test Product'
    };

    const finalUrl = this.replaceVariables(url, testVariables);

    try {
      console.log(`Testing postback URL: ${finalUrl}`);

      const response = await fetch(finalUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Lead-Management-System/1.0 (Test)',
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(15000) // Shorter timeout for tests
      });

      const responseBody = await response.text();
      const isSuccess = response.ok;

      // Save test result to database
      await storage.createPostbackNotification({
        userId,
        leadId: null, // NULL for test postbacks
        url: finalUrl,
        status: isSuccess ? 'success' : 'failed',
        httpStatus: response.status,
        responseBody: responseBody.substring(0, 1000),
        errorMessage: isSuccess ? null : `HTTP ${response.status}: ${response.statusText}`,
        retryCount: 0
      });

      const result = {
        success: response.ok,
        httpStatus: response.status,
        responseBody: responseBody.substring(0, 500), // Limit response for display
        testUrl: finalUrl,
        errorMessage: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
      };

      console.log(`Postback test result:`, {
        success: result.success,
        httpStatus: result.httpStatus,
        url: finalUrl
      });

      return result;

    } catch (error: any) {
      const errorMessage = error.name === 'AbortError'
        ? 'URL test timed out (15 seconds). Please check if the URL is accessible.'
        : error.message || 'Network error occurred';

      console.error(`Postback test failed for URL ${finalUrl}:`, error);

      // Save failed test to database
      await storage.createPostbackNotification({
        userId,
        leadId: null, // NULL for test postbacks
        url: finalUrl,
        status: 'failed',
        httpStatus: null,
        responseBody: null,
        errorMessage,
        retryCount: 0
      });

      return {
        success: false,
        testUrl: finalUrl,
        errorMessage
      };
    }
  }
}

export const postbackService = PostbackService.getInstance();
