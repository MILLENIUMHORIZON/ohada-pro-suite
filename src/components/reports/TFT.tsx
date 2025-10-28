import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CashFlowData {
  // Activités opérationnelles
  resultat_net: number;
  dotations_amortissements: number;
  provisions: number;
  variation_stocks: number;
  variation_creances: number;
  variation_dettes: number;
  flux_operationnels: number;
  
  // Activités d'investissement
  acquisitions_immobilisations: number;
  cessions_immobilisations: number;
  investissements_financiers: number;
  flux_investissement: number;
  
  // Activités de financement
  augmentation_capital: number;
  emprunts_contractes: number;
  remboursements_emprunts: number;
  dividendes_payes: number;
  flux_financement: number;
  
  // Totaux
  tresorerie_debut: number;
  variation_tresorerie: number;
  tresorerie_fin: number;
}

export function TFT() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CashFlowData | null>(null);
  const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadTFT();
  }, []);

  const loadTFT = async () => {
    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile?.company_id) return;

      // Fetch account balances for the period
      const { data: lines } = await supabase
        .from("account_move_lines")
        .select(`
          account_id,
          debit,
          credit,
          accounts!inner(code, type),
          account_moves!inner(date, company_id)
        `)
        .eq("account_moves.company_id", profile.company_id)
        .gte("account_moves.date", startDate)
        .lte("account_moves.date", endDate);

      if (!lines) return;

      // Helper function to get balance for account range
      const getBalance = (start: string, end: string) => {
        return lines
          .filter(line => {
            const code = (line.accounts as any).code;
            return code >= start && code <= end;
          })
          .reduce((sum, line) => {
            return sum + (Number(line.credit || 0) - Number(line.debit || 0));
          }, 0);
      };

      // Helper function to get debit balance
      const getDebitBalance = (start: string, end: string) => {
        return lines
          .filter(line => {
            const code = (line.accounts as any).code;
            return code >= start && code <= end;
          })
          .reduce((sum, line) => {
            return sum + (Number(line.debit || 0) - Number(line.credit || 0));
          }, 0);
      };

      // ACTIVITÉS OPÉRATIONNELLES
      const resultat_net = getBalance("130000", "139999"); // Résultat net
      const dotations_amortissements = getDebitBalance("681000", "689999"); // Dotations
      const provisions = getDebitBalance("691000", "699999") - getBalance("791000", "799999"); // Provisions nettes
      const variation_stocks = -getDebitBalance("300000", "399999"); // Variation stocks (négatif = augmentation)
      const variation_creances = -getDebitBalance("400000", "499999"); // Variation créances (négatif = augmentation)
      const variation_dettes = getBalance("400000", "499999"); // Variation dettes (positif = augmentation)
      
      const flux_operationnels = resultat_net + dotations_amortissements + provisions + 
                                  variation_stocks + variation_creances + variation_dettes;

      // ACTIVITÉS D'INVESTISSEMENT
      const acquisitions_immobilisations = -getDebitBalance("200000", "259999"); // Acquisitions (sortie de trésorerie)
      const cessions_immobilisations = getBalance("820000", "829999"); // Cessions (entrée de trésorerie)
      const investissements_financiers = -getDebitBalance("260000", "279999"); // Titres de participation
      
      const flux_investissement = acquisitions_immobilisations + cessions_immobilisations + investissements_financiers;

      // ACTIVITÉS DE FINANCEMENT
      const augmentation_capital = getBalance("100000", "109999"); // Apports en capital
      const emprunts_contractes = getBalance("160000", "189999"); // Emprunts
      const remboursements_emprunts = -getDebitBalance("160000", "189999"); // Remboursements
      const dividendes_payes = -getDebitBalance("460000", "469999"); // Dividendes
      
      const flux_financement = augmentation_capital + emprunts_contractes + remboursements_emprunts + dividendes_payes;

      // TRÉSORERIE
      const tresorerie_debut = getDebitBalance("500000", "529999"); // Trésorerie début période
      const variation_tresorerie = flux_operationnels + flux_investissement + flux_financement;
      const tresorerie_fin = tresorerie_debut + variation_tresorerie;

      setData({
        resultat_net,
        dotations_amortissements,
        provisions,
        variation_stocks,
        variation_creances,
        variation_dettes,
        flux_operationnels,
        acquisitions_immobilisations,
        cessions_immobilisations,
        investissements_financiers,
        flux_investissement,
        augmentation_capital,
        emprunts_contractes,
        remboursements_emprunts,
        dividendes_payes,
        flux_financement,
        tresorerie_debut,
        variation_tresorerie,
        tresorerie_fin,
      });
    } catch (error) {
      console.error("Error loading TFT:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const downloadCSV = () => {
    if (!data) return;

    const rows = [
      ["TABLEAU DE FLUX DE TRÉSORERIE", "Montant (CDF)"],
      ["", ""],
      ["I. FLUX DE TRÉSORERIE LIÉS AUX ACTIVITÉS OPÉRATIONNELLES", ""],
      ["Résultat net de l'exercice", formatAmount(data.resultat_net)],
      ["Ajustements pour:", ""],
      ["  Dotations aux amortissements", formatAmount(data.dotations_amortissements)],
      ["  Provisions nettes", formatAmount(data.provisions)],
      ["Variation du besoin en fonds de roulement:", ""],
      ["  Variation des stocks", formatAmount(data.variation_stocks)],
      ["  Variation des créances", formatAmount(data.variation_creances)],
      ["  Variation des dettes", formatAmount(data.variation_dettes)],
      ["FLUX NET DE TRÉSORERIE GÉNÉRÉ PAR L'ACTIVITÉ", formatAmount(data.flux_operationnels)],
      ["", ""],
      ["II. FLUX DE TRÉSORERIE LIÉS AUX ACTIVITÉS D'INVESTISSEMENT", ""],
      ["Acquisitions d'immobilisations", formatAmount(data.acquisitions_immobilisations)],
      ["Cessions d'immobilisations", formatAmount(data.cessions_immobilisations)],
      ["Investissements financiers", formatAmount(data.investissements_financiers)],
      ["FLUX NET DE TRÉSORERIE AFFECTÉ AUX OPÉRATIONS D'INVESTISSEMENT", formatAmount(data.flux_investissement)],
      ["", ""],
      ["III. FLUX DE TRÉSORERIE LIÉS AUX ACTIVITÉS DE FINANCEMENT", ""],
      ["Augmentation de capital", formatAmount(data.augmentation_capital)],
      ["Emprunts contractés", formatAmount(data.emprunts_contractes)],
      ["Remboursements d'emprunts", formatAmount(data.remboursements_emprunts)],
      ["Dividendes payés", formatAmount(data.dividendes_payes)],
      ["FLUX NET DE TRÉSORERIE PROVENANT DES ACTIVITÉS DE FINANCEMENT", formatAmount(data.flux_financement)],
      ["", ""],
      ["VARIATION DE TRÉSORERIE", formatAmount(data.variation_tresorerie)],
      ["Trésorerie en début d'exercice", formatAmount(data.tresorerie_debut)],
      ["TRÉSORERIE EN FIN D'EXERCICE", formatAmount(data.tresorerie_fin)],
    ];

    const csvContent = rows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `flux_tresorerie_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">Aucune donnée disponible</p>
        </CardContent>
      </Card>
    );
  }

  const renderRow = (label: string, value: number, isSubtotal = false, isTotal = false) => (
    <TableRow className={isTotal ? "font-bold bg-primary/10" : isSubtotal ? "font-semibold bg-muted/50" : ""}>
      <TableCell className={isTotal || isSubtotal ? "font-bold" : ""}>{label}</TableCell>
      <TableCell className={`text-right font-mono ${value < 0 ? "text-destructive" : value > 0 && isTotal ? "text-primary" : ""}`}>
        {formatAmount(value)}
      </TableCell>
    </TableRow>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Tableau de Flux de Trésorerie</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Analyse des flux de trésorerie par activité</p>
          </div>
          <Button onClick={downloadCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Télécharger CSV
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <Label htmlFor="startDate">Date de début</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="endDate">Date de fin</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        <Button onClick={loadTFT} className="mt-4">Actualiser</Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-3/4">Libellé</TableHead>
                <TableHead className="text-right">Montant (CDF)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/30">
                <TableCell colSpan={2} className="font-bold">I. FLUX DE TRÉSORERIE LIÉS AUX ACTIVITÉS OPÉRATIONNELLES</TableCell>
              </TableRow>
              {renderRow("Résultat net de l'exercice", data.resultat_net)}
              <TableRow>
                <TableCell className="pl-8 italic text-muted-foreground">Ajustements pour :</TableCell>
                <TableCell></TableCell>
              </TableRow>
              {renderRow("  Dotations aux amortissements", data.dotations_amortissements)}
              {renderRow("  Provisions nettes", data.provisions)}
              <TableRow>
                <TableCell className="pl-8 italic text-muted-foreground">Variation du besoin en fonds de roulement :</TableCell>
                <TableCell></TableCell>
              </TableRow>
              {renderRow("  Variation des stocks", data.variation_stocks)}
              {renderRow("  Variation des créances", data.variation_creances)}
              {renderRow("  Variation des dettes", data.variation_dettes)}
              {renderRow("FLUX NET DE TRÉSORERIE GÉNÉRÉ PAR L'ACTIVITÉ", data.flux_operationnels, true)}

              <TableRow className="bg-muted/30">
                <TableCell colSpan={2} className="font-bold">II. FLUX DE TRÉSORERIE LIÉS AUX ACTIVITÉS D'INVESTISSEMENT</TableCell>
              </TableRow>
              {renderRow("Acquisitions d'immobilisations", data.acquisitions_immobilisations)}
              {renderRow("Cessions d'immobilisations", data.cessions_immobilisations)}
              {renderRow("Investissements financiers", data.investissements_financiers)}
              {renderRow("FLUX NET DE TRÉSORERIE AFFECTÉ AUX OPÉRATIONS D'INVESTISSEMENT", data.flux_investissement, true)}

              <TableRow className="bg-muted/30">
                <TableCell colSpan={2} className="font-bold">III. FLUX DE TRÉSORERIE LIÉS AUX ACTIVITÉS DE FINANCEMENT</TableCell>
              </TableRow>
              {renderRow("Augmentation de capital", data.augmentation_capital)}
              {renderRow("Emprunts contractés", data.emprunts_contractes)}
              {renderRow("Remboursements d'emprunts", data.remboursements_emprunts)}
              {renderRow("Dividendes payés", data.dividendes_payes)}
              {renderRow("FLUX NET DE TRÉSORERIE PROVENANT DES ACTIVITÉS DE FINANCEMENT", data.flux_financement, true)}

              <TableRow className="h-4"></TableRow>
              {renderRow("VARIATION DE TRÉSORERIE", data.variation_tresorerie, true)}
              {renderRow("Trésorerie en début d'exercice", data.tresorerie_debut)}
              {renderRow("TRÉSORERIE EN FIN D'EXERCICE", data.tresorerie_fin, false, true)}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
