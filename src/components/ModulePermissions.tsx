import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckSquare, Square } from "lucide-react";

type ModulePermissionsProps = {
  userId: string;
};

const AVAILABLE_MODULES = [
  { id: "dashboard", name: "Dashboard", description: "Vue d'ensemble et statistiques" },
  { id: "crm", name: "CRM", description: "Gestion relation client" },
  { id: "proforma", name: "Pro Forma", description: "Factures pro forma" },
  { id: "procurement", name: "Approvisionnements", description: "Achats et fournisseurs" },
  { id: "invoicing", name: "Facturation", description: "Facturation client" },
  { id: "stock", name: "Stock", description: "Gestion des stocks" },
  { id: "accounting", name: "Comptabilité", description: "Comptabilité générale" },
  { id: "reference-data", name: "Données de Référence", description: "Configuration de base" },
];

export default function ModulePermissions({ userId }: ModulePermissionsProps) {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPermissions();
  }, [userId]);

  const loadPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from("user_module_permissions")
        .select("module")
        .eq("user_id", userId);

      if (error) throw error;

      setPermissions(data?.map((p) => p.module) || []);
    } catch (error: any) {
      console.error("Error loading permissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = async (moduleId: string, checked: boolean) => {
    try {
      if (checked) {
        // Add permission
        const { error } = await supabase
          .from("user_module_permissions")
          .insert([{ user_id: userId, module: moduleId }]);

        if (error) throw error;
        setPermissions([...permissions, moduleId]);
        toast.success("Permission ajoutée");
      } else {
        // Remove permission
        const { error } = await supabase
          .from("user_module_permissions")
          .delete()
          .eq("user_id", userId)
          .eq("module", moduleId);

        if (error) throw error;
        setPermissions(permissions.filter((p) => p !== moduleId));
        toast.success("Permission retirée");
      }
    } catch (error: any) {
      console.error("Error updating permission:", error);
      toast.error("Erreur lors de la mise à jour de la permission");
    }
  };

  const selectAll = async () => {
    try {
      const modulesToAdd = AVAILABLE_MODULES.filter(m => !permissions.includes(m.id));
      
      if (modulesToAdd.length === 0) {
        toast.info("Toutes les permissions sont déjà attribuées");
        return;
      }

      const { error } = await supabase
        .from("user_module_permissions")
        .insert(modulesToAdd.map(m => ({ user_id: userId, module: m.id })));

      if (error) throw error;

      setPermissions(AVAILABLE_MODULES.map(m => m.id));
      toast.success("Tous les modules ont été activés");
    } catch (error: any) {
      console.error("Error selecting all:", error);
      toast.error("Erreur lors de l'activation des modules");
    }
  };

  const deselectAll = async () => {
    try {
      if (permissions.length === 0) {
        toast.info("Aucune permission à retirer");
        return;
      }

      const { error } = await supabase
        .from("user_module_permissions")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;

      setPermissions([]);
      toast.success("Tous les modules ont été désactivés");
    } catch (error: any) {
      console.error("Error deselecting all:", error);
      toast.error("Erreur lors de la désactivation des modules");
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Chargement...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">Modules Autorisés</CardTitle>
            <CardDescription className="text-xs mt-1">
              {permissions.length} / {AVAILABLE_MODULES.length} modules activés
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              disabled={permissions.length === AVAILABLE_MODULES.length}
            >
              <CheckSquare className="h-3 w-3 mr-1" />
              Tout sélectionner
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deselectAll}
              disabled={permissions.length === 0}
            >
              <Square className="h-3 w-3 mr-1" />
              Tout désélectionner
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AVAILABLE_MODULES.map((module) => (
            <div
              key={module.id}
              className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
            >
              <Checkbox
                id={`${userId}-${module.id}`}
                checked={permissions.includes(module.id)}
                onCheckedChange={(checked) =>
                  togglePermission(module.id, checked as boolean)
                }
                className="mt-1"
              />
              <div className="flex-1">
                <Label
                  htmlFor={`${userId}-${module.id}`}
                  className="text-sm font-medium cursor-pointer"
                >
                  {module.name}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {module.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
