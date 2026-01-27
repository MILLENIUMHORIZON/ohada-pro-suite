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
import { Key, Eye, EyeOff, CheckCircle, XCircle, Wallet, Shield } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TreasuryAccountSettings } from "@/components/settings/TreasuryAccountSettings";
import { UserTreasuryAccess } from "@/components/settings/UserTreasuryAccess";

export default function CompanySettings() {
  const [loading, setLoading] = useState(false);
  const [dgiToken, setDgiToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const { register, handleSubmit, reset } = useForm();

  const handleUpdateDgiToken = async () => {
    if (!dgiToken.trim()) {
      toast.error("Veuillez entrer un token");
      return;
    }

    setTokenLoading(true);
    try {
      // Call edge function to update the token
      const { data, error } = await supabase.functions.invoke('update-dgi-token', {
        body: { token: dgiToken }
      });

      if (error) throw error;

      toast.success("Token DGI mis à jour avec succès");
      setDgiToken("");
      setTokenStatus('idle');
    } catch (error: any) {
      console.error("Error updating DGI token:", error);
      toast.error(error.message || "Erreur lors de la mise à jour du token");
    } finally {
      setTokenLoading(false);
    }
  };

  const handleTestDgiToken = async () => {
    if (!dgiToken.trim()) {
      toast.error("Veuillez entrer un token à tester");
      return;
    }

    setTokenLoading(true);
    setTokenStatus('idle');
    try {
      const response = await fetch('https://developper.dgirdc.cd/edef/api/info/status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${dgiToken}`,
        },
      });

      if (response.ok) {
        setTokenStatus('valid');
        toast.success("Token valide !");
      } else {
        setTokenStatus('invalid');
        toast.error("Token invalide ou expiré");
      }
    } catch (error: any) {
      console.error("Error testing DGI token:", error);
      setTokenStatus('invalid');
      toast.error("Erreur lors du test du token");
    } finally {
      setTokenLoading(false);
    }
  };

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
          nim: formData.nim,
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
        <h1 className="text-3xl font-bold text-foreground">Paramètres de l'Entreprise</h1>
        <p className="text-muted-foreground mt-1">Gérez les informations et configurations de votre société</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">Informations Générales</TabsTrigger>
          <TabsTrigger value="treasury" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Comptes de Trésorerie
          </TabsTrigger>
          <TabsTrigger value="access" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Autorisations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
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

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="id_nat">ID NAT</Label>
                        <Input id="id_nat" {...register("id_nat")} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="nim">NIM</Label>
                        <Input id="nim" {...register("nim")} />
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Enregistrement..." : "Enregistrer les modifications"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <CompanyLogoUpload />

              {/* DGI Token Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Token DGI (e-Facturation)
                  </CardTitle>
                  <CardDescription>
                    Mettez à jour votre token Bearer pour l'API DGI
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="dgi_token">Token Bearer DGI</Label>
                    <div className="relative">
                      <Input
                        id="dgi_token"
                        type={showToken ? "text" : "password"}
                        value={dgiToken}
                        onChange={(e) => {
                          setDgiToken(e.target.value);
                          setTokenStatus('idle');
                        }}
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {tokenStatus === 'valid' && (
                      <div className="flex items-center gap-2 text-green-600 text-sm">
                        <CheckCircle className="h-4 w-4" />
                        Token valide
                      </div>
                    )}
                    {tokenStatus === 'invalid' && (
                      <div className="flex items-center gap-2 text-red-600 text-sm">
                        <XCircle className="h-4 w-4" />
                        Token invalide ou expiré
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestDgiToken}
                      disabled={tokenLoading || !dgiToken.trim()}
                      className="flex-1"
                    >
                      {tokenLoading ? "Test en cours..." : "Tester le token"}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleUpdateDgiToken}
                      disabled={tokenLoading || !dgiToken.trim()}
                      className="flex-1"
                    >
                      {tokenLoading ? "Mise à jour..." : "Mettre à jour"}
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Le token est utilisé pour envoyer les factures à la DGI. 
                    Vous pouvez obtenir un nouveau token sur le portail développeur de la DGI.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="treasury" className="space-y-4">
          <TreasuryAccountSettings />
        </TabsContent>

        <TabsContent value="access" className="space-y-4">
          <UserTreasuryAccess />
        </TabsContent>
      </Tabs>
    </div>
  );
}
