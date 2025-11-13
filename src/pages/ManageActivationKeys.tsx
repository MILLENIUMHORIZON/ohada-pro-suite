import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Key, Plus, Trash2, Copy, CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ActivationKey {
  id: string;
  key: string;
  key_type: string;
  max_uses: number;
  current_uses: number;
  expires_at: string | null;
  created_at: string;
  is_active: boolean;
}

export default function ManageActivationKeys() {
  const [keys, setKeys] = useState<ActivationKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<string | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const { toast } = useToast();

  // Form state
  const [keyType, setKeyType] = useState("standard");
  const [maxUses, setMaxUses] = useState("1");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [numberOfUsers, setNumberOfUsers] = useState("1");
  const [duration, setDuration] = useState("1");
  const [durationType, setDurationType] = useState("monthly");

  useEffect(() => {
    loadKeys();
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from("profiles")
          .select("phone")
          .eq("user_id", user.id)
          .single();
        
        if (error) throw error;
        setUserPhone(data?.phone || "");
      }
    } catch (error: any) {
      console.error("Error loading user profile:", error);
    }
  };

  const loadKeys = async () => {
    try {
      const { data, error } = await supabase
        .from("activation_keys")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setKeys(data || []);
    } catch (error: any) {
      console.error("Error loading keys:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les clés d'activation",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateKey = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const segments = 4;
    const segmentLength = 5;
    
    return Array.from({ length: segments }, () =>
      Array.from({ length: segmentLength }, () =>
        chars.charAt(Math.floor(Math.random() * chars.length))
      ).join("")
    ).join("-");
  };

  const calculateTotalAmount = () => {
    const pricePerUser = 7;
    const users = parseInt(numberOfUsers) || 1;
    const durationValue = parseInt(duration) || 1;
    
    if (durationType === "monthly") {
      return pricePerUser * users * durationValue;
    } else {
      // Annual: 12 months
      return pricePerUser * users * 12 * durationValue;
    }
  };

  const handleCreateKey = async () => {
    try {
      if (!userPhone) {
        toast({
          title: "Erreur",
          description: "Numéro de téléphone manquant. Veuillez le configurer dans vos paramètres.",
          variant: "destructive",
        });
        return;
      }

      // Calculate total amount
      const totalAmount = calculateTotalAmount();

      // Call edge function to generate payment link
      const { data, error } = await supabase.functions.invoke('generate-payment-link', {
        body: {
          amount: totalAmount,
          phone: userPhone,
        }
      });

      if (error) throw error;

      if (data?.paymentUrl) {
        setPaymentUrl(data.paymentUrl);
        setShowPaymentDialog(true);
        setShowCreateDialog(false);
      }

    } catch (error: any) {
      console.error("Error creating key:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de générer le lien de paiement",
        variant: "destructive",
      });
    }
  };

  const handleDeleteKey = async () => {
    if (!keyToDelete) return;

    try {
      const { error } = await supabase
        .from("activation_keys")
        .delete()
        .eq("id", keyToDelete);

      if (error) throw error;

      toast({
        title: "Clé supprimée",
        description: "La clé d'activation a été supprimée",
      });

      loadKeys();
    } catch (error: any) {
      console.error("Error deleting key:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer la clé",
        variant: "destructive",
      });
    } finally {
      setKeyToDelete(null);
    }
  };

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({
      title: "Copié",
      description: "La clé a été copiée dans le presse-papier",
    });
  };

  const getKeyTypeBadge = (type: string) => {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      standard: { label: "Standard", variant: "default" },
      premium: { label: "Premium", variant: "secondary" },
      enterprise: { label: "Enterprise", variant: "outline" },
    };
    
    const config = variants[type] || variants.standard;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestion des Clés d'Activation</h1>
          <p className="text-muted-foreground mt-1">Créez et gérez les clés d'activation pour vos utilisateurs</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Créer une clé
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clés d'activation</CardTitle>
          <CardDescription>Liste de toutes les clés d'activation créées</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Chargement...</p>
          ) : keys.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Aucune clé d'activation créée</p>
          ) : (
            <div className="space-y-2">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-3">
                      <code className="font-mono font-semibold text-sm">{key.key}</code>
                      {getKeyTypeBadge(key.key_type)}
                      {!key.is_active && <Badge variant="outline">Inactive</Badge>}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Utilisations: {key.current_uses}/{key.max_uses}</span>
                      {key.expires_at && (
                        <span>Expire: {new Date(key.expires_at).toLocaleDateString()}</span>
                      )}
                      <span>Créée: {new Date(key.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(key.key)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setKeyToDelete(key.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Key Dialog */}
      <AlertDialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Créer une clé d'activation</AlertDialogTitle>
            <AlertDialogDescription>
              Configurez les paramètres de la nouvelle clé d'activation
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type de clé</Label>
              <Select value={keyType} onValueChange={setKeyType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard - 7$/utilisateur/mois</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Nombre d'utilisateurs</Label>
              <Input
                type="number"
                min="1"
                value={numberOfUsers}
                onChange={(e) => setNumberOfUsers(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Durée</Label>
                <Input
                  type="number"
                  min="1"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Période</Label>
                <Select value={durationType} onValueChange={setDurationType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mois</SelectItem>
                    <SelectItem value="yearly">Année(s)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Montant total:</span>
                <span className="text-2xl font-bold text-primary">
                  ${calculateTotalAmount()} USD
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {numberOfUsers} utilisateur(s) × {duration} {durationType === "monthly" ? "mois" : "année(s)"} × $7
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateKey}>
              Créer la clé
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!keyToDelete} onOpenChange={() => setKeyToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la clé?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La clé ne pourra plus être utilisée pour activer des comptes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteKey}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Paiement de l'activation</DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full h-full">
            <iframe
              src={paymentUrl}
              className="w-full h-full border-0 rounded-lg"
              title="Payment Gateway"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
