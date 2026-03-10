import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, CheckCircle, XCircle, Factory, Eye, ArrowLeft, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { ProductionFlowDiagram } from "./ProductionFlowDiagram";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Brouillon", variant: "outline" },
  in_progress: { label: "En cours", variant: "default" },
  done: { label: "Terminé", variant: "secondary" },
  cancelled: { label: "Annulé", variant: "destructive" },
};

export function ManufacturingOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [userId, setUserId] = useState("");
  const { toast } = useToast();

  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [bomLines, setBomLines] = useState<any[]>([]);
  const [bomSteps, setBomSteps] = useState<any[]>([]);
  const [totalStepsDuration, setTotalStepsDuration] = useState(0);

  const [form, setForm] = useState({
    product_id: "",
    quantity: 1,
    responsible: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
      if (!profile?.company_id) return;
      setCompanyId(profile.company_id);

      const [ordersRes, productsRes] = await Promise.all([
        (supabase.from("manufacturing_orders" as any) as any).select("*, products(name, sku)").eq("company_id", profile.company_id).order("created_at", { ascending: false }),
        supabase.from("products").select("id, name, sku, type").eq("company_id", profile.company_id).in("type", ["finished", "semi_finished"]),
      ]);

      setOrders(ordersRes.data || []);
      setProducts(productsRes.data || []);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const year = new Date().getFullYear();
      const { count } = await (supabase.from("manufacturing_orders" as any) as any).select("*", { count: "exact", head: true }).eq("company_id", companyId);
      const number = `OF-${year}-${String((count || 0) + 1).padStart(5, "0")}`;

      const { error } = await (supabase.from("manufacturing_orders" as any) as any).insert({
        number,
        product_id: form.product_id,
        quantity: form.quantity,
        responsible: form.responsible || null,
        company_id: companyId,
        status: "draft",
        launch_date: new Date().toISOString().split("T")[0],
      });

      if (error) throw error;
      toast({ title: "Ordre de fabrication créé", description: number });
      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  const updateStatus = async (id: string, status: string) => {
    if (status === "done") {
      await completeManufacturingOrder(id);
      return;
    }
    const { error } = await (supabase.from("manufacturing_orders" as any) as any).update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Ordre ${statusLabels[status]?.label || status}` });
      loadData();
    }
  };

  const completeManufacturingOrder = async (orderId: string) => {
    try {
      const { data: order } = await (supabase.from("manufacturing_orders" as any) as any)
        .select("*, products(name, sku, cost_price)")
        .eq("id", orderId)
        .single();
      if (!order) throw new Error("Ordre non trouvé");

      const { data: bom } = await (supabase.from("bill_of_materials" as any) as any)
        .select("id, quantity")
        .eq("product_id", order.product_id)
        .eq("company_id", companyId)
        .single();

      if (!bom) {
        toast({ title: "Erreur", description: "Aucune nomenclature trouvée pour ce produit.", variant: "destructive" });
        return;
      }

      const { data: components } = await (supabase.from("bom_lines" as any) as any)
        .select("*, products(name, sku, cost_price)")
        .eq("bom_id", bom.id);

      if (!components || components.length === 0) {
        toast({ title: "Erreur", description: "La nomenclature n'a aucun composant.", variant: "destructive" });
        return;
      }

      const multiplier = order.quantity / (bom.quantity || 1);

      const { data: locations } = await supabase.from("stock_locations")
        .select("id, type").eq("company_id", companyId);

      const internalLoc = locations?.find(l => l.type === "internal");
      const productionLoc = locations?.find(l => (l.type as string) === "production");

      if (!internalLoc) {
        toast({ title: "Erreur", description: "Aucun emplacement interne trouvé.", variant: "destructive" });
        return;
      }

      const sourceLoc = internalLoc.id;
      const destLoc = productionLoc?.id || internalLoc.id;

      for (const comp of components) {
        const neededQty = comp.quantity * multiplier;
        const { data: stockData } = await supabase.from("stock_quants")
          .select("qty_on_hand")
          .eq("product_id", comp.product_id)
          .eq("company_id", companyId);

        const totalStock = (stockData || []).reduce((sum: number, q: any) => sum + (q.qty_on_hand || 0), 0);
        if (totalStock < neededQty) {
          toast({ title: "Stock insuffisant", description: `${comp.products?.name}: besoin de ${neededQty}, disponible: ${totalStock}`, variant: "destructive" });
          return;
        }
      }

      let totalCost = 0;
      for (const comp of components) {
        const neededQty = comp.quantity * multiplier;
        const cost = comp.products?.cost_price || 0;
        totalCost += cost * neededQty;

        await supabase.from("stock_moves").insert({
          product_id: comp.product_id,
          from_location_id: sourceLoc,
          to_location_id: destLoc !== sourceLoc ? destLoc : sourceLoc,
          qty: neededQty,
          cost,
          move_type: "production_out" as any,
          state: "done" as any,
          reference: order.number,
          origin: `Consommation OF ${order.number}`,
          notes: `Composant pour fabrication de ${order.products?.name}`,
          company_id: companyId,
          responsible_id: userId,
        });
      }

      await supabase.from("stock_moves").insert({
        product_id: order.product_id,
        from_location_id: destLoc !== sourceLoc ? destLoc : sourceLoc,
        to_location_id: sourceLoc,
        qty: order.quantity,
        cost: totalCost / order.quantity,
        move_type: "production_in" as any,
        state: "done" as any,
        reference: order.number,
        origin: `Production OF ${order.number}`,
        notes: `Production de ${order.quantity} x ${order.products?.name}`,
        company_id: companyId,
        responsible_id: userId,
      });

      await (supabase.from("manufacturing_orders" as any) as any).update({
        status: "done",
        completion_date: new Date().toISOString().split("T")[0],
        actual_cost: totalCost,
      }).eq("id", orderId);

      sonnerToast.success(`Production terminée : ${order.quantity} x ${order.products?.name}`);
      loadData();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  const viewOrderDetail = async (order: any) => {
    setSelectedOrder(order);
    const { data: bom } = await (supabase.from("bill_of_materials" as any) as any)
      .select("id, quantity")
      .eq("product_id", order.product_id)
      .eq("company_id", companyId)
      .single();

    if (bom) {
      const [linesRes, stepsRes] = await Promise.all([
        (supabase.from("bom_lines" as any) as any)
          .select("*, products(name, sku, type, cost_price)")
          .eq("bom_id", bom.id),
        (supabase.from("bom_steps" as any) as any)
          .select("*, production_steps(name, code, duration_minutes, labor_required, machine)")
          .eq("bom_id", bom.id)
          .order("step_order"),
      ]);

      const multiplier = order.quantity / (bom.quantity || 1);
      setBomLines((linesRes.data || []).map((l: any) => ({
        ...l,
        needed_qty: l.quantity * multiplier,
        product_name: l.products?.name,
        product_sku: l.products?.sku,
        product_type: l.products?.type,
        cost_price: l.products?.cost_price || 0,
      })));

      const stepsData = (stepsRes.data || []).map((s: any) => ({
        ...s,
        step_name: s.production_steps?.name,
        step_code: s.production_steps?.code,
        labor_required: s.production_steps?.labor_required || 1,
        machines: s.production_steps?.machine ? s.production_steps.machine.split(", ").filter(Boolean) : [],
      }));
      setBomSteps(stepsData);
      setTotalStepsDuration(stepsData.reduce((sum: number, s: any) => sum + s.duration_minutes, 0));
    } else {
      setBomLines([]);
      setBomSteps([]);
      setTotalStepsDuration(0);
    }
  };

  // Detail view
  if (selectedOrder) {
    const st = statusLabels[selectedOrder.status] || statusLabels.draft;
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setSelectedOrder(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2">
                  {selectedOrder.number}
                  <Badge variant={st.variant}>{st.label}</Badge>
                </CardTitle>
                <CardDescription>
                  Produit: {selectedOrder.products?.name} — Quantité: {selectedOrder.quantity}
                  {selectedOrder.responsible && ` — Responsable: ${selectedOrder.responsible}`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <h4 className="font-medium mb-3">Composants nécessaires</h4>
            {bomLines.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground border rounded-lg">
                <Package className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p>Aucune nomenclature trouvée pour ce produit.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Composant</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qté/unité</TableHead>
                    <TableHead className="text-right">Qté totale</TableHead>
                    <TableHead className="text-right">Coût unit.</TableHead>
                    <TableHead className="text-right">Coût total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bomLines.map((line: any) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-medium">{line.product_name}</TableCell>
                      <TableCell className="font-mono text-sm">{line.product_sku}</TableCell>
                      <TableCell><Badge variant="outline">{line.product_type}</Badge></TableCell>
                      <TableCell className="text-right">{line.quantity}</TableCell>
                      <TableCell className="text-right font-medium">{line.needed_qty}</TableCell>
                      <TableCell className="text-right">{new Intl.NumberFormat("fr-FR").format(line.cost_price)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {new Intl.NumberFormat("fr-FR").format(line.cost_price * line.needed_qty)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2">
                    <TableCell colSpan={6} className="text-right font-bold">Coût total estimé</TableCell>
                    <TableCell className="text-right font-bold">
                      {new Intl.NumberFormat("fr-FR").format(
                        bomLines.reduce((sum: number, l: any) => sum + (l.cost_price * l.needed_qty), 0)
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Production Flow Diagram */}
        {bomSteps.length > 0 && (
          <ProductionFlowDiagram
            productName={selectedOrder.products?.name || ""}
            quantity={selectedOrder.quantity}
            totalDuration={totalStepsDuration}
            steps={bomSteps.map((s: any) => ({
              step_order: s.step_order,
              step_name: s.step_name || "",
              step_code: s.step_code || "",
              duration_minutes: s.duration_minutes,
              machines: s.machines || [],
              labor_required: s.labor_required || 1,
            }))}
          />
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Ordres de Fabrication</CardTitle>
            <CardDescription>Planifiez et suivez la production industrielle</CardDescription>
          </div>
          <Button onClick={() => { setForm({ product_id: "", quantity: 1, responsible: "" }); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvel OF
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-center py-8">Chargement...</p>
        ) : orders.length === 0 ? (
          <div className="text-center py-8">
            <Factory className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Aucun ordre de fabrication.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° OF</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>Quantité</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const st = statusLabels[order.status] || statusLabels.draft;
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono font-medium">{order.number}</TableCell>
                    <TableCell>{order.products?.name || "—"}</TableCell>
                    <TableCell>{order.quantity}</TableCell>
                    <TableCell>{order.responsible || "—"}</TableCell>
                    <TableCell>{order.launch_date}</TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" title="Détails" onClick={() => viewOrderDetail(order)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {order.status === "draft" && (
                          <Button variant="ghost" size="icon" title="Lancer" onClick={() => updateStatus(order.id, "in_progress")}>
                            <Play className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        {order.status === "in_progress" && (
                          <Button variant="ghost" size="icon" title="Terminer" onClick={() => updateStatus(order.id, "done")}>
                            <CheckCircle className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        {order.status !== "done" && order.status !== "cancelled" && (
                          <Button variant="ghost" size="icon" title="Annuler" onClick={() => updateStatus(order.id, "cancelled")}>
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel Ordre de Fabrication</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Produit à fabriquer</Label>
              <Select value={form.product_id} onValueChange={v => setForm({ ...form, product_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un produit" /></SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantité à produire</Label>
              <Input type="number" min={1} value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Responsable</Label>
              <Input value={form.responsible} onChange={e => setForm({ ...form, responsible: e.target.value })} placeholder="Optionnel" />
            </div>
            <Button onClick={handleCreate} className="w-full" disabled={!form.product_id}>
              Créer l'ordre de fabrication
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
