import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Calendar, BookOpen } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface JournalEntry {
  date: string;
  move_number: string;
  ref: string;
  account_code: string;
  account_name: string;
  partner_name: string;
  debit: number;
  credit: number;
}

interface Journal {
  id: string;
  code: string;
  name: string;
}

export function JournauxAuxiliaires() {
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [selectedJournalId, setSelectedJournalId] = useState<string>("");
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [totals, setTotals] = useState({ debit: 0, credit: 0 });

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
      loadJournals();
    }
  }, [companyId]);

  useEffect(() => {
    if (selectedJournalId) {
      loadJournalEntries(selectedJournalId);
    }
  }, [selectedJournalId, dateFrom, dateTo]);

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

  const loadJournals = async () => {
    if (!companyId) return;
    
    try {
      const { data, error } = await supabase
        .from("journals")
        .select("id, code, name")
        .eq("company_id", companyId)
        .order("code");

      if (error) {
        console.error("Error loading journals:", error);
        return;
      }

      setJournals(data || []);
      
      if (data && data.length > 0 && !selectedJournalId) {
        setSelectedJournalId(data[0].id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error("Error:", error);
      setLoading(false);
    }
  };

  const loadJournalEntries = async (journalId: string) => {
    setLoading(true);
    try {
      // Get accounts for this company
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, code, name")
        .eq("company_id", companyId);

      const accountMap = new Map(accounts?.map(a => [a.id, { code: a.code, name: a.name }]) || []);

      // Get partners for this company
      const { data: partners } = await supabase
        .from("partners")
        .select("id, name")
        .eq("company_id", companyId);

      const partnerMap = new Map(partners?.map(p => [p.id, p.name]) || []);

      // Get move lines for this journal
      const { data: lines, error } = await supabase
        .from("account_move_lines")
        .select(`
          id,
          debit,
          credit,
          account_id,
          partner_id,
          move:account_moves!inner(id, date, number, ref, state, journal_id)
        `)
        .eq("move.journal_id", journalId)
        .eq("move.state", "posted")
        .gte("move.date", dateFrom)
        .lte("move.date", dateTo);

      if (error) {
        console.error("Error loading entries:", error);
        setLoading(false);
        return;
      }

      if (!lines || lines.length === 0) {
        setEntries([]);
        setTotals({ debit: 0, credit: 0 });
        setLoading(false);
        return;
      }

      // Sort by date then move number
      const sortedLines = [...lines].sort((a: any, b: any) => {
        const dateCompare = new Date(a.move?.date || 0).getTime() - new Date(b.move?.date || 0).getTime();
        if (dateCompare !== 0) return dateCompare;
        return (a.move?.number || "").localeCompare(b.move?.number || "");
      });

      let totalDebit = 0;
      let totalCredit = 0;
      const entryList: JournalEntry[] = [];

      sortedLines.forEach((line: any) => {
        const debit = Number(line.debit || 0);
        const credit = Number(line.credit || 0);
        totalDebit += debit;
        totalCredit += credit;

        const accountInfo = accountMap.get(line.account_id) || { code: "", name: "" };

        entryList.push({
          date: line.move?.date || "",
          move_number: line.move?.number || "",
          ref: line.move?.ref || "",
          account_code: accountInfo.code,
          account_name: accountInfo.name,
          partner_name: line.partner_id ? partnerMap.get(line.partner_id) || "" : "",
          debit,
          credit,
        });
      });

      setEntries(entryList);
      setTotals({ debit: totalDebit, credit: totalCredit });
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
    const journal = journals.find(j => j.id === selectedJournalId);
    if (!journal) return;

    const rows: string[] = [
      `Journal ${journal.code} - ${journal.name}`,
      `Du ${new Date(dateFrom).toLocaleDateString("fr-FR")} au ${new Date(dateTo).toLocaleDateString("fr-FR")}`,
      "",
      "Date,Numéro,Référence,Compte,Libellé Compte,Tiers,Débit,Crédit"
    ];
    
    entries.forEach((entry) => {
      rows.push(
        `${new Date(entry.date).toLocaleDateString("fr-FR")},${entry.move_number},${entry.ref},${entry.account_code},"${entry.account_name}","${entry.partner_name}",${formatAmount(entry.debit)},${formatAmount(entry.credit)}`
      );
    });
    
    rows.push(`TOTAL,,,,,,${formatAmount(totals.debit)},${formatAmount(totals.credit)}`);

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `journal_${journal.code}_${dateFrom}_${dateTo}.csv`;
    link.click();
  };

  const selectedJournal = journals.find(j => j.id === selectedJournalId);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Journaux Auxiliaires
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Détail des écritures par journal
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <Select value={selectedJournalId} onValueChange={setSelectedJournalId}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Sélectionner un journal" />
              </SelectTrigger>
              <SelectContent>
                {journals.map((journal) => (
                  <SelectItem key={journal.id} value={journal.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{journal.code}</span>
                      <span>{journal.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="dateFromJournal" className="sr-only">Du</Label>
              <Input
                id="dateFromJournal"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[140px]"
              />
              <span className="text-muted-foreground">au</span>
              <Label htmlFor="dateToJournal" className="sr-only">Au</Label>
              <Input
                id="dateToJournal"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[140px]"
              />
            </div>
            
            <Button onClick={downloadCSV} variant="outline" disabled={entries.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        {selectedJournal && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Journal</div>
                <div className="font-mono font-semibold">{selectedJournal.code}</div>
                <div className="text-sm">{selectedJournal.name}</div>
              </CardContent>
            </Card>
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
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : journals.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Aucun journal trouvé
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Aucune écriture pour ce journal sur cette période
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Compte</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead>Tiers</TableHead>
                  <TableHead className="text-right">Débit</TableHead>
                  <TableHead className="text-right">Crédit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{new Date(entry.date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell className="font-mono">{entry.move_number}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.ref || "-"}</TableCell>
                    <TableCell className="font-mono">{entry.account_code}</TableCell>
                    <TableCell>{entry.account_name}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.partner_name || "-"}</TableCell>
                    <TableCell className="text-right font-mono">
                      {entry.debit > 0 ? formatAmount(entry.debit) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {entry.credit > 0 ? formatAmount(entry.credit) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell colSpan={6}>TOTAL</TableCell>
                  <TableCell className="text-right font-mono">{formatAmount(totals.debit)}</TableCell>
                  <TableCell className="text-right font-mono">{formatAmount(totals.credit)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
