import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface LedgerLine {
  date: string;
  move_number: string;
  journal: string;
  ref: string;
  debit: number;
  credit: number;
  balance: number;
}

interface AccountLedger {
  code: string;
  name: string;
  lines: LedgerLine[];
  total_debit: number;
  total_credit: number;
  final_balance: number;
}

export function GrandLivre() {
  const [loading, setLoading] = useState(true);
  const [ledgers, setLedgers] = useState<AccountLedger[]>([]);
  const [openAccounts, setOpenAccounts] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadGrandLivre();
  }, []);

  const loadGrandLivre = async () => {
    setLoading(true);
    try {
      // Get all move lines with their account and move info in a single query
      const { data: lines, error } = await supabase
        .from("account_move_lines")
        .select(`
          id,
          debit,
          credit,
          account:accounts!inner(id, code, name),
          move:account_moves!inner(date, number, ref, state, journal:journals(name))
        `)
        .eq("move.state", "posted")
        .order("account.code", { ascending: true });

      if (error) {
        console.error("Error fetching ledger data:", error);
        setLoading(false);
        return;
      }

      if (!lines || lines.length === 0) {
        setLedgers([]);
        setLoading(false);
        return;
      }

      // Group lines by account
      const accountMap = new Map<string, {
        code: string;
        name: string;
        lines: any[];
      }>();

      lines.forEach((line: any) => {
        const accountId = line.account?.id;
        if (!accountId) return;

        if (!accountMap.has(accountId)) {
          accountMap.set(accountId, {
            code: line.account.code,
            name: line.account.name,
            lines: [],
          });
        }

        accountMap.get(accountId)!.lines.push({
          date: line.move?.date || "",
          move_number: line.move?.number || "",
          journal: line.move?.journal?.name || "",
          ref: line.move?.ref || "",
          debit: Number(line.debit || 0),
          credit: Number(line.credit || 0),
        });
      });

      // Sort lines by date and compute running balances
      const ledgerData: AccountLedger[] = [];

      // Sort accounts by code
      const sortedAccounts = Array.from(accountMap.entries()).sort((a, b) => 
        a[1].code.localeCompare(b[1].code)
      );

      sortedAccounts.forEach(([_, account]) => {
        // Sort lines by date
        account.lines.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let runningBalance = 0;
        let totalDebit = 0;
        let totalCredit = 0;
        const ledgerLines: LedgerLine[] = [];

        account.lines.forEach((line) => {
          runningBalance += line.debit - line.credit;
          totalDebit += line.debit;
          totalCredit += line.credit;

          ledgerLines.push({
            ...line,
            balance: runningBalance,
          });
        });

        ledgerData.push({
          code: account.code,
          name: account.name,
          lines: ledgerLines,
          total_debit: totalDebit,
          total_credit: totalCredit,
          final_balance: runningBalance,
        });
      });

      setLedgers(ledgerData);
    } catch (error) {
      console.error("Error loading grand livre:", error);
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

  const toggleAccount = (code: string) => {
    const newOpen = new Set(openAccounts);
    if (newOpen.has(code)) {
      newOpen.delete(code);
    } else {
      newOpen.add(code);
    }
    setOpenAccounts(newOpen);
  };

  const downloadCSV = () => {
    const rows: string[] = ["Grand Livre - Détail des écritures par compte", ""];
    
    ledgers.forEach((ledger) => {
      rows.push(`Compte: ${ledger.code} - ${ledger.name}`);
      rows.push("Date,Numéro,Journal,Référence,Débit,Crédit,Solde");
      ledger.lines.forEach((line) => {
        rows.push(
          `${new Date(line.date).toLocaleDateString("fr-FR")},${line.move_number},${line.journal},${line.ref},${formatAmount(line.debit)},${formatAmount(line.credit)},${formatAmount(line.balance)}`
        );
      });
      rows.push(`TOTAL,,,,${formatAmount(ledger.total_debit)},${formatAmount(ledger.total_credit)},${formatAmount(ledger.final_balance)}`);
      rows.push("");
    });

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `grand_livre_${new Date().toISOString().split("T")[0]}.csv`;
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
            <CardTitle>Grand Livre</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Détail des écritures par compte</p>
          </div>
          <Button onClick={downloadCSV} variant="outline" disabled={ledgers.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Télécharger CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {ledgers.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Aucune écriture comptable trouvée
            </div>
          ) : (
            ledgers.map((ledger) => (
              <Collapsible
                key={ledger.code}
                open={openAccounts.has(ledger.code)}
                onOpenChange={() => toggleAccount(ledger.code)}
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer">
                    <div className="flex items-center gap-2">
                      {openAccounts.has(ledger.code) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-mono font-medium">{ledger.code}</span>
                      <span>{ledger.name}</span>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span>Solde: <span className="font-mono font-semibold">{formatAmount(ledger.final_balance)}</span></span>
                      <span className="text-muted-foreground">{ledger.lines.length} écritures</span>
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Numéro</TableHead>
                          <TableHead>Journal</TableHead>
                          <TableHead>Référence</TableHead>
                          <TableHead className="text-right">Débit</TableHead>
                          <TableHead className="text-right">Crédit</TableHead>
                          <TableHead className="text-right">Solde</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledger.lines.map((line, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{new Date(line.date).toLocaleDateString("fr-FR")}</TableCell>
                            <TableCell className="font-mono">{line.move_number}</TableCell>
                            <TableCell>{line.journal}</TableCell>
                            <TableCell className="text-muted-foreground">{line.ref || "-"}</TableCell>
                            <TableCell className="text-right font-mono">
                              {line.debit > 0 ? formatAmount(line.debit) : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {line.credit > 0 ? formatAmount(line.credit) : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold">
                              {formatAmount(line.balance)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold bg-muted/50">
                          <TableCell colSpan={4}>TOTAL</TableCell>
                          <TableCell className="text-right font-mono">{formatAmount(ledger.total_debit)}</TableCell>
                          <TableCell className="text-right font-mono">{formatAmount(ledger.total_credit)}</TableCell>
                          <TableCell className="text-right font-mono">{formatAmount(ledger.final_balance)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
