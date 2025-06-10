import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  User, 
  Mail, 
  Phone, 
  Building, 
  CreditCard, 
  Lock, 
  Save,
  Upload,
  Trash2,
  Wallet,
  KeyRound,
  Copy,
  RefreshCw,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Define validation schemas for forms
const profileSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email address").optional(),
  username: z.string().min(1, "Username is required"),
  phone: z.string().optional(),
  company: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function AccountPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Wallet management - support for multiple wallets with names
  const [wallets, setWallets] = useState<{id: string; name: string; address: string; isDefault?: boolean}[]>([]);
  const [showAddWalletDialog, setShowAddWalletDialog] = useState(false);
  const [newWalletData, setNewWalletData] = useState({
    id: "",
    name: "",
    address: "",
    isDefault: false
  });
  const [activeTab, setActiveTab] = useState("profile");
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  // State for API key management
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoadingApiKey, setIsLoadingApiKey] = useState(false);
  const [isGeneratingApiKey, setIsGeneratingApiKey] = useState(false);

  // Fetch wallet addresses from user settings or API
  useEffect(() => {
    const fetchWalletAddresses = async () => {
      try {
        // Initialize default wallets array
        let userWallets: {id: string; name: string; address: string; isDefault?: boolean}[] = [];
        
        // Try to get wallets from settings
        if (user?.settings?.wallets && Array.isArray(user.settings.wallets)) {
          userWallets = user.settings.wallets;
        } 
        // If no wallets array found but there's a legacy walletAddress
        else if (user?.settings?.walletAddress) {
          userWallets = [{
            id: "default",
            name: "Principal",
            address: user.settings.walletAddress,
            isDefault: true
          }];
        } 
        // If nothing in settings, try API
        else {
          const response = await apiRequest("GET", '/api/user/wallet-address');
          if (response.ok) {
            const data = await response.json();
            if (data.walletAddress) {
              userWallets = [{
                id: "default",
                name: "Principal",
                address: data.walletAddress,
                isDefault: true
              }];
            }
          }
        }
        
        setWallets(userWallets);
      } catch (error) {
        console.error("Error fetching wallet addresses:", error);
      }
    };
    
    fetchWalletAddresses();
  }, [user]);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      email: user?.email || "",
      username: user?.username || "",
      phone: user?.settings?.phone || "",
      company: user?.settings?.company || ""
    }
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    }
  });

  // Update form when user data changes
  useEffect(() => {
    if (user) {
      profileForm.reset({
        fullName: user.fullName || "",
        email: user.email || "",
        username: user.username || "",
        phone: user.settings?.phone || "",
        company: user.settings?.company || ""
      });
    }
  }, [user, profileForm]);
  
  // Load API key when Security tab is active
  useEffect(() => {
    if (activeTab === "security" && user) {
      fetchApiKey();
    }
  }, [activeTab, user]);

  const onProfileSubmit = async (data: ProfileFormValues) => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      // Create settings object with the updated values
      const settings = {
        ...(user.settings || {}),
        phone: data.phone,
        company: data.company
      };

      // Only update fields that can be modified (not username or email)
      const userData = {
        fullName: data.fullName,
        settings
      };

      const response = await apiRequest("PATCH", '/api/user/profile', userData);

      if (response.ok) {
        toast({
          title: "Profile updated",
          description: "Your profile has been successfully updated.",
          variant: "default"
        });
        
        // Refresh user data to get updated profile
        queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update profile");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "There was a problem updating your profile.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onPasswordSubmit = async (data: PasswordFormValues) => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      const response = await apiRequest("POST", '/api/user/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword
      });

      if (response.ok) {
        toast({
          title: "Password updated",
          description: "Your password has been successfully changed.",
          variant: "default"
        });
        passwordForm.reset({
          currentPassword: "",
          newPassword: "",
          confirmPassword: ""
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update password");
      }
    } catch (error) {
      console.error("Error updating password:", error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "There was a problem updating your password.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handler for triggering the file input click
  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Handler for when a file is selected
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    // Validate the file
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please select an image file.",
        variant: "destructive"
      });
      return;
    }
    
    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive"
      });
      return;
    }
    
    setIsUploading(true);
    
    try {
      // Create form data for the file upload
      const formData = new FormData();
      formData.append('avatar', file);
      
      // Upload the file
      const response = await fetch('/api/user/avatar', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to upload avatar");
      }
      
      // Success, refresh user data
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      
      toast({
        title: "Avatar updated",
        description: "Your profile photo has been updated successfully.",
        variant: "default"
      });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "There was a problem uploading your photo.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // Handler for removing the avatar
  const handleRemoveAvatar = async () => {
    if (!user) return;
    
    try {
      const response = await apiRequest("DELETE", '/api/user/avatar', undefined);
      
      if (response.ok) {
        // Success, refresh user data
        queryClient.invalidateQueries({ queryKey: ['/api/user'] });
        
        toast({
          title: "Avatar removed",
          description: "Your profile photo has been removed.",
          variant: "default"
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to remove avatar");
      }
    } catch (error) {
      console.error("Error removing avatar:", error);
      toast({
        title: "Failed to remove avatar",
        description: error instanceof Error ? error.message : "There was a problem removing your photo.",
        variant: "destructive"
      });
    }
  };
  
  // Switch to the security tab
  const switchToSecurityTab = () => {
    setActiveTab("security");
  };
  
  // Fetch API key
  const fetchApiKey = async () => {
    if (!user) return;
    
    setIsLoadingApiKey(true);
    try {
      const response = await apiRequest("GET", '/api/user/api-key');
      
      if (response.ok) {
        const data = await response.json();
        setApiKey(data.apiKey);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch API key");
      }
    } catch (error) {
      console.error("Error fetching API key:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch API key",
        variant: "destructive"
      });
    } finally {
      setIsLoadingApiKey(false);
    }
  };
  
  // Generate new API key
  const generateApiKey = async () => {
    if (!user) return;
    
    setIsGeneratingApiKey(true);
    try {
      const response = await apiRequest("POST", '/api/user/api-key');
      
      if (response.ok) {
        const data = await response.json();
        setApiKey(data.apiKey);
        
        toast({
          title: "API Key Generated",
          description: "Your new API key has been generated successfully.",
          variant: "default"
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to generate API key");
      }
    } catch (error) {
      console.error("Error generating API key:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate API key",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingApiKey(false);
    }
  };
  
  // Handle opening wallet dialog for adding a new wallet or editing existing one
  const handleOpenWalletDialog = (walletId: string | null = null) => {
    if (walletId) {
      // Edit mode
      const walletToEdit = wallets.find(w => w.id === walletId);
      if (walletToEdit) {
        setNewWalletData({...walletToEdit});
        setEditingWalletId(walletId);
      }
    } else {
      // Add mode - create a new wallet with a unique ID
      setNewWalletData({
        id: `wallet_${Date.now()}`,
        name: "",
        address: "",
        isDefault: wallets.length === 0 // Make it default if it's the first one
      });
      setEditingWalletId(null);
    }
    setShowAddWalletDialog(true);
  };
  
  // Handle wallet save (add or update)
  const handleSaveWallet = async () => {
    if (!newWalletData.name || !newWalletData.address || !user) return;
    
    // Validation - max 3 wallets
    if (!editingWalletId && wallets.length >= 3) {
      toast({
        title: "Límite alcanzado",
        description: "Solo puedes tener un máximo de 3 carteras.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Create updated wallets array
      let updatedWallets = [...wallets];
      
      if (editingWalletId) {
        // Update existing wallet
        updatedWallets = updatedWallets.map(w => 
          w.id === editingWalletId ? {...newWalletData} : 
          // If this wallet is marked as default, remove default from others
          newWalletData.isDefault ? {...w, isDefault: false} : w
        );
      } else {
        // Add new wallet
        if (newWalletData.isDefault) {
          // If new wallet is default, remove default from others
          updatedWallets = updatedWallets.map(w => ({...w, isDefault: false}));
        }
        updatedWallets.push(newWalletData);
      }
      
      // Ensure at least one wallet is marked as default
      if (!updatedWallets.some(w => w.isDefault) && updatedWallets.length > 0) {
        updatedWallets[0].isDefault = true;
      }
      
      // Update in user settings
      const settings = {
        ...(user.settings || {}),
        wallets: updatedWallets
      };
      
      const response = await apiRequest("PATCH", '/api/user/profile', {
        settings
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update wallet addresses");
      }
      
      // Success
      setWallets(updatedWallets);
      setShowAddWalletDialog(false);
      setNewWalletData({
        id: "",
        name: "",
        address: "",
        isDefault: false
      });
      setEditingWalletId(null);
      
      // Refresh user data
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      
      toast({
        title: editingWalletId ? "Cartera actualizada" : "Cartera agregada",
        description: editingWalletId 
          ? "Tu cartera ha sido actualizada correctamente." 
          : "Tu nueva cartera ha sido agregada correctamente.",
        variant: "default"
      });
    } catch (error) {
      console.error("Error updating wallet:", error);
      toast({
        title: "Error al guardar",
        description: error instanceof Error ? error.message : "Hubo un problema al guardar la cartera.",
        variant: "destructive"
      });
    }
  };
  
  // Handler for copying text to clipboard
  const copyToClipboard = (text: string, message = "Copied to clipboard") => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: message,
      variant: "default"
    });
  };
  
  // Handle wallet delete
  const handleDeleteWallet = async (walletId: string) => {
    if (!user) return;
    
    try {
      // Remove wallet from array
      let updatedWallets = wallets.filter(w => w.id !== walletId);
      
      // If deleted wallet was default, make another one default
      if (wallets.find(w => w.id === walletId)?.isDefault && updatedWallets.length > 0) {
        updatedWallets[0].isDefault = true;
      }
      
      // Update in user settings
      const settings = {
        ...(user.settings || {}),
        wallets: updatedWallets
      };
      
      const response = await apiRequest("PATCH", '/api/user/profile', {
        settings
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete wallet");
      }
      
      // Success
      setWallets(updatedWallets);
      
      // Refresh user data
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      
      toast({
        title: "Cartera eliminada",
        description: "La cartera ha sido eliminada correctamente.",
        variant: "default"
      });
    } catch (error) {
      console.error("Error deleting wallet:", error);
      toast({
        title: "Error al eliminar",
        description: error instanceof Error ? error.message : "Hubo un problema al eliminar la cartera.",
        variant: "destructive"
      });
    }
  };

  return (
    <DashboardLayout activeItem="account">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">My Account</h1>
          <p className="text-gray-500 mt-1">Manage your account settings and preferences</p>
        </div>
        
        <Tabs defaultValue="profile" className="w-full" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="security" id="security-tab">Security</TabsTrigger>
          </TabsList>
          
          {/* Profile Tab */}
          <TabsContent value="profile">
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Update your account details and personal information.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center">
                    <Avatar className="w-24 h-24 mr-6">
                      {user?.settings?.avatar ? (
                        <AvatarImage src={user.settings.avatar} alt={user.fullName || user.username} />
                      ) : null}
                      <AvatarFallback className="bg-gray-200">
                        <User className="h-12 w-12 text-gray-500" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-medium">Profile Photo</h3>
                      <p className="text-sm text-gray-500 mt-1 mb-2">
                        This will be displayed on your profile and throughout the platform.
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          type="button"
                          onClick={handleUploadClick}
                          disabled={isUploading}
                          className="flex items-center gap-1"
                        >
                          <Upload className="h-4 w-4" />
                          {isUploading ? 'Uploading...' : 'Upload Photo'}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          type="button" 
                          onClick={handleRemoveAvatar}
                          disabled={isUploading || !user?.settings?.avatar}
                          className="flex items-center gap-1"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500" />
                          Full Name
                        </div>
                      </Label>
                      <Input 
                        id="fullName"
                        {...profileForm.register("fullName")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-500" />
                          Email Address
                        </div>
                      </Label>
                      <Input 
                        id="email"
                        type="email"
                        {...profileForm.register("email")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="username">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500" />
                          Username
                        </div>
                      </Label>
                      <Input 
                        id="username"
                        {...profileForm.register("username")}
                        disabled
                      />
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-gray-500">
                          Your username cannot be changed
                        </p>
                        <Button 
                          variant="link" 
                          type="button" 
                          size="sm" 
                          className="text-blue-600"
                          onClick={switchToSecurityTab}
                        >
                          <Lock className="h-3 w-3 mr-1" />
                          Change Password
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-500" />
                          Phone Number
                        </div>
                      </Label>
                      <Input 
                        id="phone"
                        {...profileForm.register("phone")}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="company">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-gray-500" />
                          Company
                        </div>
                      </Label>
                      <Input 
                        id="company"
                        {...profileForm.register("company")}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                  <Button type="submit" className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    Save Changes
                  </Button>
                </CardFooter>
              </Card>
            </form>
          </TabsContent>
          
          {/* Security Tab */}
          <TabsContent value="security">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* API Key Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <KeyRound className="h-5 w-5" />
                    API Key
                  </CardTitle>
                  <CardDescription>
                    Your API key is used to authenticate requests to the API.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoadingApiKey ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
                    </div>
                  ) : apiKey ? (
                    <div className="space-y-4">
                      <div className="p-3 bg-gray-50 rounded-md border relative">
                        <div className="font-mono text-sm break-all pr-8">{apiKey}</div>
                        <button 
                          onClick={() => copyToClipboard(apiKey, "API key copied to clipboard")}
                          className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
                          type="button"
                        >
                          <Copy className="h-5 w-5" />
                        </button>
                      </div>
                      
                      <div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={generateApiKey}
                          disabled={isGeneratingApiKey}
                          className="flex items-center gap-1"
                          type="button"
                        >
                          <RefreshCw className="h-4 w-4" />
                          {isGeneratingApiKey ? "Regenerating..." : "Regenerate API Key"}
                        </Button>
                        <p className="text-sm text-gray-500 mt-2">
                          <AlertCircle className="h-4 w-4 inline-block mr-1" />
                          Warning: Regenerating your API key will invalidate your current key.
                        </p>
                      </div>
                      
                      <div className="mt-4 bg-blue-50 p-3 rounded-md border border-blue-200">
                        <h4 className="font-medium flex items-center text-blue-700">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          API Documentation
                        </h4>
                        <p className="text-sm text-blue-700 mt-1">
                          Our API allows you to programmatically create orders and check order status.
                        </p>
                        <div className="mt-2 space-y-2 text-sm text-blue-700">
                          <div>
                            <span className="bg-blue-100 px-1 py-0.5 rounded font-mono">POST /api/external/orders</span>
                            <span className="ml-2">Create a new order</span>
                          </div>
                          <div>
                            <span className="bg-blue-100 px-1 py-0.5 rounded font-mono">GET /api/external/orders/:orderNumber/status</span>
                            <span className="ml-2">Check order status</span>
                          </div>
                        </div>
                        <p className="text-sm text-blue-700 mt-2">
                          All API requests require your API key in the <span className="font-mono bg-blue-100 px-1 rounded">X-API-Key</span> header.
                        </p>
                        <div className="mt-3 text-xs">
                          <details className="cursor-pointer">
                            <summary className="text-blue-700 font-medium">API Fields & Rules</summary>
                            <div className="mt-2 p-2 bg-blue-100 rounded text-blue-800">
                              <div className="font-medium mb-2">Required Fields:</div>
                              <ul className="list-disc list-inside mb-3 space-y-1">
                                <li><code>productId</code> - ID of existing product</li>
                                <li><code>customerName</code> - Customer full name</li>
                                <li><code>customerPhone</code> - Customer phone number</li>
                              </ul>
                              <div className="font-medium mb-2">Optional Fields:</div>
                              <ul className="list-disc list-inside mb-3 space-y-1">
                                <li><code>quantity</code> - Defaults to 1 if empty</li>
                                <li><code>salePrice</code> - Ignored, product price always used</li>
                                <li><code>customerAddress</code> - Street address</li>
                                <li><code>postalCode</code> - Postal/ZIP code</li>
                                <li><code>city</code> - City name</li>
                                <li><code>province</code> - State/Province</li>
                                <li><code>customerEmail</code> - Customer email</li>
                                <li><code>notes</code> - Additional notes</li>
                              </ul>
                            </div>
                          </details>
                          <details className="cursor-pointer">
                            <summary className="text-blue-700 font-medium">Example: Create Order</summary>
                            <pre className="mt-2 p-2 bg-blue-100 rounded text-blue-800 overflow-x-auto whitespace-pre-wrap">
{`// Minimal order (required fields only)
fetch('${window.location.origin}/api/external/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': '${user?.apiKey || "your-api-key-here"}'
  },
  body: JSON.stringify({
    productId: 1,
    customerName: "María García",
    customerPhone: "+34687654321"
  })
})

// Complete order with all fields
fetch('${window.location.origin}/api/external/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': '${user?.apiKey || "your-api-key-here"}'
  },
  body: JSON.stringify({
    productId: 1,
    quantity: 2,
    salePrice: 999.99, // This will be ignored
    customerName: "Juan Pérez",
    customerPhone: "+34612345678",
    customerAddress: "Calle Mayor 123",
    postalCode: "28001",
    city: "Madrid",
    province: "Madrid",
    customerEmail: "juan.perez@email.com",
    notes: "Entrega urgente"
  })
})
.then(response => response.json())
.then(data => console.log(data))
`}
                            </pre>
                          </details>
                          <details className="cursor-pointer mt-3">
                            <summary className="text-blue-700 font-medium">Example: Check Order Status</summary>
                            <pre className="mt-2 p-2 bg-blue-100 rounded text-blue-800 overflow-x-auto whitespace-pre-wrap">
{`// Check order status example
fetch('${window.location.origin}/api/external/orders/ORD-12345/status', {
  method: 'GET',
  headers: {
    'X-API-Key': '${user?.apiKey || "your-api-key-here"}'
  }
})
.then(response => response.json())
.then(data => console.log(data))
`}
                            </pre>
                          </details>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <KeyRound className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-500 mb-4">You don't have an API key yet</p>
                      <Button 
                        onClick={generateApiKey} 
                        disabled={isGeneratingApiKey}
                        variant="outline"
                        className="mx-auto"
                        type="button"
                      >
                        {isGeneratingApiKey ? "Generating..." : "Generate API Key"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Password Change Form */}
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}>
                <Card>
                  <CardHeader>
                    <CardTitle>Password</CardTitle>
                    <CardDescription>Change your account password.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">
                        <div className="flex items-center gap-2">
                          <Lock className="h-4 w-4 text-gray-500" />
                          Current Password
                        </div>
                      </Label>
                      <Input 
                        id="currentPassword"
                        type="password"
                        {...passwordForm.register("currentPassword")}
                        className={passwordForm.formState.errors.currentPassword ? "border-red-500" : ""}
                      />
                      {passwordForm.formState.errors.currentPassword && (
                        <p className="text-sm text-red-500">
                          {passwordForm.formState.errors.currentPassword.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">
                        <div className="flex items-center gap-2">
                          <Lock className="h-4 w-4 text-gray-500" />
                          New Password
                        </div>
                      </Label>
                      <Input 
                        id="newPassword"
                        type="password"
                        {...passwordForm.register("newPassword")}
                        className={passwordForm.formState.errors.newPassword ? "border-red-500" : ""}
                      />
                      {passwordForm.formState.errors.newPassword && (
                        <p className="text-sm text-red-500">
                          {passwordForm.formState.errors.newPassword.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">
                        <div className="flex items-center gap-2">
                          <Lock className="h-4 w-4 text-gray-500" />
                          Confirm Password
                        </div>
                      </Label>
                      <Input 
                        id="confirmPassword"
                        type="password"
                        {...passwordForm.register("confirmPassword")}
                        className={passwordForm.formState.errors.confirmPassword ? "border-red-500" : ""}
                      />
                      {passwordForm.formState.errors.confirmPassword && (
                        <p className="text-sm text-red-500">
                          {passwordForm.formState.errors.confirmPassword.message}
                        </p>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      type="submit" 
                      className="ml-auto"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Updating..." : "Update Password"}
                    </Button>
                  </CardFooter>
                </Card>
              </form>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Wallet Addresses</CardTitle>
                    <CardDescription>Manage your wallet addresses for withdrawals</CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => handleOpenWalletDialog()}
                    disabled={wallets.length >= 3}
                  >
                    <Wallet className="mr-2 h-4 w-4" />
                    Add Wallet
                  </Button>
                </CardHeader>
                <CardContent>
                  {wallets.length === 0 ? (
                    <div className="p-4 border rounded-md mb-4 bg-gray-50 text-center">
                      <Wallet className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                      <p className="text-gray-500">No wallet addresses configured</p>
                      <p className="text-xs text-gray-400 mt-1">You can add up to 3 wallet addresses</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {wallets.map(wallet => (
                        <div key={wallet.id} className="flex items-center justify-between p-4 border rounded-md">
                          <div className="flex items-center overflow-hidden">
                            <Wallet className="h-6 w-6 text-gray-500 mr-4 flex-shrink-0" />
                            <div className="overflow-hidden">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{wallet.name}</p>
                                {wallet.isDefault && (
                                  <Badge variant="secondary" className="text-xs">Default</Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 truncate max-w-[220px]">
                                {wallet.address}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleOpenWalletDialog(wallet.id)}
                              className="h-8 w-8 p-0"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                                <path d="m15 5 4 4"/>
                              </svg>
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDeleteWallet(wallet.id)}
                              className="h-8 w-8 p-0 text-red-500"
                              disabled={wallets.length === 1 && wallet.isDefault}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-2">
                                <path d="M3 6h18"/>
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                                <line x1="10" x2="10" y1="11" y2="17"/>
                                <line x1="14" x2="14" y1="11" y2="17"/>
                              </svg>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Wallet Address Dialog */}
              <Dialog open={showAddWalletDialog} onOpenChange={setShowAddWalletDialog}>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>{editingWalletId ? "Editar Cartera" : "Añadir Nueva Cartera"}</DialogTitle>
                    <DialogDescription>
                      {editingWalletId 
                        ? "Actualiza los detalles de tu cartera para retiros." 
                        : "Agrega una nueva dirección de cartera para recibir tus retiros."}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="walletName">Nombre de la Cartera</Label>
                      <Input 
                        id="walletName" 
                        value={newWalletData.name} 
                        onChange={(e) => setNewWalletData({...newWalletData, name: e.target.value})}
                        placeholder="Ej: Binance, Metamask, etc." 
                      />
                      <p className="text-xs text-gray-500">
                        Un nombre descriptivo para identificar esta cartera
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="walletAddress">Dirección de la Cartera</Label>
                      <Input 
                        id="walletAddress" 
                        value={newWalletData.address} 
                        onChange={(e) => setNewWalletData({...newWalletData, address: e.target.value})}
                        placeholder="Introduce la dirección de tu cartera" 
                      />
                      <p className="text-xs text-gray-500">
                        Dirección donde recibirás los fondos retirados
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                      <Switch 
                        id="default-wallet" 
                        checked={newWalletData.isDefault} 
                        onCheckedChange={(checked) => setNewWalletData({...newWalletData, isDefault: checked})}
                      />
                      <Label htmlFor="default-wallet">Establecer como cartera predeterminada</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setShowAddWalletDialog(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      type="button" 
                      onClick={handleSaveWallet} 
                      disabled={!newWalletData.name || !newWalletData.address}
                    >
                      Guardar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}