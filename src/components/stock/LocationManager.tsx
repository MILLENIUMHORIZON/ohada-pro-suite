import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

const LOCATION_TYPES = [
  { value: "internal", label: "Interne (Entrepôt)" },
  { value: "supplier", label: "Fournisseur" },
  { value: "customer", label: "Client" },
  { value: "transit", label: "Transit" },
  { value: "scrap", label: "Rebut" },
];

export function LocationManager() {
  const [locations, setLocations] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("internal");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    const { data: profile } = await supabase.from("profiles").select("company_id").single();
    if (!profile?.company_id) return;
    setCompanyId(profile.company_id);

    const { data } = await supabase.from("stock_locations")
      .select("*")
      .eq("company_id", profile.company_id)
      .order("type").order("name");
    setLocations(data || []);
  };

  const addLocation = async () => {
    if (!newName.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    setIsAdding(true);
    const { error } = await supabase.from("stock_locations").insert({
      name: newName.trim(),
      type: newType as any,
      company_id: companyId,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Emplacement créé");
      setNewName("");
      loadLocations();
    }
    setIsAdding(false);
  };

  const deleteLocation = async (id: string) => {
    // Check if used in quants
    const { data: quants } = await supabase.from("stock_quants")
      .select("id").eq("location_id", id).limit(1);
    if (quants && quants.length > 0) {
      toast.error("Cet emplacement contient du stock et ne peut pas être supprimé");
      return;
    }
    const { error } = await supabase.from("stock_locations").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Emplacement supprimé");
      loadLocations();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-1">
          <Label>Nom</Label>
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Entrepôt Principal" />
        </div>
        <div className="w-48 space-y-1">
          <Label>Type</Label>
          <Select value={newType} onValueChange={setNewType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LOCATION_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={addLocation} disabled={isAdding}>
          <Plus className="mr-2 h-4 w-4" />Ajouter
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Type</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {locations.map(l => (
            <TableRow key={l.id}>
              <TableCell className="font-medium">{l.name}</TableCell>
              <TableCell>
                <Badge variant="outline">
                  {LOCATION_TYPES.find(t => t.value === l.type)?.label || l.type}
                </Badge>
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={() => deleteLocation(l.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {locations.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                Aucun emplacement configuré. Créez au moins un emplacement interne.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
