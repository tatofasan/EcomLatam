import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Save, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type { Product, PayoutException, InsertPayoutException } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface PayoutExceptionsDialogProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function PayoutExceptionsDialog({ product, isOpen, onClose }: PayoutExceptionsDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newException, setNewException] = useState<Partial<InsertPayoutException>>({
    productId: product?.id,
    userId: undefined,
    publisherId: "",
    payoutAmount: "0"
  });
  const [allUsers, setAllUsers] = useState<Array<{id: number, username: string}>>([]);

  // Check permissions first (needed by queries)
  const canManageExceptions = user?.role === 'admin' || user?.role === 'moderator';

  // Fetch payout exceptions for this product
  const { data: exceptions, isLoading } = useQuery<PayoutException[]>({
    queryKey: ["/api/payout-exceptions", product?.id, user?.id],
    queryFn: async () => {
      if (!product?.id) return [];
      // For affiliates, only fetch their own exceptions; for admins/moderators, fetch all
      const url = canManageExceptions
        ? `/api/payout-exceptions?productId=${product.id}`
        : `/api/payout-exceptions?productId=${product.id}&userId=${user?.id}`;
      const res = await apiRequest('GET', url);
      if (!res.ok) throw new Error("Failed to fetch payout exceptions");
      return res.json();
    },
    enabled: !!product?.id && isOpen && !!user?.id,
  });

  // Fetch all users for affiliate selection (admin/moderator only)
  useEffect(() => {
    if (isOpen && (user?.role === 'admin' || user?.role === 'moderator')) {
      console.log('[PayoutExceptions] Fetching users...');
      apiRequest('GET', '/api/users')
        .then(res => res.json())
        .then(users => {
          console.log('[PayoutExceptions] Users received:', users);
          // Filter for regular users (affiliates) - not admin, moderator, or finance
          const affiliates = users.filter((u: any) => u.role === 'user');
          console.log('[PayoutExceptions] Filtered affiliates:', affiliates);
          setAllUsers(affiliates);
        })
        .catch(error => {
          console.error('[PayoutExceptions] Error fetching users:', error);
        });
    }
  }, [isOpen, user?.role]);

  // Reset form when product changes
  useEffect(() => {
    setNewException({
      productId: product?.id,
      userId: undefined,
      publisherId: "",
      payoutAmount: "0"
    });
    setIsCreating(false);
  }, [product?.id]);

  // Create payout exception mutation
  const createExceptionMutation = useMutation({
    mutationFn: async (data: InsertPayoutException) => {
      return await apiRequest("POST", "/api/payout-exceptions", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payout-exceptions"] });
      setIsCreating(false);
      setNewException({
        productId: product?.id,
        userId: undefined,
        publisherId: "",
        payoutAmount: "0"
      });
    },
  });

  // Delete payout exception mutation
  const deleteExceptionMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/payout-exceptions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payout-exceptions"] });
    },
  });

  const handleCreateException = () => {
    if (!newException.userId || !newException.payoutAmount) {
      return;
    }

    const payoutValue = parseFloat(newException.payoutAmount as string);
    if (isNaN(payoutValue) || payoutValue < 0) {
      return;
    }

    const dataToSubmit: InsertPayoutException = {
      productId: product!.id,
      userId: newException.userId,
      publisherId: newException.publisherId || null,
      payoutAmount: newException.payoutAmount as string
    };

    createExceptionMutation.mutate(dataToSubmit);
  };

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {canManageExceptions ? 'Payout Exceptions' : 'My Payout Information'} - {product.name}
          </DialogTitle>
          <DialogDescription>
            {canManageExceptions
              ? 'Manage custom payout rates for specific affiliates and publishers'
              : 'View your custom payout rates for this product'
            }
          </DialogDescription>
          <p className="text-sm text-muted-foreground">
            Default payout: ${product.payoutPo}
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Create new exception form (admin/moderator only) */}
          {canManageExceptions && (
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Create New Exception</h3>
                {!isCreating && (
                  <Button onClick={() => setIsCreating(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                )}
              </div>

              {isCreating && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="userId">Affiliate</Label>
                    <select
                      id="userId"
                      className="w-full p-2 border rounded"
                      value={newException.userId || ""}
                      onChange={(e) => setNewException(prev => ({ ...prev, userId: Number(e.target.value) }))}
                    >
                      <option value="">Select affiliate</option>
                      {allUsers.map(user => (
                        <option key={user.id} value={user.id}>{user.username}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="publisherId">Publisher ID (Optional)</Label>
                    <Input
                      id="publisherId"
                      placeholder="e.g: pub123"
                      value={newException.publisherId || ""}
                      onChange={(e) => setNewException(prev => ({ ...prev, publisherId: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="payoutAmount">Payout Amount ($)</Label>
                    <Input
                      id="payoutAmount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newException.payoutAmount || ""}
                      onChange={(e) => setNewException(prev => ({ ...prev, payoutAmount: e.target.value }))}
                    />
                  </div>

                  <div className="flex items-end gap-2">
                    <Button
                      onClick={handleCreateException}
                      disabled={createExceptionMutation.isPending || !newException.userId || !newException.payoutAmount}
                      size="sm"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsCreating(false)}
                      size="sm"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Exceptions table */}
          <div>
            <h3 className="font-medium mb-3">
              {canManageExceptions ? 'Configured Exceptions' : 'Your Payout Rates'}
            </h3>
            {isLoading ? (
              <div className="text-center py-4">Loading...</div>
            ) : exceptions && exceptions.length > 0 ? (
              <>
                {!canManageExceptions && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <h4 className="font-medium text-green-900 mb-2">✓ Special Payout Rates Found</h4>
                    <p className="text-sm text-green-800">
                      You have custom payout rates configured for this product that are different from the default rate.
                    </p>
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      {canManageExceptions && <TableHead>Affiliate ID</TableHead>}
                      <TableHead>Publisher ID</TableHead>
                      <TableHead>Payout Amount</TableHead>
                      <TableHead>Type</TableHead>
                      {canManageExceptions && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exceptions.map((exception) => (
                      <TableRow key={exception.id}>
                        {canManageExceptions && <TableCell>{exception.userId}</TableCell>}
                        <TableCell>
                          {exception.publisherId ? (
                            <Badge variant="secondary">{exception.publisherId}</Badge>
                          ) : (
                            <span className="text-muted-foreground">All Publishers</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-green-600">
                          ${exception.payoutAmount}
                        </TableCell>
                        <TableCell>
                          <Badge variant={exception.publisherId ? "default" : "outline"}>
                            {exception.publisherId ? "Publisher specific" : "Affiliate level"}
                          </Badge>
                        </TableCell>
                        {canManageExceptions && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteExceptionMutation.mutate(exception.id)}
                              disabled={deleteExceptionMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {canManageExceptions
                  ? 'No exceptions configured for this product'
                  : 'You will receive the default payout rate for this product'}
              </div>
            )}
          </div>

          {/* Explanation */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Payout Hierarchy</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>1. <strong>Publisher specific:</strong> Payout configured for a specific publisher ID within an affiliate</p>
              <p>2. <strong>Affiliate level:</strong> Payout configured for the entire affiliate</p>
              <p>3. <strong>Default:</strong> Base product payout (${product.payoutPo})</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
