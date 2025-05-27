import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, XCircle, Clock, Mail, User, Calendar, Shield } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface PendingUser {
  id: number;
  fullName: string;
  email: string;
  username?: string;
  provider: string;
  avatar?: string;
  createdAt: string;
  status: string;
}

export default function UserApprovalPage() {
  const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pendingUsers = [], isLoading } = useQuery({
    queryKey: ["/api/users/pending"],
  });

  const approvalMutation = useMutation({
    mutationFn: async ({ userId, action, reason }: { userId: number; action: "approve" | "reject"; reason?: string }) => {
      return apiRequest(`/api/users/${userId}/approval`, {
        method: "POST",
        body: { action, reason },
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/pending"] });
      toast({
        title: variables.action === "approve" ? "Usuario aprobado" : "Usuario rechazado",
        description: variables.action === "approve" 
          ? "El usuario puede acceder ahora a la plataforma."
          : "Se ha notificado al usuario sobre la decisión.",
      });
      setSelectedUser(null);
      setAction(null);
      setRejectionReason("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al procesar la solicitud",
        variant: "destructive",
      });
    },
  });

  const handleAction = (user: PendingUser, actionType: "approve" | "reject") => {
    setSelectedUser(user);
    setAction(actionType);
  };

  const confirmAction = () => {
    if (!selectedUser || !action) return;

    approvalMutation.mutate({
      userId: selectedUser.id,
      action,
      reason: action === "reject" ? rejectionReason : undefined,
    });
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "google":
        return "🔵";
      case "github":
        return "⚫";
      case "facebook":
        return "🔵";
      default:
        return "📧";
    }
  };

  const getProviderName = (provider: string) => {
    switch (provider) {
      case "google":
        return "Google";
      case "github":
        return "GitHub";
      case "facebook":
        return "Facebook";
      default:
        return "Email";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Aprobación de Usuarios</h1>
            <p className="text-gray-600 mt-2">
              Revisa y gestiona las solicitudes de registro pendientes
            </p>
          </div>
          <Badge variant="secondary" className="px-4 py-2">
            <Clock className="w-4 h-4 mr-2" />
            {pendingUsers.length} solicitudes pendientes
          </Badge>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-24"></div>
                      <div className="h-3 bg-gray-200 rounded w-32"></div>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : pendingUsers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Shield className="w-16 h-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No hay solicitudes pendientes
              </h3>
              <p className="text-gray-600 text-center max-w-md">
                Todas las solicitudes de registro han sido procesadas. 
                Nuevas solicitudes aparecerán aquí para tu revisión.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pendingUsers.map((user: PendingUser) => (
              <Card key={user.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center space-x-4">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={user.avatar} />
                      <AvatarFallback>
                        {user.fullName?.charAt(0) || user.email.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">
                        {user.fullName || "Sin nombre"}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <span className="text-lg">{getProviderIcon(user.provider)}</span>
                        {getProviderName(user.provider)}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{user.email}</span>
                    </div>
                    
                    {user.username && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <User className="w-4 h-4" />
                        <span>@{user.username}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {format(new Date(user.createdAt), "d 'de' MMMM, yyyy", { locale: es })}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => handleAction(user, "approve")}
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Aprobar
                    </Button>
                    <Button
                      onClick={() => handleAction(user, "reject")}
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Rechazar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Confirmation Dialog */}
        <Dialog open={!!selectedUser && !!action} onOpenChange={() => {
          setSelectedUser(null);
          setAction(null);
          setRejectionReason("");
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {action === "approve" ? "Aprobar Usuario" : "Rechazar Usuario"}
              </DialogTitle>
              <DialogDescription>
                {action === "approve" 
                  ? "¿Estás seguro de que quieres aprobar este usuario? Podrá acceder inmediatamente a la plataforma."
                  : "¿Estás seguro de que quieres rechazar este usuario? Se le notificará por email."
                }
              </DialogDescription>
            </DialogHeader>

            {selectedUser && (
              <div className="py-4">
                <div className="flex items-center space-x-4 mb-4">
                  <Avatar>
                    <AvatarImage src={selectedUser.avatar} />
                    <AvatarFallback>
                      {selectedUser.fullName?.charAt(0) || selectedUser.email.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{selectedUser.fullName}</p>
                    <p className="text-sm text-gray-600">{selectedUser.email}</p>
                  </div>
                </div>

                {action === "reject" && (
                  <div className="space-y-2">
                    <Label htmlFor="reason">Motivo del rechazo (opcional)</Label>
                    <Textarea
                      id="reason"
                      placeholder="Explica brevemente por qué se rechaza esta solicitud..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={3}
                    />
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedUser(null);
                  setAction(null);
                  setRejectionReason("");
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmAction}
                disabled={approvalMutation.isPending}
                className={action === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
                variant={action === "reject" ? "destructive" : "default"}
              >
                {approvalMutation.isPending ? "Procesando..." : (
                  action === "approve" ? "Aprobar Usuario" : "Rechazar Usuario"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}