import { cn } from "@/lib/utils";
import { User as UserType } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { EcomdropLogo } from "@/lib/logos";
import { LayoutDashboard, Package, ShoppingCart, Store, BarChart2, Settings, User, LogOut } from "lucide-react";

interface SidebarNavProps {
  className?: string;
  activeItem?: string;
  user: UserType | null;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  key: string;
}

export default function SidebarNav({ 
  className, 
  activeItem,
  user
}: SidebarNavProps) {
  const { logoutMutation } = useAuth();
  const [, setLocation] = useLocation();

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
      href: "/orders",
      icon: <ShoppingCart className="h-5 w-5" />,
      key: "orders"
    },
    {
      title: "Channels",
      href: "/channels",
      icon: <Store className="h-5 w-5" />,
      key: "channels"
    },
    {
      title: "Analytics",
      href: "/analytics",
      icon: <BarChart2 className="h-5 w-5" />,
      key: "analytics"
    },
    {
      title: "Settings",
      href: "/settings",
      icon: <Settings className="h-5 w-5" />,
      key: "settings"
    }
  ];

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <aside className={cn("w-[200px] bg-white border-r border-gray-200 flex flex-col h-screen fixed", className)}>
      <div className="p-4 border-b border-gray-200">
        <EcomdropLogo className="h-8" />
      </div>
      
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.key} className="px-3">
              <a 
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  setLocation(item.href);
                }}
                className={cn(
                  "flex items-center px-3 py-2 text-sm rounded-md group",
                  activeItem === item.key 
                    ? "bg-secondary text-primary" 
                    : "hover:bg-secondary"
                )}
              >
                {React.cloneElement(item.icon as React.ReactElement, { 
                  className: cn(
                    "w-5 h-5",
                    activeItem === item.key 
                      ? "text-primary"
                      : "text-gray-500 group-hover:text-primary"
                  )
                })}
                <span className={cn(
                  "ml-3",
                  activeItem === item.key && "font-medium"
                )}>
                  {item.title}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
            <User className="h-4 w-4 text-gray-500" />
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium">{user?.username}</p>
            <button 
              className="text-xs text-gray-500 flex items-center gap-1 hover:text-primary"
              onClick={handleLogout}
            >
              <LogOut className="h-3 w-3" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
