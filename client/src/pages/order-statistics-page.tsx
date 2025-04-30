import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import SidebarNav from "@/components/sidebar-nav";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Order } from "@/types";

// Define the statistics data type
interface OrderStatsByDay {
  date: string;
  pending: number;
  processing: number;
  delivered: number;
  cancelled: number;
  total: number;
  deliveredPercentage: number;
  revenue: number;
}

// Define the order type used for statistics processing
interface OrderForStats {
  id: number;
  createdAt: string;
  status: string;
  totalAmount: number;
}

export default function OrderStatisticsPage() {
  const { user } = useAuth();
  const [statistics, setStatistics] = useState<OrderStatsByDay[]>([]);

  // Fetch orders
  const { data: orders, isLoading } = useQuery<OrderForStats[]>({
    queryKey: ["/api/orders"],
    queryFn: async () => {
      const res = await fetch("/api/orders");
      if (!res.ok) throw new Error("Failed to fetch orders");
      return res.json();
    },
  });

  // Process orders into daily statistics when orders data changes
  useEffect(() => {
    if (!orders) return;

    // Group orders by date
    const ordersByDate = orders.reduce((acc: Record<string, OrderForStats[]>, order) => {
      const date = new Date(order.createdAt).toISOString().split('T')[0];
      
      if (!acc[date]) {
        acc[date] = [];
      }
      
      acc[date].push(order);
      return acc;
    }, {});

    // Calculate statistics for each day
    const stats = Object.entries(ordersByDate).map(([date, dayOrders]) => {
      const pending = dayOrders.filter((order: OrderForStats) => order.status === 'pending').length;
      const processing = dayOrders.filter((order: OrderForStats) => order.status === 'processing').length;
      const delivered = dayOrders.filter((order: OrderForStats) => order.status === 'delivered').length;
      const cancelled = dayOrders.filter((order: OrderForStats) => order.status === 'cancelled').length;
      const total = dayOrders.length;
      
      // Calculate delivered percentage
      const deliveredPercentage = total > 0 ? (delivered / total) * 100 : 0;
      
      // Calculate revenue from delivered orders
      const revenue = dayOrders
        .filter((order: OrderForStats) => order.status === 'delivered')
        .reduce((sum: number, order: OrderForStats) => sum + order.totalAmount, 0);
      
      return {
        date,
        pending,
        processing,
        delivered,
        cancelled,
        total,
        deliveredPercentage,
        revenue
      };
    });

    // Sort by date descending (most recent first)
    stats.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    setStatistics(stats);
  }, [orders]);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <SidebarNav activeItem="orders-statistics" user={user} />

      {/* Main Content */}
      <main className="flex-1 ml-[200px] bg-secondary min-h-screen overflow-auto">
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-4">Order Statistics</h1>
          
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Daily Order Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableCaption>A summary of orders by day</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Pending</TableHead>
                      <TableHead>Processing</TableHead>
                      <TableHead>Delivered</TableHead>
                      <TableHead>Cancelled</TableHead>
                      <TableHead>Total Orders</TableHead>
                      <TableHead>Delivery %</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statistics.length > 0 ? (
                      statistics.map((stat) => (
                        <TableRow key={stat.date}>
                          <TableCell className="font-medium">{stat.date}</TableCell>
                          <TableCell>{stat.pending}</TableCell>
                          <TableCell>{stat.processing}</TableCell>
                          <TableCell>{stat.delivered}</TableCell>
                          <TableCell>{stat.cancelled}</TableCell>
                          <TableCell>{stat.total}</TableCell>
                          <TableCell>{stat.deliveredPercentage.toFixed(2)}%</TableCell>
                          <TableCell className="text-right">${stat.revenue.toFixed(2)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center">No order data available</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}