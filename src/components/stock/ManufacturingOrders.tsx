import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Play, CheckCircle, XCircle, Factory, Eye, ArrowLeft, Package, SkipForward } from "lucide-react";
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
  const [orderSteps, setOrderSteps] = useState<any[]>([]);
  const [bomLines, setBomLines] = useState<any[]>([]);

  const [form, setForm] = useState({
    product_id: "",
    quantity: 1,
    responsible: "",
  });

  useEffect(() => { loadData(); }, []);

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

  const launchOrder = async (orderId: string) => {
    try {
      // Get order details
      const { data: order } = await (supabase.from("manufacturing_orders" as any) as any)
        .select("*").eq("id", orderId).single();
      if (!order) throw new Error("Ordre non trouvé");

      // Get BOM
      const { data: bom } = await (supabase.from("bill_of_materials" as any) as any)
        .select("id").eq("product_id", order.product_id).eq("company_id", companyId).single();

      if (bom) {
        // Get BOM steps
        const { data: bomSteps } = await (supabase.from("bom_steps" as any) as any)
          .select("*, production_steps(name, code, duration_minutes)")
          .eq("bom_id", bom.id).order("step_order");

        // Create order steps from BOM steps
        if (bomSteps && bomSteps.length > 0) {
          const stepsToInsert = bomSteps.map((bs: any) => ({
            order_id: orderId,
            bom_step_id: bs.id,
            step_order: bs.step_order,
            step_name: bs.production_steps?.name || "",
            step_code: bs.production_steps?.code || "",
            duration_minutes: bs.duration_minutes,
            status: "pending",
          }));

          await (supabase.from("manufacturing_order_steps" as any) as any).insert(stepsToInsert);
        }
      }

      // Update order status
      await (supabase.from("manufacturing_orders" as any) as any)
        .update({ status: "in_progress", bom_id: bom?.id || null })
        .eq("id", orderId);

      toast({ title: "Production lancée" });
      loadData();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  const startStep = async (stepId: string) => {
    await (supabase.from("manufacturing_order_steps" as any) as any)
      .update({ status: "in_progress", started_at: new Date().toISOString(), started_by: userId })
      .eq("id", stepId);
    if (selectedOrder) viewOrderDetail(selectedOrder);
  };

  const completeStep = async (step: any) => {
    try {
      const startedAt = step.started_at ? new Date(step.started_at) : new Date();
      const actualDuration = Math.round((Date.now() - startedAt.getTime()) / 60000);

      // Consume materials linked to this step
      if (selectedOrder && step.bom_step_id) {
        const { data: stepLines } = await (supabase.from("bom_lines" as any) as any)
          .select("*, products(name, cost_price)")
          .eq("bom_step_id", step.bom_step_id);

        if (stepLines && stepLines.length > 0) {
          const { data: bom } = await (supabase.from("bill_of_materials" as any) as any)
            .select("quantity").eq("id", selectedOrder.bom_id).single();
          const multiplier = selectedOrder.quantity / (bom?.quantity || 1);

          const { data: locations } = await supabase.from("stock_locations")
            .select("id, type").eq("company_id", companyId);
          const internalLoc = locations?.find(l => l.type === "internal");
          const productionLoc = locations?.find(l => (l.type as string) === "production");

          for (const comp of stepLines) {
            const neededQty = comp.quantity * multiplier;
            const cost = comp.products?.cost_price || 0;
            const sourceLoc = internalLoc?.id;
            const destLoc = productionLoc?.id || internalLoc?.id;

            if (sourceLoc) {
              // Check stock
              const { data: stockData } = await supabase.from("stock_quants")
                .select("qty_on_hand").eq("product_id", comp.product_id).eq("company_id", companyId);
              const totalStock = (stockData || []).reduce((sum: number, q: any) => sum + (q.qty_on_hand || 0), 0);

              if (totalStock < neededQty) {
                toast({ title: "Stock insuffisant", description: `${comp.products?.name}: besoin de ${neededQty}, disponible: ${totalStock}`, variant: "destructive" });
                return;
              }

              // Create stock move
              const { data: moveData } = await supabase.from("stock_moves").insert({
                product_id: comp.product_id,
                from_location_id: sourceLoc,
                to_location_id: destLoc !== sourceLoc ? destLoc : sourceLoc,
                qty: neededQty,
                cost,
                move_type: "production_out" as any,
                state: "done" as any,
                reference: selectedOrder.number,
                origin: `Consommation étape ${step.step_name}`,
                company_id: companyId,
                responsible_id: userId,
              } as any).select("id").single();

              // Record consumption
              await (supabase.from("manufacturing_order_consumptions" as any) as any).insert({
                order_id: selectedOrder.id,
                order_step_id: step.id,
                product_id: comp.product_id,
                quantity: neededQty,
                cost: cost * neededQty,
                consumed_by: userId,
                stock_move_id: moveData?.id,
              });
            }
          }
        }
      }

      await (supabase.from("manufacturing_order_steps" as any) as any)
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          completed_by: userId,
          actual_duration_minutes: actualDuration,
        })
        .eq("id", step.id);

      sonnerToast.success(`Étape "${step.step_name}" terminée`);
      if (selectedOrder) viewOrderDetail(selectedOrder);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  const validateProduction = async () => {
    if (!selectedOrder) return;
    try {
      const order = selectedOrder;

      // Consume materials not linked to any specific step
      const { data: bom } = await (supabase.from("bill_of_materials" as any) as any)
        .select("id, quantity").eq("product_id", order.product_id).eq("company_id", companyId).single();

      if (bom) {
        const { data: unlinkedLines } = await (supabase.from("bom_lines" as any) as any)
          .select("*, products(name, cost_price)")
          .eq("bom_id", bom.id)
          .is("bom_step_id", null);

        const multiplier = order.quantity / (bom.quantity || 1);
        const { data: locations } = await supabase.from("stock_locations")
          .select("id, type").eq("company_id", companyId);
        const internalLoc = locations?.find(l => l.type === "internal");
        const productionLoc = locations?.find(l => (l.type as string) === "production");

        if (unlinkedLines && unlinkedLines.length > 0 && internalLoc) {
          for (const comp of unlinkedLines) {
            const neededQty = comp.quantity * multiplier;
            const cost = comp.products?.cost_price || 0;
            const sourceLoc = internalLoc.id;
            const destLoc = productionLoc?.id || internalLoc.id;

            const { data: stockData } = await supabase.from("stock_quants")
              .select("qty_on_hand").eq("product_id", comp.product_id).eq("company_id", companyId);
            const totalStock = (stockData || []).reduce((sum: number, q: any) => sum + (q.qty_on_hand || 0), 0);

            if (totalStock < neededQty) {
              toast({ title: "Stock insuffisant", description: `${comp.products?.name}: besoin de ${neededQty}, disponible: ${totalStock}`, variant: "destructive" });
              return;
            }

            await supabase.from("stock_moves").insert({
              product_id: comp.product_id,
              from_location_id: sourceLoc,
              to_location_id: destLoc !== sourceLoc ? destLoc : sourceLoc,
              qty: neededQty,
              cost,
              move_type: "production_out" as any,
              state: "done" as any,
              reference: order.number,
              origin: `Consommation finale OF ${order.number}`,
              company_id: companyId,
              responsible_id: userId,
            } as any);
          }
        }
      }

      // Get total cost from consumptions
      const { data: consumptions } = await (supabase.from("manufacturing_order_consumptions" as any) as any)
        .select("cost").eq("order_id", order.id);
      const totalCost = (consumptions || []).reduce((s: number, c: any) => s + (c.cost || 0), 0);

      // Get total actual duration
      const totalActualDuration = orderSteps.reduce((s: number, st: any) => s + (st.actual_duration_minutes || 0), 0);

      // Add finished product to stock
      const { data: locations } = await supabase.from("stock_locations")
        .select("id, type").eq("company_id", companyId);
      const internalLoc = locations?.find(l => l.type === "internal");
      const productionLoc = locations?.find(l => (l.type as string) === "production");

      if (internalLoc) {
        await supabase.from("stock_moves").insert({
          product_id: order.product_id,
          from_location_id: productionLoc?.id || internalLoc.id,
          to_location_id: internalLoc.id,
          qty: order.quantity,
          cost: totalCost > 0 ? totalCost / order.quantity : 0,
          move_type: "production_in" as any,
          state: "done" as any,
          reference: order.number,
          origin: `Production OF ${order.number}`,
          notes: `Production de ${order.quantity} x ${order.products?.name}`,
          company_id: companyId,
          responsible_id: userId,
        } as any);
      }

      // Update order
      await (supabase.from("manufacturing_orders" as any) as any).update({
        status: "done",
        completion_date: new Date().toISOString().split("T")[0],
        actual_cost: totalCost,
        actual_duration_minutes: totalActualDuration,
      }).eq("id", order.id);

      sonnerToast.success(`Production validée : ${order.quantity} x ${order.products?.name}`);
      setSelectedOrder(null);
      loadData();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  const cancelOrder = async (id: string) => {
    await (supabase.from("manufacturing_orders" as any) as any).update({ status: "cancelled" }).eq("id", id);
    toast({ title: "Ordre annulé" });
    loadData();
  };

  const viewOrderDetail = async (order: any) => {
    setSelectedOrder(order);

    // Load order steps
    const { data: steps } = await (supabase.from("manufacturing_order_steps" as any) as any)
      .select("*").eq("order_id", order.id).order("step_order");
    setOrderSteps(steps || []);

    // Load BOM lines for info
    const { data: bom } = await (supabase.from("bill_of_materials" as any) as any)
      .select("id, quantity").eq("product_id", order.product_id).eq("company_id", companyId).single();

    if (bom) {
      const { data: lines } = await (supabase.from("bom_lines" as any) as any)
        .select("*, products(name, sku, cost_price, uom:uom(code))")
        .eq("bom_id", bom.id);

      const multiplier = order.quantity / (bom.quantity || 1);
      setBomLines((lines || []).map((l: any) => ({
        ...l,
        needed_qty: l.quantity * multiplier,
        product_name: l.products?.name,
        product_sku: l.products?.sku,
        cost_price: l.products?.cost_price || 0,
        uom_code: l.products?.uom?.code || "unité",
      })));
    } else {
      setBomLines([]);
    }
  };

  // Subscribe to realtime updates for order steps
  useEffect(() => {
    if (!selectedOrder) return;
    const channel = supabase
      .channel(`order-steps-${selectedOrder.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'manufacturing_order_steps', filter: `order_id=eq.${selectedOrder.id}` },
        () => { viewOrderDetail(selectedOrder); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedOrder?.id]);

  // Detail view
  if (selectedOrder) {
    const st = statusLabels[selectedOrder.status] || statusLabels.draft;
    const completedSteps = orderSteps.filter(s => s.status === "completed").length;
    const totalSteps = orderSteps.length;
    const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
    const allStepsDone = totalSteps > 0 && completedSteps === totalSteps;
    const totalEstimatedDuration = orderSteps.reduce((s: number, st: any) => s + st.duration_minutes, 0);

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
                  {totalSteps > 0 && (
                    <Badge variant="secondary">{completedSteps}/{totalSteps} étapes</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Produit: {selectedOrder.products?.name} — Quantité: {selectedOrder.quantity}
                  {selectedOrder.responsible && ` — Responsable: ${selectedOrder.responsible}`}
                </CardDescription>
              </div>
              {allStepsDone && selectedOrder.status === "in_progress" && (
                <Button onClick={validateProduction} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Valider la production
                </Button>
              )}
            </div>
            {totalSteps > 0 && selectedOrder.status === "in_progress" && (
              <Progress value={progress} className="h-2 mt-3" />
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step control buttons */}
            {selectedOrder.status === "in_progress" && orderSteps.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Contrôle des étapes</h4>
                <div className="flex flex-wrap gap-2">
                  {orderSteps.map(step => {
                    const prevStep = orderSteps.find(s => s.step_order === step.step_order - 1);
                    const canStart = step.status === "pending" && (!prevStep || prevStep.status === "completed");
                    return (
                      <div key={step.id} className="flex items-center gap-1">
                        {step.status === "pending" && canStart && (
                          <Button size="sm" variant="outline" onClick={() => startStep(step.id)}>
                            <Play className="mr-1 h-3 w-3" />{step.step_name}
                          </Button>
                        )}
                        {step.status === "in_progress" && (
                          <Button size="sm" onClick={() => completeStep(step)}>
                            <CheckCircle className="mr-1 h-3 w-3" />Terminer: {step.step_name}
                          </Button>
                        )}
                        {step.status === "completed" && (
                          <Badge variant="secondary" className="py-1">
                            <CheckCircle className="mr-1 h-3 w-3" />{step.step_name} ✓
                          </Badge>
                        )}
                        {step.status === "pending" && !canStart && (
                          <Badge variant="outline" className="py-1 opacity-50">{step.step_name}</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* BOM Components */}
            <h4 className="font-medium text-sm">Composants nécessaires</h4>
            {bomLines.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground border rounded-lg">
                <Package className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p>Aucune nomenclature trouvée.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Composant</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Qté/unité</TableHead>
                    <TableHead className="text-right">Qté totale</TableHead>
                    <TableHead>Unité</TableHead>
                    <TableHead className="text-right">Coût total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bomLines.map((line: any) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-medium">{line.product_name}</TableCell>
                      <TableCell className="font-mono text-sm">{line.product_sku}</TableCell>
                      <TableCell className="text-right">{line.quantity}</TableCell>
                      <TableCell className="text-right font-medium">{line.needed_qty}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{line.uom_code}</Badge></TableCell>
                      <TableCell className="text-right">
                        {new Intl.NumberFormat("fr-FR").format(line.cost_price * line.needed_qty)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2">
                    <TableCell colSpan={5} className="text-right font-bold">Coût total estimé</TableCell>
                    <TableCell className="text-right font-bold">
                      {new Intl.NumberFormat("fr-FR").format(
                        bomLines.reduce((sum: number, l: any) => sum + (l.cost_price * l.needed_qty), 0)
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}

            {/* Production completed message */}
            {allStepsDone && selectedOrder.status === "in_progress" && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="py-4 text-center">
                  <CheckCircle className="mx-auto h-8 w-8 text-green-600 mb-2" />
                  <p className="font-medium text-green-800">Toutes les étapes sont terminées.</p>
                  <p className="text-sm text-green-600 mt-1">Cliquez sur "Valider la production" pour finaliser.</p>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        {/* Production Flow Diagram */}
        {orderSteps.length > 0 && (
          <ProductionFlowDiagram
            productName={selectedOrder.products?.name || ""}
            quantity={selectedOrder.quantity}
            totalDuration={totalEstimatedDuration}
            showStatus={selectedOrder.status === "in_progress" || selectedOrder.status === "done"}
            steps={orderSteps.map((s: any) => {
              const stepMaterials = bomLines
                .filter((l: any) => l.bom_step_id === s.bom_step_id)
                .map((l: any) => ({ name: l.product_name, quantity: l.needed_qty, uom: l.uom_code }));
              return {
                step_order: s.step_order,
                step_name: s.step_name,
                step_code: s.step_code || "",
                duration_minutes: s.duration_minutes,
                actual_duration_minutes: s.actual_duration_minutes,
                status: s.status,
                machines: [],
                labor_required: 1,
                materials: stepMaterials,
              };
            })}
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
                          <Button variant="ghost" size="icon" title="Lancer" onClick={() => launchOrder(order.id)}>
                            <Play className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        {order.status !== "done" && order.status !== "cancelled" && (
                          <Button variant="ghost" size="icon" title="Annuler" onClick={() => cancelOrder(order.id)}>
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
