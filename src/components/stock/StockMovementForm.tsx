import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

const MOVE_TYPES = [
  { value: "supplier_in", label: "Entrée fournisseur" },
  { value: "customer_out", label: "Sortie client" },
  { value: "transfer", label: "Transfert interne" },
  { value: "adjustment", label: "Ajustement inventaire" },
  { value: "scrap", label: "Rebut / Perte" },
  { value: "production_in", label: "Entrée production" },
  { value: "production_out", label: "Sortie production" },
];

interface StockMovementFormProps {
  onSuccess?: () => void;
}

export function StockMovementForm({ onSuccess }: StockMovementFormProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [availableStock, setAvailableStock] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    product_id: "",
    move_type: "supplier_in",
    from_location_id: "",
    to_location_id: "",
    qty: "",
    cost: "",
    reference: "",
    notes: "",
    validate_immediately: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formData.product_id && companyId) {
      loadAvailableStock();
    }
  }, [formData.product_id, companyId]);

  const loadData = async () => {
    const { data: profile } = await supabase.from("profiles").select("company_id").single();
    if (!profile?.company_id) return;
    setCompanyId(profile.company_id);

    const [prodRes, locRes] = await Promise.all([
      supabase.from("products").select("id, name, sku, cost_price, uom:uom(code)").eq("active", true).order("name"),
      supabase.from("stock_locations").select("id, name, type").eq("company_id", profile.company_id).order("name"),
    ]);

    setProducts(prodRes.data || []);
    setLocations(locRes.data || []);
  };

  const loadAvailableStock = async () => {
    const { data } = await supabase.from("stock_quants")
      .select("qty_on_hand, location:stock_locations(type)")
      .eq("product_id", formData.product_id)
      .eq("company_id", companyId);

    const total = (data || [])
      .filter((q: any) => q.location?.type === "internal")
      .reduce((sum: number, q: any) => sum + (q.qty_on_hand || 0), 0);
    setAvailableStock(total);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.product_id || !formData.from_location_id || !formData.to_location_id || !formData.qty) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    const qty = parseFloat(formData.qty);
    if (qty <= 0) {
      toast.error("La quantité doit être positive");
      return;
    }

    // Check stock for outgoing moves
    const outgoingTypes = ["customer_out", "production_out", "scrap"];
    if (outgoingTypes.includes(formData.move_type) && availableStock !== null && qty > availableStock) {
      toast.error(`Stock insuffisant. Disponible: ${availableStock}`);
      return;
    }

    setIsLoading(true);
    try {
      const selectedProduct = products.find(p => p.id === formData.product_id);
      const cost = formData.cost ? parseFloat(formData.cost) : (selectedProduct?.cost_price || 0);

      // Get next sequence number
      const { data: seqData } = await supabase.rpc("get_next_sequence_number", {
        p_company_id: companyId,
        p_code: "STK",
      });

      const { error } = await supabase.from("stock_moves").insert({
        product_id: formData.product_id,
        from_location_id: formData.from_location_id,
        to_location_id: formData.to_location_id,
        qty,
        cost,
        move_type: formData.move_type as any,
        state: formData.validate_immediately ? "done" : "draft",
        reference: seqData || `MVT-${Date.now()}`,
        origin: formData.reference || null,
        notes: formData.notes || null,
        company_id: companyId,
        responsible_id: (await supabase.auth.getUser()).data.user?.id,
      });

      if (error) throw error;

      toast.success(formData.validate_immediately 
        ? "Mouvement validé et stock mis à jour" 
        : "Mouvement créé en brouillon");
      
      setFormData({
        product_id: "", move_type: "supplier_in", from_location_id: "", to_location_id: "",
        qty: "", cost: "", reference: "", notes: "", validate_immediately: true,
      });
      setAvailableStock(null);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la création du mouvement");
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-select locations based on move type
  useEffect(() => {
    const supplierLoc = locations.find(l => l.type === "supplier");
    const customerLoc = locations.find(l => l.type === "customer");
    const scrapLoc = locations.find(l => l.type === "scrap");
    const internalLoc = locations.find(l => l.type === "internal");

    switch (formData.move_type) {
      case "supplier_in":
        if (supplierLoc) setFormData(f => ({ ...f, from_location_id: supplierLoc.id }));
        break;
      case "customer_out":
        if (customerLoc) setFormData(f => ({ ...f, to_location_id: customerLoc.id }));
        break;
      case "scrap":
        if (scrapLoc) setFormData(f => ({ ...f, to_location_id: scrapLoc.id }));
        break;
    }
  }, [formData.move_type, locations]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Type de mouvement *</Label>
          <Select value={formData.move_type} onValueChange={v => setFormData(f => ({ ...f, move_type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MOVE_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Article *</Label>
          <Select value={formData.product_id} onValueChange={v => setFormData(f => ({ ...f, product_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Sélectionner un article" /></SelectTrigger>
            <SelectContent>
              {products.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  [{p.sku}] {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {availableStock !== null && (
            <p className="text-xs text-muted-foreground">
              Stock disponible: <span className={availableStock <= 0 ? "text-destructive font-bold" : "font-medium"}>{availableStock}</span>
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Emplacement source *</Label>
          <Select value={formData.from_location_id} onValueChange={v => setFormData(f => ({ ...f, from_location_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>
              {locations.map(l => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name} ({l.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Emplacement destination *</Label>
          <Select value={formData.to_location_id} onValueChange={v => setFormData(f => ({ ...f, to_location_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Destination" /></SelectTrigger>
            <SelectContent>
              {locations.map(l => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name} ({l.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Quantité *</Label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={formData.qty}
            onChange={e => setFormData(f => ({ ...f, qty: e.target.value }))}
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <Label>Coût unitaire</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.cost}
            onChange={e => setFormData(f => ({ ...f, cost: e.target.value }))}
            placeholder="Auto (coût article)"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Référence / Justificatif</Label>
        <Input
          value={formData.reference}
          onChange={e => setFormData(f => ({ ...f, reference: e.target.value }))}
          placeholder="N° bon de livraison, facture..."
        />
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          value={formData.notes}
          onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
          placeholder="Observations..."
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="validate"
          checked={formData.validate_immediately}
          onChange={e => setFormData(f => ({ ...f, validate_immediately: e.target.checked }))}
          className="rounded border-input"
        />
        <Label htmlFor="validate" className="text-sm cursor-pointer">
          Valider immédiatement (mettre à jour le stock)
        </Label>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Enregistrement..." : "Enregistrer le mouvement"}
        </Button>
      </div>
    </form>
  );
}
