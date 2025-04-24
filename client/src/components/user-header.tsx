import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EcomdropLogo } from "@/lib/logos";
import { 
  User, 
  LogOut, 
  Shield
} from "lucide-react";

interface UserHeaderProps {
  username?: string;
}

// WhatsApp logo icon
const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
    <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1Z" />
    <path d="M14 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1Z" />
    <path d="M9.5 13.5c.5 1.5 2.5 2 4 1.5" />
  </svg>
);

export default function UserHeader({ username }: UserHeaderProps) {
  const { user, logoutMutation } = useAuth();
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const displayName = username || user?.username || "Usuario";
  const firstLetter = displayName.charAt(0).toUpperCase();

  return (
    <div className="bg-white border-b w-full py-2 px-4 flex justify-between items-center">
      <div className="flex items-center">
        <div className="w-8 h-8 mr-2">
          <EcomdropLogo className="w-full h-full" />
        </div>
        <Button variant="link" className="font-medium px-2">
          Home
        </Button>
      </div>
      
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="rounded-full text-green-500 border-green-200">
          <WhatsAppIcon className="h-5 w-5" />
        </Button>
        
        <div className="flex items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2 px-3 hover:bg-transparent"
              >
                <div className="text-right hidden sm:block">
                  <span className="block font-medium text-sm">{displayName}</span>
                </div>
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-800">
                  {firstLetter}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem className="flex items-center gap-2 cursor-pointer">
                <User className="h-4 w-4" />
                <span>Mi perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2 cursor-pointer">
                <Shield className="h-4 w-4" />
                <span>Autenticación 2FA</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="flex items-center gap-2 cursor-pointer"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                <span>Cerrar sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}