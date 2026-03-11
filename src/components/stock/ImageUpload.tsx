import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ImageUploadProps {
  currentUrl?: string | null;
  folder: string;
  onUploaded: (url: string) => void;
  onRemoved?: () => void;
  className?: string;
}

export function ImageUpload({ currentUrl, folder, onUploaded, onRemoved, className }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner une image");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 5 Mo");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${folder}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("production-images")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("production-images")
        .getPublicUrl(fileName);

      setPreview(publicUrl);
      onUploaded(publicUrl);
      toast.success("Image uploadée");
    } catch (err: any) {
      toast.error("Erreur upload: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onRemoved?.();
  };

  return (
    <div className={className}>
      {preview ? (
        <div className="relative group w-full h-32 rounded-lg overflow-hidden border bg-muted">
          <img src={preview} alt="" className="w-full h-full object-cover" />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleRemove}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer"
        >
          {uploading ? (
            <span className="text-sm">Upload...</span>
          ) : (
            <>
              <ImageIcon className="h-8 w-8" />
              <span className="text-xs">Cliquer pour ajouter une image</span>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}
