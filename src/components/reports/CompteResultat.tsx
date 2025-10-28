import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

interface ResultatItem {
  code: string;
  name: string;
  amount: number;
}

interface ResultatData {
  produits: {
    ventes: ResultatItem[];
    autres_produits: ResultatItem[];
  };
  charges: {
    achats: ResultatItem[];
    services_exterieurs: ResultatItem[];
    autres_charges: ResultatItem[];
    charges_personnel: ResultatItem[];
    impots_taxes: ResultatItem[];
    charges_financieres: ResultatItem[];
    dotations_amortissements: ResultatItem[];
  };
  totals: {
    total_produits: number;
    total_charges: number;
    resultat_net: number;
  };
}

export function CompteResultat() {
  const [loading, setLoading] = useState(true);
  const [resultat, setResultat] = useState<ResultatData | null>(null);

  useEffect(() => {
    loadCompteResultat();
  }, []);

  const loadCompteResultat = async () => {
    setLoading(true);
    try {
      // Get all revenue and expense accounts with their balances
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, code, name, type")
        .in("type", ["expense", "income"])
        .order("code");

      if (!accounts) return;

      // Get all account move lines
      const { data: lines } = await supabase
        .from("account_move_lines")
        .select("account_id, debit, credit");

      // Calculate balances
      const balanceMap = new Map<string, number>();
      lines?.forEach((line) => {
        const current = balanceMap.get(line.account_id) || 0;
        // For P&L: credits are revenue, debits are expenses
        balanceMap.set(line.account_id, current + Number(line.credit || 0) - Number(line.debit || 0));
      });

      const resultatData: ResultatData = {
        produits: {
          ventes: [],
          autres_produits: [],
        },
        charges: {
          achats: [],
          services_exterieurs: [],
          autres_charges: [],
          charges_personnel: [],
          impots_taxes: [],
          charges_financieres: [],
          dotations_amortissements: [],
        },
        totals: {
          total_produits: 0,
          total_charges: 0,
          resultat_net: 0,
        },
      };

      accounts.forEach((account) => {
        const balance = balanceMap.get(account.id) || 0;
        if (balance === 0) return;

        const item: ResultatItem = {
          code: account.code,
          name: account.name,
          amount: Math.abs(balance),
        };

        const firstDigit = account.code.charAt(0);

        // PRODUITS (Classe 7)
        if (firstDigit === "7") {
          if (account.code.startsWith("70")) {
            resultatData.produits.ventes.push(item);
          } else {
            resultatData.produits.autres_produits.push(item);
          }
          resultatData.totals.total_produits += item.amount;
        }

        // CHARGES (Classe 6)
        if (firstDigit === "6") {
          if (account.code.startsWith("60")) {
            resultatData.charges.achats.push(item);
          } else if (account.code.startsWith("61") || account.code.startsWith("62")) {
            resultatData.charges.services_exterieurs.push(item);
          } else if (account.code.startsWith("63") || account.code.startsWith("64")) {
            resultatData.charges.autres_charges.push(item);
          } else if (account.code.startsWith("66")) {
            resultatData.charges.charges_personnel.push(item);
          } else if (account.code.startsWith("64")) {
            resultatData.charges.impots_taxes.push(item);
          } else if (account.code.startsWith("67")) {
            resultatData.charges.charges_financieres.push(item);
          } else if (account.code.startsWith("68")) {
            resultatData.charges.dotations_amortissements.push(item);
          }
          resultatData.totals.total_charges += item.amount;
        }
      });

      resultatData.totals.resultat_net = resultatData.totals.total_produits - resultatData.totals.total_charges;

      setResultat(resultatData);
    } catch (error) {
      console.error("Error loading compte resultat:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const downloadPDF = () => {
    // TODO: Implement PDF generation
    alert("Génération PDF en cours de développement");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!resultat) return null;

  const renderSection = (title: string, items: ResultatItem[]) => {
    if (items.length === 0) return null;
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    return (
      <>
        <TableRow className="bg-muted/50">
          <TableCell colSpan={2} className="font-semibold">
            {title}
          </TableCell>
          <TableCell className="text-right font-semibold">{formatAmount(total)}</TableCell>
        </TableRow>
        {items.map((item, idx) => (
          <TableRow key={idx}>
            <TableCell className="font-mono pl-6">{item.code}</TableCell>
            <TableCell>{item.name}</TableCell>
            <TableCell className="text-right font-mono">{formatAmount(item.amount)}</TableCell>
          </TableRow>
        ))}
      </>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Compte de Résultat OHADA</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Produits et Charges - Exercice {new Date().getFullYear()}
            </p>
          </div>
          <Button onClick={downloadPDF} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Télécharger PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* PRODUITS */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead colSpan={3} className="bg-primary/10">
                    <span className="text-lg font-bold">PRODUITS</span>
                  </TableHead>
                </TableRow>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="text-right">Montant (CDF)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {renderSection("Ventes de marchandises", resultat.produits.ventes)}
                {renderSection("Autres produits", resultat.produits.autres_produits)}
                <TableRow className="font-bold bg-primary/5">
                  <TableCell colSpan={2}>TOTAL PRODUITS</TableCell>
                  <TableCell className="text-right font-mono text-lg">
                    {formatAmount(resultat.totals.total_produits)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* CHARGES */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead colSpan={3} className="bg-destructive/10">
                    <span className="text-lg font-bold">CHARGES</span>
                  </TableHead>
                </TableRow>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="text-right">Montant (CDF)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {renderSection("Achats de marchandises", resultat.charges.achats)}
                {renderSection("Services extérieurs", resultat.charges.services_exterieurs)}
                {renderSection("Autres charges", resultat.charges.autres_charges)}
                {renderSection("Charges de personnel", resultat.charges.charges_personnel)}
                {renderSection("Impôts et taxes", resultat.charges.impots_taxes)}
                {renderSection("Charges financières", resultat.charges.charges_financieres)}
                {renderSection("Dotations aux amortissements", resultat.charges.dotations_amortissements)}
                <TableRow className="font-bold bg-destructive/5">
                  <TableCell colSpan={2}>TOTAL CHARGES</TableCell>
                  <TableCell className="text-right font-mono text-lg">
                    {formatAmount(resultat.totals.total_charges)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* RÉSULTAT NET */}
          <div className="rounded-md border">
            <Table>
              <TableBody>
                <TableRow className={`font-bold text-lg ${resultat.totals.resultat_net >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
                  <TableCell colSpan={2} className="text-xl">
                    RÉSULTAT NET {resultat.totals.resultat_net >= 0 ? "(Bénéfice)" : "(Perte)"}
                  </TableCell>
                  <TableCell className={`text-right font-mono text-xl ${resultat.totals.resultat_net >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatAmount(resultat.totals.resultat_net)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
