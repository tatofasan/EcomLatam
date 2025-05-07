import { useState, useRef } from "react";
import { Button } from "./button";
import { UploadCloud, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdditionalImagesUploadProps {
  className?: string;
  currentImages: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
}

export function AdditionalImagesUpload({ 
  className, 
  currentImages = [], 
  onImagesChange,
  maxImages = 5
}: AdditionalImagesUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (currentImages.length >= maxImages) {
      alert(`Maximum ${maxImages} additional images allowed`);
      return;
    }
    
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const newImages = [...currentImages, result];
      onImagesChange(newImages);
    };
    reader.readAsDataURL(file);

    // Reset file input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
    
    if (currentImages.length >= maxImages) {
      alert(`Maximum ${maxImages} additional images allowed`);
      return;
    }
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const newImages = [...currentImages, result];
      onImagesChange(newImages);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newImages = [...currentImages];
    newImages.splice(index, 1);
    onImagesChange(newImages);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="text-sm font-medium">Additional Images ({currentImages.length}/{maxImages})</div>
      
      <div className="flex gap-3 flex-wrap">
        {currentImages.map((img, idx) => (
          <div key={idx} className="relative w-24 h-24 border rounded overflow-hidden">
            <img 
              src={img} 
              alt={`Additional image ${idx + 1}`}
              className="w-full h-full object-cover"
            />
            <button
              className="absolute top-1 right-1 bg-white rounded-full p-1 shadow-md"
              onClick={(e) => removeImage(idx, e)}
            >
              <X className="h-3 w-3 text-gray-500" />
            </button>
          </div>
        ))}
        
        {currentImages.length < maxImages && (
          <div
            className={cn(
              "flex flex-col items-center justify-center w-24 h-24 rounded border-2 border-dashed cursor-pointer transition-all",
              isDragging ? "border-primary bg-primary/10" : "border-border",
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
            <Plus className="h-6 w-6 text-muted-foreground" />
            <div className="text-xs text-center text-muted-foreground mt-1">Add Photo</div>
          </div>
        )}
      </div>
    </div>
  );
}