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
  status: string;
  sku: string;
  imageUrl: string;
  category?: string;
  weight?: number;
  dimensions?: string;
  supplier?: string;
  additionalImages?: string[];
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