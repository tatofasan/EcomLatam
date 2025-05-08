import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { AlertCircle, FileText, Upload, Download, X, Check } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Product } from '@/types';

// Define las columnas del template
const templateColumns = [
  'name',
  'description',
  'price',
  'stock',
  'status',
  'sku',
  'imageUrl',
  'additionalImages',
  'weight',
  'dimensions',
  'category',
  'reference',
  'provider'
];

// Define los datos de ejemplo para el template
const templateData = [
  {
    name: 'Product Example',
    description: 'This is a sample product description',
    price: 99.99,
    stock: 100,
    status: 'active', // active, inactive, draft, low
    sku: 'SKU123456',
    imageUrl: 'https://example.com/image.jpg',
    additionalImages: 'https://example.com/image1.jpg,https://example.com/image2.jpg',
    weight: 1.5,
    dimensions: '10x10x5',
    category: 'Electronics',
    reference: 'REF001',
    provider: 'Provider Name'
  }
];

interface ProductImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProductImportDialog({ isOpen, onClose }: ProductImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Mutation for bulk product import
  const importProductsMutation = useMutation({
    mutationFn: async (products: Omit<Product, 'id'>[]) => {
      const res = await apiRequest('POST', '/api/products/bulk-import', { products });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: 'Import successful',
        description: `Successfully imported ${data.success} products.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Import failed',
        description: `Failed to import products: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFile(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleFile(file);
    }
  };

  const handleFile = (file: File) => {
    if (file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && 
        file.type !== 'application/vnd.ms-excel') {
      toast({
        title: 'Invalid file format',
        description: 'Please upload an Excel file (.xlsx or .xls)',
        variant: 'destructive',
      });
      return;
    }
    
    setFile(file);
    setValidationErrors([]);
  };

  const downloadTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
    
    // Generate the Excel file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // Save the file
    saveAs(data, 'product_import_template.xlsx');
  };

  const validateProducts = (products: any[]): { valid: Omit<Product, 'id'>[]; errors: string[] } => {
    const validProducts: Omit<Product, 'id'>[] = [];
    const errors: string[] = [];

    products.forEach((product, index) => {
      const rowNumber = index + 2; // Excel rows start at 1, and we have a header row
      
      // Required fields validation
      if (!product.name) {
        errors.push(`Row ${rowNumber}: Name is required`);
      }
      
      if (!product.description) {
        errors.push(`Row ${rowNumber}: Description is required`);
      }
      
      if (isNaN(parseFloat(product.price)) || parseFloat(product.price) <= 0) {
        errors.push(`Row ${rowNumber}: Price must be a positive number`);
      }
      
      if (!product.sku) {
        errors.push(`Row ${rowNumber}: SKU is required`);
      }
      
      if (!product.imageUrl) {
        errors.push(`Row ${rowNumber}: Image URL is required`);
      }
      
      // Status validation
      if (product.status && !['active', 'inactive', 'draft', 'low'].includes(product.status)) {
        errors.push(`Row ${rowNumber}: Status must be one of: active, inactive, draft, low`);
      }
      
      // If no errors, add to valid products
      if (!errors.some(error => error.startsWith(`Row ${rowNumber}:`))) {
        // Process additional images (convert from comma-separated string to array)
        let additionalImages = [];
        if (typeof product.additionalImages === 'string' && product.additionalImages.trim()) {
          additionalImages = product.additionalImages.split(',').map((url: string) => url.trim());
        }

        validProducts.push({
          name: product.name,
          description: product.description,
          price: parseFloat(product.price),
          stock: parseInt(product.stock) || 0,
          status: product.status || 'draft',
          sku: product.sku,
          imageUrl: product.imageUrl,
          additionalImages: additionalImages,
          weight: parseFloat(product.weight) || null,
          dimensions: product.dimensions || null,
          category: product.category || null,
          specifications: product.specifications ? JSON.parse(product.specifications) : {},
          reference: product.reference || null,
          provider: product.provider || null,
        });
      }
    });

    return { valid: validProducts, errors };
  };

  const processFile = async () => {
    if (!file) return;
    
    setIsProcessing(true);
    setProcessingProgress(10);
    
    try {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          setProcessingProgress(30);
          
          // Assuming the first sheet contains the product data
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          setProcessingProgress(50);
          
          // Validate the data
          const { valid, errors } = validateProducts(jsonData);
          
          setProcessingProgress(70);
          
          if (errors.length > 0) {
            setValidationErrors(errors);
            setErrorCount(errors.length);
            setProcessingProgress(100);
          } else if (valid.length === 0) {
            setValidationErrors(['No valid products found in the file']);
            setProcessingProgress(100);
          } else {
            // Import the products
            await importProductsMutation.mutateAsync(valid);
            setSuccessCount(valid.length);
            setProcessingProgress(100);
          }
        } catch (error) {
          console.error('Error processing Excel file:', error);
          setValidationErrors([`Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`]);
          setProcessingProgress(100);
        }
      };
      
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error reading file:', error);
      setValidationErrors([`Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`]);
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setValidationErrors([]);
    setIsProcessing(false);
    setProcessingProgress(0);
    setSuccessCount(0);
    setErrorCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCloseDialog = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCloseDialog}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Import Products</DialogTitle>
          <DialogDescription>
            Upload an Excel file to bulk import products into your inventory.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {!isProcessing && processingProgress === 0 && (
            <>
              <div 
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                  ${isDragging ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary/50'}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls"
                  ref={fileInputRef}
                  onChange={handleFileInput}
                />
                
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-gray-400" />
                  <div className="text-sm font-medium">
                    {file ? file.name : 'Drag and drop or click to upload'}
                  </div>
                  <p className="text-xs text-gray-500">
                    Accepts Excel files (.xlsx, .xls)
                  </p>
                </div>
              </div>

              <div className="flex justify-center mt-2">
                <Button variant="outline" size="sm" onClick={downloadTemplate} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Download Template
                </Button>
              </div>
            </>
          )}

          {isProcessing && (
            <div className="space-y-4">
              <div className="text-center py-2">
                <h3 className="text-sm font-medium">Processing your file...</h3>
                <Progress value={processingProgress} className="h-2 mt-2" />
              </div>
            </div>
          )}

          {processingProgress === 100 && (
            <div className="space-y-4">
              {validationErrors.length > 0 ? (
                <div className="space-y-2">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Found {validationErrors.length} error{validationErrors.length > 1 ? 's' : ''}
                    </AlertDescription>
                  </Alert>
                  
                  <div className="max-h-40 overflow-y-auto p-2 border rounded text-xs">
                    {validationErrors.map((error, index) => (
                      <div key={index} className="py-1 flex items-start gap-2">
                        <X className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center space-y-2">
                  <div className="rounded-full bg-green-100 p-2 w-12 h-12 mx-auto flex items-center justify-center">
                    <Check className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="text-lg font-medium">Import Successful</h3>
                  <p className="text-sm text-gray-500">
                    Successfully imported {successCount} products
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          {!isProcessing && processingProgress === 0 && (
            <>
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button 
                onClick={processFile} 
                disabled={!file}
                className="sm:ml-auto"
              >
                <FileText className="h-4 w-4 mr-2" />
                Process File
              </Button>
            </>
          )}
          
          {processingProgress === 100 && (
            <Button onClick={handleCloseDialog}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}