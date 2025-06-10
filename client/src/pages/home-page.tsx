import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/dashboard-layout";
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
  AlertCircle
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";

// Color constants
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

// Dashboard metrics type
interface DashboardMetrics {
  totalOffers: number;
  totalLeads: number;
  totalRevenue: number;
  totalCommission: number;
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
}

export default function HomePage() {
  const { user } = useAuth();
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
                    <p className="text-sm text-gray-500">Commission</p>
                    <h3 className="text-2xl font-bold">${metrics.totalCommission.toLocaleString()}</h3>
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
            
            {/* Recent Leads */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Leads</CardTitle>
                <CardDescription>
                  {isAdmin 
                    ? 'Latest leads from all users' 
                    : 'Your latest leads'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Lead</th>
                        <th className="text-left py-3 px-4 font-medium">Customer</th>
                        <th className="text-left py-3 px-4 font-medium">Value</th>
                        <th className="text-left py-3 px-4 font-medium">Date</th>
                        <th className="text-left py-3 px-4 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.recentLeads && metrics.recentLeads.length > 0 ? (
                        metrics.recentLeads.map((lead) => (
                          <tr key={lead.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">{lead.leadNumber}</td>
                            <td className="py-3 px-4">{lead.customerName}</td>
                            <td className="py-3 px-4">${parseFloat(lead.value || '0').toFixed(2)}</td>
                            <td className="py-3 px-4">
                              {format(new Date(lead.createdAt), "dd/MM/yyyy")}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                ${lead.status === 'sale' ? 'bg-green-100 text-green-800' : 
                                  lead.status === 'hold' ? 'bg-blue-100 text-blue-800' : 
                                    lead.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                      'bg-amber-100 text-amber-800'}`}>
                                {lead.status === 'sale' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : 
                                  lead.status === 'hold' ? <Clock className="w-3 h-3 mr-1" /> : 
                                    <Clock className="w-3 h-3 mr-1" />}
                                {lead.status ? lead.status.charAt(0).toUpperCase() + lead.status.slice(1) : 'Unknown'}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-muted-foreground">
                            No recent leads to display
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}