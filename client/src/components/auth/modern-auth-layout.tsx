import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EcomdropLogo } from "@/lib/logos";
import { Shield, Users, Zap, Star } from "lucide-react";

interface ModernAuthLayoutProps {
  children: React.ReactNode;
  title: string;
  description: string;
}

export default function ModernAuthLayout({ children, title, description }: ModernAuthLayoutProps) {
  const features = [
    {
      icon: <Shield className="h-5 w-5 text-blue-500" />,
      title: "Seguridad Avanzada",
      description: "Autenticación de dos factores y encriptación de extremo a extremo"
    },
    {
      icon: <Users className="h-5 w-5 text-green-500" />,
      title: "Sistema de Aprobación",
      description: "Registro con aprobación por moderadores para mayor control"
    },
    {
      icon: <Zap className="h-5 w-5 text-yellow-500" />,
      title: "Acceso Rápido",
      description: "Inicia sesión con Google, GitHub o Facebook en segundos"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex">
      {/* Left Panel - Branding & Features */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="w-full h-full bg-white/5 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[length:30px_30px]"></div>
        </div>
        
        {/* Logo & Title */}
        <div className="relative z-10">
          <div className="flex items-center mb-6">
            <EcomdropLogo className="w-12 h-12 text-white" />
            <span className="ml-3 text-2xl font-bold">Ecomdrop</span>
          </div>
          <h1 className="text-4xl font-bold mb-4 leading-tight">
            Potencia tu negocio con la plataforma más avanzada
          </h1>
          <p className="text-blue-100 text-lg leading-relaxed">
            Gestiona productos, órdenes y conexiones con herramientas profesionales 
            diseñadas para escalar tu e-commerce al siguiente nivel.
          </p>
          
          <div className="flex items-center gap-2 mt-6">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
              <Star className="w-3 h-3 mr-1" />
              Confiado por 10,000+ usuarios
            </Badge>
          </div>
        </div>

        {/* Features */}
        <div className="relative z-10 space-y-6">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center space-x-4">
              <div className="flex-shrink-0 w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-sm">
                {feature.icon}
              </div>
              <h3 className="font-semibold text-white">{feature.title}</h3>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="relative z-10 text-blue-200 text-sm">
          <p>&copy; 2024 Ecomdrop. Todos los derechos reservados.</p>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-6">
              <div className="lg:hidden mb-4">
                <EcomdropLogo className="w-24 h-24 mx-auto text-blue-600" />
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900">{title}</CardTitle>
              <CardDescription className="text-gray-600 mt-2">
                {description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {children}
            </CardContent>
          </Card>
          
          {/* Mobile Features */}
          <div className="lg:hidden mt-8 grid gap-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center space-x-3 p-4 bg-white/60 rounded-lg backdrop-blur-sm">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  {feature.icon}
                </div>
                <h4 className="font-medium text-gray-900 text-sm">{feature.title}</h4>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}