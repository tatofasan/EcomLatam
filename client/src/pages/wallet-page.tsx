import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Wallet, 
  ArrowUp, 
  ArrowDown, 
  Plus, 
  CreditCard, 
  Clock, 
  CheckCircle2, 
  XCircle,
  DollarSign,
  Calendar,
  Search,
  Filter,
  Download,
  Banknote
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Sample data - this would typically come from API
const transactions = [
  {
    id: 1,
    date: "2025-04-23",
    type: "deposit",
    description: "Account Funding",
    amount: 500.00,
    status: "completed",
    reference: "DEP12345"
  },
  {
    id: 2,
    date: "2025-04-22",
    type: "payment",
    description: "Order ORD-001-2025",
    amount: -125.99,
    status: "completed",
    reference: "PAY78965"
  },
  {
    id: 3,
    date: "2025-04-20",
    type: "withdrawal",
    description: "Bank Transfer",
    amount: -200.00,
    status: "processing",
    reference: "WIT54321"
  },
  {
    id: 4,
    date: "2025-04-18",
    type: "refund",
    description: "Order ORD-003-2024 Refund",
    amount: 75.50,
    status: "completed",
    reference: "REF98765"
  },
  {
    id: 5,
    date: "2025-04-15",
    type: "payment",
    description: "Order ORD-007-2025",
    amount: -89.99,
    status: "failed",
    reference: "PAY12789"
  }
];

const balanceHistory = [
  { date: '2025-01-01', balance: 100 },
  { date: '2025-02-01', balance: 250 },
  { date: '2025-03-01', balance: 180 },
  { date: '2025-04-01', balance: 320 },
  { date: '2025-04-15', balance: 450 },
  { date: '2025-04-23', balance: 350 },
];

export default function WalletPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [currentBalance, setCurrentBalance] = useState(349.52);

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = 
      transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
      transaction.reference.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === "all" || transaction.type === typeFilter;
    
    return matchesSearch && matchesType;
  });

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
      case "completed":
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
      case "failed":
        return (
          <span className="flex items-center text-red-700">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </span>
        );
      default:
        return null;
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

  return (
    <DashboardLayout activeItem="wallet">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Wallet</h1>
            <p className="text-gray-500 mt-1">Manage your balance and transactions</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Funds
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add Funds to Wallet</DialogTitle>
                <DialogDescription>
                  Top up your wallet balance to make purchases
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                    <Input id="amount" type="number" min="0" step="0.01" className="pl-10" placeholder="0.00" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Select defaultValue="card1">
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="card1">Visa ending in 4242</SelectItem>
                      <SelectItem value="card2">MasterCard ending in 5555</SelectItem>
                      <SelectItem value="new">Add new payment method</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Input id="description" placeholder="Account funding" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Add Funds</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Balance Overview */}
        <div className="grid grid-cols-1 gap-6 mb-6 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Current Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Wallet className="h-12 w-12 text-primary mr-4" />
                <div>
                  <p className="text-3xl font-bold">${currentBalance.toFixed(2)}</p>
                  <p className="text-sm text-gray-500">Available for use</p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4 flex justify-between">
              <Button variant="outline" className="flex items-center gap-2">
                <ArrowUp className="h-4 w-4" />
                Withdraw
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <ArrowDown className="h-4 w-4" />
                    Deposit
                  </Button>
                </DialogTrigger>
              </Dialog>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Balance History</CardTitle>
            </CardHeader>
            <CardContent className="h-[230px]">
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
            </CardContent>
          </Card>
        </div>
        
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Transaction</th>
                    <th className="text-left py-3 px-4 font-medium">Date</th>
                    <th className="text-left py-3 px-4 font-medium">Type</th>
                    <th className="text-left py-3 px-4 font-medium">Reference</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-right py-3 px-4 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b hover:bg-gray-50">
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
                          {transaction.date}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}