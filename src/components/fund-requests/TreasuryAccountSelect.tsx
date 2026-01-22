import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Account = {
  id: string;
  code: string;
  name: string;
};

interface TreasuryAccountSelectProps {
  accounts: Account[];
  value: string | null;
  onValueChange: (value: string) => void;
  requestAmount: number;
  currency: string;
  disabled?: boolean;
}

export function TreasuryAccountSelect({
  accounts,
  value,
  onValueChange,
  requestAmount,
  currency,
  disabled = false,
}: TreasuryAccountSelectProps) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  useEffect(() => {
    if (value) {
      loadBalance(value);
    } else {
      setBalance(null);
    }
  }, [value]);

  const loadBalance = async (accountId: string) => {
    setLoadingBalance(true);
    try {
      const { data, error } = await supabase.rpc('get_account_balance', { p_account_id: accountId });
      if (!error) {
        setBalance(data || 0);
      }
    } catch (error) {
      console.error('Error loading balance:', error);
      setBalance(null);
    } finally {
      setLoadingBalance(false);
    }
  };

  const formatAmount = (amount: number, curr: string) => {
    return new Intl.NumberFormat('fr-CD', {
      style: 'currency',
      currency: curr === 'CDF' ? 'CDF' : 'USD',
    }).format(amount);
  };

  const isInsufficientBalance = balance !== null && balance < requestAmount;
  const isSufficientBalance = balance !== null && balance >= requestAmount;
  const treasuryAccounts = accounts.filter(a => a.code.startsWith('5'));

  return (
    <div className="space-y-2">
      <Label>Compte de trésorerie</Label>
      <Select
        value={value || ""}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectTrigger className={cn(
          isInsufficientBalance && "border-destructive",
          isSufficientBalance && "border-primary"
        )}>
          <SelectValue placeholder="Sélectionner un compte" />
        </SelectTrigger>
        <SelectContent>
          {treasuryAccounts.map(account => (
            <SelectItem key={account.id} value={account.id}>
              {account.code} - {account.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Balance Display */}
      {value && (
        <div className="mt-2">
          {loadingBalance ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Calcul du solde...
            </div>
          ) : balance !== null ? (
            <div className="space-y-2">
              <div className={cn(
                "text-sm font-medium flex items-center gap-2",
                isInsufficientBalance ? "text-destructive" : "text-primary"
              )}>
                Solde disponible: {formatAmount(balance, currency)}
              </div>

              {isInsufficientBalance && (
                <Alert variant="destructive" className="py-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Solde insuffisant ! Le montant demandé est de {formatAmount(requestAmount, currency)}, 
                    mais le solde disponible n'est que de {formatAmount(balance, currency)}.
                  </AlertDescription>
                </Alert>
              )}

              {isSufficientBalance && (
                <Alert className="py-2 border-primary/50 bg-primary/10 text-primary">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-sm text-primary">
                    Solde suffisant pour cette demande.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
