import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import SidebarNav from "@/components/sidebar-nav";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

// Sample data - this would typically come from API
const connections = [
  { 
    id: 1, 
    name: "My Shopify Store", 
    platform: "shopify", 
    status: "active", 
    lastSync: "2025-04-22 14:30", 
    products: 45,
    orders: 12 
  },
  { 
    id: 2, 
    name: "MercadoLibre Shop", 
    platform: "mercadolibre", 
    status: "active", 
    lastSync: "2025-04-22 10:15", 
    products: 78,
    orders: 24 
  },
  { 
    id: 3, 
    name: "WooCommerce Store", 
    platform: "woocommerce", 
    status: "error", 
    lastSync: "2025-04-21 09:45", 
    products: 32,
    orders: 8 
  },
  { 
    id: 4, 
    name: "TikTok Shop", 
    platform: "tiktok", 
    status: "inactive", 
    lastSync: "2025-04-20 16:00", 
    products: 15,
    orders: 3 
  }
];

export default function ConnectionsPage() {
  const { user } = useAuth();
  const [activeItem, setActiveItem] = useState("connections");

  useEffect(() => {
    setActiveItem("connections");
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
                Add Connection
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add Connection</DialogTitle>
                <DialogDescription>
                  Connect your e-commerce platform to sync products and orders.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input id="name" placeholder="My Store" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="platform" className="text-right">
                    Platform
                  </Label>
                  <Select>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select platform" />
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
                  <Input id="apiKey" type="password" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="apiSecret" className="text-right">
                    API Secret
                  </Label>
                  <Input id="apiSecret" type="password" className="col-span-3" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Connect</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {connections.map((connection) => (
            <Card key={connection.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{connection.name}</CardTitle>
                    <CardDescription className="mt-1">Last sync: {connection.lastSync}</CardDescription>
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
                      <p className="text-sm text-gray-500">Orders</p>
                      <p className="font-medium">{connection.orders}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link2 className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-500">Products</p>
                      <p className="font-medium">{connection.products}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" size="sm">Settings</Button>
                <Button variant="outline" size="sm">Sync Now</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}