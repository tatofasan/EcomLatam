import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Plus } from "lucide-react";
import ProductFilter from "@/components/product-filter";
import ProductCard from "@/components/product-card";
import ProductDetailDialog from "@/components/product-detail-dialog";
import Pagination from "@/components/pagination";
import DashboardLayout from "@/components/layout/dashboard-layout";

import { Product } from "@/types";

export default function ProductsPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOption, setSortOption] = useState("newest");
  
  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setDetailDialogOpen(true);
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
        
        {/* Filter Bar */}
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
      />
    </DashboardLayout>
  );
}