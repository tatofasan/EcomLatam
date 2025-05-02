import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/hooks/use-sidebar";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import HomePage from "@/pages/home-page";
import ProductsPage from "@/pages/products-page";
import OrdersPage from "@/pages/orders-page";
import OrderStatisticsPage from "@/pages/order-statistics-page";
import ConnectionsPage from "@/pages/connections-page";
import WalletPage from "@/pages/wallet-page";
import TeamPage from "@/pages/team-page";
import AccountPage from "@/pages/account-page";
import { ProtectedRoute } from "./lib/protected-route";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/products" component={ProductsPage} />
      <ProtectedRoute path="/orders" component={OrdersPage} />
      <ProtectedRoute path="/orders/statistics" component={OrderStatisticsPage} />
      <ProtectedRoute path="/connections" component={ConnectionsPage} />
      <ProtectedRoute path="/wallet" component={WalletPage} />
      <ProtectedRoute path="/team" component={TeamPage} />
      <ProtectedRoute path="/account" component={AccountPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <Toaster />
        <Router />
      </SidebarProvider>
    </TooltipProvider>
  );
}

export default App;