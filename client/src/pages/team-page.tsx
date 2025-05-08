import React, { useState } from "react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, UserPlus, MoreHorizontal, Mail, User, Lock, UserCheck, UserX } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { insertUserSchema } from "@shared/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

// Form validation schema
const userFormSchema = insertUserSchema.extend({
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type UserFormValues = z.infer<typeof userFormSchema>;

// Define our member type 
interface TeamMember {
  id: number;
  username: string;
  fullName?: string;
  email?: string;
  role: string;
  status: string;
  lastLogin?: string;
}

export default function TeamPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TeamMember | null>(null);
  const [passwordReset, setPasswordReset] = useState<{password: string; confirmPassword: string} | null>(null);
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  // Si el usuario no es administrador o moderador, redirigir al dashboard
  React.useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'moderator') {
      toast({
        title: "Acceso denegado",
        description: "No tienes permisos para acceder a esta página",
        variant: "destructive"
      });
      setLocation('/');
    }
  }, [user, setLocation, toast]);
  
  // Fetch team members
  const { data: teamMembers = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ['/api/users'],
    enabled: !!user && user.role === 'admin',
  });
  
  // Setup form with validation
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: '',
      password: '',
      confirmPassword: '',
      fullName: '',
      email: '',
      role: 'user',
    },
  });
  
  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: async (values: UserFormValues) => {
      // Eliminar el campo confirmPassword que no debe enviarse al servidor
      const { confirmPassword, ...userData } = values;
      const res = await apiRequest("POST", "/api/users", userData);
      return res.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Success",
        description: "Team member added successfully"
      });
      setIsAddDialogOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error adding team member",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: { id: number, userData: Partial<UserFormValues> }) => {
      const res = await apiRequest("PATCH", `/api/users/${data.id}`, data.userData);
      return res.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Success",
        description: "User updated successfully"
      });
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error updating user",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { id: number, password: string }) => {
      const res = await apiRequest("PATCH", `/api/users/${data.id}/reset-password`, { password: data.password });
      return res.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Success",
        description: "Password reset successfully"
      });
      setIsResetPasswordDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error resetting password",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Deactivate/Activate user mutation
  const toggleUserStatusMutation = useMutation({
    mutationFn: async (data: { id: number, status: 'active' | 'inactive' }) => {
      const res = await apiRequest("PATCH", `/api/users/${data.id}`, { status: data.status });
      return res.json();
    },
    onSuccess: () => {
      const newStatus = selectedUser?.status === 'active' ? 'inactive' : 'active';
      toast({ 
        title: "Success",
        description: `User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`
      });
      setIsDeactivateDialogOpen(false);
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error updating user status",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Handle form submission
  const onSubmit = (values: UserFormValues) => {
    addMemberMutation.mutate(values);
  };
  
  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            Admin
          </Badge>
        );
      case "moderator":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Moderator
          </Badge>
        );
      case "finance":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            Finance
          </Badge>
        );
      case "user":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            User
          </Badge>
        );
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    return status === "active" ? (
      <span className="flex items-center">
        <span className="h-2 w-2 rounded-full bg-green-500 mr-2"></span>
        Active
      </span>
    ) : (
      <span className="flex items-center">
        <span className="h-2 w-2 rounded-full bg-gray-300 mr-2"></span>
        Inactive
      </span>
    );
  };

  return (
    <DashboardLayout activeItem="team">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Team Management</h1>
            <p className="text-gray-500 mt-1">Manage your team members and their permissions</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2" onClick={() => setIsAddDialogOpen(true)}>
                <UserPlus className="h-4 w-4" />
                Add Team Member
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
                <DialogDescription>
                  Invite a new team member to your Ecomdrop account.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-4">
                        <FormLabel className="text-right">Username</FormLabel>
                        <div className="col-span-3">
                          <FormControl>
                            <Input placeholder="username" {...field} />
                          </FormControl>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-4">
                        <FormLabel className="text-right">Full Name</FormLabel>
                        <div className="col-span-3">
                          <FormControl>
                            <Input placeholder="Full name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-4">
                        <FormLabel className="text-right">Email</FormLabel>
                        <div className="col-span-3">
                          <FormControl>
                            <Input type="email" placeholder="email@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-4">
                        <FormLabel className="text-right">Role</FormLabel>
                        <div className="col-span-3">
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="moderator">Moderator</SelectItem>
                              <SelectItem value="finance">Finance</SelectItem>
                              <SelectItem value="user">User</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-4">
                        <FormLabel className="text-right">Password</FormLabel>
                        <div className="col-span-3">
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-4">
                        <FormLabel className="text-right">Confirm</FormLabel>
                        <div className="col-span-3">
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <DialogFooter className="pt-4">
                    <Button 
                      type="submit" 
                      disabled={addMemberMutation.isPending}
                    >
                      {addMemberMutation.isPending ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Adding...
                        </span>
                      ) : (
                        'Add Member'
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>Manage user access and permissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">User</th>
                    <th className="text-left py-3 px-4 font-medium">Role</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Last Login</th>
                    <th className="text-right py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers.map((member) => (
                    <tr key={member.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                            <User className="h-4 w-4 text-gray-500" />
                          </div>
                          <div>
                            <p className="font-medium">{member.fullName || member.username}</p>
                            <p className="text-gray-500 text-xs flex items-center">
                              <Mail className="h-3 w-3 mr-1" />
                              {member.email || member.username}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {getRoleBadge(member.role)}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(member.status)}
                      </td>
                      <td className="py-3 px-4">
                        {member.lastLogin ? new Date(member.lastLogin).toLocaleString() : 'Never'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setSelectedUser(member);
                              setIsEditDialogOpen(true);
                            }}>
                              <User className="mr-2 h-4 w-4" />
                              <span>Edit Profile</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedUser(member);
                              setIsResetPasswordDialogOpen(true);
                            }}>
                              <Lock className="mr-2 h-4 w-4" />
                              <span>Reset Password</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className={member.status === "active" ? "text-red-600" : "text-green-600"}
                              onClick={() => {
                                setSelectedUser(member);
                                setIsDeactivateDialogOpen(true);
                              }}
                            >
                              {member.status === "active" ? (
                                <><UserX className="mr-2 h-4 w-4" /><span>Deactivate</span></>
                              ) : (
                                <><UserCheck className="mr-2 h-4 w-4" /><span>Activate</span></>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Edit Profile Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update user information for {selectedUser?.username}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-fullname" className="text-right">
                Full Name
              </Label>
              <Input
                id="edit-fullname"
                className="col-span-3"
                defaultValue={selectedUser?.fullName || ""}
                onChange={(e) => {
                  if (selectedUser) {
                    setSelectedUser({
                      ...selectedUser,
                      fullName: e.target.value
                    });
                  }
                }}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-email" className="text-right">
                Email
              </Label>
              <Input
                id="edit-email"
                type="email"
                className="col-span-3"
                defaultValue={selectedUser?.email || ""}
                onChange={(e) => {
                  if (selectedUser) {
                    setSelectedUser({
                      ...selectedUser,
                      email: e.target.value
                    });
                  }
                }}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-role" className="text-right">
                Role
              </Label>
              <Select 
                defaultValue={selectedUser?.role || "user"}
                onValueChange={(value) => {
                  if (selectedUser) {
                    setSelectedUser({
                      ...selectedUser,
                      role: value
                    });
                  }
                }}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedUser) {
                  updateUserMutation.mutate({
                    id: selectedUser.id,
                    userData: {
                      fullName: selectedUser.fullName,
                      email: selectedUser.email,
                      role: selectedUser.role
                    }
                  });
                }
              }} 
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedUser?.username}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-password" className="text-right">
                New Password
              </Label>
              <Input
                id="new-password"
                type="password"
                className="col-span-3"
                value={passwordReset?.password || ""}
                onChange={(e) => {
                  setPasswordReset({
                    password: e.target.value,
                    confirmPassword: passwordReset?.confirmPassword || ""
                  });
                }}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="confirm-password" className="text-right">
                Confirm
              </Label>
              <Input
                id="confirm-password"
                type="password"
                className="col-span-3"
                value={passwordReset?.confirmPassword || ""}
                onChange={(e) => {
                  setPasswordReset({
                    password: passwordReset?.password || "",
                    confirmPassword: e.target.value
                  });
                }}
              />
            </div>
            {passwordReset?.password !== passwordReset?.confirmPassword && 
              passwordReset?.confirmPassword && (
              <p className="text-sm text-red-500 text-right">
                Passwords don't match
              </p>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsResetPasswordDialogOpen(false);
                setPasswordReset(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedUser && passwordReset?.password && 
                    passwordReset.password === passwordReset.confirmPassword) {
                  resetPasswordMutation.mutate({
                    id: selectedUser.id,
                    password: passwordReset.password
                  });
                }
              }} 
              disabled={resetPasswordMutation.isPending || 
                        !passwordReset?.password || 
                        passwordReset.password !== passwordReset.confirmPassword}
            >
              {resetPasswordMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Resetting...
                </span>
              ) : (
                'Reset Password'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate User Dialog */}
      <Dialog open={isDeactivateDialogOpen} onOpenChange={setIsDeactivateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {selectedUser?.status === 'active' ? 'Deactivate' : 'Activate'} User
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.status === 'active' 
                ? 'This will prevent the user from logging in.' 
                : 'This will allow the user to log in again.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="mb-4">
              Are you sure you want to {selectedUser?.status === 'active' ? 'deactivate' : 'activate'} {selectedUser?.username}?
            </p>
            {selectedUser?.status === 'active' && (
              <p className="text-sm text-muted-foreground">
                The user will not be able to access the system until reactivated.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDeactivateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              variant={selectedUser?.status === 'active' ? "destructive" : "default"}
              onClick={() => {
                if (selectedUser) {
                  toggleUserStatusMutation.mutate({
                    id: selectedUser.id,
                    status: selectedUser.status === 'active' ? 'inactive' : 'active'
                  });
                }
              }} 
              disabled={toggleUserStatusMutation.isPending}
            >
              {toggleUserStatusMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {selectedUser?.status === 'active' ? 'Deactivating...' : 'Activating...'}
                </span>
              ) : (
                selectedUser?.status === 'active' ? 'Deactivate User' : 'Activate User'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}