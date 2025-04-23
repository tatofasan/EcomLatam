import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  status: "active" | "inactive" | "draft" | "low";
  sku: string;
  imageUrl: string;
}

interface ProductCardProps {
  product: Product;
  viewMode: "grid" | "list";
}

export default function ProductCard({ product, viewMode }: ProductCardProps) {
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
      <Card className="flex overflow-hidden hover:shadow-md transition-shadow">
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
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
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
    </Card>
  );
}
