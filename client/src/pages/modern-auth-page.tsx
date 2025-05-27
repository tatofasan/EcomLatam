import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { localRegisterSchema, socialRegisterSchema } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, User, Lock, Mail, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import ModernAuthLayout from "@/components/auth/modern-auth-layout";
import SocialAuthButtons from "@/components/auth/social-auth-buttons";
import PendingApproval from "@/components/auth/pending-approval";

const loginSchema = z.object({
  email: z.string().email("Por favor ingresa un correo electrónico válido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof localRegisterSchema>;

export default function ModernAuthPage() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pendingUser, setPendingUser] = useState<{ email: string; status: string; reason?: string } | null>(null);
  
  const { loginMutation, registerMutation } = useAuth();
  const { toast } = useToast();

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(localRegisterSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      fullName: "",
      email: "",
    },
  });

  const onLogin = async (data: LoginFormValues) => {
    try {
      const user = await loginMutation.mutateAsync({
        username: data.email, // Using email as username for backwards compatibility
        password: data.password,
      });

      if (user.status === "pending_approval") {
        setPendingUser({ 
          email: user.email || data.email, 
          status: user.status 
        });
        return;
      }

      if (user.status === "suspended") {
        setPendingUser({ 
          email: user.email || data.email, 
          status: user.status,
          reason: "Tu cuenta ha sido suspendida por nuestro equipo de moderación"
        });
        return;
      }

      toast({
        title: "¡Bienvenido!",
        description: "Has iniciado sesión exitosamente.",
      });
      setLocation("/");
    } catch (error) {
      toast({
        title: "Error al iniciar sesión",
        description: error instanceof Error ? error.message : "Credenciales inválidas",
        variant: "destructive",
      });
    }
  };

  const onRegister = async (data: RegisterFormValues) => {
    try {
      const newUser = await registerMutation.mutateAsync({
        username: data.username,
        password: data.password,
        fullName: data.fullName,
        email: data.email,
        provider: "local",
        status: "pending_approval",
        isEmailVerified: false,
      });

      setPendingUser({ 
        email: newUser.email || data.email, 
        status: "pending_approval" 
      });

      toast({
        title: "¡Registro exitoso!",
        description: "Tu solicitud está siendo revisada por nuestro equipo.",
      });
    } catch (error) {
      toast({
        title: "Error en el registro",
        description: error instanceof Error ? error.message : "Error al crear la cuenta",
        variant: "destructive",
      });
    }
  };

  const handleSocialAuth = async (provider: "google" | "github" | "facebook") => {
    toast({
      title: "Próximamente",
      description: `La autenticación con ${provider} estará disponible pronto.`,
    });
    
    // Para implementar autenticación social real, necesitaremos configurar:
    // 1. Google OAuth 2.0
    // 2. GitHub OAuth App
    // 3. Facebook App
    // Esto requiere credenciales de cada proveedor
  };

  const handleResendEmail = () => {
    toast({
      title: "Email enviado",
      description: "Hemos reenviado el email de confirmación.",
    });
  };

  const handleContactSupport = () => {
    window.open("mailto:soporte@ecomdrop.com", "_blank");
  };

  // Si hay un usuario pendiente, mostrar la pantalla de aprobación
  if (pendingUser) {
    return (
      <PendingApproval
        email={pendingUser.email}
        status={pendingUser.status as "pending_approval" | "suspended"}
        rejectionReason={pendingUser.reason}
        onResendEmail={handleResendEmail}
        onContactSupport={handleContactSupport}
      />
    );
  }

  return (
    <ModernAuthLayout
      title={activeTab === "login" ? "Bienvenido de vuelta" : "Crear cuenta"}
      description={activeTab === "login" 
        ? "Inicia sesión en tu cuenta para acceder a tu dashboard" 
        : "Registra una nueva cuenta para comenzar tu aventura"
      }
    >
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "login" | "register")}>
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="login" className="text-sm font-medium">
            Iniciar Sesión
          </TabsTrigger>
          <TabsTrigger value="register" className="text-sm font-medium">
            Registrarse
          </TabsTrigger>
        </TabsList>

        <TabsContent value="login" className="space-y-6">
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-5">
              <FormField
                control={loginForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      Correo Electrónico
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          placeholder="tu@email.com"
                          className="pl-10 h-12"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      Contraseña
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Tu contraseña"
                          className="pl-10 pr-10 h-12"
                          {...field}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  "Iniciar Sesión"
                )}
              </Button>
            </form>
          </Form>

          <SocialAuthButtons onSocialAuth={handleSocialAuth} isLoading={loginMutation.isPending} />
        </TabsContent>

        <TabsContent value="register" className="space-y-6">
          <Form {...registerForm}>
            <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={registerForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Nombre Completo
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                          <Input
                            placeholder="Tu nombre completo"
                            className="pl-10 h-12"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={registerForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Correo Electrónico
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                          <Input
                            placeholder="tu@email.com"
                            className="pl-10 h-12"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={registerForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Nombre de Usuario
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                          <Input
                            placeholder="nombre_usuario"
                            className="pl-10 h-12"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={registerForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Contraseña
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Contraseña"
                            className="pl-10 pr-10 h-12"
                            {...field}
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={registerForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Confirmar Contraseña
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirmar contraseña"
                            className="pl-10 pr-10 h-12"
                            {...field}
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando cuenta...
                  </>
                ) : (
                  "Crear Cuenta"
                )}
              </Button>
            </form>
          </Form>

          <SocialAuthButtons onSocialAuth={handleSocialAuth} isLoading={registerMutation.isPending} />
        </TabsContent>
      </Tabs>
    </ModernAuthLayout>
  );
}