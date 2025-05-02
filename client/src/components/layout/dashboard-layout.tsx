import { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSidebar } from "@/hooks/use-sidebar";
import SidebarNav from "@/components/sidebar-nav";

interface DashboardLayoutProps {
  children: ReactNode;
  activeItem?: string;
}

export default function DashboardLayout({ children, activeItem }: DashboardLayoutProps) {
  const { user } = useAuth();
  const { isSidebarOpen } = useSidebar();
  
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <SidebarNav activeItem={activeItem} user={user} />

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 bg-secondary min-h-screen overflow-auto ${isSidebarOpen ? 'md:ml-[200px]' : ''}`}>
        {children}
      </main>
    </div>
  );
}