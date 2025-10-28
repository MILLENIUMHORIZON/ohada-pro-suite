import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const lineSchema = z.object({
  account_id: z.string().min(1, "Compte requis"),
  amount: z.string().min(1, "Montant requis").refine(val => !isNaN(Number(val)) && Number(val) > 0, "Montant invalide"),
});

const journalEntryFormSchema = z.object({
  date: z.string().min(1, "Date requise"),
  journal_id: z.string().min(1, "Journal requis"),
  reference: z.string().optional(),
  description: z.string().min(1, "Description requise"),
  debit_lines: z.array(lineSchema).min(1, "Au moins une ligne de débit requise"),
  credit_lines: z.array(lineSchema).min(1, "Au moins une ligne de crédit requise"),
}).refine(
  (data) => {
    const totalDebit = data.debit_lines.reduce((sum, line) => sum + Number(line.amount), 0);
    const totalCredit = data.credit_lines.reduce((sum, line) => sum + Number(line.amount), 0);
    return Math.abs(totalDebit - totalCredit) < 0.01;
  },
  {
    message: "Le total débit doit être égal au total crédit",
    path: ["debit_lines"],
  }
);

type JournalEntryFormValues = z.infer<typeof journalEntryFormSchema>;

interface JournalEntryFormProps {
  onSuccess?: () => void;
}

export function JournalEntryForm({ onSuccess }: JournalEntryFormProps) {
  const [journals, setJournals] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadJournalsAndAccounts();
  }, []);

  const loadJournalsAndAccounts = async () => {
    try {
      const [journalsRes, accountsRes] = await Promise.all([
        supabase.from("journals").select("*").order("name"),
        supabase.from("accounts").select("*").order("code"),
      ]);

      if (journalsRes.data) setJournals(journalsRes.data);
      if (accountsRes.data) setAccounts(accountsRes.data);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erreur lors du chargement des données");
    }
  };

  const form = useForm<JournalEntryFormValues>({
    resolver: zodResolver(journalEntryFormSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      journal_id: "",
      reference: "",
      description: "",
      debit_lines: [{ account_id: "", amount: "" }],
      credit_lines: [{ account_id: "", amount: "" }],
    },
  });

  const { fields: debitFields, append: appendDebit, remove: removeDebit } = useFieldArray({
    control: form.control,
    name: "debit_lines",
  });

  const { fields: creditFields, append: appendCredit, remove: removeCredit } = useFieldArray({
    control: form.control,
    name: "credit_lines",
  });

  const watchDebitLines = form.watch("debit_lines");
  const watchCreditLines = form.watch("credit_lines");

  const totalDebit = watchDebitLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  const totalCredit = watchCreditLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  const difference = totalDebit - totalCredit;

  const onSubmit = async (data: JournalEntryFormValues) => {
    setLoading(true);
    try {
      // Get user's company_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile?.company_id) {
        throw new Error("Company not found");
      }

      // Generate entry number
      const { data: lastMove } = await supabase
        .from("account_moves")
        .select("number")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const nextNumber = lastMove
        ? `JE-${new Date().getFullYear()}-${String(parseInt(lastMove.number.split('-')[2]) + 1).padStart(4, '0')}`
        : `JE-${new Date().getFullYear()}-0001`;

      // Create account move
      const { data: move, error: moveError } = await supabase
        .from("account_moves")
        .insert({
          number: nextNumber,
          date: data.date,
          journal_id: data.journal_id,
          ref: data.reference || null,
          company_id: profile.company_id,
          state: "draft",
        })
        .select()
        .single();

      if (moveError) throw moveError;

      // Create all debit lines
      const debitLines = data.debit_lines.map(line => ({
        move_id: move.id,
        account_id: line.account_id,
        debit: Number(line.amount),
        credit: 0,
        currency: "CDF",
      }));

      const { error: debitError } = await supabase
        .from("account_move_lines")
        .insert(debitLines);

      if (debitError) throw debitError;

      // Create all credit lines
      const creditLines = data.credit_lines.map(line => ({
        move_id: move.id,
        account_id: line.account_id,
        debit: 0,
        credit: Number(line.amount),
        currency: "CDF",
      }));

      const { error: creditError } = await supabase
        .from("account_move_lines")
        .insert(creditLines);

      if (creditError) throw creditError;

      toast.success("Écriture comptable créée avec succès");
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error("Error creating journal entry:", error);
      toast.error("Erreur lors de la création de l'écriture");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="journal_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Journal</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un journal" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {journals.map((journal) => (
                      <SelectItem key={journal.id} value={journal.id}>
                        {journal.code} - {journal.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="reference"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Référence (Optionnel)</FormLabel>
              <FormControl>
                <Input placeholder="FAC-2025-0001" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Description de l'écriture..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 md:grid-cols-2">
          {/* Debit Lines */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Lignes de Débit</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendDebit({ account_id: "", amount: "" })}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {debitFields.map((field, index) => (
                <div key={field.id} className="space-y-2 p-3 border rounded-lg bg-muted/30">
                  <FormField
                    control={form.control}
                    name={`debit_lines.${index}.account_id`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Compte</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Sélectionner" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {accounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.code} - {account.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2">
                    <FormField
                      control={form.control}
                      name={`debit_lines.${index}.amount`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel className="text-xs">Montant (CDF)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="0.00" 
                              step="0.01"
                              className="h-9"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {debitFields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-6 h-9 w-9"
                        onClick={() => removeDebit(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm font-semibold">
                  <span>Total Débit:</span>
                  <span className="font-mono">
                    {new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(totalDebit)} CDF
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Credit Lines */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Lignes de Crédit</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendCredit({ account_id: "", amount: "" })}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {creditFields.map((field, index) => (
                <div key={field.id} className="space-y-2 p-3 border rounded-lg bg-muted/30">
                  <FormField
                    control={form.control}
                    name={`credit_lines.${index}.account_id`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Compte</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Sélectionner" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {accounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.code} - {account.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2">
                    <FormField
                      control={form.control}
                      name={`credit_lines.${index}.amount`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel className="text-xs">Montant (CDF)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="0.00" 
                              step="0.01"
                              className="h-9"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {creditFields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-6 h-9 w-9"
                        onClick={() => removeCredit(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm font-semibold">
                  <span>Total Crédit:</span>
                  <span className="font-mono">
                    {new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(totalCredit)} CDF
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Balance Summary */}
        <Card className={difference !== 0 ? "border-destructive" : "border-primary"}>
          <CardContent className="pt-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total Débit:</span>
                <span className="font-mono">{new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(totalDebit)} CDF</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total Crédit:</span>
                <span className="font-mono">{new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(totalCredit)} CDF</span>
              </div>
              <div className="flex justify-between font-bold pt-2 border-t">
                <span>Différence:</span>
                <span className={`font-mono ${difference !== 0 ? 'text-destructive' : 'text-primary'}`}>
                  {new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(Math.abs(difference))} CDF
                </span>
              </div>
              {difference !== 0 && (
                <p className="text-xs text-destructive pt-2">
                  L'écriture doit être équilibrée (Débit = Crédit)
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Créer l'écriture
          </Button>
        </div>
      </form>
    </Form>
  );
}
