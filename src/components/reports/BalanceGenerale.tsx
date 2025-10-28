import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface BalanceItem {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  solde_debit: number;
  solde_credit: number;
}

export function BalanceGenerale() {
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [totals, setTotals] = useState({ debit: 0, credit: 0, solde_debit: 0, solde_credit: 0 });

  useEffect(() => {
    loadBalance();
  }, []);

  const loadBalance = async () => {
    setLoading(true);
    try {
      // Get all accounts
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, code, name, type")
        .order("code");

      if (!accounts) return;

      // Get all account moves lines with their debits and credits
      const { data: lines } = await supabase
        .from("account_move_lines")
        .select("account_id, debit, credit");

      const balanceMap = new Map<string, BalanceItem>();

      // Initialize all accounts
      accounts.forEach((account) => {
        balanceMap.set(account.id, {
          code: account.code,
          name: account.name,
          type: account.type,
          debit: 0,
          credit: 0,
          solde_debit: 0,
          solde_credit: 0,
        });
      });

      // Aggregate debits and credits
      lines?.forEach((line) => {
        const balance = balanceMap.get(line.account_id);
        if (balance) {
          balance.debit += Number(line.debit || 0);
          balance.credit += Number(line.credit || 0);
        }
      });

      // Calculate soldes
      const balanceArray: BalanceItem[] = [];
      let totalDebit = 0;
      let totalCredit = 0;
      let totalSoldeDebit = 0;
      let totalSoldeCredit = 0;

      balanceMap.forEach((balance) => {
        const solde = balance.debit - balance.credit;
        if (solde > 0) {
          balance.solde_debit = solde;
          totalSoldeDebit += solde;
        } else if (solde < 0) {
          balance.solde_credit = Math.abs(solde);
          totalSoldeCredit += Math.abs(solde);
        }
        
        totalDebit += balance.debit;
        totalCredit += balance.credit;
        
        // Only include accounts with movements
        if (balance.debit > 0 || balance.credit > 0) {
          balanceArray.push(balance);
        }
      });

      setBalances(balanceArray);
      setTotals({
        debit: totalDebit,
        credit: totalCredit,
        solde_debit: totalSoldeDebit,
        solde_credit: totalSoldeCredit,
      });
    } catch (error) {
      console.error("Error loading balance:", error);
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
    const headers = ["Code", "Nom du compte", "Type", "Débit", "Crédit", "Solde Débit", "Solde Crédit"];
    const rows = balances.map((b) => [
      b.code,
      b.name,
      b.type,
      formatAmount(b.debit),
      formatAmount(b.credit),
      formatAmount(b.solde_debit),
      formatAmount(b.solde_credit),
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
      "",
      `TOTAUX,,${formatAmount(totals.debit)},${formatAmount(totals.credit)},${formatAmount(totals.solde_debit)},${formatAmount(totals.solde_credit)}`,
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `balance_generale_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Balance Générale</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Balance des comptes OHADA</p>
          </div>
          <Button onClick={downloadCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Télécharger CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Nom du compte</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Débit</TableHead>
                <TableHead className="text-right">Crédit</TableHead>
                <TableHead className="text-right">Solde Débit</TableHead>
                <TableHead className="text-right">Solde Crédit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Aucune écriture comptable trouvée
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {balances.map((balance, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono">{balance.code}</TableCell>
                      <TableCell>{balance.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {balance.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {balance.debit > 0 ? formatAmount(balance.debit) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {balance.credit > 0 ? formatAmount(balance.credit) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {balance.solde_debit > 0 ? formatAmount(balance.solde_debit) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {balance.solde_credit > 0 ? formatAmount(balance.solde_credit) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell colSpan={3}>TOTAUX</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(totals.debit)}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(totals.credit)}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(totals.solde_debit)}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(totals.solde_credit)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
