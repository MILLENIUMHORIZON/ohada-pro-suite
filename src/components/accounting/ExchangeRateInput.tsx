import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface ExchangeRateInputProps {
  currency: string;
  value: number;
  onChange: (rate: number) => void;
  companyId: string | null;
}

export function ExchangeRateInput({ currency, value, onChange, companyId }: ExchangeRateInputProps) {
  const [loading, setLoading] = useState(false);

  const fetchLatestRate = async () => {
    if (!companyId || currency === "CDF") return;

    setLoading(true);
    try {
      // First try to get from exchange_rates table
      const { data, error } = await supabase
        .rpc('get_latest_exchange_rate', {
          p_company_id: companyId,
          p_from_currency: currency,
          p_to_currency: 'CDF',
        });

      if (!error && data && data !== 1) {
        onChange(data);
        toast.success(`Taux ${currency}/CDF: ${data}`);
        return;
      }

      // Fallback to currencies table
      const { data: currencyData } = await supabase
        .from("currencies")
        .select("rate")
        .eq("company_id", companyId)
        .eq("code", currency)
        .single();

      if (currencyData?.rate) {
        onChange(currencyData.rate);
        toast.success(`Taux ${currency}/CDF: ${currencyData.rate}`);
      }
    } catch (error) {
      console.error("Error fetching rate:", error);
      toast.error("Impossible de récupérer le taux");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currency && currency !== "CDF" && value === 1) {
      fetchLatestRate();
    }
  }, [currency, companyId]);

  if (currency === "CDF") {
    return null;
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <Label className="text-xs flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          Taux {currency}/CDF
        </Label>
        <Input
          type="number"
          step="0.01"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-9"
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9"
        onClick={fetchLatestRate}
        disabled={loading}
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
}
