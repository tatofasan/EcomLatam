import { useState } from "react";
import { Product } from "@shared/schema";
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

interface ProductDetailDialogProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProductDetailDialog({ product, isOpen, onClose }: ProductDetailDialogProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  if (!product) return null;
  
  // Prepare the images array - main image + additional images if they exist
  const images = [
    product.imageUrl,
    ...(product.additionalImages || [])
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
            SKU: {product.sku} {product.reference ? `• Ref: ${product.reference}` : ""}
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
                <TabsTrigger value="details" className="flex-1">Detalles</TabsTrigger>
                <TabsTrigger value="specs" className="flex-1">Especificaciones</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="space-y-4 pt-4">
                <div>
                  <h3 className="text-sm font-medium text-primary mb-2">Descripción</h3>
                  <p className="text-muted-foreground">{product.description}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-primary mb-1">Categoría</h3>
                    <p className="text-muted-foreground">{product.category || "No especificada"}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-primary mb-1">Stock</h3>
                    <p className="text-muted-foreground">{product.stock} unidades</p>
                  </div>
                </div>
                
                {(product.weight || product.dimensions) && (
                  <div className="grid grid-cols-2 gap-4">
                    {product.weight && (
                      <div>
                        <h3 className="text-sm font-medium text-primary mb-1">Peso</h3>
                        <p className="text-muted-foreground">{product.weight} kg</p>
                      </div>
                    )}
                    {product.dimensions && (
                      <div>
                        <h3 className="text-sm font-medium text-primary mb-1">Dimensiones</h3>
                        <p className="text-muted-foreground">{product.dimensions}</p>
                      </div>
                    )}
                  </div>
                )}
                
                {product.provider && (
                  <div>
                    <h3 className="text-sm font-medium text-primary mb-1">Proveedor</h3>
                    <p className="text-muted-foreground">{product.provider}</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="specs" className="space-y-4 pt-4">
                {product.specifications ? (
                  <div className="space-y-3">
                    {Object.entries(product.specifications).map(([key, value]) => (
                      <div key={key}>
                        <h3 className="text-sm font-medium text-primary mb-1">{key}</h3>
                        <p className="text-muted-foreground">{value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-4 text-muted-foreground">No hay especificaciones disponibles</p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
        
        <DialogFooter className="mt-6 gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Cerrar
          </Button>
          <Button>
            <ShoppingCart className="h-4 w-4 mr-2" />
            Añadir al carrito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}