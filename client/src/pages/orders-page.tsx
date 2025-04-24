import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import SidebarNav from "@/components/sidebar-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
  AlertCircle
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

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
  createdAt: string;
  updatedAt: string;
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

interface OrderWithItems extends OrderType {
  items?: OrderItemType[];
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
    
    // Seed demo data and then load orders
    const seedDemoData = async () => {
      try {
        const response = await fetch('/api/seed', { method: 'POST' });
        if (response.ok) {
          console.log("Demo data seeded successfully");
        }
      } catch (err) {
        console.error("Error seeding demo data:", err);
      }
      
      // Load orders regardless of seeding success
      loadOrders();
    };
    
    seedDemoData();
  }, []);

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerEmail.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "delivered":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Delivered
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Processing
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "shipped":
        return (
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center gap-1">
            <TruckIcon className="h-3 w-3" />
            Shipped
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Cancelled
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

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SidebarNav activeItem={activeItem} user={user} />
      
      <main className="flex-1 p-6 pl-[220px]">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Pedidos</h1>
            <p className="text-gray-500 mt-1">Gestiona y realiza seguimiento de los pedidos</p>
          </div>
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
        
        {/* Filters and search */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[300px]">
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
          <div className="w-[200px]">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los pedidos</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="processing">En proceso</SelectItem>
                <SelectItem value="shipped">Enviados</SelectItem>
                <SelectItem value="delivered">Entregados</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
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
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-4">
                <div className="flex gap-2 items-start">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-red-800">Error cargando los pedidos</h3>
                    <p className="text-red-700 text-sm">{error}</p>
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
              <div className="text-center py-8">
                <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-800 mb-2">No hay pedidos</h3>
                <p className="text-gray-600">No se encontraron pedidos con los filtros actuales.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Pedido</th>
                      <th className="text-left py-3 px-4 font-medium">Cliente</th>
                      <th className="text-left py-3 px-4 font-medium">Fecha</th>
                      <th className="text-left py-3 px-4 font-medium">Total</th>
                      <th className="text-left py-3 px-4 font-medium">Estado</th>
                      <th className="text-right py-3 px-4 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="border-b hover:bg-gray-50">
                        <td className="py-4 px-4 font-medium">{order.orderNumber}</td>
                        <td className="py-4 px-4">
                          <div>
                            <p>{order.customerName}</p>
                            <p className="text-gray-500 text-xs">{order.customerEmail}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4">{new Date(order.createdAt).toLocaleDateString()}</td>
                        <td className="py-4 px-4">${order.totalAmount.toFixed(2)}</td>
                        <td className="py-4 px-4">
                          {getStatusBadge(order.status)}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => openOrderDetails(order)}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Ver
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Order Details Dialog */}
        {selectedOrder && (
          <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Detalles del Pedido</DialogTitle>
                <DialogDescription>
                  Pedido #{selectedOrder.orderNumber}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Información del Cliente</h4>
                      <div className="border rounded-md p-3 bg-gray-50">
                        <p className="font-medium">{selectedOrder.customerName}</p>
                        <p className="text-sm text-gray-500">{selectedOrder.customerEmail}</p>
                        {selectedOrder.customerPhone && (
                          <p className="text-sm text-gray-500">{selectedOrder.customerPhone}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Estado del Pedido</h4>
                      <div className="border rounded-md p-3 bg-gray-50">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-500" />
                            <span className="text-sm">{new Date(selectedOrder.createdAt).toLocaleDateString()}</span>
                          </div>
                          {getStatusBadge(selectedOrder.status)}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Información de Envío</h4>
                    <div className="border rounded-md p-3 bg-gray-50 mb-2">
                      <p className="text-sm">{selectedOrder.shippingAddress}</p>
                    </div>
                    {selectedOrder.notes && (
                      <div className="flex items-center text-sm">
                        <FileText className="h-4 w-4 text-gray-500 mr-1" />
                        <span className="text-gray-500 mr-2">Notas:</span>
                        <span className="font-medium">{selectedOrder.notes}</span>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Items del Pedido</h4>
                    <div className="border rounded-md overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b">
                            <th className="text-left py-2 px-3">Producto</th>
                            <th className="text-center py-2 px-3">Cantidad</th>
                            <th className="text-center py-2 px-3">Precio</th>
                            <th className="text-right py-2 px-3">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedOrder.items.map((item, idx) => (
                            <tr key={idx} className={idx < selectedOrder.items!.length - 1 ? "border-b" : ""}>
                              <td className="py-3 px-3">{item.productName || `Producto #${item.productId}`}</td>
                              <td className="py-3 px-3 text-center">{item.quantity}</td>
                              <td className="py-3 px-3 text-center">${item.price.toFixed(2)}</td>
                              <td className="py-3 px-3 text-right">${item.subtotal.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t bg-gray-50">
                            <td colSpan={3} className="py-3 px-3 text-right font-medium">Total:</td>
                            <td className="py-3 px-3 text-right font-medium">${selectedOrder.totalAmount.toFixed(2)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              
              <DialogFooter className="flex gap-2">
                <Button variant="outline">Imprimir Factura</Button>
                <Select 
                  onValueChange={(value) => updateOrderStatus(selectedOrder.id, value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Actualizar Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="processing">En Proceso</SelectItem>
                    <SelectItem value="shipped">Enviado</SelectItem>
                    <SelectItem value="delivered">Entregado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </main>
    </div>
  );
}