import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle, TrendingDown, DollarSign, Box, ArrowDown } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface StockStats {
  totalProducts: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalLocations: number;
  recentMoves: number;
}

interface LowStockItem {
  id: string;
  name: string;
  sku: string;
  stock_min: number;
  current_stock: number;
  uom_code?: string;
}

export function StockDashboard() {
  const [stats, setStats] = useState<StockStats>({
    totalProducts: 0, totalValue: 0, lowStockCount: 0,
    outOfStockCount: 0, totalLocations: 0, recentMoves: 0,
  });
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [companyId, setCompanyId] = useState<string>("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: profile } = await supabase.from("profiles").select("company_id").single();
    if (!profile?.company_id) return;
    setCompanyId(profile.company_id);

    // Load all data in parallel
    const [productsRes, quantsRes, locationsRes, movesRes] = await Promise.all([
      supabase.from("products").select("id, name, sku, stock_min, cost_price, uom:uom(code)")
        .eq("active", true),
      supabase.from("stock_quants").select("product_id, qty_on_hand, cost, location:stock_locations(type)")
        .eq("company_id", profile.company_id),
      supabase.from("stock_locations").select("id").eq("company_id", profile.company_id).eq("type", "internal"),
      supabase.from("stock_moves").select("id").eq("company_id", profile.company_id).eq("state", "done")
        .gte("date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    const products = productsRes.data || [];
    const quants = (quantsRes.data || []).filter((q: any) => q.location?.type === "internal");

    // Aggregate stock per product
    const stockMap = new Map<string, number>();
    let totalValue = 0;
    for (const q of quants) {
      const current = stockMap.get(q.product_id) || 0;
      stockMap.set(q.product_id, current + (q.qty_on_hand || 0));
      totalValue += (q.qty_on_hand || 0) * (q.cost || 0);
    }

    const lowItems: LowStockItem[] = [];
    let lowCount = 0;
    let outCount = 0;

    for (const p of products) {
      const stock = stockMap.get(p.id) || 0;
      if (stock <= 0) {
        outCount++;
        lowItems.push({ id: p.id, name: p.name, sku: p.sku, stock_min: p.stock_min, current_stock: stock, uom_code: (p as any).uom?.code });
      } else if (p.stock_min > 0 && stock <= p.stock_min) {
        lowCount++;
        lowItems.push({ id: p.id, name: p.name, sku: p.sku, stock_min: p.stock_min, current_stock: stock, uom_code: (p as any).uom?.code });
      }
    }

    setStats({
      totalProducts: products.length,
      totalValue,
      lowStockCount: lowCount,
      outOfStockCount: outCount,
      totalLocations: locationsRes.data?.length || 0,
      recentMoves: movesRes.data?.length || 0,
    });
    setLowStockItems(lowItems.slice(0, 10));
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Articles en Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.totalProducts}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.totalLocations} emplacements</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valeur du Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(stats.totalValue)} CDF
            </div>
            <p className="text-xs text-muted-foreground mt-1">{stats.recentMoves} mouvements (30j)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stock Faible</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-yellow-600">{stats.lowStockCount}</div>
              {stats.lowStockCount > 0 && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ruptures</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-destructive">{stats.outOfStockCount}</div>
              {stats.outOfStockCount > 0 && <TrendingDown className="h-5 w-5 text-destructive" />}
            </div>
          </CardContent>
        </Card>
      </div>

      {lowStockItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-700">
              <AlertTriangle className="h-5 w-5" />
              Alertes Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStockItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {item.current_stock} {item.uom_code || 'unité(s)'}
                      </p>
                      <p className="text-xs text-muted-foreground">Min: {item.stock_min}</p>
                    </div>
                    <Badge variant={item.current_stock <= 0 ? "destructive" : "secondary"}>
                      {item.current_stock <= 0 ? "Rupture" : "Faible"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
