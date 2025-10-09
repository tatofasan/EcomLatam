import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, Calendar } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ReactMarkdown from 'react-markdown';

interface TermsData {
  id: number;
  version: string;
  title: string;
  content: string;
  effectiveDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function TermsPage() {
  const { data, isLoading, error } = useQuery<{ success: boolean; data: TermsData }>({
    queryKey: ['terms'],
    queryFn: async () => {
      const response = await fetch('/api/terms');
      if (!response.ok) {
        throw new Error('Failed to fetch terms and conditions');
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Error al cargar los términos y condiciones. Por favor, intente nuevamente más tarde.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const terms = data?.data;

  if (!terms) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertDescription>
            No hay términos y condiciones disponibles en este momento.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const effectiveDate = new Date(terms.effectiveDate).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-3xl flex items-center gap-2">
                <FileText className="h-8 w-8" />
                {terms.title}
              </CardTitle>
              <CardDescription className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Vigente desde: {effectiveDate}
                </span>
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                  Versión {terms.version}
                </span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{terms.content}</ReactMarkdown>
          </div>

          <div className="mt-8 pt-6 border-t text-sm text-muted-foreground">
            <p>
              Última actualización: {new Date(terms.updatedAt).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
