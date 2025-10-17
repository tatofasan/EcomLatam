import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/layout/dashboard-layout";
import ProductCard from "@/components/product-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import {
  Package,
  ShoppingCart,
  CreditCard,
  TrendingUp,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Flame
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { Product } from "@/types";

// Color constants
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

// Dashboard metrics type
interface DashboardMetrics {
  totalOffers: number;
  totalLeads: number;
  totalRevenue: number;
  totalPayout: number;
  recentLeads: Array<{
    id: number;
    leadNumber: string;
    customerName: string;
    value: string;
    status: string;
    createdAt: string;
  }>;
  leadStatus: {
    sale: number;
    hold: number;
    rejected: number;
    trash: number;
    total: number;
  };
  salesData: Array<{
    name: string;
    sales: number;
    orders: number;
  }>;
  offerCategoriesData: Array<{
    name: string;
    value: number;
  }>;
  hotProducts: Product[];
}

export default function HomePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isAdmin = user?.role === 'admin';

  // Fetch dashboard metrics based on user role
  const { data: metrics, isLoading, error } = useQuery<DashboardMetrics>({
    queryKey: ["/api/dashboard/metrics"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/metrics");
      if (!res.ok) throw new Error("Failed to fetch dashboard metrics");
      return await res.json();
    }
  });

  // Handle product click - navigate to products page
  const handleProductClick = (product: Product) => {
    setLocation('/products');
  };

  return (
    <DashboardLayout activeItem="dashboard">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {isAdmin ? 'Admin view (all metrics)' : 'Metrics of your orders and products'}
            </p>
          </div>
          <p className="text-sm text-gray-500">Welcome, {user?.username}</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Error loading dashboard data. Please try again.
            </AlertDescription>
          </Alert>
        ) : metrics ? (
          <>
            {/* Metrics Overview */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
              <Card>
                <CardContent className="p-4 flex items-center">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mr-4">
                    <CheckCircle2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Sales</p>
                    <h3 className="text-2xl font-bold">{metrics.leadStatus.sale}</h3>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 flex items-center">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mr-4">
                    <ShoppingCart className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Leads</p>
                    <h3 className="text-2xl font-bold">{metrics.totalLeads}</h3>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 flex items-center">
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mr-4">
                    <CreditCard className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Revenue</p>
                    <h3 className="text-2xl font-bold">${metrics.totalRevenue.toLocaleString()}</h3>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 flex items-center">
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mr-4">
                    <TrendingUp className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Payout</p>
                    <h3 className="text-2xl font-bold">${metrics.totalPayout.toLocaleString()}</h3>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Charts Section */}
            <div className="grid grid-cols-1 gap-6 mb-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Sales Summary</CardTitle>
                  <CardDescription>Monthly sales performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={metrics.salesData || []}
                        margin={{
                          top: 5,
                          right: 30,
                          left: 20,
                          bottom: 5,
                        }}
                      >
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(value) => value} />
                        <Legend />
                        <Bar name="Delivered Orders" dataKey="sales" fill="#4f46e5" barSize={30} />
                        <Bar name="Total Orders" dataKey="orders" fill="#0ea5e9" barSize={30} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Offer Categories</CardTitle>
                  <CardDescription>Distribution by category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    {metrics.offerCategoriesData && Array.isArray(metrics.offerCategoriesData) && metrics.offerCategoriesData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={metrics.offerCategoriesData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {metrics.offerCategoriesData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <p className="text-muted-foreground">No offer category data available</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Hot Products */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500" />
                  Hot Products
                </CardTitle>
                <CardDescription>
                  Top selling products
                </CardDescription>
              </CardHeader>
              <CardContent>
                {metrics.hotProducts && metrics.hotProducts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {metrics.hotProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        viewMode="grid"
                        onClick={handleProductClick}
                        isAdmin={isAdmin}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-center">
                    <Flame className="h-12 w-12 text-gray-300 mb-3" />
                    <p className="text-lg font-medium text-gray-500">No hot products yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Products with sales in the last 7 days will appear here
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}