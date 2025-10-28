import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TFTData {
  chiffre_affaires: number;
  variation_stocks: number;
  production_exercice: number;
  achats_consommes: number;
  marge_brute: number;
  autres_achats: number;
  transports: number;
  services_exterieurs: number;
  impots_taxes: number;
  autres_charges: number;
  valeur_ajoutee: number;
  charges_personnel: number;
  ebe: number;
  dotations_amortissements: number;
  reprises_provisions: number;
  resultat_exploitation: number;
  produits_financiers: number;
  charges_financieres: number;
  resultat_financier: number;
  resultat_ordinaire: number;
  produits_hao: number;
  charges_hao: number;
  resultat_hao: number;
  participation_salaries: number;
  impots_benefices: number;
  resultat_net: number;
}

export function TFT() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TFTData | null>(null);
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

      // Calculate all TFT components
      const chiffre_affaires = getBalance("701000", "709999");
      const variation_stocks = getBalance("730000", "739999");
      const production_exercice = chiffre_affaires + variation_stocks;
      
      const achats_consommes = getBalance("601000", "609999");
      const marge_brute = production_exercice - achats_consommes;
      
      const autres_achats = getBalance("620000", "629999");
      const transports = getBalance("630000", "639999");
      const services_exterieurs = getBalance("640000", "649999");
      const impots_taxes = getBalance("650000", "659999");
      const autres_charges = getBalance("660000", "669999");
      
      const valeur_ajoutee = marge_brute - (autres_achats + transports + services_exterieurs + impots_taxes + autres_charges);
      
      const charges_personnel = getBalance("660000", "669999");
      const ebe = valeur_ajoutee - charges_personnel;
      
      const dotations_amortissements = getBalance("681000", "689999");
      const reprises_provisions = getBalance("791000", "799999");
      const resultat_exploitation = ebe - dotations_amortissements + reprises_provisions;
      
      const produits_financiers = getBalance("771000", "779999");
      const charges_financieres = getBalance("671000", "679999");
      const resultat_financier = produits_financiers - charges_financieres;
      
      const resultat_ordinaire = resultat_exploitation + resultat_financier;
      
      const produits_hao = getBalance("811000", "819999");
      const charges_hao = getBalance("831000", "839999");
      const resultat_hao = produits_hao - charges_hao;
      
      const participation_salaries = getBalance("870000", "879999");
      const impots_benefices = getBalance("890000", "899999");
      const resultat_net = resultat_ordinaire + resultat_hao - participation_salaries - impots_benefices;

      setData({
        chiffre_affaires,
        variation_stocks,
        production_exercice,
        achats_consommes,
        marge_brute,
        autres_achats,
        transports,
        services_exterieurs,
        impots_taxes,
        autres_charges,
        valeur_ajoutee,
        charges_personnel,
        ebe,
        dotations_amortissements,
        reprises_provisions,
        resultat_exploitation,
        produits_financiers,
        charges_financieres,
        resultat_financier,
        resultat_ordinaire,
        produits_hao,
        charges_hao,
        resultat_hao,
        participation_salaries,
        impots_benefices,
        resultat_net,
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
      ["TABLEAU DE FORMATION DU RESULTAT (TFT)", "Montant (CDF)"],
      ["", ""],
      ["I. PRODUCTION DE L'EXERCICE", ""],
      ["Chiffre d'affaires", formatAmount(data.chiffre_affaires)],
      ["Variation de stocks", formatAmount(data.variation_stocks)],
      ["PRODUCTION DE L'EXERCICE", formatAmount(data.production_exercice)],
      ["", ""],
      ["II. MARGE BRUTE", ""],
      ["Achats consommés", formatAmount(-data.achats_consommes)],
      ["MARGE BRUTE", formatAmount(data.marge_brute)],
      ["", ""],
      ["III. VALEUR AJOUTÉE", ""],
      ["Autres achats", formatAmount(-data.autres_achats)],
      ["Transports", formatAmount(-data.transports)],
      ["Services extérieurs", formatAmount(-data.services_exterieurs)],
      ["Impôts et taxes", formatAmount(-data.impots_taxes)],
      ["Autres charges", formatAmount(-data.autres_charges)],
      ["VALEUR AJOUTÉE", formatAmount(data.valeur_ajoutee)],
      ["", ""],
      ["IV. EXCÉDENT BRUT D'EXPLOITATION (EBE)", ""],
      ["Charges de personnel", formatAmount(-data.charges_personnel)],
      ["EXCÉDENT BRUT D'EXPLOITATION", formatAmount(data.ebe)],
      ["", ""],
      ["V. RÉSULTAT D'EXPLOITATION", ""],
      ["Dotations aux amortissements", formatAmount(-data.dotations_amortissements)],
      ["Reprises sur provisions", formatAmount(data.reprises_provisions)],
      ["RÉSULTAT D'EXPLOITATION", formatAmount(data.resultat_exploitation)],
      ["", ""],
      ["VI. RÉSULTAT FINANCIER", ""],
      ["Produits financiers", formatAmount(data.produits_financiers)],
      ["Charges financières", formatAmount(-data.charges_financieres)],
      ["RÉSULTAT FINANCIER", formatAmount(data.resultat_financier)],
      ["", ""],
      ["VII. RÉSULTAT DES ACTIVITÉS ORDINAIRES", ""],
      ["RÉSULTAT DES ACTIVITÉS ORDINAIRES", formatAmount(data.resultat_ordinaire)],
      ["", ""],
      ["VIII. RÉSULTAT HORS ACTIVITÉS ORDINAIRES", ""],
      ["Produits HAO", formatAmount(data.produits_hao)],
      ["Charges HAO", formatAmount(-data.charges_hao)],
      ["RÉSULTAT HAO", formatAmount(data.resultat_hao)],
      ["", ""],
      ["IX. RÉSULTAT NET", ""],
      ["Participation des salariés", formatAmount(-data.participation_salaries)],
      ["Impôts sur les bénéfices", formatAmount(-data.impots_benefices)],
      ["RÉSULTAT NET DE L'EXERCICE", formatAmount(data.resultat_net)],
    ];

    const csvContent = rows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `tft_${new Date().toISOString().split("T")[0]}.csv`;
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
            <CardTitle>Tableau de Formation du Résultat (TFT)</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Analyse détaillée de la formation du résultat OHADA</p>
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
                <TableCell colSpan={2} className="font-bold">I. PRODUCTION DE L'EXERCICE</TableCell>
              </TableRow>
              {renderRow("Chiffre d'affaires", data.chiffre_affaires)}
              {renderRow("Variation de stocks", data.variation_stocks)}
              {renderRow("PRODUCTION DE L'EXERCICE", data.production_exercice, true)}

              <TableRow className="bg-muted/30">
                <TableCell colSpan={2} className="font-bold">II. MARGE BRUTE</TableCell>
              </TableRow>
              {renderRow("Achats consommés", -data.achats_consommes)}
              {renderRow("MARGE BRUTE", data.marge_brute, true)}

              <TableRow className="bg-muted/30">
                <TableCell colSpan={2} className="font-bold">III. VALEUR AJOUTÉE</TableCell>
              </TableRow>
              {renderRow("Autres achats", -data.autres_achats)}
              {renderRow("Transports", -data.transports)}
              {renderRow("Services extérieurs", -data.services_exterieurs)}
              {renderRow("Impôts et taxes", -data.impots_taxes)}
              {renderRow("Autres charges", -data.autres_charges)}
              {renderRow("VALEUR AJOUTÉE", data.valeur_ajoutee, true)}

              <TableRow className="bg-muted/30">
                <TableCell colSpan={2} className="font-bold">IV. EXCÉDENT BRUT D'EXPLOITATION (EBE)</TableCell>
              </TableRow>
              {renderRow("Charges de personnel", -data.charges_personnel)}
              {renderRow("EXCÉDENT BRUT D'EXPLOITATION", data.ebe, true)}

              <TableRow className="bg-muted/30">
                <TableCell colSpan={2} className="font-bold">V. RÉSULTAT D'EXPLOITATION</TableCell>
              </TableRow>
              {renderRow("Dotations aux amortissements", -data.dotations_amortissements)}
              {renderRow("Reprises sur provisions", data.reprises_provisions)}
              {renderRow("RÉSULTAT D'EXPLOITATION", data.resultat_exploitation, true)}

              <TableRow className="bg-muted/30">
                <TableCell colSpan={2} className="font-bold">VI. RÉSULTAT FINANCIER</TableCell>
              </TableRow>
              {renderRow("Produits financiers", data.produits_financiers)}
              {renderRow("Charges financières", -data.charges_financieres)}
              {renderRow("RÉSULTAT FINANCIER", data.resultat_financier, true)}

              <TableRow className="bg-muted/30">
                <TableCell colSpan={2} className="font-bold">VII. RÉSULTAT DES ACTIVITÉS ORDINAIRES</TableCell>
              </TableRow>
              {renderRow("RÉSULTAT DES ACTIVITÉS ORDINAIRES", data.resultat_ordinaire, true)}

              <TableRow className="bg-muted/30">
                <TableCell colSpan={2} className="font-bold">VIII. RÉSULTAT HORS ACTIVITÉS ORDINAIRES</TableCell>
              </TableRow>
              {renderRow("Produits HAO", data.produits_hao)}
              {renderRow("Charges HAO", -data.charges_hao)}
              {renderRow("RÉSULTAT HAO", data.resultat_hao, true)}

              <TableRow className="bg-muted/30">
                <TableCell colSpan={2} className="font-bold">IX. RÉSULTAT NET</TableCell>
              </TableRow>
              {renderRow("Participation des salariés", -data.participation_salaries)}
              {renderRow("Impôts sur les bénéfices", -data.impots_benefices)}
              {renderRow("RÉSULTAT NET DE L'EXERCICE", data.resultat_net, false, true)}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
