import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LayoutGrid, List } from "lucide-react";
import { Product } from "@/types";

interface ProductFilterProps {
  viewMode: "grid" | "list";
  setViewMode: (mode: "grid" | "list") => void;
  onCategoryChange: (category: string) => void;
  onStatusChange: (status: string) => void;
  onSortChange: (sort: string) => void;
  categoryFilter: string;
  statusFilter: string;
  sortOption: string;
}

export default function ProductFilter({ 
  viewMode, 
  setViewMode,
  onCategoryChange,
  onStatusChange,
  onSortChange,
  categoryFilter,
  statusFilter,
  sortOption
}: ProductFilterProps) {
  return (
    <div className="bg-white p-4 rounded-md shadow-sm mb-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-48">
          <Select 
            value={categoryFilter} 
            onValueChange={onCategoryChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Electronics">Electronics</SelectItem>
              <SelectItem value="Footwear">Footwear</SelectItem>
              <SelectItem value="Home">Home & Kitchen</SelectItem>
              <SelectItem value="Beauty">Beauty & Personal Care</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="w-48">
          <Select 
            value={statusFilter} 
            onValueChange={onStatusChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="low">Low Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="w-48">
          <Select 
            value={sortOption} 
            onValueChange={onSortChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price_high">Price: High to Low</SelectItem>
              <SelectItem value="price_low">Price: Low to High</SelectItem>
              <SelectItem value="name_asc">Name: A to Z</SelectItem>
              <SelectItem value="name_desc">Name: Z to A</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex-1"></div>
        
        <div className="flex items-center space-x-2">
          <Button 
            variant={viewMode === "grid" ? "default" : "outline"} 
            size="icon"
            onClick={() => setViewMode("grid")}
            className="h-9 w-9"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="sr-only">Grid view</span>
          </Button>
          <Button 
            variant={viewMode === "list" ? "default" : "outline"} 
            size="icon"
            onClick={() => setViewMode("list")}
            className="h-9 w-9"
          >
            <List className="h-4 w-4" />
            <span className="sr-only">List view</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
