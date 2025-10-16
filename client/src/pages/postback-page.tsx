import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { TestTube, CheckCircle, XCircle, Clock, Send, User, Settings } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";

interface PostbackConfiguration {
  id?: number;
  userId: number;
  isEnabled: boolean;
  saleUrl?: string | null;
  holdUrl?: string | null;
  rejectedUrl?: string | null;
  trashUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
  user?: {
    id: number;
    username: string;
    role: string;
  };
}

interface PostbackNotification {
  id: number;
  userId: number;
  leadId: number;
  url: string;
  status: 'success' | 'failed' | 'pending';
  httpStatus?: number;
  errorMessage?: string;
  responseBody?: string;
  createdAt: string;
  retryCount: number;
  user?: {
    id: number;
    username: string;
  };
}

interface User {
  id: number;
  username: string;
  role: string;
}

export default function PostbackPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("configuration");

  // Form state for controlled inputs
  const [formData, setFormData] = useState({
    isEnabled: false,
    saleUrl: "",
    holdUrl: "",
    rejectedUrl: "",
    trashUrl: ""
  });

  // Get current user
  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/user"],
  });

  const isAdmin = currentUser?.role === 'admin';
  const isModerator = currentUser?.role === 'moderator' || isAdmin;

  // Get current user's postback configuration
  const { data: userConfig, isLoading: configLoading } = useQuery<PostbackConfiguration>({
    queryKey: ["/api/postback/config"],
    enabled: !!currentUser && !isModerator,
  });

  // Get all users (for admin/moderator)
  const { data: allUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isModerator,
  });

  // Get selected user's configuration (for admin/moderator)
  const { data: selectedUserConfig, isLoading: selectedConfigLoading } = useQuery<PostbackConfiguration>({
    queryKey: [`/api/postback/config/${selectedUserId}`],
    enabled: isModerator && !!selectedUserId,
  });

  // Get postback notifications
  const { data: notifications } = useQuery<PostbackNotification[]>({
    queryKey: isModerator ? ["/api/postback/notifications/all"] : ["/api/postback/notifications"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Update configuration mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (config: Partial<PostbackConfiguration>) => {
      const url = isModerator && selectedUserId
        ? `/api/postback/config/${selectedUserId}`
        : "/api/postback/config";

      return await apiRequest("PUT", url, config);
    },
    onSuccess: () => {
      toast({
        title: "Configuration Saved",
        description: "Postback configuration has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/postback/config"] });
      if (selectedUserId) {
        queryClient.invalidateQueries({ queryKey: [`/api/postback/config/${selectedUserId}`] });
      }
    },
    onError(error) {
      toast({
        title: "Error",
        description: (error as Error).message || "Error updating configuration",
        variant: "destructive",
      });
    },
  });

  // Test URL mutation
  const testUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await apiRequest("POST", "/api/postback/test", { url });
      return await response.json();
    },
    onSuccess(result) {
      console.log("Postback test result received:", result);
      if (result.success) {
        toast({
          title: "Test Successful ✓",
          description: `URL responded with HTTP ${result.httpStatus}. ${result.testUrl ? `Tested: ${result.testUrl.substring(0, 80)}...` : ''}`,
        });
      } else {
        toast({
          title: "Test Failed ✗",
          description: `${result.errorMessage || "URL did not respond correctly"}${result.testUrl ? ` | Tested: ${result.testUrl.substring(0, 60)}...` : ''}`,
          variant: "destructive",
        });
      }
    },
    onError(error) {
      toast({
        title: "Test Error",
        description: (error as Error).message || "Error testing URL",
        variant: "destructive",
      });
    },
  });

  const currentConfig = isModerator && selectedUserId ? selectedUserConfig : userConfig;
  const isLoadingConfig = isModerator && selectedUserId ? selectedConfigLoading : configLoading;

  // Update form data when configuration changes
  useEffect(() => {
    if (currentConfig) {
      setFormData({
        isEnabled: currentConfig.isEnabled || false,
        saleUrl: currentConfig.saleUrl || "",
        holdUrl: currentConfig.holdUrl || "",
        rejectedUrl: currentConfig.rejectedUrl || "",
        trashUrl: currentConfig.trashUrl || ""
      });
    } else {
      // Reset to defaults when no config
      setFormData({
        isEnabled: false,
        saleUrl: "",
        holdUrl: "",
        rejectedUrl: "",
        trashUrl: ""
      });
    }
  }, [currentConfig]);

  const handleConfigSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const config = {
      isEnabled: formData.isEnabled,
      saleUrl: formData.saleUrl || null,
      holdUrl: formData.holdUrl || null,
      rejectedUrl: formData.rejectedUrl || null,
      trashUrl: formData.trashUrl || null,
    };

    // Convert empty strings to null for proper validation
    const cleanConfig = {
      ...config,
      saleUrl: config.saleUrl === '' ? null : config.saleUrl,
      holdUrl: config.holdUrl === '' ? null : config.holdUrl,
      rejectedUrl: config.rejectedUrl === '' ? null : config.rejectedUrl,
      trashUrl: config.trashUrl === '' ? null : config.trashUrl,
    };

    console.log("Submitting config:", cleanConfig);
    updateConfigMutation.mutate(cleanConfig);
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const testUrl = (url: string) => {
    if (!url.trim()) {
      toast({
        title: "Error",
        description: "Please enter a URL to test",
        variant: "destructive",
      });
      return;
    }
    testUrlMutation.mutate(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Success</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout activeItem="postback">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Postback Configuration</h1>
            <p className="text-sm text-muted-foreground">
              Configure URLs to receive automatic notifications when lead statuses change
            </p>
          </div>
          <Settings className="w-8 h-8 text-gray-400" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
            <TabsTrigger value="notifications">Notification History</TabsTrigger>
          </TabsList>

          <TabsContent value="configuration">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="w-5 h-5" />
                  Postback URL Configuration
                </CardTitle>
                <CardDescription>
                  Variables in curly braces will be automatically replaced with actual lead values.
                  Available variables: {"{leadId}"}, {"{status}"}, {"{payout}"}, {"{publisherId}"}, {"{producto}"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isModerator && (
                  <div className="mb-6">
                    <Label htmlFor="userSelect">Select User (Admin/Moderator Only)</Label>
                    <Select value={selectedUserId?.toString() || ""} onValueChange={(value) => setSelectedUserId(value ? parseInt(value) : null)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a user to configure..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allUsers?.filter(u => u.role === 'user').map((user) => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              {user.username} ({user.role})
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {isLoadingConfig ? (
                  <div>Loading configuration...</div>
                ) : (
                  <form onSubmit={handleConfigSubmit} className="space-y-6">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="isEnabled"
                        name="isEnabled"
                        checked={formData.isEnabled}
                        onCheckedChange={(checked) => handleInputChange('isEnabled', checked)}
                      />
                      <Label htmlFor="isEnabled">Enable postback notifications</Label>
                    </div>

                    <div className="grid gap-4">
                      <div>
                        <Label htmlFor="saleUrl">Sales URL</Label>
                        <div className="flex space-x-2">
                          <Input
                            id="saleUrl"
                            name="saleUrl"
                            placeholder="https://your-domain.com/webhook/success?leadId={leadId}&status={status}&payout={payout}&publisherId={publisherId}&producto={producto}"
                            value={formData.saleUrl}
                            onChange={(e) => handleInputChange('saleUrl', e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => testUrl(formData.saleUrl)}
                            disabled={testUrlMutation.isPending}
                          >
                            <TestTube className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="holdUrl">Hold URL</Label>
                        <div className="flex space-x-2">
                          <Input
                            id="holdUrl"
                            name="holdUrl"
                            placeholder="https://your-domain.com/webhook/hold?leadId={leadId}&status={status}&payout={payout}&publisherId={publisherId}&producto={producto}"
                            value={formData.holdUrl}
                            onChange={(e) => handleInputChange('holdUrl', e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => testUrl(formData.holdUrl)}
                            disabled={testUrlMutation.isPending}
                          >
                            <TestTube className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="rejectedUrl">Rejected URL</Label>
                        <div className="flex space-x-2">
                          <Input
                            id="rejectedUrl"
                            name="rejectedUrl"
                            placeholder="https://your-domain.com/webhook/rejected?leadId={leadId}&status={status}&payout={payout}&publisherId={publisherId}&producto={producto}"
                            value={formData.rejectedUrl}
                            onChange={(e) => handleInputChange('rejectedUrl', e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => testUrl(formData.rejectedUrl)}
                            disabled={testUrlMutation.isPending}
                          >
                            <TestTube className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="trashUrl">Trash URL</Label>
                        <div className="flex space-x-2">
                          <Input
                            id="trashUrl"
                            name="trashUrl"
                            placeholder="https://your-domain.com/webhook/trash?leadId={leadId}&status={status}&payout={payout}&publisherId={publisherId}&producto={producto}"
                            value={formData.trashUrl}
                            onChange={(e) => handleInputChange('trashUrl', e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => testUrl(formData.trashUrl)}
                            disabled={testUrlMutation.isPending}
                          >
                            <TestTube className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <Button type="submit" disabled={updateConfigMutation.isPending}>
                      {updateConfigMutation.isPending ? "Saving..." : "Save Configuration"}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification History</CardTitle>
                <CardDescription>
                  Last 15 postback notifications sent
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!notifications?.length ? (
                  <p className="text-gray-500 text-center py-8">No notifications recorded</p>
                ) : (
                  <div className="space-y-4">
                    {notifications.map((notification) => (
                      <div key={notification.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getStatusBadge(notification.status)}
                            {isModerator && notification.user && (
                              <Badge variant="outline">
                                <User className="w-3 h-3 mr-1" />
                                {notification.user.username}
                              </Badge>
                            )}
                          </div>
                          <span className="text-sm text-gray-500">
                            {new Date(notification.createdAt).toLocaleString()}
                          </span>
                        </div>

                        <div>
                          <p className="text-sm font-medium">Lead ID: {notification.leadId}</p>
                          <p className="text-sm text-gray-600 break-all">{notification.url}</p>
                          {notification.httpStatus && (
                            <p className="text-sm">HTTP Status: {notification.httpStatus}</p>
                          )}
                          {notification.errorMessage && (
                            <p className="text-sm text-red-600">{notification.errorMessage}</p>
                          )}
                          {notification.retryCount > 0 && (
                            <p className="text-sm text-yellow-600">Retries: {notification.retryCount}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>


        </Tabs>
      </div>
    </DashboardLayout>
  );
}
