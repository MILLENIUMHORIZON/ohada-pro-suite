import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save, AlertTriangle } from "lucide-react";

interface TreasuryAccount {
  id: string;
  code: string;
  name: string;
  currency: string | null;
}

export function TreasuryAccountSettings() {
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile?.company_id) return;

      const [accountsRes, currenciesRes] = await Promise.all([
        supabase
          .from("accounts")
          .select("id, code, name, currency")
          .eq("company_id", profile.company_id)
          .or("code.like.52%,code.like.57%,code.like.51%,code.like.53%")
          .order("code"),
        supabase
          .from("currencies")
          .select("*")
          .eq("company_id", profile.company_id)
          .order("code"),
      ]);

      if (accountsRes.data) setAccounts(accountsRes.data);
      if (currenciesRes.data) setCurrencies(currenciesRes.data);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const handleCurrencyChange = async (accountId: string, currency: string) => {
    setSaving(accountId);
    try {
      const { error } = await supabase
        .from("accounts")
        .update({ currency })
        .eq("id", accountId);

      if (error) throw error;

      setAccounts(accounts.map(a => 
        a.id === accountId ? { ...a, currency } : a
      ));
      toast.success("Devise mise à jour avec succès");
    } catch (error) {
      console.error("Error updating currency:", error);
      toast.error("Erreur lors de la mise à jour de la devise");
    } finally {
      setSaving(null);
    }
  };

  const accountsWithoutCurrency = accounts.filter(a => !a.currency);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Liaison Comptes de Trésorerie ↔ Devises</CardTitle>
        <CardDescription>
          Chaque compte de trésorerie (caisse, banque) doit être lié à une seule devise.
          Un compte sans devise ne peut pas être utilisé pour les écritures.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {accountsWithoutCurrency.length > 0 && (
          <div className="flex items-start gap-2 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">
                {accountsWithoutCurrency.length} compte(s) de trésorerie sans devise
              </p>
              <p className="text-sm text-muted-foreground">
                Ces comptes ne peuvent pas être utilisés tant qu'une devise n'est pas assignée.
              </p>
            </div>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Nom du compte</TableHead>
              <TableHead>Devise</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.length > 0 ? (
              accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-mono font-semibold">
                    {account.code}
                  </TableCell>
                  <TableCell>{account.name}</TableCell>
                  <TableCell>
                    <Select
                      value={account.currency || ""}
                      onValueChange={(value) => handleCurrencyChange(account.id, value)}
                      disabled={saving === account.id}
                    >
                      <SelectTrigger className="w-32">
                        {saving === account.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <SelectValue placeholder="Choisir..." />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((currency) => (
                          <SelectItem key={currency.id} value={currency.code}>
                            {currency.code} ({currency.symbol})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {account.currency ? (
                      <Badge variant="default">Configuré</Badge>
                    ) : (
                      <Badge variant="destructive">Non configuré</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Aucun compte de trésorerie trouvé (codes 51x, 52x, 53x, 57x)
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
