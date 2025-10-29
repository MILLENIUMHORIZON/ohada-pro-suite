import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CompanyLogoUpload } from "@/components/CompanyLogoUpload";
import { useForm } from "react-hook-form";

export default function CompanySettings() {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  useEffect(() => {
    loadCompanyData();
  }, []);

  const loadCompanyData = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Get profile with company_id for current user
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (profile?.company_id) {
        const { data: company } = await supabase
          .from("companies")
          .select("*")
          .eq("id", profile.company_id)
          .single();

        if (company) {
          reset(company);
        }
      }
    } catch (error) {
      console.error("Error loading company:", error);
    }
  };

  const onSubmit = async (formData: any) => {
    try {
      setLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Utilisateur non connecté");
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.company_id) {
        throw new Error("Impossible de récupérer l'ID de l'entreprise");
      }

      const { error } = await supabase
        .from("companies")
        .update({
          name: formData.name,
          address: formData.address,
          phone: formData.phone,
          email: formData.email,
          registration_number: formData.registration_number,
          nif: formData.nif,
          rccm: formData.rccm,
          id_nat: formData.id_nat,
        })
        .eq("id", profile.company_id);

      if (error) throw error;

      toast.success("Informations mises à jour");
    } catch (error: any) {
      console.error("Error updating company:", error);
      toast.error(error.message || "Erreur lors de la mise à jour");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Informations de l'Entreprise</h1>
        <p className="text-muted-foreground mt-1">Gérez les informations de votre société</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations Générales</CardTitle>
              <CardDescription>Détails de votre entreprise</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom de l'entreprise *</Label>
                  <Input id="name" {...register("name")} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Adresse</Label>
                  <Textarea id="address" {...register("address")} rows={3} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input id="phone" type="tel" {...register("phone")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" {...register("email")} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registration_number">Numéro d'enregistrement</Label>
                  <Input id="registration_number" {...register("registration_number")} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nif">NIF</Label>
                    <Input id="nif" {...register("nif")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rccm">RCCM</Label>
                    <Input id="rccm" {...register("rccm")} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="id_nat">ID NAT</Label>
                  <Input id="id_nat" {...register("id_nat")} />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Enregistrement..." : "Enregistrer les modifications"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div>
          <CompanyLogoUpload />
        </div>
      </div>
    </div>
  );
}
