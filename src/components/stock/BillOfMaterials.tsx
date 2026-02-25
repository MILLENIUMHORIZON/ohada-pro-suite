import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Eye, Clock, DollarSign, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BOM {
  id: string;
  product_id: string;
  product_name?: string;
  product_sku?: string;
  quantity: number;
  total_duration_minutes: number;
  total_estimated_cost: number;
  created_at: string;
}

export function BillOfMaterials() {
  const [boms, setBoms] = useState<BOM[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({ product_id: "", quantity: 1 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
      if (!profile?.company_id) return;

      const [bomsRes, productsRes] = await Promise.all([
        (supabase.from("bill_of_materials" as any) as any).select("*, products(name, sku)").eq("company_id", profile.company_id).order("created_at", { ascending: false }),
        supabase.from("products").select("id, name, sku, type").eq("company_id", profile.company_id).in("type", ["finished", "semi_finished"]),
      ]);

      if (bomsRes.data) {
        setBoms(bomsRes.data.map((b: any) => ({
          ...b,
          product_name: b.products?.name,
          product_sku: b.products?.sku,
        })));
      }
      setProducts(productsRes.data || []);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
      if (!profile?.company_id) return;

      const { error } = await (supabase.from("bill_of_materials" as any) as any).insert({
        product_id: form.product_id,
        quantity: form.quantity,
        company_id: profile.company_id,
      });

      if (error) throw error;
      toast({ title: "Nomenclature créée" });
      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette nomenclature ?")) return;
    const { error } = await (supabase.from("bill_of_materials" as any) as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Nomenclature supprimée" });
      loadData();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Nomenclatures (BOM)</CardTitle>
            <CardDescription>Bill of Materials – composition des produits finis et semi-finis</CardDescription>
          </div>
          <Button onClick={() => { setForm({ product_id: "", quantity: 1 }); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle Nomenclature
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-center py-8">Chargement...</p>
        ) : boms.length === 0 ? (
          <div className="text-center py-8">
            <Package className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Aucune nomenclature configurée.</p>
            <p className="text-sm text-muted-foreground">Créez une nomenclature pour définir la composition d'un produit fini.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Qté produite</TableHead>
                <TableHead>Durée totale</TableHead>
                <TableHead>Coût estimé</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {boms.map((bom) => (
                <TableRow key={bom.id}>
                  <TableCell className="font-medium">{bom.product_name || "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{bom.product_sku || "—"}</TableCell>
                  <TableCell>{bom.quantity}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {bom.total_duration_minutes} min
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-muted-foreground" />
                      {bom.total_estimated_cost.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(bom.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle Nomenclature</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Produit fini / semi-fini</Label>
              <Select value={form.product_id} onValueChange={v => setForm({ ...form, product_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un produit" />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.sku}) – {p.type === "finished" ? "Produit fini" : "Semi-fini"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantité produite par nomenclature</Label>
              <Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} min={1} />
            </div>
            <Button onClick={handleCreate} className="w-full" disabled={!form.product_id}>
              Créer la nomenclature
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
