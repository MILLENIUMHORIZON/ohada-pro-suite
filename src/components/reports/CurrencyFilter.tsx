import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface CurrencyFilterProps {
  value: string;
  onChange: (value: string) => void;
  showAll?: boolean;
  label?: string;
}

export function CurrencyFilter({ 
  value, 
  onChange, 
  showAll = true,
  label = "Devise" 
}: CurrencyFilterProps) {
  const [currencies, setCurrencies] = useState<any[]>([]);

  useEffect(() => {
    loadCurrencies();
  }, []);

  const loadCurrencies = async () => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .single();

    if (profile?.company_id) {
      const { data } = await supabase
        .from("currencies")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("code");

      if (data) setCurrencies(data);
    }
  };

  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Devise" />
        </SelectTrigger>
        <SelectContent>
          {showAll && (
            <SelectItem value="all">
              Toutes
            </SelectItem>
          )}
          {currencies.map((currency) => (
            <SelectItem key={currency.id} value={currency.code}>
              <span className="flex items-center gap-2">
                {currency.code}
                <Badge variant="outline" className="text-xs">
                  {currency.symbol}
                </Badge>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
