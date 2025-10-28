import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";

const journalFormSchema = z.object({
  code: z.string().min(1, "Le code est obligatoire"),
  name: z.string().min(1, "Le nom est obligatoire"),
  type: z.enum(["sales", "purchases", "bank", "cash", "misc"]),
  default_debit_account_id: z.string().optional(),
  default_credit_account_id: z.string().optional(),
});

type JournalFormValues = z.infer<typeof journalFormSchema>;

interface JournalFormProps {
  journalId?: string;
  onSuccess?: () => void;
}

export function JournalForm({ journalId, onSuccess }: JournalFormProps) {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);

  const form = useForm<JournalFormValues>({
    resolver: zodResolver(journalFormSchema),
    defaultValues: {
      code: "",
      name: "",
      type: "misc",
      default_debit_account_id: undefined,
      default_credit_account_id: undefined,
    },
  });

  useEffect(() => {
    loadAccounts();
    if (journalId) {
      loadJournal();
    }
  }, [journalId]);

  const loadAccounts = async () => {
    const { data } = await supabase
      .from("accounts")
      .select("*")
      .order("code");
    
    if (data) setAccounts(data);
  };

  const loadJournal = async () => {
    if (!journalId) return;

    const { data, error } = await supabase
      .from("journals")
      .select("*")
      .eq("id", journalId)
      .single();

    if (error) {
      toast.error("Erreur lors du chargement du journal");
      return;
    }

    if (data) {
      form.reset({
        code: data.code,
        name: data.name,
        type: data.type,
        default_debit_account_id: data.default_debit_account_id || undefined,
        default_credit_account_id: data.default_credit_account_id || undefined,
      });
    }
  };

  const onSubmit = async (values: JournalFormValues) => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.company_id) throw new Error("Entreprise non trouvée");

      const journalData = {
        code: values.code,
        name: values.name,
        type: values.type,
        default_debit_account_id: values.default_debit_account_id || null,
        default_credit_account_id: values.default_credit_account_id || null,
        company_id: profile.company_id,
      };

      if (journalId) {
        const { error } = await supabase
          .from("journals")
          .update(journalData)
          .eq("id", journalId);

        if (error) throw error;
        toast.success("Journal modifié avec succès");
      } else {
        const { error } = await supabase
          .from("journals")
          .insert(journalData);

        if (error) throw error;
        toast.success("Journal créé avec succès");
      }

      form.reset();
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Code</FormLabel>
              <FormControl>
                <Input placeholder="VTE" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom</FormLabel>
              <FormControl>
                <Input placeholder="Journal des ventes" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="sales">Vente</SelectItem>
                  <SelectItem value="purchases">Achat</SelectItem>
                  <SelectItem value="bank">Banque</SelectItem>
                  <SelectItem value="cash">Caisse</SelectItem>
                  <SelectItem value="misc">Opérations Diverses</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="default_debit_account_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Compte débit par défaut (optionnel)</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
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
          name="default_credit_account_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Compte crédit par défaut (optionnel)</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
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

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "En cours..." : journalId ? "Modifier le journal" : "Créer le journal"}
        </Button>
      </form>
    </Form>
  );
}
