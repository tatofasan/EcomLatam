/**
 * Shopify OAuth Handler
 *
 * This module handles the OAuth flow for Shopify app installation
 */

import crypto from 'crypto';
import { shopify, OAUTH_CONFIG } from './config';
import { db } from '../../db';
import { shopifyStores } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { ShopifyOAuthQuery, ShopifyAccessTokenResponse } from './types';

/**
 * Generate OAuth authorization URL
 */
export const generateAuthUrl = async (shop: string, userId: number): Promise<string> => {
  // Validate shop domain
  if (!isValidShopDomain(shop)) {
    throw new Error('Invalid shop domain');
  }

  // Generate a secure random state for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');

  // Store state temporarily (in production, use Redis or similar)
  // For now, we'll encode userId in the state (not recommended for production)
  const stateWithUserId = `${userId}:${state}`;

  // Build authorization URL
  const authUrl = `https://${shop}/admin/oauth/authorize?` +
    `client_id=${OAUTH_CONFIG.apiKey}&` +
    `scope=${OAUTH_CONFIG.scopes.join(',')}&` +
    `redirect_uri=${encodeURIComponent(OAUTH_CONFIG.redirectUri)}&` +
    `state=${stateWithUserId}`;

  return authUrl;
};

/**
 * Validate shop domain
 */
export const isValidShopDomain = (shop: string): boolean => {
  const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/;
  return shopRegex.test(shop);
};

/**
 * Verify HMAC signature from Shopify
 */
export const verifyHmac = (query: ShopifyOAuthQuery): boolean => {
  const { hmac, ...params } = query;

  if (!hmac) {
    return false;
  }

  // Build message from query parameters
  const message = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key as keyof typeof params]}`)
    .join('&');

  // Generate HMAC
  const generatedHmac = crypto
    .createHmac('sha256', OAUTH_CONFIG.apiSecret)
    .update(message)
    .digest('hex');

  return generatedHmac === hmac;
};

/**
 * Exchange authorization code for access token
 */
export const exchangeCodeForToken = async (
  shop: string,
  code: string
): Promise<ShopifyAccessTokenResponse> => {
  try {
    const tokenUrl = `https://${shop}/admin/oauth/access_token`;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: OAUTH_CONFIG.apiKey,
        client_secret: OAUTH_CONFIG.apiSecret,
        code,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to exchange code for token: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data as ShopifyAccessTokenResponse;
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    throw error;
  }
};

/**
 * Save shop credentials to database
 */
export const saveShopCredentials = async (
  userId: number,
  shop: string,
  accessToken: string,
  scopes: string
) => {
  try {
    // Check if shop already exists
    const existingStore = await db
      .select()
      .from(shopifyStores)
      .where(eq(shopifyStores.shop, shop))
      .limit(1);

    if (existingStore.length > 0) {
      // Update existing store
      const [updated] = await db
        .update(shopifyStores)
        .set({
          userId,
          accessToken,
          scopes,
          status: 'active',
          installedAt: new Date(),
          uninstalledAt: null,
          updatedAt: new Date(),
        })
        .where(eq(shopifyStores.shop, shop))
        .returning();

      return updated;
    } else {
      // Insert new store
      const [inserted] = await db
        .insert(shopifyStores)
        .values({
          userId,
          shop,
          accessToken,
          scopes,
          status: 'active',
          settings: {
            autoImportOrders: true,
            autoFulfillOrders: false,
            autoSyncInventory: false,
          },
        })
        .returning();

      return inserted;
    }
  } catch (error) {
    console.error('Error saving shop credentials:', error);
    throw error;
  }
};

/**
 * Get shop credentials from database
 */
export const getShopCredentials = async (shop: string) => {
  try {
    const [store] = await db
      .select()
      .from(shopifyStores)
      .where(eq(shopifyStores.shop, shop))
      .limit(1);

    return store;
  } catch (error) {
    console.error('Error getting shop credentials:', error);
    throw error;
  }
};

/**
 * Get shop credentials by user ID
 */
export const getShopCredentialsByUserId = async (userId: number) => {
  try {
    const stores = await db
      .select()
      .from(shopifyStores)
      .where(eq(shopifyStores.userId, userId));

    return stores;
  } catch (error) {
    console.error('Error getting shop credentials by user ID:', error);
    throw error;
  }
};

/**
 * Mark shop as uninstalled
 */
export const markShopUninstalled = async (shop: string) => {
  try {
    await db
      .update(shopifyStores)
      .set({
        status: 'inactive',
        uninstalledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(shopifyStores.shop, shop));
  } catch (error) {
    console.error('Error marking shop as uninstalled:', error);
    throw error;
  }
};

/**
 * Delete shop credentials
 */
export const deleteShopCredentials = async (shop: string) => {
  try {
    await db.delete(shopifyStores).where(eq(shopifyStores.shop, shop));
  } catch (error) {
    console.error('Error deleting shop credentials:', error);
    throw error;
  }
};

export default {
  generateAuthUrl,
  isValidShopDomain,
  verifyHmac,
  exchangeCodeForToken,
  saveShopCredentials,
  getShopCredentials,
  getShopCredentialsByUserId,
  markShopUninstalled,
  deleteShopCredentials,
};
