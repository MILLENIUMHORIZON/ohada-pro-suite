import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Eye, Clock, DollarSign, Package, ArrowLeft, X, PackagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input as FormInput } from "@/components/ui/input";

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

interface BOMLine {
  id: string;
  bom_id: string;
  product_id: string;
  quantity: number;
  product_name?: string;
  product_sku?: string;
  product_type?: string;
}

export function BillOfMaterials() {
  const [boms, setBoms] = useState<BOM[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const { toast } = useToast();

  // Detail view
  const [selectedBom, setSelectedBom] = useState<BOM | null>(null);
  const [bomLines, setBomLines] = useState<BOMLine[]>([]);
  const [addLineForm, setAddLineForm] = useState({ product_id: "", quantity: 1 });

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
      setCompanyId(profile.company_id);

      const [bomsRes, finishedRes, allRes] = await Promise.all([
        (supabase.from("bill_of_materials" as any) as any).select("*, products(name, sku)").eq("company_id", profile.company_id).order("created_at", { ascending: false }),
        supabase.from("products").select("id, name, sku, type").eq("company_id", profile.company_id).in("type", ["finished", "semi_finished"]),
        supabase.from("products").select("id, name, sku, type").eq("company_id", profile.company_id).eq("active", true).order("name"),
      ]);

      if (bomsRes.data) {
        setBoms(bomsRes.data.map((b: any) => ({
          ...b,
          product_name: b.products?.name,
          product_sku: b.products?.sku,
        })));
      }
      setProducts(finishedRes.data || []);
      setAllProducts(allRes.data || []);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const { error } = await (supabase.from("bill_of_materials" as any) as any).insert({
        product_id: form.product_id,
        quantity: form.quantity,
        company_id: companyId,
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

  // BOM Lines management
  const openBomDetail = async (bom: BOM) => {
    setSelectedBom(bom);
    await loadBomLines(bom.id);
  };

  const loadBomLines = async (bomId: string) => {
    const { data } = await (supabase.from("bom_lines" as any) as any)
      .select("*, products(name, sku, type)")
      .eq("bom_id", bomId)
      .order("created_at");

    setBomLines((data || []).map((l: any) => ({
      ...l,
      product_name: l.products?.name,
      product_sku: l.products?.sku,
      product_type: l.products?.type,
    })));
  };

  const addBomLine = async () => {
    if (!selectedBom || !addLineForm.product_id) return;
    try {
      const { error } = await (supabase.from("bom_lines" as any) as any).insert({
        bom_id: selectedBom.id,
        product_id: addLineForm.product_id,
        quantity: addLineForm.quantity,
      });
      if (error) throw error;
      toast({ title: "Composant ajouté" });
      setAddLineForm({ product_id: "", quantity: 1 });
      await loadBomLines(selectedBom.id);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  const removeBomLine = async (lineId: string) => {
    const { error } = await (supabase.from("bom_lines" as any) as any).delete().eq("id", lineId);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else if (selectedBom) {
      await loadBomLines(selectedBom.id);
    }
  };

  const productTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      raw_material: "Matière première",
      semi_finished: "Semi-fini",
      finished: "Produit fini",
      consumable: "Consommable",
      spare_part: "Pièce détachée",
      service: "Service",
    };
    return labels[type] || type;
  };

  // Detail view
  if (selectedBom) {
    // Filter out the finished product itself from available components
    const availableComponents = allProducts.filter(p => p.id !== selectedBom.product_id);

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedBom(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <CardTitle>Nomenclature : {selectedBom.product_name}</CardTitle>
              <CardDescription>
                SKU: {selectedBom.product_sku} — Qté produite: {selectedBom.quantity}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add component form */}
          <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
            <h4 className="font-medium text-sm">Ajouter un composant / matière première</h4>
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs">Article</Label>
                <Select value={addLineForm.product_id} onValueChange={v => setAddLineForm(f => ({ ...f, product_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un article" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableComponents.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        [{p.sku}] {p.name} — {productTypeLabel(p.type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-32">
                <Label className="text-xs">Quantité nécessaire</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={addLineForm.quantity}
                  onChange={e => setAddLineForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                />
              </div>
              <Button onClick={addBomLine} disabled={!addLineForm.product_id}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter
              </Button>
            </div>
          </div>

          {/* Components list */}
          {bomLines.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="mx-auto h-10 w-10 mb-2 opacity-50" />
              <p>Aucun composant ajouté.</p>
              <p className="text-sm">Ajoutez les matières premières et composants nécessaires à la fabrication.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qté nécessaire</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bomLines.map(line => (
                  <TableRow key={line.id}>
                    <TableCell className="font-medium">{line.product_name}</TableCell>
                    <TableCell className="font-mono text-sm">{line.product_sku}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{productTypeLabel(line.product_type || "")}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{line.quantity}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeBomLine(line.id)}>
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    );
  }

  // List view
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
                      <Button variant="ghost" size="icon" onClick={() => openBomDetail(bom)} title="Voir les composants">
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
