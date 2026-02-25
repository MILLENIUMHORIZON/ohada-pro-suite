import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Download, CheckCircle } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

const MOVE_TYPE_LABELS: Record<string, string> = {
  supplier_in: "Entrée fournisseur",
  customer_out: "Sortie client",
  transfer: "Transfert",
  adjustment: "Ajustement",
  scrap: "Rebut",
  production_in: "Entrée production",
  production_out: "Sortie production",
  production_return: "Retour production",
};

const STATE_LABELS: Record<string, string> = {
  draft: "Brouillon",
  confirmed: "Confirmé",
  done: "Validé",
  cancelled: "Annulé",
};

interface StockMovesHistoryProps {
  refreshKey?: number;
}

export function StockMovesHistory({ refreshKey }: StockMovesHistoryProps) {
  const [moves, setMoves] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);

  useEffect(() => {
    loadMoves();
  }, [refreshKey, dateFrom, dateTo]);

  const loadMoves = async () => {
    const { data: profile } = await supabase.from("profiles").select("company_id").single();
    if (!profile?.company_id) return;

    const { data } = await supabase
      .from("stock_moves")
      .select(`
        *,
        product:products(name, sku),
        from_location:stock_locations!stock_moves_from_location_id_fkey(name),
        to_location:stock_locations!stock_moves_to_location_id_fkey(name)
      `)
      .eq("company_id", profile.company_id)
      .gte("date", dateFrom + "T00:00:00")
      .lte("date", dateTo + "T23:59:59")
      .order("date", { ascending: false })
      .limit(100);

    setMoves(data || []);
  };

  const validateMove = async (moveId: string) => {
    const { error } = await supabase.from("stock_moves").update({ state: "done" }).eq("id", moveId);
    if (error) {
      toast.error("Erreur lors de la validation");
      return;
    }
    toast.success("Mouvement validé, stock mis à jour");
    loadMoves();
  };

  const filtered = moves.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return m.product?.name?.toLowerCase().includes(q) ||
      m.product?.sku?.toLowerCase().includes(q) ||
      m.reference?.toLowerCase().includes(q);
  });

  const exportCSV = () => {
    const headers = ["Date", "Référence", "Type", "Article", "SKU", "De", "Vers", "Qté", "Coût", "Statut"];
    const rows = filtered.map(m => [
      new Date(m.date).toLocaleDateString("fr-FR"),
      m.reference || "",
      MOVE_TYPE_LABELS[m.move_type] || m.move_type,
      m.product?.name || "",
      m.product?.sku || "",
      m.from_location?.name || "",
      m.to_location?.name || "",
      m.qty,
      m.cost || 0,
      STATE_LABELS[m.state] || m.state,
    ]);
    const csv = [headers, ...rows].map(r => r.join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mouvements_stock_${dateFrom}_${dateTo}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Du</span>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
          <span className="text-sm text-muted-foreground">Au</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
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
            <TableHead>Date</TableHead>
            <TableHead>Réf</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Article</TableHead>
            <TableHead>De → Vers</TableHead>
            <TableHead className="text-right">Qté</TableHead>
            <TableHead className="text-right">Coût</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length > 0 ? filtered.map(m => (
            <TableRow key={m.id}>
              <TableCell className="text-sm">{new Date(m.date).toLocaleDateString("fr-FR")}</TableCell>
              <TableCell className="font-mono text-xs">{m.reference}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {MOVE_TYPE_LABELS[m.move_type] || m.move_type}
                </Badge>
              </TableCell>
              <TableCell>
                <div>{m.product?.name}</div>
                <div className="text-xs text-muted-foreground">{m.product?.sku}</div>
              </TableCell>
              <TableCell className="text-xs">
                {m.from_location?.name} → {m.to_location?.name}
              </TableCell>
              <TableCell className="text-right font-medium">{m.qty}</TableCell>
              <TableCell className="text-right text-sm">
                {new Intl.NumberFormat("fr-FR").format(m.cost || 0)}
              </TableCell>
              <TableCell>
                <Badge variant={m.state === "done" ? "default" : m.state === "cancelled" ? "destructive" : "secondary"}>
                  {STATE_LABELS[m.state] || m.state}
                </Badge>
              </TableCell>
              <TableCell>
                {m.state === "draft" && (
                  <Button variant="ghost" size="sm" onClick={() => validateMove(m.id)}>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          )) : (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                Aucun mouvement trouvé
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
