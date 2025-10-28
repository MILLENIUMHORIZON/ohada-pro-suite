import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface BilanItem {
  code: string;
  name: string;
  amount: number;
}

interface BilanData {
  actif: {
    immobilisations: BilanItem[];
    actif_circulant: BilanItem[];
    tresorerie_actif: BilanItem[];
  };
  passif: {
    capitaux_propres: BilanItem[];
    dettes_financieres: BilanItem[];
    passif_circulant: BilanItem[];
    tresorerie_passif: BilanItem[];
  };
  totals: {
    total_actif: number;
    total_passif: number;
  };
}

export function BilanOHADA() {
  const [loading, setLoading] = useState(true);
  const [bilan, setBilan] = useState<BilanData | null>(null);

  useEffect(() => {
    loadBilan();
  }, []);

  const loadBilan = async () => {
    setLoading(true);
    try {
      // Get all accounts with their balances
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, code, name, type")
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
        balanceMap.set(line.account_id, current + Number(line.debit || 0) - Number(line.credit || 0));
      });

      const bilanData: BilanData = {
        actif: {
          immobilisations: [],
          actif_circulant: [],
          tresorerie_actif: [],
        },
        passif: {
          capitaux_propres: [],
          dettes_financieres: [],
          passif_circulant: [],
          tresorerie_passif: [],
        },
        totals: {
          total_actif: 0,
          total_passif: 0,
        },
      };

      accounts.forEach((account) => {
        const balance = balanceMap.get(account.id) || 0;
        if (balance === 0) return;

        const item: BilanItem = {
          code: account.code,
          name: account.name,
          amount: Math.abs(balance),
        };

        const firstDigit = account.code.charAt(0);

        // ACTIF
        if (firstDigit === "2") {
          // Immobilisations (Classe 2)
          bilanData.actif.immobilisations.push(item);
          bilanData.totals.total_actif += item.amount;
        } else if (firstDigit === "3" || firstDigit === "4") {
          // Stocks (3) et Créances (4)
          bilanData.actif.actif_circulant.push(item);
          bilanData.totals.total_actif += item.amount;
        } else if (firstDigit === "5" && account.code.startsWith("5")) {
          // Trésorerie Actif (52, 53, 57, 58)
          if (["52", "53", "57", "58"].some(prefix => account.code.startsWith(prefix))) {
            bilanData.actif.tresorerie_actif.push(item);
            bilanData.totals.total_actif += item.amount;
          }
        }

        // PASSIF
        if (firstDigit === "1" && account.code.startsWith("1")) {
          // Capitaux propres (10-13) et Dettes financières (16-18)
          if (account.code.startsWith("10") || account.code.startsWith("11") || 
              account.code.startsWith("12") || account.code.startsWith("13")) {
            bilanData.passif.capitaux_propres.push(item);
            bilanData.totals.total_passif += item.amount;
          } else if (account.code.startsWith("16") || account.code.startsWith("17") || 
                     account.code.startsWith("18")) {
            bilanData.passif.dettes_financieres.push(item);
            bilanData.totals.total_passif += item.amount;
          }
        } else if (firstDigit === "4" && balance < 0) {
          // Dettes fournisseurs et autres dettes
          bilanData.passif.passif_circulant.push(item);
          bilanData.totals.total_passif += item.amount;
        } else if (firstDigit === "5" && balance < 0) {
          // Trésorerie Passif (dettes bancaires)
          if (["52", "56"].some(prefix => account.code.startsWith(prefix))) {
            bilanData.passif.tresorerie_passif.push(item);
            bilanData.totals.total_passif += item.amount;
          }
        }
      });

      setBilan(bilanData);
    } catch (error) {
      console.error("Error loading bilan:", error);
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

  if (!bilan) return null;

  const renderSection = (title: string, items: BilanItem[]) => {
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
            <CardTitle>Bilan OHADA</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Système Normal - Actif et Passif au {new Date().toLocaleDateString("fr-FR")}
            </p>
          </div>
          <Button onClick={downloadPDF} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Télécharger PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="actif" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="actif">ACTIF</TabsTrigger>
            <TabsTrigger value="passif">PASSIF</TabsTrigger>
          </TabsList>

          <TabsContent value="actif">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead className="text-right">Montant (CDF)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renderSection("ACTIF IMMOBILISÉ", bilan.actif.immobilisations)}
                  {renderSection("ACTIF CIRCULANT", bilan.actif.actif_circulant)}
                  {renderSection("TRÉSORERIE-ACTIF", bilan.actif.tresorerie_actif)}
                  <TableRow className="font-bold bg-primary/5">
                    <TableCell colSpan={2}>TOTAL ACTIF</TableCell>
                    <TableCell className="text-right font-mono text-lg">
                      {formatAmount(bilan.totals.total_actif)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="passif">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead className="text-right">Montant (CDF)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renderSection("CAPITAUX PROPRES", bilan.passif.capitaux_propres)}
                  {renderSection("DETTES FINANCIÈRES", bilan.passif.dettes_financieres)}
                  {renderSection("PASSIF CIRCULANT", bilan.passif.passif_circulant)}
                  {renderSection("TRÉSORERIE-PASSIF", bilan.passif.tresorerie_passif)}
                  <TableRow className="font-bold bg-primary/5">
                    <TableCell colSpan={2}>TOTAL PASSIF</TableCell>
                    <TableCell className="text-right font-mono text-lg">
                      {formatAmount(bilan.totals.total_passif)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
