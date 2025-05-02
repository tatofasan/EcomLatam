import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Eye } from "lucide-react";
import { Product } from "@/types";
import { User } from "@shared/schema";

interface ProductCardProps {
  product: Product;
  viewMode: "grid" | "list";
  onClick: (product: Product) => void;
  onEdit?: (product: Product, e: React.MouseEvent) => void;
  isAdmin?: boolean;
}

export default function ProductCard({ product, viewMode, onClick, onEdit, isAdmin = false }: ProductCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "inactive":
        return "bg-gray-100 text-gray-800";
      case "draft":
        return "bg-gray-100 text-gray-800";
      case "low":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "Active";
      case "inactive":
        return "Inactive";
      case "draft":
        return "Draft";
      case "low":
        return "Low Stock";
      default:
        return status;
    }
  };

  if (viewMode === "list") {
    return (
      <Card className="flex overflow-hidden hover:shadow-md transition-shadow relative">
        {isAdmin && (
          <div className="absolute top-2 right-2 z-10">
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 rounded-full bg-white shadow-md"
              onClick={(e) => {
                e.stopPropagation();
                if (onEdit) onEdit(product, e);
              }}
            >
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div 
          className="flex flex-1 cursor-pointer"
          onClick={() => onClick(product)}
        >
          <div className="w-24 h-24 bg-gray-200 shrink-0">
            <img 
              src={product.imageUrl} 
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="p-4 flex-1">
            <div className="flex items-center justify-between mb-2">
              <Badge className={getStatusColor(product.status)}>
                {getStatusText(product.status)}
              </Badge>
              <span className="text-sm text-gray-500">SKU: {product.sku}</span>
            </div>
            <h3 className="font-medium">{product.name}</h3>
            <p className="text-sm text-gray-500 mb-2">{product.description}</p>
            <div className="flex items-center justify-between">
              <span className="font-semibold">${product.price.toFixed(2)}</span>
              <span className="text-sm text-gray-500">Stock: {product.stock}</span>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow relative">
      {isAdmin && (
        <div className="absolute top-2 right-2 z-10">
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 rounded-full bg-white shadow-md"
            onClick={(e) => {
              e.stopPropagation();
              if (onEdit) onEdit(product, e);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div 
        className="cursor-pointer"
        onClick={() => onClick(product)}
      >
        <div className="aspect-w-3 aspect-h-2 bg-gray-200">
          <img 
            src={product.imageUrl} 
            alt={product.name}
            className="w-full h-40 object-cover"
          />
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Badge className={getStatusColor(product.status)}>
              {getStatusText(product.status)}
            </Badge>
            <span className="text-sm text-gray-500">SKU: {product.sku}</span>
          </div>
          <h3 className="font-medium">{product.name}</h3>
          <p className="text-sm text-gray-500 mb-2">{product.description}</p>
          <div className="flex items-center justify-between">
            <span className="font-semibold">${product.price.toFixed(2)}</span>
            <span className="text-sm text-gray-500">Stock: {product.stock}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
