import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface ProductStock {
  id: string;
  name: string;
  sku: string;
  type: string;
  stock_min: number;
  cost_price: number;
  uom_code: string;
  total_qty: number;
  reserved_qty: number;
  available_qty: number;
  total_value: number;
}

const TYPE_LABELS: Record<string, string> = {
  stock: "Stockable",
  raw_material: "Matière première",
  semi_finished: "Semi-fini",
  finished: "Produit fini",
  consumable: "Consommable",
  spare_part: "Pièce détachée",
  service: "Service",
};

interface StockByProductProps {
  refreshKey?: number;
}

export function StockByProduct({ refreshKey }: StockByProductProps) {
  const [items, setItems] = useState<ProductStock[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const loadData = async () => {
    const { data: profile } = await supabase.from("profiles").select("company_id").single();
    if (!profile?.company_id) return;

    const [prodRes, quantsRes] = await Promise.all([
      supabase.from("products").select("id, name, sku, type, stock_min, cost_price, uom:uom(code)")
        .eq("active", true).order("name"),
      supabase.from("stock_quants")
        .select("product_id, qty_on_hand, reserved_qty, cost, location:stock_locations(type)")
        .eq("company_id", profile.company_id),
    ]);

    const products = prodRes.data || [];
    const quants = (quantsRes.data || []).filter((q: any) => q.location?.type === "internal");

    // Aggregate
    const stockMap = new Map<string, { qty: number; reserved: number; value: number }>();
    for (const q of quants) {
      const current = stockMap.get(q.product_id) || { qty: 0, reserved: 0, value: 0 };
      current.qty += q.qty_on_hand || 0;
      current.reserved += q.reserved_qty || 0;
      current.value += (q.qty_on_hand || 0) * (q.cost || 0);
      stockMap.set(q.product_id, current);
    }

    const result: ProductStock[] = products.map(p => {
      const stock = stockMap.get(p.id) || { qty: 0, reserved: 0, value: 0 };
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        type: p.type,
        stock_min: p.stock_min,
        cost_price: p.cost_price || 0,
        uom_code: (p as any).uom?.code || "unité",
        total_qty: stock.qty,
        reserved_qty: stock.reserved,
        available_qty: stock.qty - stock.reserved,
        total_value: stock.value,
      };
    });

    setItems(result);
  };

  const filtered = items.filter(i => {
    if (typeFilter !== "all" && i.type !== typeFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q);
  });

  const exportCSV = () => {
    const headers = ["SKU", "Nom", "Type", "Stock", "Réservé", "Disponible", "Stock Min", "Valeur", "Unité"];
    const rows = filtered.map(i => [
      i.sku, i.name, TYPE_LABELS[i.type] || i.type,
      i.total_qty, i.reserved_qty, i.available_qty, i.stock_min,
      i.total_value, i.uom_code,
    ]);
    const csv = [headers, ...rows].map(r => r.join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "etat_stock.csv";
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex gap-1 p-1 bg-muted rounded-lg">
          {[
            { value: "all", label: "Tous" },
            { value: "raw_material", label: "Matières" },
            { value: "finished", label: "Produits finis" },
            { value: "semi_finished", label: "Semi-finis" },
            { value: "consumable", label: "Consommables" },
            { value: "stock", label: "Stockables" },
          ].map(f => (
            <Button
              key={f.value}
              variant={typeFilter === f.value ? "default" : "ghost"}
              size="sm"
              onClick={() => setTypeFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border-0 bg-muted/50"
          />
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="mr-2 h-4 w-4" />CSV
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SKU</TableHead>
            <TableHead>Article</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead className="text-right">Réservé</TableHead>
            <TableHead className="text-right">Disponible</TableHead>
            <TableHead className="text-right">Stock Min</TableHead>
            <TableHead className="text-right">Valeur</TableHead>
            <TableHead>Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length > 0 ? filtered.map(i => (
            <TableRow key={i.id}>
              <TableCell className="font-mono text-xs">{i.sku}</TableCell>
              <TableCell className="font-medium">{i.name}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {TYPE_LABELS[i.type] || i.type}
                </Badge>
              </TableCell>
              <TableCell className="text-right">{i.total_qty} {i.uom_code}</TableCell>
              <TableCell className="text-right text-muted-foreground">{i.reserved_qty}</TableCell>
              <TableCell className="text-right font-medium">{i.available_qty}</TableCell>
              <TableCell className="text-right text-muted-foreground">{i.stock_min}</TableCell>
              <TableCell className="text-right">
                {new Intl.NumberFormat("fr-FR").format(i.total_value)}
              </TableCell>
              <TableCell>
                {i.total_qty <= 0 ? (
                  <Badge variant="destructive">Rupture</Badge>
                ) : i.stock_min > 0 && i.total_qty <= i.stock_min ? (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Faible</Badge>
                ) : (
                  <Badge variant="default">OK</Badge>
                )}
              </TableCell>
            </TableRow>
          )) : (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                Aucun article trouvé
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex justify-between text-sm text-muted-foreground border-t pt-3">
        <span>{filtered.length} articles</span>
        <span>
          Valeur totale: <strong>{new Intl.NumberFormat("fr-FR").format(filtered.reduce((s, i) => s + i.total_value, 0))}</strong> CDF
        </span>
      </div>
    </div>
  );
}
