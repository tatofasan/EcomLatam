import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Mail, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PendingApprovalProps {
  email: string;
  status: "pending_approval" | "suspended";
  rejectionReason?: string;
  onResendEmail?: () => void;
  onContactSupport?: () => void;
}

export default function PendingApproval({ 
  email, 
  status, 
  rejectionReason,
  onResendEmail,
  onContactSupport 
}: PendingApprovalProps) {
  const isPending = status === "pending_approval";
  const isSuspended = status === "suspended";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl bg-white/90 backdrop-blur-sm">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center">
            {isPending ? (
              <Clock className="w-8 h-8 text-orange-500" />
            ) : (
              <XCircle className="w-8 h-8 text-red-500" />
            )}
          </div>
          
          <CardTitle className="text-xl font-bold text-gray-900">
            {isPending ? "Registro Pendiente de Aprobación" : "Cuenta Suspendida"}
          </CardTitle>
          
          <CardDescription className="text-gray-600 mt-2">
            {isPending 
              ? "Tu solicitud de registro está siendo revisada por nuestro equipo"
              : "Tu cuenta ha sido suspendida por nuestro equipo de moderación"
            }
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Status Badge */}
          <div className="text-center">
            <Badge variant={isPending ? "secondary" : "destructive"} className="px-4 py-2">
              {isPending ? (
                <>
                  <Clock className="w-3 h-3 mr-1" />
                  Pendiente de Aprobación
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3 mr-1" />
                  Cuenta Suspendida
                </>
              )}
            </Badge>
          </div>

          {/* Email */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
              <Mail className="w-4 h-4" />
              <span>{email}</span>
            </div>
          </div>

          {/* Message */}
          <div className="text-center space-y-3">
            {isPending ? (
              <>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Nuestro equipo de moderadores está revisando tu solicitud de registro. 
                  Este proceso puede tomar entre 24-48 horas.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="text-left">
                      <p className="text-blue-800 font-medium text-sm">¿Qué sigue?</p>
                      <ul className="text-blue-700 text-xs mt-2 space-y-1">
                        <li>• Revisaremos tu información personal</li>
                        <li>• Verificaremos tu dirección de correo</li>
                        <li>• Te notificaremos la decisión por email</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Tu cuenta ha sido suspendida. Si tienes preguntas, contacta a nuestro equipo de soporte.
                </p>
                {rejectionReason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800 font-medium text-sm mb-2">Motivo de la suspensión:</p>
                    <p className="text-red-700 text-sm">{rejectionReason}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {isPending && onResendEmail && (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={onResendEmail}
              >
                <Mail className="w-4 h-4 mr-2" />
                Reenviar Email de Confirmación
              </Button>
            )}
            
            {onContactSupport && (
              <Button 
                variant={isPending ? "outline" : "default"}
                className="w-full"
                onClick={onContactSupport}
              >
                Contactar Soporte
              </Button>
            )}
          </div>

          {/* Additional Info */}
          <div className="text-center">
            <p className="text-xs text-gray-500">
              ¿Necesitas ayuda? Escríbenos a{" "}
              <a href="mailto:soporte@ecomdrop.com" className="text-blue-600 hover:underline">
                soporte@ecomdrop.com
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}