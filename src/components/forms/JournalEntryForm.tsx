import { useForm } from "react-hook-form";
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
import { Loader2 } from "lucide-react";

const journalEntryFormSchema = z.object({
  date: z.string().min(1, "Date requise"),
  journal_id: z.string().min(1, "Journal requis"),
  reference: z.string().optional(),
  description: z.string().min(1, "Description requise"),
  account_debit_id: z.string().min(1, "Compte débit requis"),
  account_credit_id: z.string().min(1, "Compte crédit requis"),
  amount: z.string().min(1, "Montant requis").refine(val => !isNaN(Number(val)) && Number(val) > 0, "Montant invalide"),
});

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
      account_debit_id: "",
      account_credit_id: "",
      amount: "",
    },
  });

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

      const amount = Number(data.amount);

      // Create debit line
      const { error: debitError } = await supabase
        .from("account_move_lines")
        .insert({
          move_id: move.id,
          account_id: data.account_debit_id,
          debit: amount,
          credit: 0,
          currency: "CDF",
        });

      if (debitError) throw debitError;

      // Create credit line
      const { error: creditError } = await supabase
        .from("account_move_lines")
        .insert({
          move_id: move.id,
          account_id: data.account_credit_id,
          debit: 0,
          credit: amount,
          currency: "CDF",
        });

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
          <FormField
            control={form.control}
            name="account_debit_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Compte Débit</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un compte" />
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

          <FormField
            control={form.control}
            name="account_credit_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Compte Crédit</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un compte" />
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
        </div>

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Montant (CDF)</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  step="0.01"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
