import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Plus, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ProductFilter from "@/components/product-filter";
import ProductCard from "@/components/product-card";
import ProductDetailDialog from "@/components/product-detail-dialog";
import ProductImportDialog from "@/components/product-import-dialog";
import Pagination from "@/components/pagination";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";

import { Product } from "@/types";

export default function ProductsPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"view" | "edit" | "create">("view");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOption, setSortOption] = useState("newest");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  
  const isAdmin = user?.role === "admin";
  
  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setDialogMode("view");
    setDetailDialogOpen(true);
  };
  
  const handleEditClick = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProduct(product);
    setDialogMode("edit");
    setDetailDialogOpen(true);
  };
  
  const handleCreateClick = () => {
    setSelectedProduct(null);
    setDialogMode("create");
    setDetailDialogOpen(true);
  };

  // Mutations para crear, actualizar y eliminar productos
  const createProductMutation = useMutation({
    mutationFn: async (product: Omit<Product, "id">) => {
      const res = await apiRequest("POST", "/api/products", product);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Product created",
        description: "The product has been created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to create product: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async (product: Product) => {
      const res = await apiRequest("PUT", `/api/products/${product.id}`, product);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Product updated",
        description: "The product has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update product: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  const handleSaveProduct = (product: Product) => {
    if (dialogMode === "create") {
      // Omitir el ID que es un placeholder temporal para la creación
      const { id, ...productData } = product;
      createProductMutation.mutate(productData);
    } else if (dialogMode === "edit") {
      updateProductMutation.mutate(product);
    }
  };

  // Fetch products
  const { data: allProducts, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });
  
  // Filter and sort products
  let filteredProducts: Product[] = [];
  
  if (allProducts) {
    filteredProducts = [...allProducts];
    
    // Apply category filter
    if (categoryFilter !== "all") {
      filteredProducts = filteredProducts.filter(product => product.category === categoryFilter);
    }
    
    // Apply status filter
    if (statusFilter !== "all") {
      filteredProducts = filteredProducts.filter(product => product.status === statusFilter);
    }
    
    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filteredProducts = filteredProducts.filter(product => 
        product.name.toLowerCase().includes(query) || 
        product.description.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query)
      );
    }
    
    // Apply sorting
    switch(sortOption) {
      case "price_high":
        filteredProducts.sort((a, b) => b.price - a.price);
        break;
      case "price_low":
        filteredProducts.sort((a, b) => a.price - b.price);
        break;
      case "name_asc":
        filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name_desc":
        filteredProducts.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "newest":
      default:
        // Assuming newest is default
        break;
    }
  }

  return (
    <DashboardLayout activeItem="products">
      {/* Products Content */}
      <div className="p-6">
        {/* Search Bar */}
        <div className="bg-white p-4 rounded-md shadow-sm mb-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search products by name, description or SKU..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        {/* Filter Bar and Admin Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <ProductFilter 
            viewMode={viewMode} 
            setViewMode={setViewMode}
            categoryFilter={categoryFilter}
            statusFilter={statusFilter}
            sortOption={sortOption}
            onCategoryChange={setCategoryFilter}
            onStatusChange={setStatusFilter}
            onSortChange={setSortOption}
          />
          
          {/* Admin Add Product Button */}
          {isAdmin && (
            <div className="flex flex-col gap-2">
              <Button 
                onClick={handleCreateClick}
                className="whitespace-nowrap"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
              <Button 
                variant="outline"
                onClick={() => setImportDialogOpen(true)}
                className="whitespace-nowrap"
              >
                <Upload className="mr-2 h-4 w-4" />
                Mass Import
              </Button>
            </div>
          )}
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredProducts && filteredProducts.length > 0 ? (
          <>
            {/* Products Grid */}
            <div className={`grid grid-cols-1 ${viewMode === 'grid' ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'sm:grid-cols-1'} gap-6 mt-6`}>
              {filteredProducts.map((product) => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  viewMode={viewMode}
                  onClick={handleProductClick}
                  onEdit={handleEditClick}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          
            {/* Pagination */}
            <Pagination 
              currentPage={currentPage}
              totalPages={3}
              onPageChange={setCurrentPage}
              totalItems={filteredProducts.length}
              itemsPerPage={12}
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-64">
            <p className="text-lg text-gray-500">No products found</p>
            <Button variant="outline" className="mt-4">
              Add Your First Product
            </Button>
          </div>
        )}
      </div>

      {/* Product Detail Dialog */}
      <ProductDetailDialog 
        product={selectedProduct}
        isOpen={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        mode={dialogMode}
        onSave={handleSaveProduct}
        isAdmin={isAdmin}
      />

      {/* Product Import Dialog */}
      <ProductImportDialog
        isOpen={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
      />
    </DashboardLayout>
  );
}