import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type SidebarContextType = {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    const newState = !isSidebarOpen;
    setIsSidebarOpen(newState);
    // Dispatch custom event for legacy components
    window.dispatchEvent(new CustomEvent('sidebarStateChange', { 
      detail: { isOpen: newState } 
    }));
  };

  const openSidebar = () => {
    if (!isSidebarOpen) {
      setIsSidebarOpen(true);
      window.dispatchEvent(new CustomEvent('sidebarStateChange', { 
        detail: { isOpen: true } 
      }));
    }
  };

  const closeSidebar = () => {
    if (isSidebarOpen) {
      setIsSidebarOpen(false);
      window.dispatchEvent(new CustomEvent('sidebarStateChange', { 
        detail: { isOpen: false } 
      }));
    }
  };

  // Handle screen resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && isSidebarOpen) {
        setIsSidebarOpen(false);
      } else if (window.innerWidth >= 768 && !isSidebarOpen) {
        setIsSidebarOpen(true);
      }
    };

    window.addEventListener('resize', handleResize);
    // Initial check
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isSidebarOpen]);

  return (
    <SidebarContext.Provider value={{ isSidebarOpen, toggleSidebar, openSidebar, closeSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  
  return context;
}