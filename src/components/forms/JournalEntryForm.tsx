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
  type: z.enum(["debit", "credit"] as const),
  amount: z.string().min(1, "Montant requis").refine(val => !isNaN(Number(val)) && Number(val) > 0, "Montant invalide"),
});

const journalEntryFormSchema = z.object({
  date: z.string().min(1, "Date requise"),
  journal_id: z.string().min(1, "Journal requis"),
  reference: z.string().optional(),
  description: z.string().min(1, "Description requise"),
  lines: z.array(lineSchema).min(2, "Au moins deux lignes requises"),
}).refine(
  (data) => {
    const totalDebit = data.lines
      .filter(line => line.type === "debit")
      .reduce((sum, line) => sum + Number(line.amount), 0);
    const totalCredit = data.lines
      .filter(line => line.type === "credit")
      .reduce((sum, line) => sum + Number(line.amount), 0);
    return Math.abs(totalDebit - totalCredit) < 0.01;
  },
  {
    message: "Le total débit doit être égal au total crédit",
    path: ["lines"],
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
      lines: [
        { account_id: "", type: "debit", amount: "" },
        { account_id: "", type: "credit", amount: "" },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const watchLines = form.watch("lines");

  const totalDebit = watchLines
    .filter(line => line.type === "debit")
    .reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  
  const totalCredit = watchLines
    .filter(line => line.type === "credit")
    .reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  
  const difference = totalDebit - totalCredit;

  const onSubmit = async (data: JournalEntryFormValues) => {
    setLoading(true);
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Vous devez être connecté pour créer une écriture");
        setLoading(false);
        return;
      }

      // Get user's company_id
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (profileError || !profile?.company_id) {
        console.error("Profile error:", profileError);
        toast.error("Impossible de récupérer les informations de votre entreprise");
        setLoading(false);
        return;
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

      // Create all lines (debit and credit)
      const allLines = data.lines.map(line => ({
        move_id: move.id,
        account_id: line.account_id,
        debit: line.type === "debit" ? Number(line.amount) : 0,
        credit: line.type === "credit" ? Number(line.amount) : 0,
        currency: "CDF",
      }));

      const { error: linesError } = await supabase
        .from("account_move_lines")
        .insert(allLines);

      if (linesError) throw linesError;

      toast.success("Écriture comptable créée avec succès");
      form.reset();
      onSuccess?.();
    } catch (error: any) {
      console.error("Error creating journal entry:", error);
      const errorMessage = error?.message || "Erreur lors de la création de l'écriture";
      toast.error(errorMessage);
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

        {/* Lines Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Lignes d'écriture</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ account_id: "", type: "debit", amount: "" })}
              >
                <Plus className="h-4 w-4 mr-1" />
                Ajouter une ligne
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 p-3 border rounded-lg bg-muted/30">
                <div className="col-span-5">
                  <FormField
                    control={form.control}
                    name={`lines.${index}.account_id`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Compte</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-9">
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

                <div className="col-span-3">
                  <FormField
                    control={form.control}
                    name={`lines.${index}.type`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="debit">Débit</SelectItem>
                            <SelectItem value="credit">Crédit</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-3">
                  <FormField
                    control={form.control}
                    name={`lines.${index}.amount`}
                    render={({ field }) => (
                      <FormItem>
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
                </div>

                <div className="col-span-1 flex items-end">
                  {fields.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            <div className="pt-3 border-t space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Débit:</span>
                <span className="font-mono font-semibold">
                  {new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(totalDebit)} CDF
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Crédit:</span>
                <span className="font-mono font-semibold">
                  {new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(totalCredit)} CDF
                </span>
              </div>
              <div className={`flex justify-between font-bold pt-2 border-t ${difference !== 0 ? 'text-destructive' : 'text-primary'}`}>
                <span>Différence:</span>
                <span className="font-mono">
                  {new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(Math.abs(difference))} CDF
                </span>
              </div>
              {difference !== 0 && (
                <p className="text-xs text-destructive">
                  ⚠️ L'écriture doit être équilibrée (Débit = Crédit)
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
