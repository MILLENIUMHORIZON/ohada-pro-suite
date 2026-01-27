import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyFilter } from "./CurrencyFilter";

interface BalanceItem {
  code: string;
  name: string;
  type: string;
  solde_initial_debit: number;
  solde_initial_credit: number;
  mouvement_debit: number;
  mouvement_credit: number;
  solde_final_debit: number;
  solde_final_credit: number;
}

export function BalanceGenerale() {
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [totals, setTotals] = useState({ 
    solde_initial_debit: 0, 
    solde_initial_credit: 0,
    mouvement_debit: 0, 
    mouvement_credit: 0, 
    solde_final_debit: 0, 
    solde_final_credit: 0 
  });
  const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [currencyFilter, setCurrencyFilter] = useState("all");

  useEffect(() => {
    loadBalance();
  }, [currencyFilter]);

  const loadBalance = async () => {
    setLoading(true);
    try {
      // Get user's company_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile?.company_id) return;

      // Get all accounts for this company
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, code, name, type")
        .eq("company_id", profile.company_id)
        .order("code");

      if (!accounts) return;

      // Get company's fiscal year start (assuming January 1st of current year)
      const fiscalYearStart = startDate || `${new Date().getFullYear()}-01-01`;

      // Build query for initial lines (before start date)
      let initialQuery = supabase
        .from("account_move_lines")
        .select("account_id, debit, credit, currency, account_moves!inner(date, state, company_id)")
        .eq("account_moves.company_id", profile.company_id)
        .eq("account_moves.state", "posted")
        .lt("account_moves.date", fiscalYearStart);

      if (currencyFilter && currencyFilter !== "all") {
        initialQuery = initialQuery.eq("currency", currencyFilter);
      }

      const { data: initialLines } = await initialQuery;

      // Build query for period movements (between start and end date)
      let periodQuery = supabase
        .from("account_move_lines")
        .select("account_id, debit, credit, currency, account_moves!inner(date, state, company_id)")
        .eq("account_moves.company_id", profile.company_id)
        .eq("account_moves.state", "posted")
        .gte("account_moves.date", fiscalYearStart)
        .lte("account_moves.date", endDate);

      if (currencyFilter && currencyFilter !== "all") {
        periodQuery = periodQuery.eq("currency", currencyFilter);
      }

      const { data: periodLines } = await periodQuery;

      const balanceMap = new Map<string, BalanceItem>();

      // Initialize all accounts
      accounts.forEach((account) => {
        balanceMap.set(account.id, {
          code: account.code,
          name: account.name,
          type: account.type,
          solde_initial_debit: 0,
          solde_initial_credit: 0,
          mouvement_debit: 0,
          mouvement_credit: 0,
          solde_final_debit: 0,
          solde_final_credit: 0,
        });
      });

      // Calculate initial balances
      initialLines?.forEach((line) => {
        const balance = balanceMap.get(line.account_id);
        if (balance) {
          const solde = (balance.solde_initial_debit - balance.solde_initial_credit) + 
                       (Number(line.debit || 0) - Number(line.credit || 0));
          
          if (solde > 0) {
            balance.solde_initial_debit = solde;
            balance.solde_initial_credit = 0;
          } else if (solde < 0) {
            balance.solde_initial_debit = 0;
            balance.solde_initial_credit = Math.abs(solde);
          }
        }
      });

      // Calculate period movements
      periodLines?.forEach((line) => {
        const balance = balanceMap.get(line.account_id);
        if (balance) {
          balance.mouvement_debit += Number(line.debit || 0);
          balance.mouvement_credit += Number(line.credit || 0);
        }
      });

      // Calculate final balances and totals
      const balanceArray: BalanceItem[] = [];
      let totalSoldeInitialDebit = 0;
      let totalSoldeInitialCredit = 0;
      let totalMouvementDebit = 0;
      let totalMouvementCredit = 0;
      let totalSoldeFinalDebit = 0;
      let totalSoldeFinalCredit = 0;

      balanceMap.forEach((balance) => {
        // Calculate final balance
        const soldeInitial = balance.solde_initial_debit - balance.solde_initial_credit;
        const mouvements = balance.mouvement_debit - balance.mouvement_credit;
        const soldeFinal = soldeInitial + mouvements;

        if (soldeFinal > 0) {
          balance.solde_final_debit = soldeFinal;
          balance.solde_final_credit = 0;
        } else if (soldeFinal < 0) {
          balance.solde_final_debit = 0;
          balance.solde_final_credit = Math.abs(soldeFinal);
        }

        // Add to totals
        totalSoldeInitialDebit += balance.solde_initial_debit;
        totalSoldeInitialCredit += balance.solde_initial_credit;
        totalMouvementDebit += balance.mouvement_debit;
        totalMouvementCredit += balance.mouvement_credit;
        totalSoldeFinalDebit += balance.solde_final_debit;
        totalSoldeFinalCredit += balance.solde_final_credit;

        // Only include accounts with movements or balances
        if (balance.solde_initial_debit > 0 || balance.solde_initial_credit > 0 ||
            balance.mouvement_debit > 0 || balance.mouvement_credit > 0 ||
            balance.solde_final_debit > 0 || balance.solde_final_credit > 0) {
          balanceArray.push(balance);
        }
      });

      setBalances(balanceArray);
      setTotals({
        solde_initial_debit: totalSoldeInitialDebit,
        solde_initial_credit: totalSoldeInitialCredit,
        mouvement_debit: totalMouvementDebit,
        mouvement_credit: totalMouvementCredit,
        solde_final_debit: totalSoldeFinalDebit,
        solde_final_credit: totalSoldeFinalCredit,
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
    const headers = ["Code", "Nom du compte", "Type", "Solde Initial Débit", "Solde Initial Crédit", "Mouvement Débit", "Mouvement Crédit", "Solde Final Débit", "Solde Final Crédit"];
    const rows = balances.map((b) => [
      b.code,
      b.name,
      b.type,
      formatAmount(b.solde_initial_debit),
      formatAmount(b.solde_initial_credit),
      formatAmount(b.mouvement_debit),
      formatAmount(b.mouvement_credit),
      formatAmount(b.solde_final_debit),
      formatAmount(b.solde_final_credit),
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
      "",
      `TOTAUX,,,${formatAmount(totals.solde_initial_debit)},${formatAmount(totals.solde_initial_credit)},${formatAmount(totals.mouvement_debit)},${formatAmount(totals.mouvement_credit)},${formatAmount(totals.solde_final_debit)},${formatAmount(totals.solde_final_credit)}`,
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `balance_6_colonnes_${new Date().toISOString().split("T")[0]}.csv`;
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
            <CardTitle>Balance à 6 Colonnes</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Soldes initiaux, mouvements et soldes finaux OHADA</p>
          </div>
          <Button onClick={downloadCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Télécharger CSV
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-4 mt-4">
          <div>
            <Label htmlFor="startDate">Du</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-40"
            />
          </div>
          <div>
            <Label htmlFor="endDate">Au</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-40"
            />
          </div>
          <CurrencyFilter 
            value={currencyFilter} 
            onChange={setCurrencyFilter}
            showAll={true}
          />
          <Button onClick={loadBalance}>Actualiser</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead rowSpan={2} className="border-r">Code</TableHead>
                <TableHead rowSpan={2} className="border-r">Nom du compte</TableHead>
                <TableHead rowSpan={2} className="border-r">Type</TableHead>
                <TableHead colSpan={2} className="text-center border-r bg-muted/50">Soldes Initiaux</TableHead>
                <TableHead colSpan={2} className="text-center border-r bg-muted/50">Mouvements</TableHead>
                <TableHead colSpan={2} className="text-center bg-muted/50">Soldes Finaux</TableHead>
              </TableRow>
              <TableRow>
                <TableHead className="text-right">Débit</TableHead>
                <TableHead className="text-right border-r">Crédit</TableHead>
                <TableHead className="text-right">Débit</TableHead>
                <TableHead className="text-right border-r">Crédit</TableHead>
                <TableHead className="text-right">Débit</TableHead>
                <TableHead className="text-right">Crédit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Aucune écriture comptable trouvée
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {balances.map((balance, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono border-r">{balance.code}</TableCell>
                      <TableCell className="border-r">{balance.name}</TableCell>
                      <TableCell className="border-r">
                        <Badge variant="outline" className="text-xs">
                          {balance.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {balance.solde_initial_debit > 0 ? formatAmount(balance.solde_initial_debit) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono border-r">
                        {balance.solde_initial_credit > 0 ? formatAmount(balance.solde_initial_credit) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {balance.mouvement_debit > 0 ? formatAmount(balance.mouvement_debit) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono border-r">
                        {balance.mouvement_credit > 0 ? formatAmount(balance.mouvement_credit) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {balance.solde_final_debit > 0 ? formatAmount(balance.solde_final_debit) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {balance.solde_final_credit > 0 ? formatAmount(balance.solde_final_credit) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell colSpan={3} className="border-r">TOTAUX</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(totals.solde_initial_debit)}</TableCell>
                    <TableCell className="text-right font-mono border-r">{formatAmount(totals.solde_initial_credit)}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(totals.mouvement_debit)}</TableCell>
                    <TableCell className="text-right font-mono border-r">{formatAmount(totals.mouvement_credit)}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(totals.solde_final_debit)}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(totals.solde_final_credit)}</TableCell>
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
