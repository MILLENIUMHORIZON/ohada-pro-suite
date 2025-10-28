import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";

const accountFormSchema = z.object({
  code: z.string().min(1, "Le code est requis"),
  name: z.string().min(1, "Le nom est requis"),
  type: z.enum(["asset", "liability", "equity", "income", "expense"]),
  reconcilable: z.boolean().default(false),
});

type AccountFormValues = z.infer<typeof accountFormSchema>;

interface AccountFormProps {
  onSuccess?: () => void;
  defaultValues?: Partial<AccountFormValues>;
}

export function AccountForm({ onSuccess, defaultValues }: AccountFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: defaultValues || {
      code: "",
      name: "",
      type: "asset",
      reconcilable: false,
    },
  });

  async function onSubmit(data: AccountFormValues) {
    try {
      setIsLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.company_id) throw new Error("Entreprise non trouvée");

      const { error } = await supabase.from("accounts").insert([{
        code: data.code,
        name: data.name,
        type: data.type as any,
        reconcilable: data.reconcilable,
        company_id: profile.company_id,
      }]);

      if (error) throw error;

      toast.success("Compte créé avec succès");
      form.reset();
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la création du compte");
    } finally {
      setIsLoading(false);
    }
  }

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
                <Input placeholder="Ex: 411001" {...field} />
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
              <FormLabel>Nom du compte</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Client XYZ" {...field} />
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
              <FormLabel>Type de compte</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner le type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="asset">Actif</SelectItem>
                  <SelectItem value="liability">Passif</SelectItem>
                  <SelectItem value="equity">Capitaux propres</SelectItem>
                  <SelectItem value="income">Produit</SelectItem>
                  <SelectItem value="expense">Charge</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="reconcilable"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  Lettrable
                </FormLabel>
                <p className="text-sm text-muted-foreground">
                  Permet le lettrage des écritures (rapprochement)
                </p>
              </div>
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Création..." : "Créer le compte"}
        </Button>
      </form>
    </Form>
  );
}
