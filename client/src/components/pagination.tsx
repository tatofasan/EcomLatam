import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage
}: PaginationProps) {
  // Calculate range of items being displayed
  const firstItem = Math.min((currentPage - 1) * itemsPerPage + 1, totalItems);
  const lastItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    
    // Always include first page, last page, and pages around current page
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 || 
        i === totalPages || 
        (i >= currentPage - 1 && i <= currentPage + 1)
      ) {
        pages.push(i);
      } else if (
        (i === currentPage - 2 && currentPage > 3) || 
        (i === currentPage + 2 && currentPage < totalPages - 2)
      ) {
        // Add ellipsis indicator
        pages.push("ellipsis");
      }
    }
    
    // Remove duplicates and ellipsis next to each other
    return pages.filter((page, index, array) => 
      page !== "ellipsis" || (page === "ellipsis" && array[index - 1] !== "ellipsis")
    );
  };

  return (
    <div className="mt-8 flex flex-col md:flex-row items-center justify-between">
      <div className="text-sm text-gray-600 mb-4 md:mb-0">
        Showing <span className="font-medium">{firstItem}</span> to{" "}
        <span className="font-medium">{lastItem}</span> of{" "}
        <span className="font-medium">{totalItems}</span> products
      </div>
      
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Previous page</span>
        </Button>
        
        {getPageNumbers().map((page, i) => 
          page === "ellipsis" ? (
            <span key={`ellipsis-${i}`} className="px-3 py-1">...</span>
          ) : (
            <Button
              key={page}
              variant={currentPage === page ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(page as number)}
              className="h-8 w-8 p-0"
            >
              {page}
            </Button>
          )
        )}
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Next page</span>
        </Button>
      </div>
    </div>
  );
}
