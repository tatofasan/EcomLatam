import { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import SidebarNav from "@/components/sidebar-nav";
import { useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
  activeItem?: string;
}

export default function DashboardLayout({ 
  children, 
  activeItem 
}: DashboardLayoutProps) {
  const { user } = useAuth();
  const { isSidebarOpen } = useSidebar();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SidebarNav activeItem={activeItem} user={user} />
      
      <main 
        className={cn(
          "flex-1 min-h-screen transition-all duration-300",
          isSidebarOpen 
            ? "md:ml-[200px]" // Ajustar según ancho de sidebar
            : ""
        )}
      >
        {children}
      </main>
    </div>
  );
}