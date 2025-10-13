import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, Package, ShoppingBag, Calendar, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";

interface ShopifyOrderItem {
  id: number;
  orderId: number;
  productName: string;
  quantity: number;
  price: number;
  subtotal: number;
}

interface ShopifyOrder {
  id: number;
  leadNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  customerCity: string | null;
  status: string;
  value: string;
  totalAmount: number;
  createdAt: string;
  customFields?: {
    shopifyOrderName?: string;
    shopifyOrderNumber?: number;
    shopifyFinancialStatus?: string;
    shopifyFulfillmentStatus?: string;
    shopifyShop?: string;
  };
  items: ShopifyOrderItem[];
}

interface ShopifyOrdersResponse {
  orders: ShopifyOrder[];
  count: number;
  dateRange: {
    from: string;
    to: string;
  };
}

const getStatusColor = (status: string): string => {
  const statusMap: Record<string, string> = {
    sale: "bg-green-500",
    hold: "bg-yellow-500",
    rejected: "bg-red-500",
    trash: "bg-gray-500",
  };
  return statusMap[status] || "bg-gray-500";
};

const getStatusLabel = (status: string): string => {
  const labelMap: Record<string, string> = {
    sale: "Venta",
    hold: "En Espera",
    rejected: "Rechazado",
    trash: "Descartado",
  };
  return labelMap[status] || status;
};

export default function ShopifyOrdersPage() {
  const [location] = useLocation();
  const [showInstallSuccess, setShowInstallSuccess] = useState(false);

  const { data, isLoading, error } = useQuery<ShopifyOrdersResponse>({
    queryKey: ["/api/orders/shopify/recent"],
    queryFn: async () => {
      const res = await fetch("/api/orders/shopify/recent");
      if (!res.ok) throw new Error("Failed to fetch Shopify orders");
      return await res.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Check if just installed
  useEffect(() => {
    const params = new URLSearchParams(location.split('?')[1]);
    if (params.get('installed') === 'true') {
      setShowInstallSuccess(true);
      // Auto-hide after 5 seconds
      setTimeout(() => setShowInstallSuccess(false), 5000);
    }
  }, [location]);

  return (
    <DashboardLayout activeItem="shopify-orders">
      <div className="p-6 space-y-6">
        {/* Installation Success Alert */}
        {showInstallSuccess && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              ¡App de Shopify instalada correctamente! Los pedidos nuevos se mostrarán aquí automáticamente.
            </AlertDescription>
          </Alert>
        )}

        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ShoppingBag className="h-8 w-8 text-primary" />
              Pedidos de Shopify
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Últimos 7 días • Actualización automática cada 30 segundos
            </p>
          </div>
          {data && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                {format(new Date(data.dateRange.from), "dd/MM/yyyy")} - {format(new Date(data.dateRange.to), "dd/MM/yyyy")}
              </span>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        {data && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4 flex items-center">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mr-4">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Pedidos</p>
                  <h3 className="text-2xl font-bold">{data.count}</h3>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mr-4">
                  <ShoppingBag className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ventas Confirmadas</p>
                  <h3 className="text-2xl font-bold">
                    {data.orders.filter((o) => o.status === "sale").length}
                  </h3>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mr-4">
                  <span className="text-2xl font-bold text-purple-600">$</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Valor Total</p>
                  <h3 className="text-2xl font-bold">
                    ${data.orders.reduce((sum, o) => sum + o.totalAmount, 0).toFixed(2)}
                  </h3>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Error al cargar pedidos de Shopify. Por favor intenta de nuevo.
            </AlertDescription>
          </Alert>
        )}

        {/* Orders Table */}
        {data && data.count > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pedidos Recientes</CardTitle>
              <CardDescription>
                Mostrando {data.count} pedidos de los últimos 7 días
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Productos</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          <div>
                            <div className="font-semibold">
                              {order.customFields?.shopifyOrderName || order.leadNumber}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {order.customFields?.shopifyShop || "Shopify"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{order.customerName}</div>
                            {order.customerEmail && (
                              <div className="text-xs text-muted-foreground">
                                {order.customerEmail}
                              </div>
                            )}
                            {order.customerCity && (
                              <div className="text-xs text-muted-foreground">
                                {order.customerCity}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {order.items.slice(0, 2).map((item) => (
                              <div key={item.id} className="text-sm">
                                <span className="font-medium">{item.quantity}x</span>{" "}
                                {item.productName}
                              </div>
                            ))}
                            {order.items.length > 2 && (
                              <div className="text-xs text-muted-foreground">
                                +{order.items.length - 2} más
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(order.status)}>
                            {getStatusLabel(order.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">
                          ${order.totalAmount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(order.createdAt), "dd/MM/yyyy HH:mm")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {data && data.count === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay pedidos recientes</h3>
              <p className="text-sm text-muted-foreground">
                No se han recibido pedidos de Shopify en los últimos 7 días.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
