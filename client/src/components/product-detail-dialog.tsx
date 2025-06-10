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
import { AdditionalImagesUpload } from "@/components/ui/additional-images-upload";
import { useToast } from "@/hooks/use-toast";
import { 
  ChevronLeft, 
  ChevronRight, 
  ShoppingCart, 
  Save,
  X,
  AlertCircle,
  Download
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";

import { Product } from "@/types";

interface ProductDetailDialogProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  mode?: "view" | "edit" | "create";
  onSave?: (product: Product) => void;
  isAdmin?: boolean;
}

export default function ProductDetailDialog({ 
  product, 
  isOpen, 
  onClose, 
  mode = "view", 
  onSave,
  isAdmin = false
}: ProductDetailDialogProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  
  // Inicializar los datos del formulario cuando cambia el producto o el modo
  useEffect(() => {
    if (mode === "create") {
      setFormData({
        name: "",
        description: "",
        price: 0,
        stock: 0,
        status: "draft",
        sku: "",
        imageUrl: "",
        category: "",
        additionalImages: [],
        weight: 0,
        dimensions: "",
        // specifications y reference se mantienen, pero no se requieren
        provider: ""
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
        id: -1, // ID temporal para modo creación
        name: "",
        description: "",
        price: 0,
        stock: 0,
        status: "draft",
        sku: "",
        imageUrl: "",
        category: "",
        weight: 0,
        dimensions: "",
        specifications: {} as Record<string, any>,
        reference: "",
        provider: ""
      } as unknown as Product
    : product as Product;
  
  // Usar la imagen principal y las adicionales si existen
  const images = productData.additionalImages && productData.additionalImages.length > 0
    ? [productData.imageUrl, ...productData.additionalImages]
    : [productData.imageUrl];

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

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    // Validar campos obligatorios
    if (!formData.name || formData.name.trim() === "") {
      errors.name = "Nombre del producto es obligatorio";
    }
    
    if (!formData.description || formData.description.trim() === "") {
      errors.description = "Descripción del producto es obligatoria";
    }
    
    if (!formData.sku || formData.sku.trim() === "") {
      errors.sku = "SKU es obligatorio";
    }
    
    if (!formData.imageUrl || formData.imageUrl === "") {
      // Si no hay imagen principal pero hay imágenes adicionales,
      // promover la primera imagen adicional a principal
      if (formData.additionalImages && formData.additionalImages.length > 0) {
        const newAdditionalImages = [...formData.additionalImages];
        const newMainImage = newAdditionalImages.shift();
        setFormData({
          ...formData,
          imageUrl: newMainImage,
          additionalImages: newAdditionalImages
        });
      } else {
        errors.imageUrl = "Imagen principal es obligatoria";
      }
    }
    
    // Validación de precio - debe ser mayor que 0
    if (formData.price === undefined || formData.price <= 0) {
      errors.price = "Precio debe ser mayor que 0";
    }
    
    // Validación de stock - solo puede ser 0 si status es draft o inactive
    if (formData.stock === undefined || formData.stock < 0) {
      errors.stock = "Stock debe ser un valor positivo";
    } else if (formData.stock === 0 && 
              !(formData.status === "draft" || formData.status === "inactive")) {
      errors.stock = "Stock solo puede ser 0 si el estado es Borrador o Inactivo";
    }
    
    // Validación de categoría
    if (!formData.category || formData.category.trim() === "") {
      errors.category = "Categoría es obligatoria";
    }
    
    // Validación de peso
    if (formData.weight === undefined || formData.weight === null) {
      errors.weight = "Peso es obligatorio";
    }
    
    // Validación de dimensiones
    if (!formData.dimensions || formData.dimensions.trim() === "") {
      errors.dimensions = "Dimensiones son obligatorias";
    }
    
    // Quitamos las validaciones de especificaciones y referencia (por pedido del usuario)
    
    // Validación de proveedor (solo para administradores)
    if (isAdmin && (!formData.provider || formData.provider.trim() === "")) {
      errors.provider = "Proveedor es obligatorio";
    }
    
    // Actualizar los errores y devolver si pasó la validación
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Función para descargar todas las imágenes del producto como ZIP
  const handleDownloadImages = async () => {
    if (images.length === 0) {
      toast({
        title: "No images available",
        description: "This product has no images to download",
        variant: "destructive",
      });
      return;
    }

    try {
      const zip = new JSZip();
      const imgFolder = zip.folder("product-images");
      
      if (!imgFolder) {
        throw new Error("Could not create folder in ZIP file");
      }
      
      // Add main image
      const mainImageName = `main-image.${getImageExtension(productData.imageUrl)}`;
      await addImageToZip(productData.imageUrl, imgFolder, mainImageName);
      
      // Add additional images
      if (productData.additionalImages && productData.additionalImages.length > 0) {
        for (let i = 0; i < productData.additionalImages.length; i++) {
          const imgUrl = productData.additionalImages[i];
          const imgName = `additional-image-${i+1}.${getImageExtension(imgUrl)}`;
          await addImageToZip(imgUrl, imgFolder, imgName);
        }
      }
      
      // Generate and download ZIP file
      const zipBlob = await zip.generateAsync({type: "blob"});
      saveAs(zipBlob, `images-${productData.name.replace(/[^a-zA-Z0-9]/g, "-")}.zip`);
      
      toast({
        title: "Images downloaded",
        description: "Images have been downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not download images",
        variant: "destructive",
      });
      console.error("Error downloading images:", error);
    }
  };

  // Helper function to determine image extension
  const getImageExtension = (url: string) => {
    if (url.includes(";base64,")) {
      const mimeType = url.split(";base64,")[0].split("data:")[1];
      return mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1];
    }
    return "jpg"; // Default
  };

  // Function to convert image URL to blob and add to ZIP
  const addImageToZip = async (url: string, folder: JSZip, fileName: string) => {
    if (!folder) return;
    
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      folder.file(fileName, blob);
    } catch (error) {
      console.error(`Error adding image ${fileName}:`, error);
      // If the image is base64, add it directly
      if (url.includes(";base64,")) {
        const base64Data = url.split(";base64,")[1];
        folder.file(fileName, base64Data, {base64: true});
      }
    }
  };

  const handleSave = () => {
    if (onSave && formData) {
      // Validate form before saving
      if (!validateForm()) {
        toast({
          title: "Validation error",
          description: "Please complete all required fields",
          variant: "destructive",
        });
        return;
      }
      
      // Clean formData - no defaults, all fields must be complete
      const cleanedData = {
        name: formData.name,
        description: formData.description,
        price: formData.price,
        stock: formData.stock,
        status: formData.status,
        sku: formData.sku,
        imageUrl: formData.imageUrl,
        additionalImages: formData.additionalImages || [],
        category: formData.category,
        weight: formData.weight,
        dimensions: formData.dimensions,
        specifications: formData.specifications,
        reference: formData.reference,
        provider: formData.provider
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
          {mode === "view" && isAdmin && (
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
                
                {/* Botón discreto para descargar todas las imágenes */}
                {images.length > 0 && (
                  <div 
                    className="absolute top-2 right-2 p-1 rounded-full bg-white/80 hover:bg-white shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md z-10"
                    onClick={handleDownloadImages}
                    title="Download Images"
                  >
                    <Download className="h-4 w-4 text-gray-700" />
                  </div>
                )}
                
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
              <div className="space-y-1">
                <div className="flex items-center mb-1">
                  <Label>Main Image *</Label>
                  {formErrors.imageUrl && (
                    <p className="text-red-500 text-xs flex items-center ml-2">
                      <AlertCircle className="h-3 w-3 mr-1" /> {formErrors.imageUrl}
                    </p>
                  )}
                </div>
                <ImageUpload 
                  className={`h-[300px] ${formErrors.imageUrl ? "border-red-500" : ""}`}
                  currentImage={formData.imageUrl}
                  additionalImages={formData.additionalImages || []}
                  onImageChange={(image) => {
                    setFormData({
                      ...formData,
                      imageUrl: image
                    });
                  }}
                  onSelectAdditionalImage={(image, index) => {
                    // Promover una imagen adicional a ser la imagen principal
                    // y eliminarla del array de imágenes adicionales
                    const newAdditionalImages = [...(formData.additionalImages || [])];
                    newAdditionalImages.splice(index, 1);
                    
                    setFormData({
                      ...formData,
                      imageUrl: image,
                      additionalImages: newAdditionalImages
                    });
                  }}
                />
                
                <div className="mt-4">
                  <AdditionalImagesUpload
                    currentImages={formData.additionalImages || []}
                    onImagesChange={(images) => {
                      setFormData({
                        ...formData,
                        additionalImages: images
                      });
                    }}
                  />
                </div>
              </div>
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
                <div className="space-y-1">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input 
                    id="name"
                    name="name"
                    value={formData.name || ""}
                    onChange={handleInputChange}
                    placeholder="Enter product name"
                    className={formErrors.name ? "border-red-500" : ""}
                  />
                  {formErrors.name && (
                    <p className="text-red-500 text-xs flex items-center">
                      <AlertCircle className="h-3 w-3 mr-1" /> {formErrors.name}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="sku">SKU *</Label>
                  <Input 
                    id="sku"
                    name="sku"
                    value={formData.sku || ""}
                    onChange={handleInputChange}
                    placeholder="Enter product SKU"
                    readOnly={mode === "edit"} // SKU no se puede editar, solo crear
                    className={`${mode === "edit" ? "bg-muted" : ""} ${formErrors.sku ? "border-red-500" : ""}`}
                  />
                  {formErrors.sku && (
                    <p className="text-red-500 text-xs flex items-center">
                      <AlertCircle className="h-3 w-3 mr-1" /> {formErrors.sku}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="category">Category *</Label>
                  <Input 
                    id="category"
                    name="category"
                    value={formData.category || ""}
                    onChange={handleInputChange}
                    placeholder="Enter product category"
                    className={formErrors.category ? "border-red-500" : ""}
                  />
                  {formErrors.category && (
                    <p className="text-red-500 text-xs flex items-center">
                      <AlertCircle className="h-3 w-3 mr-1" /> {formErrors.category}
                    </p>
                  )}
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
                        <p className="text-muted-foreground">{productData.weight ? `${productData.weight} kg` : 'Not specified'}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-primary mb-1">Dimensions</h3>
                        <p className="text-muted-foreground">{productData.dimensions || 'Not specified'}</p>
                      </div>
                    </div>
                    
                    {isAdmin && (
                      <div>
                        <h3 className="text-sm font-medium text-primary mb-1">Supplier</h3>
                        <p className="text-muted-foreground">{productData.provider || 'Not specified'}</p>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="specs" className="space-y-4 pt-4">
                    {productData.specifications ? (
                      <pre className="text-sm whitespace-pre-wrap">
                        {typeof productData.specifications === 'string' 
                          ? productData.specifications 
                          : JSON.stringify(productData.specifications, null, 2)}
                      </pre>
                    ) : (
                      <div className="text-muted-foreground text-center py-4">No specifications available</div>
                    )}
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              // Formulario para la columna derecha en modo edición/creación
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea 
                    id="description"
                    name="description"
                    value={formData.description || ""}
                    onChange={handleInputChange}
                    placeholder="Enter product description"
                    rows={5}
                    className={formErrors.description ? "border-red-500" : ""}
                  />
                  {formErrors.description && (
                    <p className="text-red-500 text-xs flex items-center">
                      <AlertCircle className="h-3 w-3 mr-1" /> {formErrors.description}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="price">Price ($) *</Label>
                    <Input 
                      id="price"
                      name="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price || 0}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      className={formErrors.price ? "border-red-500" : ""}
                    />
                    {formErrors.price && (
                      <p className="text-red-500 text-xs flex items-center">
                        <AlertCircle className="h-3 w-3 mr-1" /> {formErrors.price}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="stock">Stock *</Label>
                    <Input 
                      id="stock"
                      name="stock"
                      type="number"
                      min="0"
                      value={formData.stock || 0}
                      onChange={handleInputChange}
                      placeholder="0"
                      className={formErrors.stock ? "border-red-500" : ""}
                    />
                    {formErrors.stock && (
                      <p className="text-red-500 text-xs flex items-center">
                        <AlertCircle className="h-3 w-3 mr-1" /> {formErrors.stock}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="status">Status *</Label>
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

                <div className="space-y-1">
                  <Label htmlFor="weight">Weight (kg) *</Label>
                  <Input 
                    id="weight"
                    name="weight"
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.weight || ""}
                    onChange={handleInputChange}
                    placeholder="0.0"
                    className={formErrors.weight ? "border-red-500" : ""}
                  />
                  {formErrors.weight && (
                    <p className="text-red-500 text-xs flex items-center">
                      <AlertCircle className="h-3 w-3 mr-1" /> {formErrors.weight}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="dimensions">Dimensions (LxWxH cm) *</Label>
                  <Input 
                    id="dimensions"
                    name="dimensions"
                    value={formData.dimensions || ""}
                    onChange={handleInputChange}
                    placeholder="e.g. 20x15x5"
                    className={formErrors.dimensions ? "border-red-500" : ""}
                  />
                  {formErrors.dimensions && (
                    <p className="text-red-500 text-xs flex items-center">
                      <AlertCircle className="h-3 w-3 mr-1" /> {formErrors.dimensions}
                    </p>
                  )}
                </div>
                
                {/* Campos specifications y reference removidos por petición del usuario */}
                
                {isAdmin && (
                  <div className="space-y-1">
                    <Label htmlFor="provider">Supplier/Provider *</Label>
                    <Input 
                      id="provider"
                      name="provider"
                      value={formData.provider || ""}
                      onChange={handleInputChange}
                      placeholder="Enter supplier/provider name"
                      className={formErrors.provider ? "border-red-500" : ""}
                    />
                    {formErrors.provider && (
                      <p className="text-red-500 text-xs flex items-center">
                        <AlertCircle className="h-3 w-3 mr-1" /> {formErrors.provider}
                      </p>
                    )}
                  </div>
                )}
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
            <>
              {/* Solo mostrar el botón "Add to My Shop" para usuarios regulares (no admins) */}
              {!isAdmin && (
                <Button>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Add to My Shop
                </Button>
              )}
            </>
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