import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Wallet, 
  ArrowUp, 
  ArrowDown,
  CreditCard, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Calendar,
  Search,
  Download,
  Banknote,
  AlertCircle,
  DollarSign,
  Plus,
  Upload,
  FileCheck,
  Eye,
  Edit as EditIcon,
  Trash2 as Trash2Icon
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { type Transaction } from "@shared/schema";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Tipo para el balance history
interface BalancePoint {
  date: string;
  balance: number;
}

export default function WalletPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [wallets, setWallets] = useState<Array<{id: string; name: string; address: string; isDefault?: boolean}>>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<number | "">("");
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [walletAddressDialogOpen, setWalletAddressDialogOpen] = useState(false);
  const [newWalletData, setNewWalletData] = useState<{id: string; name: string; address: string; isDefault?: boolean}>({
    id: "",
    name: "",
    address: "",
    isDefault: false
  });
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  
  // Admin - Gestión de retiros
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [transactionDetailOpen, setTransactionDetailOpen] = useState(false);
  const [updateStatusDialogOpen, setUpdateStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [paymentProofText, setPaymentProofText] = useState("");
  
  // Fetch transactions
  const { data: transactions = [], isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['/api/wallet/transactions'],
    enabled: !!user
  });
  
  // Fetch balance
  const { data: balanceData, isLoading: isLoadingBalance } = useQuery({
    queryKey: ['/api/wallet/balance'],
    enabled: !!user
  });
  
  // Fetch wallet addresses from user data
  const { data: userData } = useQuery({
    queryKey: ['/api/user'],
    enabled: !!user
  });

  // Load wallet addresses when user data is available
  useEffect(() => {
    if (userData) {
      // Initialize default wallets array
      let userWallets: {id: string; name: string; address: string; isDefault?: boolean}[] = [];
      
      // Try to get wallets from settings
      if (userData?.settings?.wallets && Array.isArray(userData.settings.wallets)) {
        userWallets = userData.settings.wallets;
      } 
      // If no wallets array found but there's a legacy walletAddress
      else if (userData?.settings?.walletAddress) {
        userWallets = [{
          id: "default",
          name: "Principal",
          address: userData.settings.walletAddress,
          isDefault: true
        }];
      }
      
      setWallets(userWallets);
      
      // Set selected wallet to the default one
      const defaultWallet = userWallets.find(w => w.isDefault);
      if (defaultWallet) {
        setSelectedWalletId(defaultWallet.id);
      } else if (userWallets.length > 0) {
        setSelectedWalletId(userWallets[0].id);
      }
    }
  }, [userData]);
  
  // Create withdrawal mutation
  const withdrawMutation = useMutation({
    mutationFn: (data: { amount: number, walletAddress: string, walletId?: string, walletName?: string }) => {
      return apiRequest('POST', '/api/wallet/withdraw', data);
    },
    onSuccess: () => {
      toast({
        title: "Withdrawal Requested",
        description: "Your withdrawal request has been submitted and is now being processed.",
        variant: "default"
      });
      setWithdrawDialogOpen(false);
      setWithdrawAmount("");
      queryClient.invalidateQueries({ queryKey: ['/api/wallet/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wallet/balance'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Withdrawal Failed",
        description: error.message || "Failed to process your withdrawal. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Update wallet addresses through user settings
  const updateWalletsMutation = useMutation({
    mutationFn: (updatedWallets: Array<{id: string; name: string; address: string; isDefault?: boolean}>) => {
      // Update in user settings
      return apiRequest('PATCH', '/api/user/profile', {
        settings: {
          wallets: updatedWallets
        }
      });
    },
    onSuccess: () => {
      toast({
        title: "Wallet Addresses Updated",
        description: "Your wallet addresses have been updated successfully.",
        variant: "default"
      });
      setWalletAddressDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update your wallet addresses. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Admin - Update transaction status mutation
  const updateTransactionStatusMutation = useMutation({
    mutationFn: async (data: { transactionId: number, status: string, paymentProof?: string }) => {
      const { transactionId, status, paymentProof } = data;
      
      return apiRequest(
        'PATCH', 
        `/api/wallet/transactions/${transactionId}/status`, 
        { status, paymentProof }
      );
    },
    onSuccess: () => {
      toast({
        title: "Transaction Updated",
        description: "The transaction status has been updated successfully.",
        variant: "default"
      });
      setUpdateStatusDialogOpen(false);
      setNewStatus("");
      setPaymentProofText("");
      queryClient.invalidateQueries({ queryKey: ['/api/wallet/transactions'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update transaction status. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Handle transaction status update
  const handleUpdateTransactionStatus = async () => {
    if (!selectedTransaction || !newStatus) return;
    
    // Para estados "paid", se requiere el comprobante de pago como texto
    if (newStatus === "paid" && !paymentProofText) {
      toast({
        title: "Missing Payment Proof",
        description: "Please enter the Tronscan transaction link as payment proof.",
        variant: "destructive"
      });
      return;
    }
    
    updateTransactionStatusMutation.mutate({
      transactionId: selectedTransaction.id,
      status: newStatus,
      paymentProof: newStatus === "paid" ? paymentProofText : undefined
    });
  };
  
  // Function to export transactions to Excel
  const exportTransactions = () => {
    if (!filteredTransactions || filteredTransactions.length === 0) {
      toast({
        title: "No Data to Export",
        description: "There are no transactions to export.",
        variant: "destructive"
      });
      return;
    }
    
    // Prepare data for export
    const exportData = filteredTransactions.map((transaction: any) => {
      return {
        "ID": transaction.id,
        "Type": transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1),
        "Description": transaction.description || "",
        "Reference": transaction.reference || "",
        "Amount": transaction.amount > 0 ? `$${transaction.amount.toFixed(2)}` : `-$${Math.abs(transaction.amount).toFixed(2)}`,
        "Status": transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1),
        "Date": new Date(transaction.createdAt).toLocaleDateString(),
        "Time": new Date(transaction.createdAt).toLocaleTimeString()
      };
    });
    
    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
    
    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // Save the file
    saveAs(dataBlob, `transaction_history_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Export Successful",
      description: "Transaction history has been exported to Excel.",
      variant: "default"
    });
  };
  
  // Prepare balance history data from transactions
  const balanceHistory: BalancePoint[] = useMemo(() => {
    if (!Array.isArray(transactions) || transactions.length === 0) return [];
    
    // Sort transactions by date
    const sortedTransactions = [...transactions].sort((a: any, b: any) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    
    // Create a map of dates to cumulative balance
    const balanceMap = new Map<string, number>();
    let runningBalance = 0;
    
    sortedTransactions.forEach((tx: any) => {
      runningBalance += tx.amount;
      // Format date to YYYY-MM-DD
      const dateStr = new Date(tx.createdAt).toISOString().split('T')[0];
      balanceMap.set(dateStr, runningBalance);
    });
    
    // Convert map to array of points
    return Array.from(balanceMap.entries()).map(([date, balance]) => ({
      date,
      balance
    }));
  }, [transactions]);
  
  // Filter transactions based on search and type filter
  const filteredTransactions = useMemo(() => {
    if (!Array.isArray(transactions) || transactions.length === 0) return [];
    
    return transactions.filter((transaction: any) => {
      const description = transaction.description || '';
      const reference = transaction.reference || '';
      
      const matchesSearch = 
        description.toLowerCase().includes(searchTerm.toLowerCase()) || 
        reference.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = typeFilter === "all" || transaction.type === typeFilter;
      
      return matchesSearch && matchesType;
    });
  }, [transactions, searchTerm, typeFilter]);

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case "withdrawal":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            Withdrawal
          </Badge>
        );
      case "bonus":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Bonus
          </Badge>
        );
      case "discount":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            Discount
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </Badge>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <span className="flex items-center text-green-700">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Paid
          </span>
        );
      case "completed": // Legacy status - mantenerlo para transacciones antiguas
        return (
          <span className="flex items-center text-green-700">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </span>
        );
      case "processing":
        return (
          <span className="flex items-center text-amber-700">
            <Clock className="h-3 w-3 mr-1" />
            Processing
          </span>
        );
      case "pending":
        return (
          <span className="flex items-center text-blue-700">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </span>
        );
      case "failed":
        return (
          <span className="flex items-center text-red-700">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </span>
        );
      case "cancelled":
        return (
          <span className="flex items-center text-gray-700">
            <XCircle className="h-3 w-3 mr-1" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="flex items-center text-gray-500">
            <AlertCircle className="h-3 w-3 mr-1" />
            {status || "Unknown"}
          </span>
        );
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "withdrawal":
        return (
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
            <ArrowUp className="h-4 w-4 text-amber-600" />
          </div>
        );
      case "bonus":
        return (
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <Plus className="h-4 w-4 text-green-600" />
          </div>
        );
      case "discount":
        return (
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <Banknote className="h-4 w-4 text-blue-600" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <CreditCard className="h-4 w-4 text-gray-600" />
          </div>
        );
    }
  };
  
  // Function to handle withdrawal
  const handleWithdraw = () => {
    if (!withdrawAmount || !selectedWalletId) return;
    
    const selectedWallet = wallets.find(w => w.id === selectedWalletId);
    if (!selectedWallet) {
      toast({
        title: "Wallet not found",
        description: "Please select a valid wallet address for the withdrawal.",
        variant: "destructive"
      });
      return;
    }
    
    withdrawMutation.mutate({
      amount: Number(withdrawAmount),
      walletAddress: selectedWallet.address,
      walletId: selectedWallet.id,
      walletName: selectedWallet.name
    });
  };
  
  // Function to handle wallet address management
  const handleSaveWallet = () => {
    if (!newWalletData.name || !newWalletData.address) {
      toast({
        title: "Missing Information",
        description: "Please provide both a name and address for the wallet.",
        variant: "destructive"
      });
      return;
    }
    
    // Check if we've reached the limit of 3 wallets when adding new one
    if (!editingWalletId && wallets.length >= 3) {
      toast({
        title: "Wallet Limit Reached",
        description: "You can have a maximum of 3 wallet addresses. Please delete one to add a new address.",
        variant: "destructive"
      });
      return;
    }
    
    // Create updated wallets array
    let updatedWallets = [...wallets];
    
    // If editing existing wallet
    if (editingWalletId) {
      updatedWallets = updatedWallets.map(wallet => 
        wallet.id === editingWalletId ? 
          { ...newWalletData, isDefault: newWalletData.isDefault || wallet.isDefault } : 
          wallet
      );
      
      // If making this wallet default, make sure others are not default
      if (newWalletData.isDefault) {
        updatedWallets = updatedWallets.map(wallet =>
          wallet.id === editingWalletId ? 
            { ...wallet, isDefault: true } : 
            { ...wallet, isDefault: false }
        );
      }
    } 
    // Adding new wallet
    else {
      // Generate unique ID for new wallet
      const newId = `wallet_${Date.now()}`;
      
      // If this is the first wallet or set as default, make sure it's the only default
      if (newWalletData.isDefault || updatedWallets.length === 0) {
        // First, set isDefault: false for all existing wallets
        updatedWallets = updatedWallets.map(wallet => ({ ...wallet, isDefault: false }));
        
        // Then add the new wallet with isDefault: true
        updatedWallets.push({ 
          ...newWalletData, 
          id: newId, 
          isDefault: true 
        });
      } else {
        // Add non-default wallet
        updatedWallets.push({ 
          ...newWalletData, 
          id: newId,
          isDefault: newWalletData.isDefault || false
        });
      }
    }
    
    // Ensure at least one wallet is marked as default
    if (!updatedWallets.some(w => w.isDefault) && updatedWallets.length > 0) {
      updatedWallets[0] = { ...updatedWallets[0], isDefault: true };
    }
    
    // Update wallets in user settings
    updateWalletsMutation.mutate(updatedWallets);
    
    // Reset form state
    setEditingWalletId(null);
    setNewWalletData({
      id: "",
      name: "",
      address: "",
      isDefault: false
    });
  };
  
  // Function to edit a wallet
  const handleEditWallet = (wallet: {id: string; name: string; address: string; isDefault?: boolean}) => {
    setEditingWalletId(wallet.id);
    setNewWalletData({
      ...wallet,
      isDefault: !!wallet.isDefault
    });
    setWalletAddressDialogOpen(true);
  };
  
  // Function to delete a wallet
  const handleDeleteWallet = (walletId: string) => {
    const walletToDelete = wallets.find(w => w.id === walletId);
    if (!walletToDelete) return;
    
    // Create updated wallets array without the deleted wallet
    let updatedWallets = wallets.filter(w => w.id !== walletId);
    
    // If deleting the default wallet, make another one default
    if (walletToDelete.isDefault && updatedWallets.length > 0) {
      updatedWallets[0] = { ...updatedWallets[0], isDefault: true };
    }
    
    // Update wallets in user settings
    updateWalletsMutation.mutate(updatedWallets);
  };
  
  // Calculate current balance from balanceData with fallback for regular users
  // This ensures we're always displaying the user's own balance
  const currentBalance = balanceData?.balance ?? 0;
  
  // Calculate total pending withdrawals
  const pendingWithdrawals = useMemo(() => {
    if (!transactions || !Array.isArray(transactions)) return 0;
    
    return transactions
      .filter((tx: any) => tx.type === 'withdrawal' && (tx.status === 'pending' || tx.status === 'processing'))
      .reduce((sum: number, tx: any) => sum + Math.abs(tx.amount), 0);
  }, [transactions]);
  
  // Reload balance when user changes to ensure we always have fresh data
  useEffect(() => {
    if (user) {
      queryClient.invalidateQueries({ queryKey: ['/api/wallet/balance'] });
    }
  }, [user]);

  return (
    <DashboardLayout activeItem="wallet">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Wallet</h1>
            <p className="text-gray-500 mt-1">Manage your balance and transactions</p>
          </div>
          
          {/* Wallet Management Button - Only for non-admin users */}
          {user?.role !== "admin" && (
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={() => setWalletAddressDialogOpen(true)}
            >
              <Wallet className="h-4 w-4 mr-1" />
              {wallets.length > 0 ? "Manage Wallets" : "Add Wallet Address"}
            </Button>
          )}
        </div>
        
        {/* Wallet Address Management Dialog - Only for non-admin users */}
        {user?.role !== "admin" && (
          <Dialog open={walletAddressDialogOpen} onOpenChange={(open) => {
            if (!open) {
              // Reset form state when closing
              setEditingWalletId(null);
              setNewWalletData({
                id: "",
                name: "",
                address: "",
                isDefault: false
              });
            }
            setWalletAddressDialogOpen(open);
          }}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editingWalletId ? "Edit Wallet" : "Add Wallet Address"}</DialogTitle>
                <DialogDescription>
                  {editingWalletId 
                    ? "Update your wallet information." 
                    : `Add a wallet address to receive your funds. You can add up to ${3 - wallets.length} more wallet(s).`
                  }
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="walletName">Wallet Name</Label>
                  <Input 
                    id="walletName" 
                    placeholder="e.g. My Main Wallet" 
                    value={newWalletData.name} 
                    onChange={(e) => setNewWalletData({...newWalletData, name: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="walletAddress">Wallet Address</Label>
                  <Input 
                    id="walletAddress" 
                    placeholder="Enter wallet address" 
                    value={newWalletData.address} 
                    onChange={(e) => setNewWalletData({...newWalletData, address: e.target.value})} 
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="isDefault"
                    checked={newWalletData.isDefault}
                    onCheckedChange={(checked) => 
                      setNewWalletData({...newWalletData, isDefault: !!checked})
                    }
                  />
                  <Label htmlFor="isDefault" className="cursor-pointer">Set as default wallet for withdrawals</Label>
                </div>
              </div>

              {/* List existing wallets */}
              {wallets.length > 0 && !editingWalletId && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-2">Your Wallets</h3>
                  <div className="space-y-3">
                    {wallets.map((wallet) => (
                      <div key={wallet.id} className="flex items-center justify-between rounded-md border p-2">
                        <div className="overflow-hidden mr-2">
                          <div className="font-medium flex items-center">
                            {wallet.name}
                            {wallet.isDefault && (
                              <Badge variant="outline" className="ml-2 text-xs">Default</Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{wallet.address}</div>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEditWallet(wallet)}
                          >
                            <EditIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteWallet(wallet.id)}
                            disabled={wallets.length <= 1 && wallet.isDefault}
                          >
                            <Trash2Icon className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter>
                {editingWalletId && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setEditingWalletId(null);
                      setNewWalletData({
                        id: "",
                        name: "",
                        address: "",
                        isDefault: false
                      });
                    }}
                  >
                    Cancel
                  </Button>
                )}
                <Button 
                  type="submit" 
                  onClick={handleSaveWallet}
                  disabled={!newWalletData.address || !newWalletData.name || updateWalletsMutation.isPending}
                >
                  {updateWalletsMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        
        {/* Balance Overview */}
        <div className="grid grid-cols-1 gap-6 mb-6 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">
                {user?.role === "admin" ? "Total Balance (All Users)" : "Current Balance"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Wallet className="h-12 w-12 text-primary mr-4" />
                <div>
                  {isLoadingBalance ? (
                    <p className="text-3xl font-bold">Loading...</p>
                  ) : (
                    <p className="text-3xl font-bold">${currentBalance.toFixed(2)}</p>
                  )}
                  <p className="text-sm text-gray-500">
                    {user?.role === "admin" 
                      ? "Total funds across all accounts" 
                      : "Available for withdrawal"
                    }
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4 flex justify-between">
              {/* Only show withdraw button for regular users */}
              {user?.role !== "admin" && (
                <div className="flex flex-col">
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2"
                    onClick={() => setWithdrawDialogOpen(true)}
                    disabled={wallets.length === 0 || currentBalance <= 0}
                  >
                    <ArrowUp className="h-4 w-4" />
                    Withdraw
                  </Button>
                  
                  {pendingWithdrawals > 0 && (
                    <p className="text-xs text-gray-500 mt-2">
                      Pending withdrawals: ${pendingWithdrawals.toFixed(2)}
                    </p>
                  )}
                </div>
              )}
              
              {/* Display info message if no wallet address is set */}
              {wallets.length === 0 && user?.role !== "admin" && (
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Set up a wallet address to enable withdrawals</span>
                </div>
              )}
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Balance History</CardTitle>
            </CardHeader>
            <CardContent className="h-[230px]">
              {balanceHistory.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p>No transaction history available</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={balanceHistory}
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value) => [`$${value}`, 'Balance']}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="balance"
                      stroke="#4f46e5"
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Withdrawal Dialog - Only for non-admin users */}
        {user?.role !== "admin" && (
          <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Withdraw Funds</DialogTitle>
                <DialogDescription>
                  Request a withdrawal to your virtual wallet.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="withdrawAmount">Amount</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                    <Input 
                      id="withdrawAmount" 
                      type="number" 
                      min="1" 
                      max={currentBalance} 
                      step="0.01" 
                      className="pl-10" 
                      placeholder="0.00" 
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value === "" ? "" : Number(e.target.value))}
                    />
                  </div>
                  <p className="text-xs text-gray-500">Available balance: ${currentBalance.toFixed(2)}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="walletAddressSelect">Select Wallet</Label>
                  {wallets.length > 0 ? (
                    <Select 
                      value={selectedWalletId || undefined}
                      onValueChange={(value) => {
                        if (value === "add_new") {
                          setWithdrawDialogOpen(false);
                          setWalletAddressDialogOpen(true);
                        } else {
                          setSelectedWalletId(value);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a wallet" />
                      </SelectTrigger>
                      <SelectContent>
                        {wallets.map(wallet => (
                          <SelectItem key={wallet.id} value={wallet.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{wallet.name}</span>
                              <span className="text-xs text-gray-500 truncate max-w-[300px]">{wallet.address}</span>
                            </div>
                          </SelectItem>
                        ))}
                        <SelectItem value="add_new">
                          <div className="flex items-center text-blue-600">
                            <Plus className="h-4 w-4 mr-2" />
                            Add new wallet
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button 
                        onClick={() => {
                          setWithdrawDialogOpen(false);
                          setWalletAddressDialogOpen(true);
                        }}
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add wallet address
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    Funds will be sent to the selected wallet.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  type="submit" 
                  onClick={handleWithdraw} 
                  disabled={!withdrawAmount || Number(withdrawAmount) <= 0 || Number(withdrawAmount) > currentBalance || !selectedWalletId || withdrawMutation.isPending}
                >
                  {withdrawMutation.isPending ? "Processing..." : "Request Withdrawal"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        
        {/* Transactions Section */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap justify-between items-center">
              <div>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>Track all your wallet transactions</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center gap-2"
                onClick={exportTransactions}
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex-1 min-w-[250px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <Input 
                    placeholder="Search transactions..." 
                    className="pl-10" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="w-[200px]">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="withdrawal">Withdrawals</SelectItem>
                    <SelectItem value="bonus">Bonus</SelectItem>
                    <SelectItem value="discount">Discount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              {isLoadingTransactions ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-gray-500">Loading transactions...</p>
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-gray-500">No transactions found</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Transaction</th>
                      <th className="text-left py-3 px-4 font-medium">Date</th>
                      <th className="text-left py-3 px-4 font-medium">Type</th>
                      <th className="text-left py-3 px-4 font-medium">Reference</th>
                      <th className="text-left py-3 px-4 font-medium">Status</th>
                      <th className="text-right py-3 px-4 font-medium">Amount</th>
                      {(user?.role === "admin" || user?.role === "finance") && (
                        <th className="text-center py-3 px-4 font-medium">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((transaction: any) => (
                      <tr 
                        key={transaction.id} 
                        className="border-b hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          setSelectedTransaction(transaction);
                          setTransactionDetailOpen(true);
                        }}
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center">
                            {getTransactionIcon(transaction.type)}
                            <div className="ml-3">
                              <p className="font-medium">{transaction.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                            {new Date(transaction.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          {getTransactionBadge(transaction.type)}
                        </td>
                        <td className="py-4 px-4 text-gray-500">
                          {transaction.status === "paid" && 
                           transaction.type === "withdrawal" && 
                           transaction.settings?.paymentProof ? (
                            <a 
                              href={transaction.settings.paymentProof}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center text-blue-600 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              <span className="truncate">View on Tronscan</span>
                            </a>
                          ) : (
                            transaction.reference
                          )}
                        </td>
                        <td className="py-4 px-4">
                          {getStatusBadge(transaction.status)}
                        </td>
                        <td className={`py-4 px-4 text-right font-medium ${
                          transaction.amount > 0 ? 'text-green-600' : 'text-gray-700'
                        }`}>
                          {transaction.amount > 0 ? '+' : ''}
                          ${Math.abs(transaction.amount).toFixed(2)}
                        </td>
                        {(user?.role === "admin" || user?.role === "finance") && (
                          <td className="py-4 px-4">
                            {transaction.type === "withdrawal" && transaction.status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="mr-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateTransactionStatusMutation.mutate({
                                    transactionId: transaction.id,
                                    status: "processing"
                                  });
                                }}
                              >
                                Process
                              </Button>
                            )}
                            {transaction.type === "withdrawal" && transaction.status === "processing" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTransaction(transaction);
                                  setUpdateStatusDialogOpen(true);
                                  setNewStatus("paid");
                                }}
                              >
                                Paid
                              </Button>
                            )}
                            {transaction.type === "withdrawal" && 
                             (transaction.status === "pending" || transaction.status === "processing") && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-gray-500"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateTransactionStatusMutation.mutate({
                                    transactionId: transaction.id,
                                    status: "cancelled"
                                  });
                                }}
                              >
                                Cancel
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Transaction Details Dialog */}
      <Dialog open={transactionDetailOpen} onOpenChange={setTransactionDetailOpen}>
        <DialogContent className="sm:max-w-[500px]">
          {selectedTransaction && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {getTransactionIcon(selectedTransaction.type)}
                  <span>Transaction Details</span>
                </DialogTitle>
                <DialogDescription>
                  View the details of this transaction
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">Transaction ID</p>
                    <p className="font-medium">{selectedTransaction.id}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">Reference</p>
                    <p className="font-medium">{selectedTransaction.reference || 'N/A'}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">Type</p>
                    <div>{getTransactionBadge(selectedTransaction.type)}</div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">Status</p>
                    <div>{getStatusBadge(selectedTransaction.status)}</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">Date</p>
                    <p className="font-medium">
                      {new Date(selectedTransaction.createdAt).toLocaleDateString()} 
                      {' '}
                      {new Date(selectedTransaction.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">Amount</p>
                    <p className={`font-medium ${selectedTransaction.amount > 0 ? 'text-green-600' : 'text-gray-700'}`}>
                      {selectedTransaction.amount > 0 ? '+' : ''}
                      ${Math.abs(selectedTransaction.amount).toFixed(2)}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Description</p>
                  <p className="font-medium">{selectedTransaction.description || 'No description'}</p>
                </div>
                
                {/* Wallet info section for withdrawals - display wallet information */}
                {selectedTransaction.type === "withdrawal" && selectedTransaction.settings?.walletAddress && (
                  <div className="space-y-2 mt-2 border-t pt-2">
                    <p className="text-sm text-gray-500 font-medium">Wallet Information</p>
                    {selectedTransaction.settings.walletName && (
                      <div className="space-y-1">
                        <p className="text-sm text-gray-500">Wallet Name</p>
                        <p className="font-medium">{selectedTransaction.settings.walletName}</p>
                      </div>
                    )}
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">Wallet Address</p>
                      <p className="font-medium break-all text-xs">{selectedTransaction.settings.walletAddress}</p>
                    </div>
                  </div>
                )}
                
                {/* Payment Proof section - only show if available */}
                {selectedTransaction.status === "paid" && 
                 selectedTransaction.type === "withdrawal" && 
                 selectedTransaction.settings?.paymentProof && (
                  <div className="space-y-2 mt-2">
                    <p className="text-sm text-gray-500 font-medium">Payment Proof</p>
                    <div className="border rounded-md p-3 bg-gray-50">
                      <a 
                        href={selectedTransaction.settings.paymentProof}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-blue-600 hover:underline"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Transaction on Tronscan
                      </a>
                    </div>
                  </div>
                )}
                
                {/* Admin/Finance Actions - For admin and finance users and withdrawal transactions */}
                {(user?.role === "admin" || user?.role === "finance") && 
                 selectedTransaction.type === "withdrawal" && 
                 (selectedTransaction.status === "pending" || selectedTransaction.status === "processing") && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium mb-2">Management Actions</h4>
                    <div className="flex gap-2">
                      {selectedTransaction.status === "pending" && (
                        <Button 
                          onClick={() => {
                            setTransactionDetailOpen(false);
                            setSelectedTransaction(selectedTransaction);
                            setUpdateStatusDialogOpen(true);
                            setNewStatus("processing");
                          }}
                          className="flex items-center gap-2"
                        >
                          <Clock className="h-4 w-4" />
                          Mark as Processing
                        </Button>
                      )}
                      
                      {selectedTransaction.status === "processing" && (
                        <Button 
                          onClick={() => {
                            setTransactionDetailOpen(false);
                            setSelectedTransaction(selectedTransaction);
                            setUpdateStatusDialogOpen(true);
                            setNewStatus("paid");
                          }}
                          className="flex items-center gap-2"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Mark as Paid
                        </Button>
                      )}
                      
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setTransactionDetailOpen(false);
                          setSelectedTransaction(selectedTransaction);
                          setUpdateStatusDialogOpen(true);
                          setNewStatus("cancelled");
                        }}
                        className="flex items-center gap-2"
                      >
                        <XCircle className="h-4 w-4" />
                        Cancel Withdrawal
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setTransactionDetailOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Update Transaction Status Dialog - For admin and finance users */}
      {(user?.role === "admin" || user?.role === "finance") && (
        <Dialog open={updateStatusDialogOpen} onOpenChange={setUpdateStatusDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            {selectedTransaction && (
              <>
                <DialogHeader>
                  <DialogTitle>Update Transaction Status</DialogTitle>
                  <DialogDescription>
                    Change the status of transaction #{selectedTransaction.id}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Current Status</Label>
                    <div className="p-2 rounded-md bg-gray-50 border">
                      {getStatusBadge(selectedTransaction.status)}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="newStatus">New Status</Label>
                    <Select
                      value={newStatus}
                      onValueChange={setNewStatus}
                    >
                      <SelectTrigger id="newStatus">
                        <SelectValue placeholder="Select a new status" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedTransaction.status === "pending" && (
                          <SelectItem value="processing">Processing</SelectItem>
                        )}
                        {(selectedTransaction.status === "pending" || 
                          selectedTransaction.status === "processing") && (
                          <SelectItem value="paid">Paid</SelectItem>
                        )}
                        {(selectedTransaction.status === "pending" || 
                          selectedTransaction.status === "processing") && (
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Payment Proof - Only for paid status */}
                  {newStatus === "paid" && (
                    <div className="space-y-2">
                      <Label htmlFor="paymentProof">Tronscan Transaction Link (required)</Label>
                      <div className="grid gap-2">
                        <Input
                          id="paymentProof"
                          type="text" 
                          placeholder="https://tronscan.org/#/transaction/..."
                          value={paymentProofText}
                          onChange={(e) => setPaymentProofText(e.target.value)}
                        />
                        <p className="text-xs text-gray-500">
                          Paste the Tronscan transaction link as proof of payment
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setUpdateStatusDialogOpen(false);
                      setNewStatus("");
                      setPaymentProofText("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    onClick={handleUpdateTransactionStatus}
                    disabled={
                      !newStatus || 
                      (newStatus === "paid" && !paymentProofText) ||
                      updateTransactionStatusMutation.isPending
                    }
                  >
                    {updateTransactionStatusMutation.isPending ? "Updating..." : "Update Status"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}