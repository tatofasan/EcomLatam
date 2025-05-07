import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
  Eye
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { type Transaction } from "@shared/schema";

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
  const [walletAddress, setWalletAddress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState<number | "">("");
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [walletAddressDialogOpen, setWalletAddressDialogOpen] = useState(false);
  const [newWalletAddress, setNewWalletAddress] = useState("");
  
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
  
  // Fetch wallet address
  const { data: walletAddressData } = useQuery({
    queryKey: ['/api/user/wallet-address'],
    enabled: !!user
  });
  
  // Update wallet address when data is loaded
  useEffect(() => {
    if (walletAddressData?.walletAddress) {
      setWalletAddress(walletAddressData.walletAddress);
    }
  }, [walletAddressData]);
  
  // Create withdrawal mutation
  const withdrawMutation = useMutation({
    mutationFn: (data: { amount: number, walletAddress: string }) => {
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
  
  // Update wallet address mutation
  const updateWalletAddressMutation = useMutation({
    mutationFn: (walletAddress: string) => {
      return apiRequest('PATCH', '/api/user/wallet-address', { walletAddress });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Wallet Address Updated",
        description: "Your virtual wallet address has been updated successfully.",
        variant: "default"
      });
      setWalletAddress(data?.walletAddress || "");
      setWalletAddressDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/user/wallet-address'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update your wallet address. Please try again.",
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
      setPaymentProofFile(null);
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
  
  // Handle file selection for payment proof
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPaymentProofFile(e.target.files[0]);
    }
  };
  
  // Handle transaction status update
  const handleUpdateTransactionStatus = async () => {
    if (!selectedTransaction || !newStatus) return;
    
    let paymentProofBase64: string | undefined;
    
    // Si es estado "paid" y hay archivo de comprobante, convertir a base64
    if (newStatus === "paid" && paymentProofFile) {
      try {
        const fileReader = new FileReader();
        paymentProofBase64 = await new Promise<string>((resolve, reject) => {
          fileReader.onload = (e) => {
            resolve(e.target?.result as string);
          };
          fileReader.onerror = (error) => {
            reject(error);
          };
          fileReader.readAsDataURL(paymentProofFile);
        });
      } catch (error) {
        toast({
          title: "Error Processing File",
          description: "There was an error processing the payment proof file.",
          variant: "destructive"
        });
        return;
      }
    }
    
    updateTransactionStatusMutation.mutate({
      transactionId: selectedTransaction.id,
      status: newStatus,
      paymentProof: paymentProofBase64
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
      case "deposit":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Deposit
          </Badge>
        );
      case "withdrawal":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            Withdrawal
          </Badge>
        );
      case "payment":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            Payment
          </Badge>
        );
      case "refund":
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            Refund
          </Badge>
        );
      default:
        return null;
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
      case "deposit":
        return (
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <ArrowDown className="h-4 w-4 text-green-600" />
          </div>
        );
      case "withdrawal":
        return (
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
            <ArrowUp className="h-4 w-4 text-amber-600" />
          </div>
        );
      case "payment":
        return (
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <CreditCard className="h-4 w-4 text-blue-600" />
          </div>
        );
      case "refund":
        return (
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
            <Banknote className="h-4 w-4 text-purple-600" />
          </div>
        );
      default:
        return null;
    }
  };
  
  // Function to handle withdrawal
  const handleWithdraw = () => {
    if (!withdrawAmount || !walletAddress) return;
    
    withdrawMutation.mutate({
      amount: Number(withdrawAmount),
      walletAddress
    });
  };
  
  // Function to handle wallet address update
  const handleUpdateWalletAddress = () => {
    if (!newWalletAddress) return;
    
    updateWalletAddressMutation.mutate(newWalletAddress);
  };
  
  // Calculate current balance from balanceData or balance history
  const currentBalance = balanceData?.balance ?? 0;

  return (
    <DashboardLayout activeItem="wallet">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Wallet</h1>
            <p className="text-gray-500 mt-1">Manage your balance and transactions</p>
          </div>
          
          {/* Wallet Address Setup Button - Only for non-admin users */}
          {user?.role !== "admin" && (
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={() => setWalletAddressDialogOpen(true)}
            >
              {walletAddress ? "Change Wallet Address" : "Set Wallet Address"}
            </Button>
          )}
        </div>
        
        {/* Wallet Address Dialog - Only for non-admin users */}
        {user?.role !== "admin" && (
          <Dialog open={walletAddressDialogOpen} onOpenChange={setWalletAddressDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{walletAddress ? "Change Wallet Address" : "Set Wallet Address"}</DialogTitle>
                <DialogDescription>
                  {walletAddress 
                    ? "Update your virtual wallet address for withdrawals." 
                    : "Set up a virtual wallet address to receive your funds."
                  }
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="walletAddress">Wallet Address</Label>
                  <Input 
                    id="walletAddress" 
                    placeholder="Enter your wallet address" 
                    value={newWalletAddress} 
                    onChange={(e) => setNewWalletAddress(e.target.value)} 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  type="submit" 
                  onClick={handleUpdateWalletAddress} 
                  disabled={!newWalletAddress || updateWalletAddressMutation.isPending}
                >
                  {updateWalletAddressMutation.isPending ? "Saving..." : "Save"}
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
                <Button 
                  variant="outline" 
                  className="flex items-center gap-2"
                  onClick={() => setWithdrawDialogOpen(true)}
                  disabled={!walletAddress || currentBalance <= 0}
                >
                  <ArrowUp className="h-4 w-4" />
                  Withdraw
                </Button>
              )}
              
              {/* Display info message if wallet address is not set */}
              {!walletAddress && user?.role !== "admin" && (
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
                  <Label htmlFor="walletAddressDisplay">Wallet Address</Label>
                  <div className="flex items-center gap-2 p-2 border rounded-md bg-gray-50">
                    <span className="truncate">{walletAddress}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Funds will be sent to this wallet address. 
                    <Button 
                      onClick={() => {
                        setWithdrawDialogOpen(false);
                        setWalletAddressDialogOpen(true);
                      }} 
                      variant="link" 
                      className="p-0 h-auto text-xs"
                    >
                      Change address
                    </Button>
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  type="submit" 
                  onClick={handleWithdraw} 
                  disabled={!withdrawAmount || Number(withdrawAmount) <= 0 || Number(withdrawAmount) > currentBalance || !walletAddress || withdrawMutation.isPending}
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
              <Button variant="outline" size="sm" className="flex items-center gap-2">
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
                    <SelectItem value="deposit">Deposits</SelectItem>
                    <SelectItem value="withdrawal">Withdrawals</SelectItem>
                    <SelectItem value="payment">Payments</SelectItem>
                    <SelectItem value="refund">Refunds</SelectItem>
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
                      {user?.role === "admin" && (
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
                        <td className="py-4 px-4 text-gray-500">{transaction.reference}</td>
                        <td className="py-4 px-4">
                          {getStatusBadge(transaction.status)}
                        </td>
                        <td className={`py-4 px-4 text-right font-medium ${
                          transaction.amount > 0 ? 'text-green-600' : 'text-gray-700'
                        }`}>
                          {transaction.amount > 0 ? '+' : ''}
                          ${Math.abs(transaction.amount).toFixed(2)}
                        </td>
                        {user?.role === "admin" && (
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
                
                {/* Payment Proof section - only show if available */}
                {selectedTransaction.status === "paid" && 
                 selectedTransaction.type === "withdrawal" && 
                 selectedTransaction.settings?.paymentProof && (
                  <div className="space-y-2 mt-2">
                    <p className="text-sm text-gray-500 font-medium">Payment Proof</p>
                    <div className="border rounded-md p-3 bg-gray-50">
                      <img 
                        src={selectedTransaction.settings.paymentProof} 
                        alt="Payment Proof" 
                        className="max-w-full h-auto rounded-md"
                      />
                    </div>
                  </div>
                )}
                
                {/* Admin Actions - Only for admin users and withdrawal transactions */}
                {user?.role === "admin" && 
                 selectedTransaction.type === "withdrawal" && 
                 (selectedTransaction.status === "pending" || selectedTransaction.status === "processing") && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium mb-2">Admin Actions</h4>
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
      
      {/* Update Transaction Status Dialog - Only for admin users */}
      {user?.role === "admin" && (
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
                      setPaymentProofFile(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    onClick={handleUpdateTransactionStatus}
                    disabled={
                      !newStatus || 
                      (newStatus === "paid" && !paymentProofFile) ||
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