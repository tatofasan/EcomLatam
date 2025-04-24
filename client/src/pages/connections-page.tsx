import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import SidebarNav from "@/components/sidebar-nav";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  PlusCircle,
  Link2, 
  ShoppingCart, 
  AlertCircle,
  Check,
  XCircle,
  ShoppingBag,
  Store,
  BarChart,
  Landmark
} from "lucide-react";

// Type definition for connection from the API
interface ConnectionType {
  id: number;
  userId: number;
  platform: string;
  name: string;
  apiKey?: string;
  apiSecret?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  settings?: Record<string, any>;
}

// Extended connection type with additional UI-specific fields
interface ConnectionWithStats extends ConnectionType {
  lastSync?: string;
  products?: number;
  orders?: number;
}

export default function ConnectionsPage() {
  const { user } = useAuth();
  const [activeItem, setActiveItem] = useState("connections");
  const [isLoading, setIsLoading] = useState(true);
  const [connections, setConnections] = useState<ConnectionWithStats[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Form state for creating a new connection
  const [formData, setFormData] = useState({
    name: "",
    platform: "shopify",
    apiKey: "",
    apiSecret: "",
  });

  // Function to load connections
  const loadConnections = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/connections');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch connections: ${response.statusText}`);
      }
      
      const data = await response.json() as ConnectionType[];
      
      // Add UI-specific fields to the API data
      const enhancedData: ConnectionWithStats[] = data.map(conn => ({
        ...conn,
        lastSync: new Date(conn.updatedAt).toLocaleString(),
        products: Math.floor(Math.random() * 100), // In a real app, you'd fetch this from a stats endpoint
        orders: Math.floor(Math.random() * 30),    // In a real app, you'd fetch this from a stats endpoint
      }));
      
      setConnections(enhancedData);
      setError(null);
    } catch (err) {
      console.error("Error fetching connections:", err);
      setError("Failed to load connections. Please try again.");
      toast({
        title: "Error",
        description: "Failed to load connections. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle creating a new connection
  const handleCreateConnection = async () => {
    try {
      const response = await fetch('/api/connections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          status: "active"
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create connection: ${response.statusText}`);
      }
      
      // Clear form data
      setFormData({
        name: "",
        platform: "shopify",
        apiKey: "",
        apiSecret: "",
      });
      
      // Reload connections
      await loadConnections();
      
      toast({
        title: "Connection created",
        description: "Your new connection has been created successfully.",
      });
    } catch (err) {
      console.error("Error creating connection:", err);
      toast({
        title: "Error",
        description: "Failed to create connection. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Function to handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  // Function to handle select changes
  const handleSelectChange = (value: string) => {
    setFormData(prev => ({ ...prev, platform: value }));
  };

  // Function to handle connection status updates
  const updateConnectionStatus = async (id: number, status: string) => {
    try {
      const response = await fetch(`/api/connections/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update connection: ${response.statusText}`);
      }
      
      // Reload connections
      await loadConnections();
      
      toast({
        title: "Connection updated",
        description: `Connection status has been updated to ${status}.`,
      });
    } catch (err) {
      console.error("Error updating connection:", err);
      toast({
        title: "Error",
        description: "Failed to update connection. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Load connections on mount
  useEffect(() => {
    setActiveItem("connections");
    
    // Call API to seed demo data if needed
    const seedDemoData = async () => {
      try {
        const response = await fetch('/api/seed', { method: 'POST' });
        if (response.ok) {
          console.log("Demo data seeded successfully");
        }
      } catch (err) {
        console.error("Error seeding demo data:", err);
      }
      
      // Load connections regardless of seeding success
      loadConnections();
    };
    
    seedDemoData();
  }, []);

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "shopify":
        return <ShoppingBag className="h-8 w-8 text-green-600" />;
      case "mercadolibre":
        return <Store className="h-8 w-8 text-yellow-500" />;
      case "woocommerce":
        return <Landmark className="h-8 w-8 text-purple-600" />;
      case "tiktok":
        return <BarChart className="h-8 w-8 text-black" />;
      default:
        return <Link2 className="h-8 w-8 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1">
            <Check className="h-3 w-3" />
            Active
          </Badge>
        );
      case "inactive":
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Inactive
          </Badge>
        );
      case "error":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Error
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SidebarNav activeItem={activeItem} user={user} />
      
      <main className="flex-1 p-6 pl-[220px]">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Connections</h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4" />
                Añadir Conexión
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Añadir Conexión</DialogTitle>
                <DialogDescription>
                  Conecta tu plataforma de e-commerce para sincronizar productos y pedidos.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Nombre
                  </Label>
                  <Input 
                    id="name" 
                    placeholder="Mi Tienda" 
                    className="col-span-3"
                    value={formData.name}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="platform" className="text-right">
                    Plataforma
                  </Label>
                  <Select onValueChange={handleSelectChange} value={formData.platform}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Selecciona plataforma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shopify">Shopify</SelectItem>
                      <SelectItem value="mercadolibre">MercadoLibre</SelectItem>
                      <SelectItem value="woocommerce">WooCommerce</SelectItem>
                      <SelectItem value="tiktok">TikTok Shop</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="apiKey" className="text-right">
                    API Key
                  </Label>
                  <Input 
                    id="apiKey" 
                    type="password" 
                    className="col-span-3"
                    value={formData.apiKey}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="apiSecret" className="text-right">
                    API Secret
                  </Label>
                  <Input 
                    id="apiSecret" 
                    type="password" 
                    className="col-span-3"
                    value={formData.apiSecret}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateConnection}>Conectar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <Skeleton className="h-5 w-40 mb-2" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="flex justify-between items-center mb-4">
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-5 rounded-full" />
                      <div>
                        <Skeleton className="h-4 w-12 mb-1" />
                        <Skeleton className="h-4 w-8" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-5 rounded-full" />
                      <div>
                        <Skeleton className="h-4 w-12 mb-1" />
                        <Skeleton className="h-4 w-8" />
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-4">
            <div className="flex gap-2 items-start">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-800">Error cargando las conexiones</h3>
                <p className="text-red-700 text-sm">{error}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => loadConnections()}
                >
                  Intentar de nuevo
                </Button>
              </div>
            </div>
          </div>
        ) : connections.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 my-4 text-center">
            <Link2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-800 mb-2">No hay conexiones activas</h3>
            <p className="text-gray-600 mb-4">Conecta tus tiendas para sincronizar productos y pedidos.</p>
            <Dialog>
              <DialogTrigger asChild>
                <Button>Añadir conexión</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Añadir conexión</DialogTitle>
                  <DialogDescription>
                    Conecta tu plataforma de e-commerce para sincronizar productos y pedidos.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Nombre
                    </Label>
                    <Input 
                      id="name" 
                      placeholder="Mi Tienda" 
                      className="col-span-3"
                      value={formData.name}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="platform" className="text-right">
                      Plataforma
                    </Label>
                    <Select onValueChange={handleSelectChange} value={formData.platform}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Selecciona plataforma" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="shopify">Shopify</SelectItem>
                        <SelectItem value="mercadolibre">MercadoLibre</SelectItem>
                        <SelectItem value="woocommerce">WooCommerce</SelectItem>
                        <SelectItem value="tiktok">TikTok Shop</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="apiKey" className="text-right">
                      API Key
                    </Label>
                    <Input 
                      id="apiKey" 
                      type="password" 
                      className="col-span-3"
                      value={formData.apiKey}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="apiSecret" className="text-right">
                      API Secret
                    </Label>
                    <Input 
                      id="apiSecret" 
                      type="password" 
                      className="col-span-3"
                      value={formData.apiSecret}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreateConnection}>Conectar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {connections.map((connection) => (
              <Card key={connection.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{connection.name}</CardTitle>
                      <CardDescription className="mt-1">Última sincronización: {connection.lastSync}</CardDescription>
                    </div>
                    <div>
                      {getPlatformIcon(connection.platform)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="flex justify-between items-center mb-4">
                    {getStatusBadge(connection.status)}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">Pedidos</p>
                        <p className="font-medium">{connection.orders}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link2 className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">Productos</p>
                        <p className="font-medium">{connection.products}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const newStatus = connection.status === "active" ? "inactive" : "active";
                      updateConnectionStatus(connection.id, newStatus);
                    }}
                  >
                    {connection.status === "active" ? "Desactivar" : "Activar"}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className={connection.status !== "active" ? "opacity-50 cursor-not-allowed" : ""}
                    disabled={connection.status !== "active"}
                  >
                    Sincronizar
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}