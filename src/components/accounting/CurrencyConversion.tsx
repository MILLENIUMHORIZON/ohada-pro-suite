import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, ArrowRight, RefreshCw, AlertTriangle } from "lucide-react";

const conversionSchema = z.object({
  from_currency: z.string().min(1, "Sélectionnez la devise source"),
  to_currency: z.string().min(1, "Sélectionnez la devise cible"),
  from_account_id: z.string().min(1, "Sélectionnez le compte source"),
  to_account_id: z.string().min(1, "Sélectionnez le compte cible"),
  amount: z.string().min(1, "Le montant est requis").refine(val => !isNaN(Number(val)) && Number(val) > 0, "Le montant doit être positif"),
  exchange_rate: z.string().min(1, "Le taux est requis").refine(val => !isNaN(Number(val)) && Number(val) > 0, "Le taux doit être positif"),
  notes: z.string().optional(),
});

type ConversionFormValues = z.infer<typeof conversionSchema>;

interface CurrencyConversionProps {
  onSuccess?: () => void;
}

export function CurrencyConversion({ onSuccess }: CurrencyConversionProps) {
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const form = useForm<ConversionFormValues>({
    resolver: zodResolver(conversionSchema),
    defaultValues: {
      from_currency: "",
      to_currency: "",
      from_account_id: "",
      to_account_id: "",
      amount: "",
      exchange_rate: "",
      notes: "",
    },
  });

  const watchFromCurrency = form.watch("from_currency");
  const watchToCurrency = form.watch("to_currency");
  const watchAmount = form.watch("amount");
  const watchRate = form.watch("exchange_rate");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Fetch exchange rate when currencies change
    if (watchFromCurrency && watchToCurrency && watchFromCurrency !== watchToCurrency) {
      fetchExchangeRate();
    }
  }, [watchFromCurrency, watchToCurrency]);

  const loadData = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile?.company_id) return;
      setCompanyId(profile.company_id);

      const [currenciesRes, accountsRes] = await Promise.all([
        supabase
          .from("currencies")
          .select("*")
          .eq("company_id", profile.company_id)
          .order("code"),
        supabase
          .from("accounts")
          .select("id, code, name, currency")
          .eq("company_id", profile.company_id)
          .or("code.like.52%,code.like.57%,code.like.51%,code.like.53%")
          .not("currency", "is", null)
          .order("code"),
      ]);

      if (currenciesRes.data) setCurrencies(currenciesRes.data);
      if (accountsRes.data) setAccounts(accountsRes.data);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExchangeRate = async () => {
    if (!companyId) return;
    
    const { data, error } = await supabase
      .rpc('get_latest_exchange_rate', {
        p_company_id: companyId,
        p_from_currency: watchFromCurrency,
        p_to_currency: watchToCurrency,
      });

    if (!error && data) {
      form.setValue("exchange_rate", data.toString());
    }
  };

  const convertedAmount = () => {
    const amount = Number(watchAmount) || 0;
    const rate = Number(watchRate) || 0;
    return amount * rate;
  };

  const filteredFromAccounts = accounts.filter(a => a.currency === watchFromCurrency);
  const filteredToAccounts = accounts.filter(a => a.currency === watchToCurrency);

  const onSubmit = async (data: ConversionFormValues) => {
    if (!companyId) return;
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const amount = Number(data.amount);
      const rate = Number(data.exchange_rate);
      const toAmount = amount * rate;

      // Get journal for cash transactions (OD or treasury journal)
      const { data: journal } = await supabase
        .from("journals")
        .select("id")
        .eq("company_id", companyId)
        .eq("type", "misc")
        .single();

      if (!journal) throw new Error("Journal non trouvé");

      // Generate move number
      const { data: lastMove } = await supabase
        .from("account_moves")
        .select("number")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextNumber = lastMove?.number
        ? `CONV-${new Date().getFullYear()}-${String(parseInt(lastMove.number.split('-')[2] || '0') + 1).padStart(4, '0')}`
        : `CONV-${new Date().getFullYear()}-0001`;

      // Create the accounting move
      const { data: move, error: moveError } = await supabase
        .from("account_moves")
        .insert({
          number: nextNumber,
          date: new Date().toISOString().split('T')[0],
          journal_id: journal.id,
          ref: `Conversion ${data.from_currency} → ${data.to_currency}`,
          company_id: companyId,
          state: "posted",
          currency: data.to_currency,
          exchange_rate: rate,
        })
        .select()
        .single();

      if (moveError) throw moveError;

      // Create move lines
      // Debit: To account (receiving currency)
      // Credit: From account (sending currency)
      const { error: linesError } = await supabase
        .from("account_move_lines")
        .insert([
          {
            move_id: move.id,
            account_id: data.to_account_id,
            debit: toAmount,
            credit: 0,
            currency: data.to_currency,
            exchange_rate: rate,
          },
          {
            move_id: move.id,
            account_id: data.from_account_id,
            debit: 0,
            credit: amount,
            currency: data.from_currency,
            exchange_rate: rate,
          },
        ]);

      if (linesError) throw linesError;

      // Record the conversion
      const { error: conversionError } = await supabase
        .from("currency_conversions")
        .insert({
          company_id: companyId,
          from_currency: data.from_currency,
          to_currency: data.to_currency,
          from_amount: amount,
          to_amount: toAmount,
          exchange_rate: rate,
          from_account_id: data.from_account_id,
          to_account_id: data.to_account_id,
          account_move_id: move.id,
          notes: data.notes || null,
          created_by: user.id,
        });

      if (conversionError) throw conversionError;

      toast.success(`Conversion effectuée: ${amount} ${data.from_currency} → ${toAmount.toFixed(2)} ${data.to_currency}`);
      form.reset();
      onSuccess?.();
    } catch (error: any) {
      console.error("Error creating conversion:", error);
      toast.error(error.message || "Erreur lors de la conversion");
    } finally {
      setSubmitting(false);
    }
  };

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
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Conversion de Devise
        </CardTitle>
        <CardDescription>
          Effectuer une conversion explicite et tracée entre deux devises.
          L'écriture comptable est générée automatiquement.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-5 gap-4 items-end">
              {/* Source Currency */}
              <FormField
                control={form.control}
                name="from_currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Devise source</FormLabel>
                    <Select onValueChange={(val) => {
                      field.onChange(val);
                      form.setValue("from_account_id", "");
                    }} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Source" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {currencies.map((c) => (
                          <SelectItem key={c.id} value={c.code}>
                            {c.code} ({c.symbol})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-center pb-2">
                <ArrowRight className="h-6 w-6 text-muted-foreground" />
              </div>

              {/* Target Currency */}
              <FormField
                control={form.control}
                name="to_currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Devise cible</FormLabel>
                    <Select onValueChange={(val) => {
                      field.onChange(val);
                      form.setValue("to_account_id", "");
                    }} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Cible" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {currencies.filter(c => c.code !== watchFromCurrency).map((c) => (
                          <SelectItem key={c.id} value={c.code}>
                            {c.code} ({c.symbol})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Amount */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Montant ({watchFromCurrency || "?"})</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Exchange Rate */}
              <FormField
                control={form.control}
                name="exchange_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Taux de change</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.000001" placeholder="1.0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Converted Amount Preview */}
            {watchAmount && watchRate && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Montant converti :</p>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(convertedAmount())} {watchToCurrency}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Source Account */}
              <FormField
                control={form.control}
                name="from_account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Compte source ({watchFromCurrency})</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner le compte source" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredFromAccounts.length > 0 ? (
                          filteredFromAccounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.code} - {a.name}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-sm text-muted-foreground">
                            Aucun compte en {watchFromCurrency}
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Target Account */}
              <FormField
                control={form.control}
                name="to_account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Compte cible ({watchToCurrency})</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner le compte cible" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredToAccounts.length > 0 ? (
                          filteredToAccounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.code} - {a.name}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-sm text-muted-foreground">
                            Aucun compte en {watchToCurrency}
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Motif de la conversion..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Effectuer la conversion
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
