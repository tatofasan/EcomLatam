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
import { 
  User, 
  Mail, 
  Phone, 
  Building, 
  CreditCard, 
  Lock, 
  Save,
  Upload,
  Trash2
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
  const [walletAddress, setWalletAddress] = useState("");
  const [showAddWalletDialog, setShowAddWalletDialog] = useState(false);
  const [newWalletAddress, setNewWalletAddress] = useState("");

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

  return (
    <DashboardLayout activeItem="account">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">My Account</h1>
          <p className="text-gray-500 mt-1">Manage your account settings and preferences</p>
        </div>
        
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
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
                      <p className="text-xs text-gray-500">
                        Your username cannot be changed
                      </p>
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
                      />
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
                      />
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
                      />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" className="ml-auto">Update Password</Button>
                  </CardFooter>
                </Card>
              </form>
              
              <Card>
                <CardHeader>
                  <CardTitle>Payment Methods</CardTitle>
                  <CardDescription>Manage your payment methods.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 border rounded-md mb-4">
                    <div className="flex items-center">
                      <CreditCard className="h-6 w-6 text-gray-500 mr-4" />
                      <div>
                        <p className="font-medium">Visa ending in 4242</p>
                        <p className="text-sm text-gray-500">Expires 12/25</p>
                      </div>
                    </div>
                    <Badge>Default</Badge>
                  </div>
                  <Button variant="outline" className="w-full">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Add Payment Method
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}