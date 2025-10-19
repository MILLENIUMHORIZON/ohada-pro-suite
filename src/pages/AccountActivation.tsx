import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Key, CheckCircle2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";

export default function AccountActivation() {
  const [activationKey, setActivationKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!activationKey.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer une clé d'activation",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.rpc('activate_account_with_key', {
        activation_key: activationKey.trim()
      });

      if (error) throw error;

      const result = data as { success: boolean; message?: string; error?: string; account_type?: string };

      if (result.success) {
        toast({
          title: "Compte activé!",
          description: result.message || "Votre compte a été activé avec succès",
        });
        
        // Redirect to dashboard after success
        setTimeout(() => {
          navigate("/");
        }, 2000);
      } else {
        toast({
          title: "Erreur d'activation",
          description: result.error || "Une erreur est survenue",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Activation error:", error);
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de l'activation",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Activation du Compte</h1>
        <p className="text-muted-foreground mt-1">Convertissez votre compte démo en compte permanent</p>
      </div>

      <div className="max-w-2xl">
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Les comptes démo expirent après 15 jours. Utilisez une clé d'activation pour convertir votre compte en compte permanent et accéder à toutes les fonctionnalités sans limitation de temps.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Key className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Activer votre compte</CardTitle>
                <CardDescription>Entrez votre clé d'activation pour débloquer l'accès complet</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleActivate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="activationKey">Clé d'activation</Label>
                <Input
                  id="activationKey"
                  type="text"
                  placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                  value={activationKey}
                  onChange={(e) => setActivationKey(e.target.value.toUpperCase())}
                  disabled={isLoading}
                  className="font-mono"
                />
                <p className="text-sm text-muted-foreground">
                  Entrez la clé d'activation fournie par votre administrateur
                </p>
              </div>

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  "Activation en cours..."
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Activer le compte
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">Avantages du compte activé</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Accès illimité sans expiration</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Toutes les fonctionnalités de l'ERP</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Support technique prioritaire</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Sauvegarde automatique de vos données</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
