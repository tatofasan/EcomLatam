import { Button } from "@/components/ui/button";
import { FcGoogle } from "react-icons/fc";
import { FaGithub, FaFacebook } from "react-icons/fa";
import { Loader2 } from "lucide-react";
import { useState } from "react";

interface SocialAuthButtonsProps {
  onSocialAuth: (provider: "google" | "github" | "facebook") => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export default function SocialAuthButtons({ 
  onSocialAuth, 
  isLoading = false, 
  disabled = false 
}: SocialAuthButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const handleSocialAuth = async (provider: "google" | "github" | "facebook") => {
    setLoadingProvider(provider);
    try {
      await onSocialAuth(provider);
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            O continúa con
          </span>
        </div>
      </div>

      <div className="grid gap-3">
        <Button
          variant="outline"
          className="w-full h-12 text-sm font-medium"
          onClick={() => handleSocialAuth("google")}
          disabled={disabled || isLoading}
        >
          {loadingProvider === "google" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FcGoogle className="mr-2 h-5 w-5" />
          )}
          Continuar con Google
        </Button>

        <Button
          variant="outline"
          className="w-full h-12 text-sm font-medium"
          onClick={() => handleSocialAuth("github")}
          disabled={disabled || isLoading}
        >
          {loadingProvider === "github" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FaGithub className="mr-2 h-5 w-5" />
          )}
          Continuar con GitHub
        </Button>

        <Button
          variant="outline"
          className="w-full h-12 text-sm font-medium"
          onClick={() => handleSocialAuth("facebook")}
          disabled={disabled || isLoading}
        >
          {loadingProvider === "facebook" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FaFacebook className="mr-2 h-5 w-5 text-blue-600" />
          )}
          Continuar con Facebook
        </Button>
      </div>
    </div>
  );
}