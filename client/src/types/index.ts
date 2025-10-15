// Tipos compartidos para toda la aplicación cliente

export interface User {
  id: number;
  username: string;
  fullName?: string;
  email?: string;
  role?: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  status: string; // "active" | "inactive" | "draft" | "low"
  sku: string;
  imageUrl: string;
  additionalImages?: string[] | null;
  weight?: number | null;
  dimensions?: string | null;
  category?: string | null;
  specifications?: Record<string, any> | null;
  reference?: string | null;
  provider?: string | null;
  userId?: number | null;
  payoutPo?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress: string;
  status: string;
  totalAmount: number;
  notes?: string;
  createdAt?: Date;
  items?: OrderItem[];
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  price: number;
  subtotal: number;
  productName?: string;
}

export interface Connection {
  id: number;
  platform: string;
  name: string;
  apiKey?: string;
  apiSecret?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  settings?: Record<string, any>;
  lastSync?: string;
  products?: number;
  orders?: number;
}

export interface Transaction {
  id: number;
  type: string;
  amount: number;
  status: string;
  description?: string;
  createdAt?: string;
  reference?: string;
}