import { useState, useRef } from "react";
import { Button } from "./button";
import { UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  className?: string;
  currentImage?: string;
  onImageChange: (image: string) => void;
}

export function ImageUpload({ className, currentImage, onImageChange }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreview(result);
      onImageChange(result);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreview(result);
      onImageChange(result);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(null);
    onImageChange("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center rounded-md border-2 border-dashed p-6 transition-all",
        isDragging ? "border-primary bg-primary/10" : "border-border",
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={triggerFileInput}
    >
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        ref={fileInputRef}
      />
      
      {preview ? (
        <div className="relative w-full h-full">
          <img 
            src={preview} 
            alt="Preview" 
            className="w-full h-full object-contain"
          />
          <button
            className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md"
            onClick={clearImage}
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center text-center space-y-2">
          <UploadCloud className="h-12 w-12 text-muted-foreground" />
          <div className="text-sm font-medium">
            Drag and drop an image, or click to browse
          </div>
          <div className="text-xs text-muted-foreground">
            JPG, PNG, GIF up to 5MB
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerFileInput();
            }}
          >
            Select Image
          </Button>
        </div>
      )}
    </div>
  );
}