import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { EcomdropLogo } from "@/lib/logos";

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState<string>("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    // Obtener el token de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");

    if (!token) {
      setStatus("error");
      setMessage("No valid verification token provided.");
      return;
    }

    // Verificar el token
    async function verifyEmail() {
      try {
        const response = await fetch(`/api/verify-email?token=${token}`);
        const data = await response.json();

        if (response.ok && data.success) {
          setStatus("success");
          setMessage(data.message || "Your email has been successfully verified.");
        } else {
          setStatus("error");
          setMessage(data.message || "An error occurred while verifying your email.");
        }
      } catch (error) {
        console.error("Error verifying email:", error);
        setStatus("error");
        setMessage("An error occurred while communicating with the server.");
      }
    }

    verifyEmail();
  }, []);

  const handleReturn = () => {
    setLocation("/login");
  };

  const handleResendEmail = async () => {
    const email = prompt("Please enter your email address:");
    
    if (!email) return;
    
    try {
      const response = await fetch("/api/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json();
      
      toast({
        title: data.success ? "Request Processed" : "Error",
        description: data.message,
        variant: data.success ? "default" : "destructive"
      });
    } catch (error) {
      console.error("Error resending verification:", error);
      toast({
        title: "Error",
        description: "An error occurred while processing your request.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <EcomdropLogo className="h-12 mb-4" />
          <CardTitle className="text-2xl font-bold text-center">
            Verificación de Email
          </CardTitle>
          <CardDescription className="text-center">
            {status === "verifying" 
              ? "Verificando tu dirección de correo electrónico..." 
              : status === "success" 
                ? "¡Verificación completada!" 
                : "Error de verificación"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          {status === "verifying" ? (
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-16 w-16 text-primary animate-spin" />
              <p className="text-center">Estamos verificando tu dirección de correo electrónico. Por favor espera un momento...</p>
            </div>
          ) : status === "success" ? (
            <div className="flex flex-col items-center space-y-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
              <p className="text-center">{message}</p>
              <Button className="w-full" onClick={handleReturn}>
                Ir a Iniciar Sesión
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <XCircle className="h-16 w-16 text-red-500" />
              <p className="text-center">{message}</p>
              <Button variant="outline" className="w-full" onClick={handleResendEmail}>
                Reenviar Email de Verificación
              </Button>
              <Button className="w-full" onClick={handleReturn}>
                Volver a Iniciar Sesión
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}