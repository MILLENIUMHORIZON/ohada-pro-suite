import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, AlertCircle, TrendingDown, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface StockAlert {
  product_id: string;
  product_name: string;
  sku: string;
  stock_min: number;
  qty_on_hand: number;
  type: "rupture" | "low_stock";
}

export function StockAlerts({ refreshKey }: { refreshKey: number }) {
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadAlerts();
  }, [refreshKey]);

  const loadAlerts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
      if (!profile?.company_id) return;

      // Get all products with stock info
      const { data: products } = await supabase
        .from("products")
        .select("id, name, sku, stock_min, type")
        .eq("company_id", profile.company_id)
        .eq("active", true)
        .neq("type", "service");

      if (!products) return;

      const { data: quants } = await supabase
        .from("stock_quants")
        .select("product_id, qty_on_hand, location_id, stock_locations(type)")
        .eq("company_id", profile.company_id);

      // Aggregate stock by product (internal locations only)
      const stockByProduct: Record<string, number> = {};
      (quants || []).forEach((q: any) => {
        if (q.stock_locations?.type === "internal") {
          stockByProduct[q.product_id] = (stockByProduct[q.product_id] || 0) + (q.qty_on_hand || 0);
        }
      });

      const alertsList: StockAlert[] = [];
      products.forEach(p => {
        const qty = stockByProduct[p.id] || 0;
        if (qty <= 0) {
          alertsList.push({ product_id: p.id, product_name: p.name, sku: p.sku, stock_min: p.stock_min, qty_on_hand: qty, type: "rupture" });
        } else if (qty <= p.stock_min) {
          alertsList.push({ product_id: p.id, product_name: p.name, sku: p.sku, stock_min: p.stock_min, qty_on_hand: qty, type: "low_stock" });
        }
      });

      // Sort: ruptures first
      alertsList.sort((a, b) => (a.type === "rupture" ? -1 : 1) - (b.type === "rupture" ? -1 : 1));
      setAlerts(alertsList);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const ruptureCount = alerts.filter(a => a.type === "rupture").length;
  const lowStockCount = alerts.filter(a => a.type === "low_stock").length;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Alertes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alerts.length}</div>
          </CardContent>
        </Card>
        <Card className="border-destructive/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Ruptures de stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{ruptureCount}</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-yellow-600" />
              Stock faible
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{lowStockCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Alertes Stock
          </CardTitle>
          <CardDescription>Articles en rupture ou sous le seuil minimum</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Chargement...</p>
          ) : alerts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="mx-auto h-12 w-12 text-green-500/50 mb-3" />
              <p className="text-green-600 font-medium">Aucune alerte</p>
              <p className="text-sm text-muted-foreground">Tous les articles sont au-dessus du seuil minimum.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Stock actuel</TableHead>
                  <TableHead>Stock minimum</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.product_id}>
                    <TableCell className="font-medium">{alert.product_name}</TableCell>
                    <TableCell className="font-mono text-sm">{alert.sku}</TableCell>
                    <TableCell className={alert.type === "rupture" ? "text-destructive font-bold" : "text-yellow-600 font-medium"}>
                      {alert.qty_on_hand}
                    </TableCell>
                    <TableCell>{alert.stock_min}</TableCell>
                    <TableCell>
                      <Badge variant={alert.type === "rupture" ? "destructive" : "outline"} className={alert.type === "low_stock" ? "border-yellow-500 text-yellow-600" : ""}>
                        {alert.type === "rupture" ? "Rupture" : "Stock faible"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
