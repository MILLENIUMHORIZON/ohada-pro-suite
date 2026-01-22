import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Calendar, Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SupplierBalance {
  partner_id: string;
  partner_name: string;
  account_code: string;
  total_debit: number;
  total_credit: number;
  balance: number;
}

export function BalanceFournisseurs() {
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [balances, setBalances] = useState<SupplierBalance[]>([]);
  const [totals, setTotals] = useState({ debit: 0, credit: 0, balance: 0 });

  // Date filters
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setMonth(0, 1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState<string>(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadCompanyId();
  }, []);

  useEffect(() => {
    if (companyId) {
      loadBalances();
    }
  }, [companyId, dateFrom, dateTo]);

  const loadCompanyId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (profile?.company_id) {
        setCompanyId(profile.company_id);
      }
    } catch (error) {
      console.error("Error loading company:", error);
      setLoading(false);
    }
  };

  const loadBalances = async () => {
    if (!companyId) return;
    
    setLoading(true);
    try {
      // Get supplier accounts (401xxx)
      const { data: supplierAccounts, error: accountsError } = await supabase
        .from("accounts")
        .select("id, code, name")
        .eq("company_id", companyId)
        .like("code", "401%");

      if (accountsError || !supplierAccounts) {
        console.error("Error fetching accounts:", accountsError);
        setLoading(false);
        return;
      }

      const accountIds = supplierAccounts.map(a => a.id);
      
      if (accountIds.length === 0) {
        setBalances([]);
        setTotals({ debit: 0, credit: 0, balance: 0 });
        setLoading(false);
        return;
      }

      // Get partners with their account mappings
      const { data: partners } = await supabase
        .from("partners")
        .select("id, name, account_id")
        .eq("company_id", companyId);

      // Get all move lines for supplier accounts
      const { data: lines, error } = await supabase
        .from("account_move_lines")
        .select(`
          id,
          debit,
          credit,
          account_id,
          partner_id,
          move:account_moves!inner(date, state)
        `)
        .in("account_id", accountIds)
        .eq("move.state", "posted")
        .gte("move.date", dateFrom)
        .lte("move.date", dateTo);

      if (error) {
        console.error("Error fetching lines:", error);
        setLoading(false);
        return;
      }

      // Create account to code mapping
      const accountMap = new Map(supplierAccounts.map(a => [a.id, a.code]));
      const partnerMap = new Map(partners?.map(p => [p.id, { name: p.name, account_id: p.account_id }]) || []);

      // Group by partner or account
      const balanceMap = new Map<string, SupplierBalance>();

      lines?.forEach((line: any) => {
        const debit = Number(line.debit || 0);
        const credit = Number(line.credit || 0);
        const partnerId = line.partner_id;
        const accountCode = accountMap.get(line.account_id) || "";
        
        // Use partner_id if available, otherwise use account_id
        const key = partnerId || line.account_id;
        const partnerInfo = partnerId ? partnerMap.get(partnerId) : null;
        const name = partnerInfo?.name || `Compte ${accountCode}`;

        if (!balanceMap.has(key)) {
          balanceMap.set(key, {
            partner_id: key,
            partner_name: name,
            account_code: accountCode,
            total_debit: 0,
            total_credit: 0,
            balance: 0,
          });
        }

        const item = balanceMap.get(key)!;
        item.total_debit += debit;
        item.total_credit += credit;
        // For suppliers, balance = credit - debit (we owe them)
        item.balance += credit - debit;
      });

      const sortedBalances = Array.from(balanceMap.values())
        .filter(b => b.balance !== 0)
        .sort((a, b) => b.balance - a.balance);

      const totalDebit = sortedBalances.reduce((sum, b) => sum + b.total_debit, 0);
      const totalCredit = sortedBalances.reduce((sum, b) => sum + b.total_credit, 0);
      const totalBalance = sortedBalances.reduce((sum, b) => sum + b.balance, 0);

      setBalances(sortedBalances);
      setTotals({ debit: totalDebit, credit: totalCredit, balance: totalBalance });
    } catch (error) {
      console.error("Error loading balances:", error);
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
    const rows: string[] = [
      `Balance Fournisseurs`,
      `Du ${new Date(dateFrom).toLocaleDateString("fr-FR")} au ${new Date(dateTo).toLocaleDateString("fr-FR")}`,
      "",
      "Compte,Fournisseur,Débit,Crédit,Solde"
    ];
    
    balances.forEach((item) => {
      rows.push(
        `${item.account_code},"${item.partner_name}",${formatAmount(item.total_debit)},${formatAmount(item.total_credit)},${formatAmount(item.balance)}`
      );
    });
    
    rows.push(`TOTAL,,${formatAmount(totals.debit)},${formatAmount(totals.credit)},${formatAmount(totals.balance)}`);

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `balance_fournisseurs_${dateFrom}_${dateTo}.csv`;
    link.click();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Balance Fournisseurs
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Soldes des comptes fournisseurs (401)</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="dateFromSuppliers" className="sr-only">Du</Label>
              <Input
                id="dateFromSuppliers"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[140px]"
              />
              <span className="text-muted-foreground">au</span>
              <Label htmlFor="dateToSuppliers" className="sr-only">Au</Label>
              <Input
                id="dateToSuppliers"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[140px]"
              />
            </div>
            <Button onClick={downloadCSV} variant="outline" disabled={balances.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Télécharger CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
            <CardContent className="pt-4">
              <div className="text-sm text-green-600 dark:text-green-400">Total Débit</div>
              <div className="text-xl font-mono font-bold text-green-700 dark:text-green-300">
                {formatAmount(totals.debit)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
            <CardContent className="pt-4">
              <div className="text-sm text-red-600 dark:text-red-400">Total Crédit</div>
              <div className="text-xl font-mono font-bold text-red-700 dark:text-red-300">
                {formatAmount(totals.credit)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-4">
              <div className="text-sm text-primary">Solde Total (dû)</div>
              <div className={`text-xl font-mono font-bold ${totals.balance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatAmount(totals.balance)}
              </div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : balances.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Aucun solde fournisseur pour cette période
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Compte</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead className="text-right">Débit</TableHead>
                  <TableHead className="text-right">Crédit</TableHead>
                  <TableHead className="text-right">Solde (dû)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balances.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono">{item.account_code}</TableCell>
                    <TableCell>{item.partner_name}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatAmount(item.total_debit)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatAmount(item.total_credit)}
                    </TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${item.balance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatAmount(item.balance)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell colSpan={2}>TOTAL</TableCell>
                  <TableCell className="text-right font-mono">{formatAmount(totals.debit)}</TableCell>
                  <TableCell className="text-right font-mono">{formatAmount(totals.credit)}</TableCell>
                  <TableCell className={`text-right font-mono ${totals.balance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatAmount(totals.balance)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
