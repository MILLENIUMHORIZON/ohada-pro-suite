import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, X, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function CompanyLogoUpload() {
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    loadCompanyLogo();
  }, []);

  const loadCompanyLogo = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (profile?.company_id) {
        setCompanyId(profile.company_id);
        
        const { data: company } = await supabase
          .from("companies")
          .select("logo_url")
          .eq("id", profile.company_id)
          .single();

        if (company?.logo_url) {
          setLogoUrl(company.logo_url);
        }
      }
    } catch (error) {
      console.error("Error loading company logo:", error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error("Vous devez sélectionner un fichier");
      }

      const file = event.target.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error("Le fichier doit être une image");
      }

      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        throw new Error("La taille du fichier ne doit pas dépasser 2MB");
      }

      if (!companyId) {
        throw new Error("Impossible de récupérer l'ID de l'entreprise");
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${companyId}/logo.${fileExt}`;

      // Delete old logo if exists
      if (logoUrl) {
        const oldPath = logoUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('company-logos')
            .remove([`${companyId}/${oldPath}`]);
        }
      }

      // Upload new logo
      const { error: uploadError, data } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      // Update company logo_url
      const { error: updateError } = await supabase
        .from('companies')
        .update({ logo_url: publicUrl })
        .eq('id', companyId);

      if (updateError) {
        throw updateError;
      }

      setLogoUrl(publicUrl);
      toast.success("Logo uploadé avec succès");
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      toast.error(error.message || "Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    try {
      if (!companyId || !logoUrl) return;

      const fileName = logoUrl.split('/').pop();
      if (!fileName) return;

      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from('company-logos')
        .remove([`${companyId}/${fileName}`]);

      if (deleteError) {
        throw deleteError;
      }

      // Update company
      const { error: updateError } = await supabase
        .from('companies')
        .update({ logo_url: null })
        .eq('id', companyId);

      if (updateError) {
        throw updateError;
      }

      setLogoUrl(null);
      toast.success("Logo supprimé");
    } catch (error: any) {
      console.error("Error removing logo:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo de l'Entreprise</CardTitle>
        <CardDescription>
          Uploadez le logo de votre entreprise (max 2MB)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {logoUrl ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center w-full h-40 border-2 border-dashed rounded-lg bg-muted/50">
              <img
                src={logoUrl}
                alt="Company Logo"
                className="max-h-36 max-w-full object-contain"
              />
            </div>
            <div className="flex gap-2">
              <Label htmlFor="logo-upload" className="flex-1">
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={uploading}
                  asChild
                >
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    Changer le logo
                  </span>
                </Button>
              </Label>
              <Button
                variant="destructive"
                size="icon"
                onClick={handleRemoveLogo}
                disabled={uploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-center w-full h-40 border-2 border-dashed rounded-lg bg-muted/50">
              <div className="text-center">
                <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Aucun logo
                </p>
              </div>
            </div>
            <Label htmlFor="logo-upload">
              <Button
                variant="outline"
                className="w-full"
                disabled={uploading}
                asChild
              >
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  {uploading ? "Upload en cours..." : "Uploader un logo"}
                </span>
              </Button>
            </Label>
          </div>
        )}
        <Input
          id="logo-upload"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
          disabled={uploading}
        />
      </CardContent>
    </Card>
  );
}
