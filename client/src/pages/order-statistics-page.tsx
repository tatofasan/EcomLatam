import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  Loader2,
  CalendarRange,
  Package2,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import Pagination from "@/components/pagination";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Order, Product } from "@/types";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subDays } from "date-fns";

interface OrderStatsByDay {
  date: string;
  sale: number;
  hold: number;
  rejected: number;
  trash: number;
  total: number;
  salePercentage: number;
  payout: number;
}

interface OrderForStats {
  id: number;
  createdAt: string;
  updatedAt?: string; // date of last activity
  status: string;
  totalAmount: number;
  payout: number;
  orderItems?: Array<{
    id: number;
    productId: number;
    productName?: string;
    quantity: number;
    price: number;
  }>;
}

export default function OrderStatisticsPage() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [statistics, setStatistics] = useState<OrderStatsByDay[]>([]);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
  // Filters
  const [useActivityDate, setUseActivityDate] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  
  // Sorting states
  const [sortField, setSortField] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  
  // Helper functions to calculate totals for all statistics
  const calcTotalsByStatus = useMemo(() => {
    return {
      sale: statistics.reduce((sum, stat) => sum + stat.sale, 0),
      hold: statistics.reduce((sum, stat) => sum + stat.hold, 0),
      rejected: statistics.reduce((sum, stat) => sum + stat.rejected, 0),
      trash: statistics.reduce((sum, stat) => sum + stat.trash, 0),
      total: statistics.reduce((sum, stat) => sum + stat.total, 0),
      payout: statistics.reduce((sum, stat) => sum + stat.payout, 0),
    };
  }, [statistics]);
  
  // Calculate overall sale percentage
  const totalSalePercentage = useMemo(() => {
    const { sale, total } = calcTotalsByStatus;
    return total > 0 ? (sale / total * 100).toFixed(2) : "0.00";
  }, [calcTotalsByStatus]);

  // Get user role - no data regeneration in production

  // Get user role
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  // Fetch orders based on user role - admin gets all orders, regular users only see their orders
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
    if (dateRange?.from || dateRange?.to) {
      filteredOrders = filteredOrders.filter(order => {
        const orderDate = new Date(useActivityDate && order.updatedAt ? order.updatedAt : order.createdAt);
        
        if (dateRange?.from && dateRange?.to) {
          return orderDate >= dateRange.from && orderDate <= dateRange.to;
        } else if (dateRange?.from) {
          return orderDate >= dateRange.from;
        } else if (dateRange?.to) {
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
      
      // Format the date as YYYY-MM-DD for grouping
      const date = new Date(dateString).toISOString().split('T')[0];
      
      if (!acc[date]) {
        acc[date] = [];
      }
      
      acc[date].push(order);
      return acc;
    }, {});

    // Calculate statistics for each day
    const stats = Object.entries(ordersByDate).map(([date, dayOrders]) => {
      const sale = dayOrders.filter((order: OrderForStats) => order.status === 'sale').length;
      const hold = dayOrders.filter((order: OrderForStats) => order.status === 'hold').length;
      const rejected = dayOrders.filter((order: OrderForStats) => order.status === 'rejected').length;
      const trash = dayOrders.filter((order: OrderForStats) => order.status === 'trash').length;
      const total = dayOrders.length;
      
      // Calculate sale percentage
      const salePercentage = total > 0 ? (sale / total) * 100 : 0;
      
      // Calculate total payout from sale orders
      const payout = dayOrders
        .filter((order: OrderForStats) => order.status === 'sale')
        .reduce((sum: number, order: OrderForStats) => sum + (parseFloat(order.payout as any) || 0), 0);
      
      return {
        date,
        sale,
        hold,
        rejected,
        trash,
        total,
        salePercentage,
        payout
      };
    });

    // Sort the statistics based on sort field and direction
    const sortedStats = [...stats].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case "date":
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case "sale":
        case "hold":
        case "rejected":
        case "trash":
        case "total":
          comparison = a[sortField] - b[sortField];
          break;
        case "salePercentage":
          comparison = a.salePercentage - b.salePercentage;
          break;
        case "payout":
          comparison = a.payout - b.payout;
          break;
        default:
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });
    
    setStatistics(sortedStats);
  }, [orders, selectedProductId, dateRange, useActivityDate, sortField, sortDirection]);
  
  // Function to handle sort change
  const handleSort = (field: string) => {
    // If clicking the same field, toggle direction
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // If clicking a new field, set it as the sort field and default to asc
      setSortField(field);
      setSortDirection("asc");
    }
  };
  
  // Fix TypeScript error with date range reset
  const resetFilters = () => {
    setSelectedProductId(null);
    setDateRange({
      from: subDays(new Date(), 30),
      to: new Date(),
    });
    setUseActivityDate(false);
  };

  return (
    <DashboardLayout activeItem="orders-statistics">
      <div className="p-3 md:p-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 mb-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Lead Statistics</h1>
            <p className="text-sm text-muted-foreground">
              {isAdmin 
                ? 'Admin view (all leads)' 
                : 'Your lead statistics'}
            </p>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-2 md:space-y-0">
                <div className="flex flex-col space-y-1">
                  <CardTitle>Daily Lead Summary</CardTitle>
                  <CardDescription className="hidden md:block">View and analyze lead data by day</CardDescription>
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
                    {/* Unified Date Range Picker */}
                    <div className="md:col-span-2">
                      <Label htmlFor="date-range" className="mb-1 block">Date Range</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            id="date-range"
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            <CalendarRange className="mr-2 h-4 w-4" />
                            {dateRange?.from ? (
                              dateRange.to ? (
                                <>
                                  {format(dateRange.from, "PPP")} - {format(dateRange.to, "PPP")}
                                </>
                              ) : (
                                format(dateRange.from, "PPP")
                              )
                            ) : (
                              <span>Pick a date range</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="range"
                            selected={dateRange}
                            onSelect={setDateRange}
                            numberOfMonths={2}
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
                      onClick={resetFilters}
                    >
                      Reset Filters
                    </Button>
                  </div>
                </div>
                {/* Table display for medium and large screens */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableCaption>A summary of orders by day</TableCaption>
                    <TableHeader>
                      <TableRow className="border-b border-border bg-accent/50">
                        <TableHead 
                          className="text-left py-3 px-4 font-medium text-primary cursor-pointer select-none whitespace-nowrap"
                          onClick={() => handleSort("date")}
                        >
                          Date
                          {sortField === "date" && (
                            <span className="inline-flex ml-1">
                              {sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </span>
                          )}
                        </TableHead>
                        <TableHead 
                          className="text-left py-3 px-4 font-medium text-primary cursor-pointer select-none whitespace-nowrap"
                          onClick={() => handleSort("sale")}
                        >
                          Sale
                          {sortField === "sale" && (
                            <span className="inline-flex ml-1">
                              {sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </span>
                          )}
                        </TableHead>
                        <TableHead 
                          className="text-left py-3 px-4 font-medium text-primary cursor-pointer select-none whitespace-nowrap"
                          onClick={() => handleSort("hold")}
                        >
                          Hold
                          {sortField === "hold" && (
                            <span className="inline-flex ml-1">
                              {sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </span>
                          )}
                        </TableHead>
                        <TableHead 
                          className="text-left py-3 px-4 font-medium text-primary cursor-pointer select-none whitespace-nowrap"
                          onClick={() => handleSort("rejected")}
                        >
                          Rejected
                          {sortField === "rejected" && (
                            <span className="inline-flex ml-1">
                              {sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </span>
                          )}
                        </TableHead>
                        <TableHead 
                          className="text-left py-3 px-4 font-medium text-primary cursor-pointer select-none whitespace-nowrap"
                          onClick={() => handleSort("trash")}
                        >
                          Trash
                          {sortField === "trash" && (
                            <span className="inline-flex ml-1">
                              {sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </span>
                          )}
                        </TableHead>
                        <TableHead 
                          className="text-left py-3 px-4 font-medium text-primary cursor-pointer select-none whitespace-nowrap"
                          onClick={() => handleSort("total")}
                        >
                          Total Leads
                          {sortField === "total" && (
                            <span className="inline-flex ml-1">
                              {sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </span>
                          )}
                        </TableHead>
                        <TableHead 
                          className="text-right py-3 px-4 font-medium text-primary cursor-pointer select-none whitespace-nowrap"
                          onClick={() => handleSort("payout")}
                        >
                          Payout
                          {sortField === "payout" && (
                            <span className="inline-flex ml-1">
                              {sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </span>
                          )}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statistics.length > 0 ? (
                        // Apply pagination to the statistics data
                        statistics
                          .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                          .map((stat) => (
                            <TableRow key={stat.date}>
                              <TableCell className="font-medium whitespace-nowrap">{stat.date}</TableCell>
                              <TableCell>{stat.sale}</TableCell>
                              <TableCell>{stat.hold}</TableCell>
                              <TableCell>{stat.rejected}</TableCell>
                              <TableCell>{stat.trash}</TableCell>
                              <TableCell>{stat.total}</TableCell>
                              <TableCell className="text-right">${stat.payout.toFixed(2)}</TableCell>
                            </TableRow>
                          ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center">No lead data available</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                    {statistics.length > 0 && (
                      <TableFooter className="bg-muted/50">
                        <TableRow className="font-bold">
                          <TableCell>Total (All Pages)</TableCell>
                          <TableCell>{calcTotalsByStatus.sale}</TableCell>
                          <TableCell>{calcTotalsByStatus.hold}</TableCell>
                          <TableCell>{calcTotalsByStatus.rejected}</TableCell>
                          <TableCell>{calcTotalsByStatus.trash}</TableCell>
                          <TableCell>{calcTotalsByStatus.total}</TableCell>
                          <TableCell className="text-right">
                            ${calcTotalsByStatus.payout.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    )}
                  </Table>
                  
                  {/* Items Per Page Selector */}
                  {statistics.length > 0 && (
                    <div className="flex justify-end mt-6 mb-4">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="items-per-page" className="text-sm whitespace-nowrap">Items per page:</Label>
                        <Select
                          value={itemsPerPage.toString()}
                          onValueChange={(value) => {
                            setItemsPerPage(Number(value));
                            setCurrentPage(1); // Reset to first page when changing items per page
                          }}
                        >
                          <SelectTrigger className="w-[80px]">
                            <SelectValue placeholder="20" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  
                  {/* Pagination */}
                  {statistics.length > 0 && (
                    <Pagination
                      currentPage={currentPage}
                      totalPages={Math.ceil(statistics.length / itemsPerPage)}
                      onPageChange={setCurrentPage}
                      totalItems={statistics.length}
                      itemsPerPage={itemsPerPage}
                    />
                  )}
                </div>
                
                {/* Card display for mobile devices */}
                <div className="md:hidden space-y-4">
                  <h3 className="text-center text-muted-foreground mb-2">Order Summary by Day</h3>
                  
                  {statistics.length > 0 ? (
                    <>
                      {/* Paginated mobile cards */}
                      {statistics
                        .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                        .map((stat) => (
                          <div key={stat.date} className="bg-card border rounded-lg p-4 shadow-sm">
                            <div className="flex justify-between items-center border-b pb-2 mb-2">
                              <h4 className="font-semibold">{stat.date}</h4>
                              <span className="bg-primary/10 text-primary px-2 py-1 rounded-md text-xs">
                                Total: {stat.total}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground">Sale</span>
                                <span className="font-medium">{stat.sale}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground">Hold</span>
                                <span className="font-medium">{stat.hold}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground">Rejected</span>
                                <span className="font-medium">{stat.rejected}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground">Trash</span>
                                <span className="font-medium">{stat.trash}</span>
                              </div>
                            </div>
                            
                            <div className="flex justify-between items-center pt-2 border-t">
                              <span className="text-xs text-green-600 font-medium">${stat.payout.toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      
                      {/* Totals Card for Mobile */}
                      <div className="bg-muted/50 border border-primary/20 rounded-lg p-4 shadow-sm mt-4">
                        <div className="flex justify-between items-center border-b border-muted-foreground/30 pb-2 mb-3">
                          <h4 className="font-bold">Total (All Pages)</h4>
                          <span className="bg-primary/20 text-primary px-2 py-1 rounded-md text-xs font-semibold">
                            {calcTotalsByStatus.total} Leads
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">Sale</span>
                            <span className="font-bold">{calcTotalsByStatus.sale}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">Hold</span>
                            <span className="font-bold">{calcTotalsByStatus.hold}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">Rejected</span>
                            <span className="font-bold">{calcTotalsByStatus.rejected}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">Trash</span>
                            <span className="font-bold">{calcTotalsByStatus.trash}</span>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center pt-2 border-t border-muted-foreground/30">
                          <span className="text-sm text-green-600 font-bold">
                            ${calcTotalsByStatus.payout.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      
                      {/* Items Per Page Selector for Mobile */}
                      <div className="flex justify-end mt-6 mb-4">
                        <div className="flex items-center space-x-2">
                          <Label htmlFor="items-per-page-mobile" className="text-xs whitespace-nowrap">Items per page:</Label>
                          <Select
                            value={itemsPerPage.toString()}
                            onValueChange={(value) => {
                              setItemsPerPage(Number(value));
                              setCurrentPage(1); // Reset to first page when changing items per page
                            }}
                          >
                            <SelectTrigger className="w-[70px] h-8 text-xs">
                              <SelectValue placeholder="20" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="20">20</SelectItem>
                              <SelectItem value="50">50</SelectItem>
                              <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      {/* Mobile Pagination */}
                      <div className="mt-2">
                        <Pagination
                          currentPage={currentPage}
                          totalPages={Math.ceil(statistics.length / itemsPerPage)}
                          onPageChange={setCurrentPage}
                          totalItems={statistics.length}
                          itemsPerPage={itemsPerPage}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="bg-muted/20 border rounded-lg p-4 text-center">
                      <Package2 className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No order data available</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}