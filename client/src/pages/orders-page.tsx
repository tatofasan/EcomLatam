import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardLayout from "@/components/layout/dashboard-layout";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  ShoppingCart,
  Search,
  Calendar,
  Filter,
  Download,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  TruckIcon,
  AlertCircle,
  CalendarRange,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, subDays, isAfter, isBefore, isEqual } from "date-fns";
import { es } from "date-fns/locale";
import Pagination from "@/components/pagination";

// DateRange interface
interface DateRange {
  from: Date;
  to?: Date;
}

// Type definitions for data from the API
interface OrderType {
  id: number;
  userId: number;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  status: string;
  totalAmount: number;
  notes: string;
  utmSource?: string;
  createdAt: string;
  updatedAt: string;
  // Índice para poder acceder a propiedades con strings
  [key: string]: string | number | undefined;
}

interface OrderItemType {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  price: number;
  subtotal: number;
  productName?: string;
}

interface OrderWithItems extends Omit<OrderType, 'items'> {
  items?: OrderItemType[];
  [key: string]: OrderItemType[] | string | number | undefined;
}

export default function OrdersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeItem, setActiveItem] = useState("orders");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [orders, setOrders] = useState<OrderType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
  // Date filter - default to last 30 days
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  
  // Sort states
  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Function to load order details
  const fetchOrderDetails = async (orderId: number) => {
    try {
      const response = await fetch(`/api/orders/${orderId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch order details: ${response.statusText}`);
      }
      
      const data = await response.json() as OrderWithItems;
      setSelectedOrder(data);
    } catch (err) {
      console.error("Error fetching order details:", err);
      toast({
        title: "Error",
        description: "Failed to load order details. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Function to load orders from API
  const loadOrders = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/orders');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.statusText}`);
      }
      
      const data = await response.json() as OrderType[];
      setOrders(data);
      setError(null);
    } catch (err) {
      console.error("Error fetching orders:", err);
      setError("Failed to load orders. Please try again.");
      toast({
        title: "Error",
        description: "Failed to load orders. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to update order status
  const updateOrderStatus = async (orderId: number, status: string) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update order: ${response.statusText}`);
      }
      
      // Close dialog and reload orders
      setSelectedOrder(null);
      await loadOrders();
      
      toast({
        title: "Order updated",
        description: `Order status has been updated to ${status}.`,
      });
    } catch (err) {
      console.error("Error updating order:", err);
      toast({
        title: "Error",
        description: "Failed to update order. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Load orders on mount
  useEffect(() => {
    setActiveItem("orders");
    loadOrders();
  }, []);

  // Filter orders based on all criteria
  const filteredOrders = useMemo(() => {
    // First filter the orders
    const filtered = orders.filter(order => {
      // Text search filter
      const matchesSearch =
        (order.orderNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.customerEmail || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      // Status filter
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      
      // Date range filter
      const orderDate = new Date(order.createdAt);
      let matchesDateRange = true;
      
      if (dateRange.from) {
        // Set time to beginning of day for "from" date
        const fromDate = new Date(dateRange.from);
        fromDate.setHours(0, 0, 0, 0);
        
        // Check if order date is on or after the fromDate
        matchesDateRange = matchesDateRange && 
          (isAfter(orderDate, fromDate) || isEqual(orderDate, fromDate));
      }
      
      if (dateRange.to) {
        // Set time to end of day for "to" date
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        
        // Check if order date is on or before the toDate
        matchesDateRange = matchesDateRange && 
          (isBefore(orderDate, toDate) || isEqual(orderDate, toDate));
      }
      
      return matchesSearch && matchesStatus && matchesDateRange;
    });
    
    // Then sort the filtered orders
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      
      // Handle different data types for different fields
      if (sortField === "createdAt" || sortField === "updatedAt") {
        // Date comparison
        comparison = new Date(a[sortField]).getTime() - new Date(b[sortField]).getTime();
      } else if (sortField === "totalAmount") {
        // Number comparison
        comparison = a[sortField] - b[sortField];
      } else {
        // String comparison for other fields
        const aValue = String(a[sortField] || "").toLowerCase();
        const bValue = String(b[sortField] || "").toLowerCase();
        comparison = aValue.localeCompare(bValue);
      }
      
      // Apply sort direction
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [orders, searchTerm, statusFilter, dateRange, sortField, sortDirection]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sale":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 flex items-center gap-1 font-medium">
            <CheckCircle2 className="h-3 w-3" />
            Sale
          </Badge>
        );
      case "hold":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 flex items-center gap-1 font-medium">
            <Clock className="h-3 w-3" />
            Hold
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 flex items-center gap-1 font-medium">
            <XCircle className="h-3 w-3" />
            Rejected
          </Badge>
        );
      case "trash":
        return (
          <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200 flex items-center gap-1 font-medium">
            <XCircle className="h-3 w-3" />
            Trash
          </Badge>
        );
      default:
        return null;
    }
  };

  const openOrderDetails = async (order: OrderType) => {
    // Fetch the details including items
    await fetchOrderDetails(order.id);
  };
  
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
  
  // Function to export orders to Excel
  const exportToExcel = () => {
    try {
      // Prepare the data for Excel
      const ordersForExport = filteredOrders.map(order => ({
        "Número de Pedido": order.orderNumber,
        "Cliente": order.customerName,
        "Correo": order.customerEmail,
        "Teléfono": order.customerPhone || "N/A",
        "Dirección": order.shippingAddress,
        "Estado": order.status === "pending" ? "Pendiente" :
                 order.status === "processing" ? "En proceso" :
                 order.status === "shipped" ? "Enviado" :
                 order.status === "delivered" ? "Entregado" :
                 order.status === "cancelled" ? "Cancelado" : order.status,
        "Total": `$${order.totalAmount.toFixed(2)}`,
        "Fecha": new Date(order.createdAt).toLocaleDateString(),
        "Notas": order.notes || "N/A"
      }));
      
      // Create a worksheet from the data
      const worksheet = XLSX.utils.json_to_sheet(ordersForExport);
      
      // Create a workbook and add the worksheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Pedidos");
      
      // Generate and save the Excel file
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
      
      // Use date for the filename
      const today = new Date().toISOString().slice(0, 10);
      saveAs(blob, `pedidos_${today}.xlsx`);
      
      toast({
        title: "Exportación completada",
        description: "Los pedidos han sido exportados a Excel exitosamente.",
      });
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast({
        title: "Error de exportación",
        description: "No se pudieron exportar los pedidos. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout activeItem="orders-list">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-primary">Pedidos</h1>
            <p className="text-muted-foreground mt-1">Gestiona y realiza seguimiento de los pedidos</p>
          </div>
          <Button 
            variant="outline"
            className="flex items-center gap-2"
            onClick={exportToExcel}
            disabled={isLoading || error !== null || filteredOrders.length === 0}
          >
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
        
        {/* Filters and search */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input 
                placeholder="Buscar pedidos..." 
                className="pl-10" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          {/* Date Range Selector */}
          <div className="w-[230px]">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarRange className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd/MM/yyyy")} -{" "}
                        {format(dateRange.to, "dd/MM/yyyy")}
                      </>
                    ) : (
                      format(dateRange.from, "dd/MM/yyyy")
                    )
                  ) : (
                    <span>Seleccionar rango de fechas</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={{
                    from: dateRange.from,
                    to: dateRange.to
                  }}
                  onSelect={(range) => {
                    if (range) {
                      setDateRange(range);
                    }
                  }}
                  numberOfMonths={2}
                  locale={es}
                />
                <div className="p-3 border-t border-border flex justify-between">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setDateRange({
                      from: subDays(new Date(), 30),
                      to: new Date(),
                    })}
                  >
                    Últimos 30 días
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setDateRange({
                      from: subDays(new Date(), 90),
                      to: new Date(),
                    })}
                  >
                    Últimos 90 días
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          {/* Status Filter */}
          <div className="w-[200px]">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Orders</SelectItem>
                <SelectItem value="sale">Sale</SelectItem>
                <SelectItem value="hold">Hold</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="trash">Trash</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Orders table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Historial de Pedidos</CardTitle>
            <CardDescription>Ver y gestionar todos los pedidos de clientes</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center space-x-4 py-4">
                    <Skeleton className="h-5 w-[100px]" />
                    <Skeleton className="h-5 w-[150px]" />
                    <Skeleton className="h-5 w-[100px]" />
                    <Skeleton className="h-5 w-[80px]" />
                    <Skeleton className="h-5 w-[100px]" />
                    <Skeleton className="h-9 w-16 ml-auto" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 my-4">
                <div className="flex gap-2 items-start">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <h3 className="font-medium text-destructive">Error cargando los pedidos</h3>
                    <p className="text-destructive/80 text-sm">{error}</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => loadOrders()}
                    >
                      Intentar de nuevo
                    </Button>
                  </div>
                </div>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-8 bg-accent/50 border border-border rounded-lg">
                <ShoppingCart className="h-12 w-12 text-primary/60 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-foreground mb-2">No hay pedidos</h3>
                <p className="text-muted-foreground">No se encontraron pedidos con los filtros actuales.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-accent/50">
                      <th
                        className="text-left py-3 px-4 font-medium text-primary cursor-pointer select-none"
                        onClick={() => handleSort("id")}
                      >
                        <div className="flex items-center">
                          ID
                          {sortField === "id" && (
                            <span className="ml-1">
                              {sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        className="text-left py-3 px-4 font-medium text-primary cursor-pointer select-none"
                        onClick={() => handleSort("customerName")}
                      >
                        <div className="flex items-center">
                          Customer
                          {sortField === "customerName" && (
                            <span className="ml-1">
                              {sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        className="text-left py-3 px-4 font-medium text-primary cursor-pointer select-none"
                        onClick={() => handleSort("createdAt")}
                      >
                        <div className="flex items-center">
                          Date
                          {sortField === "createdAt" && (
                            <span className="ml-1">
                              {sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        className="text-left py-3 px-4 font-medium text-primary cursor-pointer select-none"
                        onClick={() => handleSort("totalAmount")}
                      >
                        <div className="flex items-center">
                          Total
                          {sortField === "totalAmount" && (
                            <span className="ml-1">
                              {sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        className="text-left py-3 px-4 font-medium text-primary cursor-pointer select-none"
                        onClick={() => handleSort("status")}
                      >
                        <div className="flex items-center">
                          Status
                          {sortField === "status" && (
                            <span className="ml-1">
                              {sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </span>
                          )}
                        </div>
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-primary">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders
                      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                      .map((order) => (
                        <tr key={order.id} className="border-b border-border hover:bg-accent/20">
                          <td className="py-4 px-4 text-muted-foreground">#{order.id}</td>
                          <td className="py-4 px-4">
                            <div>
                              <p>{order.customerName}</p>
                              <p className="text-muted-foreground text-xs">{order.customerEmail}</p>
                            </div>
                          </td>
                          <td className="py-4 px-4">{new Date(order.createdAt).toLocaleDateString()}</td>
                          <td className="py-4 px-4 font-medium text-primary">${(order.totalAmount || 0).toFixed(2)}</td>
                          <td className="py-4 px-4">
                            {getStatusBadge(order.status)}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openOrderDetails(order)}
                              className="hover:bg-primary/10 hover:text-primary"
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                
                {/* Items Per Page & Pagination Controls */}
                <div className="mt-6">
                  {/* Items Per Page Selector */}
                  <div className="flex justify-end mb-4">
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
                  
                  {/* Pagination */}
                  <Pagination
                    currentPage={currentPage}
                    totalPages={Math.ceil(filteredOrders.length / itemsPerPage)}
                    onPageChange={setCurrentPage}
                    totalItems={filteredOrders.length}
                    itemsPerPage={itemsPerPage}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Order Details Dialog */}
        {selectedOrder && (
          <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Order Details</DialogTitle>
                <DialogDescription>
                  Order #{selectedOrder.orderNumber} (ID: {selectedOrder.id})
                </DialogDescription>
              </DialogHeader>
              
              {/* Loading state */}
              {!selectedOrder.items ? (
                <div className="py-10">
                  <div className="flex justify-center mb-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-32 mx-auto mb-2" />
                  <Skeleton className="h-4 w-48 mx-auto" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* VALIDATION ERROR ALERT - Show when order is in trash */}
                  {selectedOrder.status === 'trash' && selectedOrder.notes && selectedOrder.notes.includes('VALIDATION FAILED') && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex gap-3">
                        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-red-900 mb-2">⚠️ Order Automatically Marked as Trash</h4>
                          <p className="text-sm text-red-800 mb-3">
                            This order {selectedOrder.utmSource === 'shopify' ? 'from Shopify' : 'from API'} failed validation checks and was automatically marked as trash. Please review the errors below:
                          </p>
                          <div className="bg-white border border-red-200 rounded p-3">
                            <pre className="text-xs text-red-900 whitespace-pre-wrap font-mono">
                              {selectedOrder.notes}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-primary mb-2">Customer Information</h4>
                      <div className="border rounded-md p-3 bg-accent">
                        <p className="font-medium">{selectedOrder.customerName}</p>
                        <p className="text-sm text-muted-foreground">{selectedOrder.customerEmail}</p>
                        {selectedOrder.customerPhone && (
                          <p className="text-sm text-muted-foreground">{selectedOrder.customerPhone}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-primary mb-2">Order Status</h4>
                      <div className="border rounded-md p-3 bg-accent">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 mb-1">
                              <Calendar className="h-4 w-4 text-primary" />
                              <span className="text-sm">Created: {new Date(selectedOrder.createdAt).toLocaleDateString()}</span>
                            </div>
                            {selectedOrder.status === "sale" && (
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="text-sm">Sold: {new Date(selectedOrder.updatedAt).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                          {getStatusBadge(selectedOrder.status)}
                        </div>
                        {(selectedOrder as any).commission && (
                          <div className="pt-2 border-t border-border mt-2">
                            <span className="text-sm text-muted-foreground">Commission: </span>
                            <span className="text-sm font-medium text-green-600">${parseFloat((selectedOrder as any).commission || '0').toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-primary mb-2">Shipping Information</h4>
                    <div className="border rounded-md p-3 bg-accent mb-2">
                      <p className="text-sm">{selectedOrder.shippingAddress}</p>
                      {(selectedOrder as any).customerCity && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {(selectedOrder as any).customerCity}
                          {(selectedOrder as any).customerCountry && `, ${(selectedOrder as any).customerCountry}`}
                        </p>
                      )}
                    </div>
                    {selectedOrder.notes && (
                      <div className="flex items-center text-sm">
                        <FileText className="h-4 w-4 text-primary mr-1" />
                        <span className="text-muted-foreground mr-2">Notes:</span>
                        <span className="font-medium">{selectedOrder.notes}</span>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-primary mb-2">Order Items</h4>
                    <div className="border rounded-md overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-accent border-b">
                            <th className="text-left py-2 px-3 font-medium">Product</th>
                            <th className="text-center py-2 px-3 font-medium">Quantity</th>
                            <th className="text-center py-2 px-3 font-medium">Price</th>
                            <th className="text-right py-2 px-3 font-medium">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedOrder.items.map((item, idx) => (
                            <tr key={idx} className={idx < selectedOrder.items!.length - 1 ? "border-b" : ""}>
                              <td className="py-3 px-3">{item.productName || `Product #${item.productId}`}</td>
                              <td className="py-3 px-3 text-center">{item.quantity}</td>
                              <td className="py-3 px-3 text-center">${Number(item.price).toFixed(2)}</td>
                              <td className="py-3 px-3 text-right">${Number(item.subtotal).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t bg-accent">
                            <td colSpan={3} className="py-3 px-3 text-right font-medium">Total:</td>
                            <td className="py-3 px-3 text-right font-medium text-primary">${Number(selectedOrder.totalAmount).toFixed(2)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              
              <DialogFooter className="flex gap-2">
                <Button variant="outline">Print Invoice</Button>
                {/* Only show status update dropdown for admin or finance users */}
                {user && (user.role === 'admin' || user.role === 'finance') && (
                  <Select
                    onValueChange={(value) => updateOrderStatus(selectedOrder.id, value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Update Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sale">Sale</SelectItem>
                      <SelectItem value="hold">Hold</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="trash">Trash</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
}