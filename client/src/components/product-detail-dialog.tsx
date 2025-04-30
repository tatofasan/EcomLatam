import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ChevronLeft, 
  ChevronRight, 
  ShoppingCart, 
  X 
} from "lucide-react";

import { Product } from "@/types";

interface ProductDetailDialogProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProductDetailDialog({ product, isOpen, onClose }: ProductDetailDialogProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  if (!product) return null;
  
  // Para esta versión inicial, usamos solo la imagen principal
  // y algunas imágenes de demostración hasta que tengamos additionalImages en la BD
  const images = [
    product.imageUrl,
    "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=500&h=350&fit=crop",
    "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=500&h=350&fit=crop"
  ];

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "Activo";
      case "inactive":
        return "Inactivo";
      case "draft":
        return "Borrador";
      case "low":
        return "Poco Stock";
      default:
        return status;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[80vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-primary text-xl">{product.name}</DialogTitle>
          <DialogDescription>
            SKU: {product.sku}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
          {/* Left column - Images */}
          <div className="space-y-4">
            <div className="relative bg-accent border border-border rounded-lg overflow-hidden h-[300px]">
              <img 
                src={images[currentImageIndex]} 
                alt={product.name}
                className="w-full h-full object-contain p-4"
              />
              
              {images.length > 1 && (
                <>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="absolute left-2 top-1/2 transform -translate-y-1/2"
                    onClick={prevImage}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="absolute right-2 top-1/2 transform -translate-y-1/2"
                    onClick={nextImage}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto py-2">
                {images.map((img, idx) => (
                  <div 
                    key={idx}
                    className={`
                      w-16 h-16 border rounded cursor-pointer
                      ${currentImageIndex === idx ? 'border-primary' : 'border-gray-200'}
                    `}
                    onClick={() => setCurrentImageIndex(idx)}
                  >
                    <img 
                      src={img} 
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Right column - Details */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge 
                variant="outline" 
                className={`
                  ${product.status === 'active' ? 'bg-green-50 text-green-600 border-green-200' : 
                   product.status === 'low' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' : 
                   'bg-gray-50 text-gray-600 border-gray-200'}
                `}
              >
                {getStatusText(product.status)}
              </Badge>
              <div className="text-2xl font-bold text-primary">${product.price.toFixed(2)}</div>
            </div>
            
            <Tabs defaultValue="details">
              <TabsList className="w-full">
                <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
                <TabsTrigger value="specs" className="flex-1">Specifications</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="space-y-4 pt-4">
                <div>
                  <h3 className="text-sm font-medium text-primary mb-2">Description</h3>
                  <p className="text-muted-foreground">{product.description}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-primary mb-1">Category</h3>
                    <p className="text-muted-foreground">{product.category || "Not specified"}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-primary mb-1">Stock</h3>
                    <p className="text-muted-foreground">{product.stock} units</p>
                  </div>
                </div>
                
                {/* Additional information section */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-primary mb-1">Weight</h3>
                    <p className="text-muted-foreground">0.5 kg</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-primary mb-1">Dimensions</h3>
                    <p className="text-muted-foreground">20 x 15 x 5 cm</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-primary mb-1">Supplier</h3>
                  <p className="text-muted-foreground">Main Supplier</p>
                </div>
              </TabsContent>
              
              <TabsContent value="specs" className="space-y-4 pt-4">
                {/* Demo specifications */}
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-medium text-primary mb-1">Material</h3>
                    <p className="text-muted-foreground">ABS Plastic</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-primary mb-1">Battery</h3>
                    <p className="text-muted-foreground">300 mAh</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-primary mb-1">Connectivity</h3>
                    <p className="text-muted-foreground">Bluetooth 5.0</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
        
        <DialogFooter className="mt-6 gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
          <Button>
            <ShoppingCart className="h-4 w-4 mr-2" />
            Add to My Shop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}