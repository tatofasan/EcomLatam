import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import SidebarNav from "@/components/sidebar-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

// Sample data - this would typically come from API
const orders = [
  {
    id: 1,
    orderNumber: "ORD-001-2025",
    customer: "John Doe",
    email: "john.doe@example.com",
    date: "2025-04-23",
    total: 125.99,
    status: "delivered",
    items: [
      { name: "Product A", quantity: 2, price: 49.99 },
      { name: "Product B", quantity: 1, price: 26.01 }
    ],
    shippingAddress: "123 Main St, New York, NY 10001",
    trackingNumber: "TRK123456789US"
  },
  {
    id: 2,
    orderNumber: "ORD-002-2025",
    customer: "Jane Smith",
    email: "jane.smith@example.com",
    date: "2025-04-22",
    total: 199.50,
    status: "processing",
    items: [
      { name: "Product C", quantity: 1, price: 199.50 }
    ],
    shippingAddress: "456 Market St, San Francisco, CA 94105"
  },
  {
    id: 3,
    orderNumber: "ORD-003-2025",
    customer: "Robert Johnson",
    email: "robert.johnson@example.com",
    date: "2025-04-21",
    total: 75.25,
    status: "pending",
    items: [
      { name: "Product D", quantity: 3, price: 15.25 },
      { name: "Product E", quantity: 1, price: 29.50 }
    ],
    shippingAddress: "789 Broad St, Boston, MA 02110"
  },
  {
    id: 4,
    orderNumber: "ORD-004-2025",
    customer: "Maria Garcia",
    email: "maria.garcia@example.com",
    date: "2025-04-20",
    total: 299.99,
    status: "shipped",
    items: [
      { name: "Product F", quantity: 1, price: 299.99 }
    ],
    shippingAddress: "101 Pine St, Seattle, WA 98101",
    trackingNumber: "TRK987654321US"
  },
  {
    id: 5,
    orderNumber: "ORD-005-2025",
    customer: "David Brown",
    email: "david.brown@example.com",
    date: "2025-04-19",
    total: 45.00,
    status: "cancelled",
    items: [
      { name: "Product G", quantity: 2, price: 22.50 }
    ],
    shippingAddress: "222 Oak St, Chicago, IL 60601"
  }
];

export default function OrdersPage() {
  const { user } = useAuth();
  const [activeItem, setActiveItem] = useState("orders");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  useEffect(() => {
    setActiveItem("orders");
  }, []);

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
      order.customer.toLowerCase().includes(searchTerm.toLowerCase());
    
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

  const openOrderDetails = (order: any) => {
    setSelectedOrder(order);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SidebarNav activeItem={activeItem} user={user} />
      
      <main className="flex-1 p-6 pl-[220px]">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Orders</h1>
            <p className="text-gray-500 mt-1">Manage and track customer orders</p>
          </div>
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
        
        {/* Filters and search */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input 
                placeholder="Search orders..." 
                className="pl-10" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="w-[200px]">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All orders</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Orders table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Order History</CardTitle>
            <CardDescription>View and manage all your customer orders</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Order</th>
                    <th className="text-left py-3 px-4 font-medium">Customer</th>
                    <th className="text-left py-3 px-4 font-medium">Date</th>
                    <th className="text-left py-3 px-4 font-medium">Total</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-right py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="border-b hover:bg-gray-50">
                      <td className="py-4 px-4 font-medium">{order.orderNumber}</td>
                      <td className="py-4 px-4">
                        <div>
                          <p>{order.customer}</p>
                          <p className="text-gray-500 text-xs">{order.email}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4">{order.date}</td>
                      <td className="py-4 px-4">${order.total.toFixed(2)}</td>
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
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        
        {/* Order Details Dialog */}
        {selectedOrder && (
          <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Order Details</DialogTitle>
                <DialogDescription>
                  Order #{selectedOrder.orderNumber}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Customer Information</h4>
                    <div className="border rounded-md p-3 bg-gray-50">
                      <p className="font-medium">{selectedOrder.customer}</p>
                      <p className="text-sm text-gray-500">{selectedOrder.email}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Order Status</h4>
                    <div className="border rounded-md p-3 bg-gray-50">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span className="text-sm">{selectedOrder.date}</span>
                        </div>
                        {getStatusBadge(selectedOrder.status)}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Shipping Information</h4>
                  <div className="border rounded-md p-3 bg-gray-50 mb-2">
                    <p className="text-sm">{selectedOrder.shippingAddress}</p>
                  </div>
                  {selectedOrder.trackingNumber && (
                    <div className="flex items-center text-sm">
                      <TruckIcon className="h-4 w-4 text-gray-500 mr-1" />
                      <span className="text-gray-500 mr-2">Tracking:</span>
                      <span className="font-medium">{selectedOrder.trackingNumber}</span>
                    </div>
                  )}
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Order Items</h4>
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="text-left py-2 px-3">Item</th>
                          <th className="text-center py-2 px-3">Quantity</th>
                          <th className="text-center py-2 px-3">Price</th>
                          <th className="text-right py-2 px-3">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrder.items.map((item: any, idx: number) => (
                          <tr key={idx} className={idx < selectedOrder.items.length - 1 ? "border-b" : ""}>
                            <td className="py-3 px-3">{item.name}</td>
                            <td className="py-3 px-3 text-center">{item.quantity}</td>
                            <td className="py-3 px-3 text-center">${item.price.toFixed(2)}</td>
                            <td className="py-3 px-3 text-right">${(item.quantity * item.price).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t bg-gray-50">
                          <td colSpan={3} className="py-3 px-3 text-right font-medium">Total:</td>
                          <td className="py-3 px-3 text-right font-medium">${selectedOrder.total.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
              
              <DialogFooter className="flex gap-2">
                <Button variant="outline">Print Invoice</Button>
                <Button>Update Status</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </main>
    </div>
  );
}