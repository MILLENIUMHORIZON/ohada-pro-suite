import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Eye, Clock, DollarSign, Package, ArrowLeft, X, PackagePlus, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ProductionFlowDiagram } from "./ProductionFlowDiagram";

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
  uom_code?: string;
  bom_step_id?: string | null;
}

interface BOMStep {
  id: string;
  bom_id: string;
  step_id: string;
  step_order: number;
  duration_minutes: number;
  step_name?: string;
  step_code?: string;
  labor_required?: number;
  machines?: string[];
}

interface ProductionStepOption {
  id: string;
  code: string;
  name: string;
  duration_minutes: number;
  labor_required: number;
  machine: string | null;
  machine_hourly_cost: number;
  labor_hourly_cost: number;
}

export function BillOfMaterials() {
  const [boms, setBoms] = useState<BOM[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [productionSteps, setProductionSteps] = useState<ProductionStepOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const { toast } = useToast();

  // Detail view
  const [selectedBom, setSelectedBom] = useState<BOM | null>(null);
  const [bomLines, setBomLines] = useState<BOMLine[]>([]);
  const [bomSteps, setBomSteps] = useState<BOMStep[]>([]);
  const [addLineForm, setAddLineForm] = useState({ product_id: "", quantity: 1 });
  const [addStepForm, setAddStepForm] = useState({ step_id: "", duration_minutes: 0 });

  // Quick stock entry
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [stockProduct, setStockProduct] = useState<{ id: string; name: string } | null>(null);
  const [stockForm, setStockForm] = useState({ qty: 1, cost: 0 });
  const [internalLocations, setInternalLocations] = useState<any[]>([]);
  const [supplierLocations, setSupplierLocations] = useState<any[]>([]);
  const [stockLocationId, setStockLocationId] = useState("");
  const [stockFromLocationId, setStockFromLocationId] = useState("");

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

      const [bomsRes, finishedRes, allRes, locationsRes, stepsRes] = await Promise.all([
        (supabase.from("bill_of_materials" as any) as any).select("*, products(name, sku)").eq("company_id", profile.company_id).order("created_at", { ascending: false }),
        supabase.from("products").select("id, name, sku, type").eq("company_id", profile.company_id).in("type", ["finished", "semi_finished"]),
        supabase.from("products").select("id, name, sku, type").eq("company_id", profile.company_id).eq("active", true).order("name"),
        supabase.from("stock_locations").select("id, name, type").eq("company_id", profile.company_id),
        (supabase.from("production_steps" as any) as any).select("*").eq("company_id", profile.company_id).order("code"),
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
      setProductionSteps((stepsRes.data as any[]) || []);
      if (locationsRes.data) {
        setInternalLocations(locationsRes.data.filter((l: any) => l.type === 'internal'));
        setSupplierLocations(locationsRes.data.filter((l: any) => l.type === 'supplier'));
      }
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

  // BOM detail
  const openBomDetail = async (bom: BOM) => {
    setSelectedBom(bom);
    await Promise.all([loadBomLines(bom.id), loadBomSteps(bom.id)]);
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

  const loadBomSteps = async (bomId: string) => {
    const { data } = await (supabase.from("bom_steps" as any) as any)
      .select("*, production_steps(name, code, duration_minutes, labor_required, machine)")
      .eq("bom_id", bomId)
      .order("step_order");

    const stepsData = (data || []).map((s: any) => ({
      ...s,
      step_name: s.production_steps?.name,
      step_code: s.production_steps?.code,
      labor_required: s.production_steps?.labor_required,
      machines: s.production_steps?.machine ? s.production_steps.machine.split(", ").filter(Boolean) : [],
    }));
    setBomSteps(stepsData);

    // Update BOM total duration
    const totalDuration = stepsData.reduce((sum: number, s: any) => sum + s.duration_minutes, 0);
    if (selectedBom || bomId) {
      await (supabase.from("bill_of_materials" as any) as any)
        .update({ total_duration_minutes: totalDuration })
        .eq("id", bomId);
    }
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

  const addBomStep = async () => {
    if (!selectedBom || !addStepForm.step_id) return;
    try {
      const step = productionSteps.find(s => s.id === addStepForm.step_id);
      const nextOrder = bomSteps.length > 0 ? Math.max(...bomSteps.map(s => s.step_order)) + 1 : 1;
      const duration = addStepForm.duration_minutes || step?.duration_minutes || 0;

      const { error } = await (supabase.from("bom_steps" as any) as any).insert({
        bom_id: selectedBom.id,
        step_id: addStepForm.step_id,
        step_order: nextOrder,
        duration_minutes: duration,
      });
      if (error) throw error;
      toast({ title: "Étape ajoutée" });
      setAddStepForm({ step_id: "", duration_minutes: 0 });
      await loadBomSteps(selectedBom.id);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  const removeBomStep = async (stepId: string) => {
    if (!selectedBom) return;
    const { error } = await (supabase.from("bom_steps" as any) as any).delete().eq("id", stepId);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      await loadBomSteps(selectedBom.id);
    }
  };

  const onStepSelected = (stepId: string) => {
    const step = productionSteps.find(s => s.id === stepId);
    setAddStepForm({ step_id: stepId, duration_minutes: step?.duration_minutes || 0 });
  };

  const openQuickStock = (productId: string, productName: string) => {
    setStockProduct({ id: productId, name: productName });
    setStockForm({ qty: 1, cost: 0 });
    setStockLocationId(internalLocations[0]?.id || "");
    setStockFromLocationId(supplierLocations[0]?.id || "");
    setStockDialogOpen(true);
  };

  const handleQuickStockEntry = async () => {
    if (!stockProduct || !stockLocationId || !stockFromLocationId) return;
    try {
      const { error } = await supabase.from("stock_moves").insert({
        product_id: stockProduct.id,
        qty: stockForm.qty,
        cost: stockForm.cost,
        from_location_id: stockFromLocationId,
        to_location_id: stockLocationId,
        company_id: companyId,
        move_type: "supplier_in" as any,
        state: "done" as any,
        origin: "BOM Quick Entry",
      } as any);
      if (error) throw error;
      toast({ title: "Stock ajouté", description: `${stockForm.qty} unité(s) de ${stockProduct.name} ajoutées.` });
      setStockDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
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

  const totalStepsDuration = bomSteps.reduce((sum, s) => sum + s.duration_minutes, 0);

  // Detail view
  if (selectedBom) {
    const availableComponents = allProducts.filter(p => p.id !== selectedBom.product_id);
    const availableSteps = productionSteps.filter(ps => !bomSteps.some(bs => bs.step_id === ps.id));

    return (
      <>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setSelectedBom(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <CardTitle>Nomenclature : {selectedBom.product_name}</CardTitle>
                <CardDescription>
                  SKU: {selectedBom.product_sku} — Qté produite: {selectedBom.quantity}
                </CardDescription>
              </div>
              {totalStepsDuration > 0 && (
                <Badge variant="secondary" className="text-sm">
                  <Clock className="h-3 w-3 mr-1" />
                  {totalStepsDuration} min
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Components section */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Package className="h-4 w-4" />
                Composants / Matières premières
              </h4>
              <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                <div className="flex gap-3 items-end flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <Label className="text-xs">Article</Label>
                    <Select value={addLineForm.product_id} onValueChange={v => setAddLineForm(f => ({ ...f, product_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner un article" /></SelectTrigger>
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
                    <Label className="text-xs">Quantité</Label>
                    <Input type="number" min="0.01" step="0.01" value={addLineForm.quantity}
                      onChange={e => setAddLineForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
                  </div>
                  <Button onClick={addBomLine} disabled={!addLineForm.product_id}>
                    <Plus className="mr-2 h-4 w-4" />Ajouter
                  </Button>
                </div>
              </div>

              {bomLines.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Article</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Qté</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bomLines.map(line => (
                      <TableRow key={line.id}>
                        <TableCell className="font-medium">{line.product_name}</TableCell>
                        <TableCell className="font-mono text-sm">{line.product_sku}</TableCell>
                        <TableCell><Badge variant="outline">{productTypeLabel(line.product_type || "")}</Badge></TableCell>
                        <TableCell className="text-right font-medium">{line.quantity}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openQuickStock(line.product_id, line.product_name || "")} title="Ajouter du stock">
                              <PackagePlus className="h-4 w-4 text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => removeBomLine(line.id)} title="Retirer">
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Steps section */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Étapes de fabrication (ordre de production)
              </h4>
              <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                <div className="flex gap-3 items-end flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <Label className="text-xs">Étape de production</Label>
                    <Select value={addStepForm.step_id} onValueChange={onStepSelected}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner une étape" /></SelectTrigger>
                      <SelectContent>
                        {availableSteps.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            [{s.code}] {s.name} — {s.duration_minutes} min
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-32">
                    <Label className="text-xs">Durée (min)</Label>
                    <Input type="number" min="1" value={addStepForm.duration_minutes}
                      onChange={e => setAddStepForm(f => ({ ...f, duration_minutes: Number(e.target.value) }))} />
                  </div>
                  <Button onClick={addBomStep} disabled={!addStepForm.step_id}>
                    <Plus className="mr-2 h-4 w-4" />Ajouter
                  </Button>
                </div>
              </div>

              {bomSteps.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Ordre</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Étape</TableHead>
                      <TableHead>Machines</TableHead>
                      <TableHead className="text-right">Durée</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bomSteps.map(step => (
                      <TableRow key={step.id}>
                        <TableCell>
                          <Badge variant="outline">{step.step_order}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{step.step_code}</TableCell>
                        <TableCell className="font-medium">{step.step_name}</TableCell>
                        <TableCell>
                          {step.machines && step.machines.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {step.machines.map((m, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">{m}</Badge>
                              ))}
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{step.duration_minutes} min</Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeBomStep(step.id)}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2">
                      <TableCell colSpan={4} className="text-right font-bold">Durée totale estimée</TableCell>
                      <TableCell className="text-right font-bold">
                        <Badge><Clock className="h-3 w-3 mr-1" />{totalStepsDuration} min</Badge>
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Production Flow Diagram */}
            {bomSteps.length > 0 && (
              <ProductionFlowDiagram
                productName={selectedBom.product_name || ""}
                quantity={selectedBom.quantity}
                totalDuration={totalStepsDuration}
                steps={bomSteps.map(s => ({
                  step_order: s.step_order,
                  step_name: s.step_name || "",
                  step_code: s.step_code || "",
                  duration_minutes: s.duration_minutes,
                  machines: s.machines || [],
                  labor_required: s.labor_required || 1,
                }))}
              />
            )}
          </CardContent>
        </Card>

        {/* Quick Stock Dialog */}
        <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Ajouter du stock : {stockProduct?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Destination (dépôt)</Label>
                <Select value={stockLocationId} onValueChange={setStockLocationId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un dépôt" /></SelectTrigger>
                  <SelectContent>
                    {internalLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Source (fournisseur)</Label>
                <Select value={stockFromLocationId} onValueChange={setStockFromLocationId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner une source" /></SelectTrigger>
                  <SelectContent>
                    {supplierLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantité</Label>
                  <Input type="number" min={0.01} value={stockForm.qty} onChange={e => setStockForm(f => ({ ...f, qty: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label>Coût unitaire</Label>
                  <Input type="number" min={0} value={stockForm.cost} onChange={e => setStockForm(f => ({ ...f, cost: Number(e.target.value) }))} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleQuickStockEntry} disabled={!stockLocationId || !stockFromLocationId || stockForm.qty <= 0} className="w-full">
                  <PackagePlus className="mr-2 h-4 w-4" />Valider
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // List view
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Nomenclatures (BOM)</CardTitle>
            <CardDescription>Composition des produits finis avec étapes de fabrication</CardDescription>
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
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Qté</TableHead>
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
                      <Button variant="ghost" size="icon" onClick={() => openBomDetail(bom)} title="Détails">
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
                <SelectTrigger><SelectValue placeholder="Sélectionner un produit" /></SelectTrigger>
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
