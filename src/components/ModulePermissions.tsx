import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ModulePermissionsProps = {
  userId: string;
};

const AVAILABLE_MODULES = [
  { id: "dashboard", name: "Dashboard" },
  { id: "crm", name: "CRM" },
  { id: "proforma", name: "Pro Forma" },
  { id: "procurement", name: "Approvisionnements" },
  { id: "invoicing", name: "Facturation" },
  { id: "stock", name: "Stock" },
  { id: "accounting", name: "Comptabilité" },
  { id: "reference-data", name: "Données de Référence" },
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

  if (loading) {
    return <div className="text-sm text-muted-foreground">Chargement...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Modules Autorisés</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {AVAILABLE_MODULES.map((module) => (
            <div key={module.id} className="flex items-center space-x-2">
              <Checkbox
                id={`${userId}-${module.id}`}
                checked={permissions.includes(module.id)}
                onCheckedChange={(checked) =>
                  togglePermission(module.id, checked as boolean)
                }
              />
              <Label
                htmlFor={`${userId}-${module.id}`}
                className="text-sm font-normal cursor-pointer"
              >
                {module.name}
              </Label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
