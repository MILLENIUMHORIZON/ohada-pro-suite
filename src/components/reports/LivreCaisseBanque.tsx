import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Wallet, Building2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface TreasuryEntry {
  date: string;
  move_number: string;
  journal: string;
  ref: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface TreasuryAccount {
  id: string;
  code: string;
  name: string;
  type: 'cash' | 'bank';
}

export function LivreCaisseBanque() {
  const [loading, setLoading] = useState(true);
  const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [entries, setEntries] = useState<TreasuryEntry[]>([]);
  const [totals, setTotals] = useState({ debit: 0, credit: 0, balance: 0 });

  useEffect(() => {
    loadTreasuryAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      loadAccountEntries(selectedAccountId);
    }
  }, [selectedAccountId]);

  const loadTreasuryAccounts = async () => {
    try {
      // Comptes de trésorerie: 52xx (Banque) et 57xx (Caisse)
      const { data, error } = await supabase
        .from("accounts")
        .select("id, code, name")
        .or("code.like.52%,code.like.57%")
        .order("code");

      if (error) {
        console.error("Error loading treasury accounts:", error);
        return;
      }

      const accounts: TreasuryAccount[] = (data || []).map(acc => ({
        id: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.code.startsWith("57") ? 'cash' : 'bank'
      }));

      setTreasuryAccounts(accounts);
      
      // Select first account by default
      if (accounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accounts[0].id);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAccountEntries = async (accountId: string) => {
    setLoading(true);
    try {
      const { data: lines, error } = await supabase
        .from("account_move_lines")
        .select(`
          id,
          debit,
          credit,
          name,
          move:account_moves!inner(id, date, number, ref, state, journal:journals(name))
        `)
        .eq("account_id", accountId)
        .eq("move.state", "posted")
        .order("move.date", { ascending: true });

      if (error) {
        console.error("Error loading entries:", error);
        setLoading(false);
        return;
      }

      if (!lines || lines.length === 0) {
        setEntries([]);
        setTotals({ debit: 0, credit: 0, balance: 0 });
        setLoading(false);
        return;
      }

      // Sort by date and compute running balance
      const sortedLines = [...lines].sort((a: any, b: any) => 
        new Date(a.move?.date || 0).getTime() - new Date(b.move?.date || 0).getTime()
      );

      let runningBalance = 0;
      let totalDebit = 0;
      let totalCredit = 0;
      const entryList: TreasuryEntry[] = [];

      sortedLines.forEach((line: any) => {
        const debit = Number(line.debit || 0);
        const credit = Number(line.credit || 0);
        runningBalance += debit - credit;
        totalDebit += debit;
        totalCredit += credit;

        entryList.push({
          date: line.move?.date || "",
          move_number: line.move?.number || "",
          journal: line.move?.journal?.name || "",
          ref: line.move?.ref || "",
          description: line.name || "",
          debit,
          credit,
          balance: runningBalance,
        });
      });

      setEntries(entryList);
      setTotals({ debit: totalDebit, credit: totalCredit, balance: runningBalance });
    } catch (error) {
      console.error("Error:", error);
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
    const account = treasuryAccounts.find(a => a.id === selectedAccountId);
    if (!account) return;

    const rows: string[] = [
      `Livre de ${account.type === 'cash' ? 'Caisse' : 'Banque'} - ${account.code} ${account.name}`,
      "",
      "Date,Numéro,Journal,Référence,Description,Débit,Crédit,Solde"
    ];
    
    entries.forEach((entry) => {
      rows.push(
        `${new Date(entry.date).toLocaleDateString("fr-FR")},${entry.move_number},${entry.journal},${entry.ref},"${entry.description}",${formatAmount(entry.debit)},${formatAmount(entry.credit)},${formatAmount(entry.balance)}`
      );
    });
    
    rows.push(`TOTAL,,,,,${formatAmount(totals.debit)},${formatAmount(totals.credit)},${formatAmount(totals.balance)}`);

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `livre_${account.type}_${account.code}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const selectedAccount = treasuryAccounts.find(a => a.id === selectedAccountId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {selectedAccount?.type === 'cash' ? (
                <Wallet className="h-5 w-5" />
              ) : (
                <Building2 className="h-5 w-5" />
              )}
              Livre de Caisse & Banque
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Mouvements et solde des comptes de trésorerie
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Sélectionner un compte" />
              </SelectTrigger>
              <SelectContent>
                {treasuryAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    <div className="flex items-center gap-2">
                      {account.type === 'cash' ? (
                        <Wallet className="h-4 w-4 text-green-600" />
                      ) : (
                        <Building2 className="h-4 w-4 text-blue-600" />
                      )}
                      <span className="font-mono">{account.code}</span>
                      <span>{account.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={downloadCSV} variant="outline" disabled={entries.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Card */}
        {selectedAccount && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Compte</div>
                <div className="font-mono font-semibold">{selectedAccount.code}</div>
                <div className="text-sm">{selectedAccount.name}</div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
              <CardContent className="pt-4">
                <div className="text-sm text-green-600 dark:text-green-400">Total Entrées</div>
                <div className="text-xl font-mono font-bold text-green-700 dark:text-green-300">
                  {formatAmount(totals.debit)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
              <CardContent className="pt-4">
                <div className="text-sm text-red-600 dark:text-red-400">Total Sorties</div>
                <div className="text-xl font-mono font-bold text-red-700 dark:text-red-300">
                  {formatAmount(totals.credit)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-4">
                <div className="text-sm text-primary">Solde Actuel</div>
                <div className={`text-xl font-mono font-bold ${totals.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatAmount(totals.balance)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : treasuryAccounts.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Aucun compte de trésorerie trouvé (52xx ou 57xx)
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Aucune écriture pour ce compte
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Journal</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Entrée</TableHead>
                  <TableHead className="text-right">Sortie</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{new Date(entry.date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell className="font-mono">{entry.move_number}</TableCell>
                    <TableCell>{entry.journal}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.ref || "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{entry.description || "-"}</TableCell>
                    <TableCell className="text-right font-mono text-green-600">
                      {entry.debit > 0 ? formatAmount(entry.debit) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-600">
                      {entry.credit > 0 ? formatAmount(entry.credit) : "-"}
                    </TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${entry.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatAmount(entry.balance)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell colSpan={5}>TOTAL</TableCell>
                  <TableCell className="text-right font-mono text-green-600">{formatAmount(totals.debit)}</TableCell>
                  <TableCell className="text-right font-mono text-red-600">{formatAmount(totals.credit)}</TableCell>
                  <TableCell className={`text-right font-mono ${totals.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
