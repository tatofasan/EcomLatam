import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  CalendarRange,
  Package2,
  RefreshCw,
  Database
} from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Order, Product } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";

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
  updatedAt?: string; // fecha de última actividad
  status: string;
  totalAmount: number;
  orderItems?: Array<{
    id: number;
    productId: number;
    productName?: string;
    quantity: number;
    price: number;
  }>;
}

export default function OrderStatisticsPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);
  const [statistics, setStatistics] = useState<OrderStatsByDay[]>([]);
  
  // Filtros
  const [useActivityDate, setUseActivityDate] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined
  });

  // Mutación para regenerar los datos de estadísticas
  const regenerateDataMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/seed/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error regenerating data');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Data regenerated successfully",
        description: "New order statistics data has been created",
        variant: "default",
      });
      // Refrescar los datos
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error regenerating data",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Fetch orders
  const { data: orders, isLoading: ordersLoading } = useQuery<OrderForStats[]>({
    queryKey: ["/api/orders"],
    queryFn: async () => {
      const res = await fetch("/api/orders");
      if (!res.ok) throw new Error("Failed to fetch orders");
      return res.json();
    },
  });
  
  // Fetch products for filter
  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });
  
  const isLoading = ordersLoading || productsLoading;

  // Process orders into daily statistics when orders data changes or filters change
  useEffect(() => {
    if (!orders) return;

    // Filter orders first
    let filteredOrders = [...orders];
    
    // Apply product filter if selected
    if (selectedProductId) {
      filteredOrders = filteredOrders.filter(order => 
        order.orderItems?.some(item => item.productId === selectedProductId)
      );
    }
    
    // Apply date range filter if set
    if (dateRange.from || dateRange.to) {
      filteredOrders = filteredOrders.filter(order => {
        const orderDate = new Date(useActivityDate && order.updatedAt ? order.updatedAt : order.createdAt);
        
        if (dateRange.from && dateRange.to) {
          return orderDate >= dateRange.from && orderDate <= dateRange.to;
        } else if (dateRange.from) {
          return orderDate >= dateRange.from;
        } else if (dateRange.to) {
          return orderDate <= dateRange.to;
        }
        
        return true;
      });
    }

    // Group orders by date using selected date field (activity or creation)
    const ordersByDate = filteredOrders.reduce((acc: Record<string, OrderForStats[]>, order) => {
      // Use either activity date (updatedAt) or creation date based on the switch
      const dateString = useActivityDate && order.updatedAt 
        ? order.updatedAt 
        : order.createdAt;
        
      const date = new Date(dateString).toISOString().split('T')[0];
      
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
  }, [orders, selectedProductId, dateRange, useActivityDate]);

  // Escuchar cambios del sidebar desde SidebarNav
  useEffect(() => {
    function handleSidebarChange(e: CustomEvent) {
      setIsSidebarOpen(e.detail.isOpen);
    }
    window.addEventListener('sidebarToggle' as any, handleSidebarChange);
    return () => {
      window.removeEventListener('sidebarToggle' as any, handleSidebarChange);
    };
  }, []);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <SidebarNav activeItem="orders-statistics" user={user} />

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 bg-secondary min-h-screen overflow-auto ${isSidebarOpen ? 'md:ml-[200px]' : 'ml-0'}`}>
        <div className="p-3 md:p-6">
          <h1 className="text-xl md:text-2xl font-bold mb-4">Order Statistics</h1>
          
          {isLoading || regenerateDataMutation.isPending ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Información y botón para regenerar datos */}
              <div className="mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center mb-4">
                  <Alert>
                    <Database className="h-4 w-4" />
                    <AlertTitle>Statistics Visualization</AlertTitle>
                    <AlertDescription className="text-xs md:text-sm">
                      This page shows order statistics over time. Generate test data for better visualization.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="flex justify-center md:justify-end">
                    <Button 
                      variant="outline" 
                      className="flex items-center gap-1 w-full md:w-auto"
                      onClick={() => regenerateDataMutation.mutate()}
                      disabled={regenerateDataMutation.isPending}
                    >
                      {regenerateDataMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-1" />
                      )}
                      Regenerate Test Data
                    </Button>
                  </div>
                </div>
              </div>
              
              <Card>
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-2 md:space-y-0">
                  <div className="flex flex-col space-y-1">
                    <CardTitle>Daily Order Summary</CardTitle>
                    <CardDescription className="hidden md:block">View and analyze order data by day</CardDescription>
                  </div>
                  <div className="flex items-center space-x-2 bg-muted/30 p-1.5 rounded-md">
                    <Label htmlFor="date-type" className="text-xs md:text-sm truncate">Creation Date</Label>
                    <Switch 
                      id="date-type"
                      checked={useActivityDate} 
                      onCheckedChange={setUseActivityDate}
                    />
                    <Label htmlFor="date-type" className="text-xs md:text-sm truncate">Activity Date</Label>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Filters Section */}
                  <div className="bg-muted/40 p-4 rounded-md mb-6 space-y-4">
                    <h2 className="text-lg font-medium mb-2">Filters</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Product Filter */}
                      <div>
                        <Label htmlFor="product-filter" className="mb-1 block">Product</Label>
                        <Select
                          value={selectedProductId?.toString() || "all"}
                          onValueChange={(value) => setSelectedProductId(value === "all" ? null : Number(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All Products" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Products</SelectItem>
                            {products?.map((product) => (
                              <SelectItem key={product.id} value={product.id.toString()}>
                                {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Date Range - From */}
                      <div>
                        <Label htmlFor="date-from" className="mb-1 block">Date From</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              id="date-from"
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              <CalendarRange className="mr-2 h-4 w-4" />
                              {dateRange.from ? (
                                format(dateRange.from, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={dateRange.from}
                              onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      
                      {/* Date Range - To */}
                      <div>
                        <Label htmlFor="date-to" className="mb-1 block">Date To</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              id="date-to"
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              <CalendarRange className="mr-2 h-4 w-4" />
                              {dateRange.to ? (
                                format(dateRange.to, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={dateRange.to}
                              onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    
                    {/* Reset Filters */}
                    <div className="flex justify-end">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedProductId(null);
                          setDateRange({ from: undefined, to: undefined });
                          setUseActivityDate(false);
                        }}
                      >
                        Reset Filters
                      </Button>
                    </div>
                  </div>
                  {/* Visualización de tabla para pantallas medianas y grandes */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableCaption>A summary of orders by day</TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">Date</TableHead>
                          <TableHead className="whitespace-nowrap">Pending</TableHead>
                          <TableHead className="whitespace-nowrap">Processing</TableHead>
                          <TableHead className="whitespace-nowrap">Delivered</TableHead>
                          <TableHead className="whitespace-nowrap">Cancelled</TableHead>
                          <TableHead className="whitespace-nowrap">Total Orders</TableHead>
                          <TableHead className="whitespace-nowrap">Delivery %</TableHead>
                          <TableHead className="whitespace-nowrap text-right">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statistics.length > 0 ? (
                          statistics.map((stat) => (
                            <TableRow key={stat.date}>
                              <TableCell className="font-medium whitespace-nowrap">{stat.date}</TableCell>
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
                  </div>
                  
                  {/* Visualización de tarjetas para dispositivos móviles */}
                  <div className="md:hidden space-y-4">
                    <h3 className="text-center text-muted-foreground mb-2">Order Summary by Day</h3>
                    
                    {statistics.length > 0 ? (
                      statistics.map((stat) => (
                        <div key={stat.date} className="bg-card border rounded-lg p-4 shadow-sm">
                          <div className="flex justify-between items-center border-b pb-2 mb-2">
                            <h4 className="font-semibold">{stat.date}</h4>
                            <span className="bg-primary/10 text-primary px-2 py-1 rounded-md text-xs">
                              Total: {stat.total}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className="flex flex-col">
                              <span className="text-xs text-muted-foreground">Pending</span>
                              <span className="font-medium">{stat.pending}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs text-muted-foreground">Processing</span>
                              <span className="font-medium">{stat.processing}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs text-muted-foreground">Delivered</span>
                              <span className="font-medium">{stat.delivered}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs text-muted-foreground">Cancelled</span>
                              <span className="font-medium">{stat.cancelled}</span>
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center border-t pt-2">
                            <div>
                              <span className="text-xs text-muted-foreground block">Delivery Rate</span>
                              <span className="font-medium">{stat.deliveredPercentage.toFixed(2)}%</span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-muted-foreground block">Revenue</span>
                              <span className="font-medium">${stat.revenue.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No order data available
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}