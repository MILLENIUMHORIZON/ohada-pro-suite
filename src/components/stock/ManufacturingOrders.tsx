import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, CheckCircle, XCircle, Factory } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

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
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
      if (!profile?.company_id) return;

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
      if (!profile?.company_id) return;

      // Generate OF number
      const year = new Date().getFullYear();
      const { count } = await (supabase.from("manufacturing_orders" as any) as any).select("*", { count: "exact", head: true }).eq("company_id", profile.company_id);
      const number = `OF-${year}-${String((count || 0) + 1).padStart(5, "0")}`;

      const { error } = await (supabase.from("manufacturing_orders" as any) as any).insert({
        number,
        product_id: form.product_id,
        quantity: form.quantity,
        responsible: form.responsible || null,
        company_id: profile.company_id,
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
    const { error } = await (supabase.from("manufacturing_orders" as any) as any).update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Ordre ${statusLabels[status]?.label || status}` });
      loadData();
    }
  };

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
            <p className="text-sm text-muted-foreground">Créez un OF pour lancer la production d'un produit.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° OF</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>Quantité</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead>Date lancement</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-32">Actions</TableHead>
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
                    <TableCell>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {order.status === "draft" && (
                          <Button variant="ghost" size="icon" title="Lancer" onClick={() => updateStatus(order.id, "in_progress")}>
                            <Play className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        {order.status === "in_progress" && (
                          <Button variant="ghost" size="icon" title="Terminer" onClick={() => updateStatus(order.id, "done")}>
                            <CheckCircle className="h-4 w-4 text-green-600" />
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
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un produit" />
                </SelectTrigger>
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
              <Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} min={1} />
            </div>
            <div>
              <Label>Responsable</Label>
              <Input value={form.responsible} onChange={e => setForm({ ...form, responsible: e.target.value })} placeholder="Nom du responsable" />
            </div>
            <Button onClick={handleCreate} className="w-full" disabled={!form.product_id}>
              Créer l'OF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
