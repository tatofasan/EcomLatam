import React from "react";
import { cn } from "@/lib/utils";
import { User as UserType } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { EcomdropLogo } from "@/lib/logos";
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Link2, 
  Wallet, 
  Users, 
  UserCog,
  User, 
  LogOut 
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
      key: "orders",
      subItems: [
        {
          title: "Orders List",
          href: "/orders",
          key: "orders-list"
        },
        {
          title: "Statistics",
          href: "/orders/statistics",
          key: "orders-statistics"
        }
      ]
    },
    {
      title: "Connections",
      href: "/connections",
      icon: <Link2 className="h-5 w-5" />,
      key: "connections"
    },
    {
      title: "Wallet",
      href: "/wallet",
      icon: <Wallet className="h-5 w-5" />,
      key: "wallet"
    },
    {
      title: "Team",
      href: "/team",
      icon: <Users className="h-5 w-5" />,
      key: "team"
    },
    {
      title: "My Account",
      href: "/account",
      icon: <UserCog className="h-5 w-5" />,
      key: "account"
    }
  ];

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <aside className={cn("w-[200px] bg-accent border-r border-border flex flex-col h-screen fixed", className)}>
      <div className="p-4 border-b border-border bg-primary/10">
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
                  activeItem === item.key || activeItem?.startsWith(item.key + '-')
                    ? "bg-primary/10 text-primary font-medium" 
                    : "hover:bg-primary/5 text-foreground/80 hover:text-primary"
                )}
              >
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
              </a>
              
              {/* Render sub-items if they exist */}
              {item.subItems && item.subItems.length > 0 && (
                <ul className="pl-5 mt-1 space-y-1">
                  {item.subItems.map((subItem) => (
                    <li key={subItem.key}>
                      <a
                        href={subItem.href}
                        onClick={(e) => {
                          e.preventDefault();
                          setLocation(subItem.href);
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
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
