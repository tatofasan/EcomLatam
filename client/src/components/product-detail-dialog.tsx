import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageUpload } from "@/components/ui/image-upload";
import { 
  ChevronLeft, 
  ChevronRight, 
  ShoppingCart, 
  Save,
  X 
} from "lucide-react";

import { Product } from "@/types";

interface ProductDetailDialogProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  mode?: "view" | "edit" | "create";
  onSave?: (product: Product) => void;
}

export default function ProductDetailDialog({ 
  product, 
  isOpen, 
  onClose, 
  mode = "view", 
  onSave 
}: ProductDetailDialogProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [formData, setFormData] = useState<Partial<Product>>({});
  
  // Inicializar los datos del formulario cuando cambia el producto o el modo
  useEffect(() => {
    if (mode === "create") {
      setFormData({
        name: "",
        description: "",
        price: 0,
        stock: 0,
        status: "draft",
        sku: `SKU-${Math.floor(Math.random() * 10000)}`,
        imageUrl: "https://placehold.co/600x400?text=Product+Image",
        category: "",
        additionalImages: [],
        weight: null,
        dimensions: null,
        specifications: null,
        reference: null,
        provider: null
      });
    } else if (product) {
      setFormData({ ...product });
    }
  }, [product, mode]);
  
  // Evitamos renderizar si no hay datos de producto cuando se necesitan
  if (!product && mode !== "create") return null;
  
  // Inicializar datos del producto para edición/creación
  const productData = mode === "create" 
    ? {
        name: "",
        description: "",
        price: 0,
        stock: 0,
        status: "draft",
        sku: "",
        imageUrl: "https://placehold.co/600x400?text=Product+Image",
        category: ""
      } as Product
    : product as Product;
  
  // Para esta versión inicial, usamos solo la imagen principal
  // y algunas imágenes de demostración hasta que tengamos additionalImages en la BD
  const images = [
    productData.imageUrl,
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: ["price", "stock"].includes(name) ? parseFloat(value) : value,
    });
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSave = () => {
    if (onSave && formData) {
      // Clean formData to ensure it matches schema requirements
      const cleanedData = {
        name: formData.name || "",
        description: formData.description || "",
        price: formData.price || 0,
        stock: formData.stock || 0,
        status: formData.status || "draft",
        sku: formData.sku || `SKU-${Math.floor(Math.random() * 10000)}`,
        imageUrl: formData.imageUrl || "https://placehold.co/600x400?text=Product+Image",
        additionalImages: formData.additionalImages || null,
        category: formData.category || null,
        weight: formData.weight || null,
        dimensions: formData.dimensions || null,
        specifications: formData.specifications || null,
        reference: formData.reference || null,
        provider: formData.provider || null
      };
      
      // Si es modo crear, asegúrate de que se creará con un ID temporal 
      // (en producción, el backend se encargará de asignar el ID real)
      const productToSave = mode === "create" 
        ? { ...cleanedData, id: Date.now() } as Product 
        : { ...productData, ...cleanedData } as Product;
      
      onSave(productToSave);
      onClose();
    }
  };

  const titleText = {
    "view": productData.name,
    "edit": `Edit Product: ${productData.name}`,
    "create": "Create New Product"
  }[mode];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[80vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-primary text-xl">{titleText}</DialogTitle>
          {mode === "view" && (
            <DialogDescription>
              SKU: {productData.sku}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
          {/* Left column - Images */}
          <div className="space-y-4">
{mode === "view" ? (
              <div className="relative bg-accent border border-border rounded-lg overflow-hidden h-[300px]">
                <img 
                  src={images[currentImageIndex]} 
                  alt={productData.name}
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
            ) : (
              <ImageUpload 
                className="h-[300px]"
                currentImage={formData.imageUrl}
                onImageChange={(image) => {
                  setFormData({
                    ...formData,
                    imageUrl: image
                  });
                }}
              />
            )}
            
            {images.length > 1 && mode === "view" && (
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

            {/* Formulario para la columna izquierda en modo edición/creación */}
            {mode !== "view" && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Product Name</Label>
                  <Input 
                    id="name"
                    name="name"
                    value={formData.name || ""}
                    onChange={handleInputChange}
                    placeholder="Enter product name"
                  />
                </div>

                <div>
                  <Label htmlFor="sku">SKU</Label>
                  <Input 
                    id="sku"
                    name="sku"
                    value={formData.sku || ""}
                    onChange={handleInputChange}
                    placeholder="Enter product SKU"
                    readOnly={mode === "edit"} // SKU no se puede editar, solo crear
                    className={mode === "edit" ? "bg-muted" : ""}
                  />
                </div>



                <div>
                  <Label htmlFor="category">Category</Label>
                  <Input 
                    id="category"
                    name="category"
                    value={formData.category || ""}
                    onChange={handleInputChange}
                    placeholder="Enter product category"
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Right column - Details (modo vista) o formulario (modo edición/creación) */}
          <div className="space-y-4">
            {mode === "view" ? (
              <>
                <div className="flex items-center justify-between">
                  <Badge 
                    variant="outline" 
                    className={`
                      ${productData.status === 'active' ? 'bg-green-50 text-green-600 border-green-200' : 
                       productData.status === 'low' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' : 
                       'bg-gray-50 text-gray-600 border-gray-200'}
                    `}
                  >
                    {getStatusText(productData.status)}
                  </Badge>
                  <div className="text-2xl font-bold text-primary">${productData.price.toFixed(2)}</div>
                </div>
                
                <Tabs defaultValue="details">
                  <TabsList className="w-full">
                    <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
                    <TabsTrigger value="specs" className="flex-1">Specifications</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="details" className="space-y-4 pt-4">
                    <div>
                      <h3 className="text-sm font-medium text-primary mb-2">Description</h3>
                      <p className="text-muted-foreground">{productData.description}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-primary mb-1">Category</h3>
                        <p className="text-muted-foreground">{productData.category || "Not specified"}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-primary mb-1">Stock</h3>
                        <p className="text-muted-foreground">{productData.stock} units</p>
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
              </>
            ) : (
              // Formulario para la columna derecha en modo edición/creación
              <div className="space-y-4">
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description"
                    name="description"
                    value={formData.description || ""}
                    onChange={handleInputChange}
                    placeholder="Enter product description"
                    rows={5}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price">Price ($)</Label>
                    <Input 
                      id="price"
                      name="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price || 0}
                      onChange={handleInputChange}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="stock">Stock</Label>
                    <Input 
                      id="stock"
                      name="stock"
                      type="number"
                      min="0"
                      value={formData.stock || 0}
                      onChange={handleInputChange}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select 
                    value={formData.status || "draft"} 
                    onValueChange={(value) => handleSelectChange("status", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="low">Low Stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input 
                    id="weight"
                    name="weight"
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.weight || ""}
                    onChange={handleInputChange}
                    placeholder="0.0"
                  />
                </div>

                <div>
                  <Label htmlFor="dimensions">Dimensions (LxWxH cm)</Label>
                  <Input 
                    id="dimensions"
                    name="dimensions"
                    value={formData.dimensions || ""}
                    onChange={handleInputChange}
                    placeholder="e.g. 20x15x5"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter className="mt-6 gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          
          {mode === "view" ? (
            <Button>
              <ShoppingCart className="h-4 w-4 mr-2" />
              Add to My Shop
            </Button>
          ) : (
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save Product
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}