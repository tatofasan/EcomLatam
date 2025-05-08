import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layout/dashboard-layout";
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
import { ShopifyIcon, WooCommerceIcon, MercadoLibreIcon, TikTokIcon, PlatformButton } from "@/lib/platform-icons";

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
  
  // State for the dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [step, setStep] = useState<'platforms' | 'details' | 'authenticating'>('platforms');

  // Function to load connections
  const loadConnections = async () => {
    try {
      setIsLoading(true);
      
      // Si el usuario es administrador, cargamos todas las conexiones
      // Si es usuario regular, solo cargamos sus conexiones
      const isAdmin = user?.role === 'admin';
      const endpoint = isAdmin ? '/api/connections?all=true' : '/api/connections';
      
      const response = await fetch(endpoint);
      
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

  // Function to handle platform selection
  const handleSelectPlatform = (platform: string) => {
    setFormData(prev => ({ ...prev, platform }));
    if (platform === 'shopify') {
      setStep('details');
    } else {
      toast({
        title: "Próximamente",
        description: `La integración con ${platform} estará disponible próximamente.`,
      });
    }
  };

  // Function to initiate OAuth flow with Shopify
  const handleShopifyAuth = () => {
    // In a real implementation, you would:
    // 1. Call your backend to get a redirect URL for Shopify OAuth
    // 2. Open that URL in a new window/tab
    // 3. After user authorizes, they'll be redirected back to your app

    // For this demo, we'll simulate the flow:
    setStep('authenticating');
    
    // Store name is required
    if (!formData.name.trim()) {
      toast({
        title: "Nombre requerido",
        description: "Por favor, ingresa un nombre para tu tienda.",
        variant: "destructive",
      });
      setStep('details');
      return;
    }
    
    // Simulate opening a new window for authorization
    const shopifyAuthWindow = window.open(
      `https://shopify.com/admin/oauth/authorize?dummy=1&store=${encodeURIComponent(formData.name)}`,
      'shopify_auth',
      'width=800,height=600'
    );
    
    // After a "successful" authentication (simulated), create the connection
    setTimeout(() => {
      if (shopifyAuthWindow) {
        shopifyAuthWindow.close();
      }
      
      handleCreateConnection({
        name: formData.name,
        platform: 'shopify',
        status: 'active',
      });
      
      setIsDialogOpen(false);
      setStep('platforms');
    }, 3000);
  };

  // Function to handle creating a new connection
  const handleCreateConnection = async (connectionData?: any) => {
    try {
      const dataToSend = connectionData || {
        ...formData,
        status: "active"
      };
      
      const response = await fetch('/api/connections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
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
        title: "Conexión creada",
        description: "Tu nueva conexión ha sido creada exitosamente.",
      });
    } catch (err) {
      console.error("Error creating connection:", err);
      toast({
        title: "Error",
        description: "Falló la creación de la conexión. Por favor, intenta de nuevo.",
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
  
  // Function to delete a connection
  const deleteConnection = async (id: number) => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta conexión? Esta acción no se puede deshacer.")) {
      return;
    }
    
    try {
      const response = await fetch(`/api/connections/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete connection: ${response.statusText}`);
      }
      
      // Reload connections
      await loadConnections();
      
      toast({
        title: "Conexión eliminada",
        description: "La conexión ha sido eliminada exitosamente.",
      });
    } catch (err) {
      console.error("Error deleting connection:", err);
      toast({
        title: "Error",
        description: "No se pudo eliminar la conexión. Por favor, intenta de nuevo.",
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
        return <ShopifyIcon className="h-10 w-10" active={true} />;
      case "mercadolibre":
        return <MercadoLibreIcon className="h-10 w-10" active={true} />;
      case "woocommerce":
        return <WooCommerceIcon className="h-10 w-10" active={true} />;
      case "tiktok":
        return <TikTokIcon className="h-10 w-10" active={true} />;
      default:
        return <Link2 className="h-10 w-10 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 flex items-center gap-1 font-medium">
            <Check className="h-3 w-3" />
            Activa
          </Badge>
        );
      case "inactive":
        return (
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 flex items-center gap-1 font-medium">
            <AlertCircle className="h-3 w-3" />
            Inactiva
          </Badge>
        );
      case "error":
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 flex items-center gap-1 font-medium">
            <XCircle className="h-3 w-3" />
            Error
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <DashboardLayout activeItem="connections">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-primary">Conexiones</h1>
            <p className="text-muted-foreground mt-1">
              {user?.role === 'admin' 
                ? "Administra las conexiones de todos los usuarios"
                : "Gestiona las conexiones con tus plataformas de e-commerce"
              }
            </p>
          </div>
          
          {/* Solo mostrar el botón de agregar conexión para usuarios regulares, no para administradores */}
          {user?.role !== 'admin' && (
            <Button 
              className="flex items-center gap-2"
              onClick={() => {
                setStep('platforms');
                setIsDialogOpen(true);
              }}
            >
              <PlusCircle className="h-4 w-4" />
              Add Connection
            </Button>
          )}
          
          {/* Dialog para crear nuevas conexiones */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Conectar plataforma</DialogTitle>
                <DialogDescription>
                  {step === 'platforms' && "Selecciona la plataforma de e-commerce que deseas conectar."}
                  {step === 'details' && "Ingresa los detalles de tu tienda Shopify para conectarla."}
                  {step === 'authenticating' && "Autorizando la conexión con Shopify..."}
                </DialogDescription>
              </DialogHeader>
              
              {step === 'platforms' && (
                <div className="grid grid-cols-2 gap-4 py-4">
                  <PlatformButton 
                    name="Shopify" 
                    icon={<ShopifyIcon />} 
                    active={true} 
                    onClick={() => handleSelectPlatform('shopify')}
                  />
                  <PlatformButton 
                    name="WooCommerce" 
                    icon={<WooCommerceIcon />} 
                    active={false} 
                    onClick={() => handleSelectPlatform('woocommerce')}
                  />
                  <PlatformButton 
                    name="MercadoLibre" 
                    icon={<MercadoLibreIcon />} 
                    active={false} 
                    onClick={() => handleSelectPlatform('mercadolibre')}
                  />
                  <PlatformButton 
                    name="TikTok Shop" 
                    icon={<TikTokIcon />} 
                    active={false} 
                    onClick={() => handleSelectPlatform('tiktok')}
                  />
                </div>
              )}
              
              {step === 'details' && (
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Información de tu tienda Shopify</h3>
                    <p className="text-sm text-muted-foreground">
                      Conectar con Shopify permite importar productos y sincronizar pedidos automáticamente.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Nombre de la tienda
                    </Label>
                    <Input 
                      id="name" 
                      placeholder="mi-tienda" 
                      className="col-span-3"
                      value={formData.name}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2 mt-4">
                    <div className="bg-blue-50 p-3 rounded-md text-sm border border-blue-100">
                      <p className="text-blue-700">
                        Se abrirá una ventana de Shopify para autorizar la conexión.
                        Una vez autorizada, podrás gestionar tus productos y pedidos desde aquí.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {step === 'authenticating' && (
                <div className="flex items-center justify-center py-10">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                    <p>Autorizando conexión con Shopify...</p>
                    <p className="text-sm text-muted-foreground mt-2">Esto puede tomar unos segundos.</p>
                  </div>
                </div>
              )}
              
              <DialogFooter>
                {step === 'platforms' && (
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                )}
                
                {step === 'details' && (
                  <>
                    <Button variant="outline" onClick={() => setStep('platforms')}>Volver</Button>
                    <Button onClick={handleShopifyAuth}>Conectar con Shopify</Button>
                  </>
                )}
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
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 my-4">
            <div className="flex gap-2 items-start">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <h3 className="font-medium text-destructive">Error cargando las conexiones</h3>
                <p className="text-destructive/80 text-sm">{error}</p>
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
          <div className="bg-accent border border-border rounded-lg p-8 my-4 text-center">
            <Link2 className="h-12 w-12 text-primary/60 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No active connections</h3>
            <p className="text-muted-foreground mb-4">Connect your stores to synchronize products and orders.</p>
            <Button
              onClick={() => {
                setStep('platforms');
                setIsDialogOpen(true);
              }}
            >
              Add Connection
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {connections.map((connection) => (
              <Card key={connection.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{connection.name}</CardTitle>
                      <CardDescription className="mt-1">
                        Last sync: {connection.lastSync}
                        {/* Mostrar el ID del usuario para administradores */}
                        {user?.role === 'admin' && (
                          <> • Usuario ID: {connection.userId}</>
                        )}
                      </CardDescription>
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
                      <ShoppingCart className="w-5 h-5 text-primary/70" />
                      <div>
                        <p className="text-sm text-muted-foreground">Orders</p>
                        <p className="font-medium">{connection.orders}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link2 className="w-5 h-5 text-primary/70" />
                      <div>
                        <p className="text-sm text-muted-foreground">Products</p>
                        <p className="font-medium">{connection.products}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  {/* Mostrar botón para desactivar/activar la conexión */}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const newStatus = connection.status === "active" ? "inactive" : "active";
                      updateConnectionStatus(connection.id, newStatus);
                    }}
                    className="hover:bg-primary/10 hover:text-primary border-border"
                  >
                    {connection.status === "active" ? "Deactivate" : "Activate"}
                  </Button>
                  
                  {/* Mostrar el botón de sincronización o borrado según el rol */}
                  {user?.role === 'admin' ? (
                    <Button 
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                      onClick={() => deleteConnection(connection.id)}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  ) : (
                    <Button 
                      variant={connection.status === "active" ? "default" : "outline"}
                      size="sm" 
                      className={connection.status !== "active" ? "opacity-50 cursor-not-allowed" : ""}
                      disabled={connection.status !== "active"}
                    >
                      Synchronize
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}