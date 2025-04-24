import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import SidebarNav from "@/components/sidebar-nav";
import UserHeader from "@/components/user-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Package, 
  ShoppingCart, 
  CreditCard, 
  Wallet,
  Clock,
  CheckCircle2,
  User,
  Store,
  FileSpreadsheet
} from "lucide-react";

export default function HomePage() {
  const { user } = useAuth();
  const [activeItem, setActiveItem] = useState("dashboard");
  const [hasCompletedSetup, setHasCompletedSetup] = useState(false);

  useEffect(() => {
    setActiveItem("dashboard");
    
    // En un proyecto real, verificaríamos si el usuario ha completado cada paso del onboarding
    // y actualizaríamos el estado en consecuencia
    // Por ahora, simplemente asumimos que no ha completado el setup
    setHasCompletedSetup(false);
  }, []);

  // Datos de onboarding
  const onboardingSteps = [
    {
      id: "profile",
      title: "Completá tu perfil",
      description: "Antes de comenzar a usar Ecomdrop necesitamos que completes tu perfil.",
      icon: <User className="h-10 w-10 text-pink-500" />,
      buttonText: "Completar",
      buttonLink: "/account",
      completed: false
    },
    {
      id: "stores",
      title: "Conectá tus tiendas",
      description: "Conectá tus tiendas de Shopify o Tiendanube con Ecomdrop para recibir pedidos.",
      icon: <Store className="h-10 w-10 text-indigo-500" />,
      buttonText: "Conectar",
      buttonLink: "/connections",
      completed: false
    },
    {
      id: "wallet",
      title: "Cargá tu billetera",
      description: "Configurá tu cuenta bancaria para ingresar y retirar el dinero de tus ventas por Ecomdrop.",
      icon: <Wallet className="h-10 w-10 text-purple-500" />,
      buttonText: "Configurar",
      buttonLink: "/wallet",
      completed: false
    },
    {
      id: "invoice",
      title: "Completá tus datos de facturación",
      description: "Para poder operar sobre tus pedidos, necesitas completar los datos de facturación.",
      icon: <FileSpreadsheet className="h-10 w-10 text-pink-500" />,
      buttonText: "Completar",
      buttonLink: "/account",
      completed: false
    }
  ];

  // Vista de onboarding
  if (!hasCompletedSetup) {
    return (
      <div className="flex min-h-screen bg-gray-50 flex-col">
        <UserHeader username={user?.username} />
        
        <div className="flex flex-1">
          <SidebarNav activeItem={activeItem} user={user} />
          
          <main className="flex-1 p-6 pl-[220px]">
            <div className="mb-8">
              <h1 className="text-2xl font-bold">¡Hola {user?.username}!</h1>
              <p className="text-gray-500 mt-1">Antes de empezar necesitamos configurar unas cositas...</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {onboardingSteps.map((step) => (
                <Card key={step.id} className="overflow-hidden">
                  <CardContent className="p-6 flex flex-col items-center text-center">
                    <div className="mb-4 mt-2">
                      {step.icon}
                    </div>
                    <h3 className="font-medium text-lg mb-2">{step.title}</h3>
                    <p className="text-gray-500 text-sm mb-6">{step.description}</p>
                    <Link href={step.buttonLink}>
                      <Button className="w-full bg-pink-500 hover:bg-pink-600">
                        {step.buttonText}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Vista de dashboard normal (cuando el usuario ha completado el onboarding)
  return (
    <div className="flex min-h-screen bg-gray-50 flex-col">
      <UserHeader username={user?.username} />
      
      <div className="flex flex-1">
        <SidebarNav activeItem={activeItem} user={user} />
        
        <main className="flex-1 p-6 pl-[220px]">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Dashboard</h1>
          </div>
          
          {/* Metrics Overview */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
              <CardContent className="p-4 flex items-center">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mr-4">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Productos</p>
                  <h3 className="text-2xl font-bold">125</h3>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 flex items-center">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mr-4">
                  <ShoppingCart className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Pedidos</p>
                  <h3 className="text-2xl font-bold">68</h3>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 flex items-center">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mr-4">
                  <CreditCard className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ingresos</p>
                  <h3 className="text-2xl font-bold">$12,450</h3>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 flex items-center">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mr-4">
                  <Wallet className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Saldo</p>
                  <h3 className="text-2xl font-bold">$5,280</h3>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Recent Orders */}
          <Card>
            <CardHeader>
              <CardTitle>Pedidos Recientes</CardTitle>
              <CardDescription>Últimos pedidos recibidos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Pedido</th>
                      <th className="text-left py-3 px-4 font-medium">Cliente</th>
                      <th className="text-left py-3 px-4 font-medium">Monto</th>
                      <th className="text-left py-3 px-4 font-medium">Fecha</th>
                      <th className="text-left py-3 px-4 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">ORD-001</td>
                      <td className="py-3 px-4">María López</td>
                      <td className="py-3 px-4">$125.99</td>
                      <td className="py-3 px-4">2025-04-23</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Entregado
                        </span>
                      </td>
                    </tr>
                    <tr className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">ORD-002</td>
                      <td className="py-3 px-4">Carlos Rodríguez</td>
                      <td className="py-3 px-4">$89.50</td>
                      <td className="py-3 px-4">2025-04-22</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <Clock className="w-3 h-3 mr-1" />
                          Procesando
                        </span>
                      </td>
                    </tr>
                    <tr className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">ORD-003</td>
                      <td className="py-3 px-4">Ana Gómez</td>
                      <td className="py-3 px-4">$315.75</td>
                      <td className="py-3 px-4">2025-04-21</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          <Clock className="w-3 h-3 mr-1" />
                          Pendiente
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}