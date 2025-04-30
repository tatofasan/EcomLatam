import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Plus } from "lucide-react";
import SidebarNav from "@/components/sidebar-nav";
import ProductFilter from "@/components/product-filter";
import ProductCard from "@/components/product-card";
import ProductDetailDialog from "@/components/product-detail-dialog";
import Pagination from "@/components/pagination";

import { Product } from "@/types";

export default function ProductsPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const { user } = useAuth();
  
  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setDetailDialogOpen(true);
  };

  // Fetch products
  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <SidebarNav activeItem="products" user={user} />

      {/* Main Content */}
      <main className="flex-1 ml-[200px] bg-secondary min-h-screen overflow-auto">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Products</h1>
            
            <div className="flex items-center space-x-4">
              <div className="relative w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="text" 
                  placeholder="Search products..." 
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <Button className="flex items-center">
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </div>
          </div>
        </header>
        
        {/* Products Content */}
        <div className="p-6">
          {/* Filter Bar */}
          <ProductFilter viewMode={viewMode} setViewMode={setViewMode} />
          
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : products && products.length > 0 ? (
            <>
              {/* Products Grid */}
              <div className={`grid grid-cols-1 ${viewMode === 'grid' ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'sm:grid-cols-1'} gap-6 mt-6`}>
                {products.map((product) => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    viewMode={viewMode}
                    onClick={handleProductClick}
                  />
                ))}
              </div>
            
              {/* Pagination */}
              <Pagination 
                currentPage={currentPage}
                totalPages={3}
                onPageChange={setCurrentPage}
                totalItems={products.length}
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
      </main>

      {/* Product Detail Dialog */}
      <ProductDetailDialog 
        product={selectedProduct}
        isOpen={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
      />
    </div>
  );
}
