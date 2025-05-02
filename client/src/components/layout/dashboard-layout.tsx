import { ReactNode, useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import SidebarNav from "@/components/sidebar-nav";

interface DashboardLayoutProps {
  children: ReactNode;
  activeItem?: string;
}

export default function DashboardLayout({ children, activeItem }: DashboardLayoutProps) {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Listen for sidebar state changes
  useEffect(() => {
    function handleSidebarChange(e: any) {
      setIsSidebarOpen(e.detail.isOpen);
    }
    window.addEventListener('sidebarStateChange', handleSidebarChange);
    return () => {
      window.removeEventListener('sidebarStateChange', handleSidebarChange);
    };
  }, []);

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