import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { User as UserType } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSidebar } from "@/hooks/use-sidebar";
import { EcomdropLogo } from "@/lib/logos";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Link2,
  Wallet,
  Send,
  Users,
  UserCog,
  User,
  LogOut,
  Menu,
  X,
  FileText
} from "lucide-react";

interface SidebarNavProps {
  className?: string;
  activeItem?: string;
  user: UserType | null;
}

interface SubNavItem {
  title: string;
  href: string;
  key: string;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  key: string;
  subItems?: SubNavItem[];
}

export default function SidebarNav({ 
  className, 
  activeItem,
  user
}: SidebarNavProps) {
  const { logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { isSidebarOpen, toggleSidebar, openSidebar, closeSidebar } = useSidebar();
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    // Expanded by default if the active item is a subitem
    orders: activeItem?.startsWith('orders-') || false
  });
  
  // Automatically close the sidebar on mobile after clicking a link
  const handleNavigation = (href: string, subMenuParent?: string) => {
    setLocation(href);
    
    // If navigating to a submenu, ensure the parent is expanded
    if (subMenuParent && !expandedMenus[subMenuParent]) {
      setExpandedMenus(prev => ({
        ...prev,
        [subMenuParent]: true
      }));
    }
    
    if (isMobile) {
      closeSidebar();
    }
  };
  
  // Toggle menu expansion
  const toggleMenuExpansion = (key: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setExpandedMenus(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const navItems: NavItem[] = [
    {
      title: "Dashboard",
      href: "/",
      icon: <LayoutDashboard className="h-5 w-5" />,
      key: "dashboard"
    },
    {
      title: "Products",
      href: "/products",
      icon: <Package className="h-5 w-5" />,
      key: "products"
    },
    {
      title: "Orders",
      href: "/orders/statistics", // Default goes to statistics
      icon: <ShoppingCart className="h-5 w-5" />,
      key: "orders",
      subItems: [
        {
          title: "Statistics", // Statistics first
          href: "/orders/statistics",
          key: "orders-statistics"
        },
        {
          title: "Orders List",
          href: "/orders",
          key: "orders-list"
        }
      ]
    },
    // Only show Connections for non-finance users
    ...(user?.role !== 'finance' ? [
      {
        title: "Connections",
        href: "/connections",
        icon: <Link2 className="h-5 w-5" />,
        key: "connections"
      }
    ] : []),
    {
      title: "Wallet",
      href: "/wallet",
      icon: <Wallet className="h-5 w-5" />,
      key: "wallet"
    },
    {
      title: "Postback",
      href: "/postback",
      icon: <Send className="h-5 w-5" />,
      key: "postback"
    },
    // Show Team management for admin, moderator, and finance users
    ...(user?.role === 'admin' || user?.role === 'moderator' || user?.role === 'finance' ? [
      {
        title: "Team",
        href: "/team",
        icon: <Users className="h-5 w-5" />,
        key: "team"
      }
    ] : []),
    {
      title: "My Account",
      href: "/account",
      icon: <UserCog className="h-5 w-5" />,
      key: "account"
    },
    {
      title: "Terms & Conditions",
      href: "/terms",
      icon: <FileText className="h-5 w-5" />,
      key: "terms"
    }
  ];

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <>
      {/* Mobile menu toggle button */}
      <button 
        onClick={toggleSidebar}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-primary text-white shadow-md"
      >
        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      
      {/* Overlay for mobile */}
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={closeSidebar}
        />
      )}
      
      {/* Sidebar itself */}
      <aside 
        className={cn(
          "w-[240px] md:w-[200px] bg-accent border-r border-border flex flex-col h-screen fixed z-40 transition-all duration-300 ease-in-out", 
          isSidebarOpen ? "left-0" : "-left-[240px] md:-left-[200px]",
          className
        )}
      >
        <div className="p-4 border-b border-border bg-primary/10 flex justify-between items-center">
          <EcomdropLogo className="h-8" />
          <button 
            onClick={() => {
              toggleSidebar();
              console.log("Toggling sidebar, new state:", !isSidebarOpen);
            }}
            className="hidden md:flex text-foreground/60 hover:text-primary"
            aria-label="Toggle sidebar"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.key} className="px-3">
                <a 
                  href={item.href}
                  onClick={(e) => {
                    // If it has submenus, toggle expansion
                    if (item.subItems && item.subItems.length > 0) {
                      toggleMenuExpansion(item.key, e);
                    } else {
                      // If it doesn't have submenus, navigate normally
                      e.preventDefault();
                      handleNavigation(item.href);
                    }
                  }}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 text-sm rounded-md group",
                    activeItem === item.key || activeItem?.startsWith(item.key + '-')
                      ? "bg-primary/10 text-primary font-medium" 
                      : "hover:bg-primary/5 text-foreground/80 hover:text-primary"
                  )}
                >
                  <div className="flex items-center">
                    {React.cloneElement(item.icon as React.ReactElement, { 
                      className: cn(
                        "w-5 h-5",
                        activeItem === item.key || activeItem?.startsWith(item.key + '-')
                          ? "text-primary"
                          : "text-foreground/60 group-hover:text-primary"
                      )
                    })}
                    <span className="ml-3">
                      {item.title}
                    </span>
                  </div>
                  
                  {/* Show expansion indicator if it has submenus */}
                  {item.subItems && item.subItems.length > 0 && (
                    <span className={cn(
                      "transition-transform duration-200", 
                      expandedMenus[item.key] ? "rotate-180" : ""
                    )}>
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        width="12" 
                        height="12" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        className="opacity-70"
                      >
                        <path d="m6 9 6 6 6-6"/>
                      </svg>
                    </span>
                  )}
                </a>
                
                {/* Render sub-items if they exist and menu is expanded */}
                {item.subItems && item.subItems.length > 0 && expandedMenus[item.key] && (
                  <ul className="pl-5 mt-1 space-y-1 overflow-hidden transition-all duration-300">
                    {item.subItems.map((subItem) => (
                      <li key={subItem.key}>
                        <a
                          href={subItem.href}
                          onClick={(e) => {
                            e.preventDefault();
                            handleNavigation(subItem.href, item.key);
                          }}
                          className={cn(
                            "flex items-center px-3 py-1.5 text-xs rounded-md",
                            activeItem === subItem.key
                              ? "bg-primary/5 text-primary font-medium"
                              : "hover:bg-primary/5 text-foreground/70 hover:text-primary"
                          )}
                        >
                          <span className="ml-1">
                            {subItem.title}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>
        
        <div className="p-4 border-t border-border bg-primary/5">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-foreground">{user?.username}</p>
              <button 
                className="text-xs text-foreground/70 flex items-center gap-1 hover:text-primary"
                onClick={handleLogout}
              >
                <LogOut className="h-3 w-3" />
                Log out
              </button>
            </div>
          </div>
        </div>
      </aside>
      
      {/* Fixed toggle button for desktop */}
      {!isSidebarOpen && (
        <button 
          onClick={openSidebar}
          className="hidden md:block fixed top-4 left-4 z-30 p-2 rounded-md bg-primary text-white shadow-md"
        >
          <Menu size={20} />
        </button>
      )}
    </>
  );
}