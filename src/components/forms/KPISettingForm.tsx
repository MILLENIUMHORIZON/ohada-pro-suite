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
  FormDescription,
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";

const kpiFormSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  description: z.string().optional(),
  unit: z.enum(["amount", "count", "percentage"]),
  calculation_type: z.enum(["sum", "average", "count", "custom"]),
  target_period: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]),
  is_active: z.boolean().default(true),
});

type KPIFormValues = z.infer<typeof kpiFormSchema>;

interface KPISettingFormProps {
  kpiId?: string;
  onSuccess?: () => void;
}

export function KPISettingForm({ kpiId, onSuccess }: KPISettingFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<KPIFormValues>({
    resolver: zodResolver(kpiFormSchema),
    defaultValues: {
      name: "",
      description: "",
      unit: "amount",
      calculation_type: "sum",
      target_period: "monthly",
      is_active: true,
    },
  });

  const onSubmit = async (values: KPIFormValues) => {
    setIsLoading(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile?.company_id) {
        toast.error("Erreur d'authentification");
        return;
      }

      const { error } = await supabase
        .from("sales_kpi_settings")
        .insert([{
          company_id: profile.company_id,
          ...values,
        }]);

      if (error) throw error;

      toast.success("Indicateur créé avec succès");
      form.reset();
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la création");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom de l'indicateur *</FormLabel>
              <FormControl>
                <Input placeholder="Chiffre d'affaires mensuel" {...field} />
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
                  placeholder="Montant total des ventes..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unité *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une unité" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="amount">Montant (CDF)</SelectItem>
                    <SelectItem value="count">Nombre</SelectItem>
                    <SelectItem value="percentage">Pourcentage (%)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="calculation_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type de calcul *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Type de calcul" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="sum">Somme</SelectItem>
                    <SelectItem value="average">Moyenne</SelectItem>
                    <SelectItem value="count">Comptage</SelectItem>
                    <SelectItem value="custom">Personnalisé</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="target_period"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Période cible *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Période" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="daily">Journalier</SelectItem>
                  <SelectItem value="weekly">Hebdomadaire</SelectItem>
                  <SelectItem value="monthly">Mensuel</SelectItem>
                  <SelectItem value="quarterly">Trimestriel</SelectItem>
                  <SelectItem value="yearly">Annuel</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">
                  Indicateur actif
                </FormLabel>
                <FormDescription>
                  Activer cet indicateur pour le suivi
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Création..." : "Créer l'indicateur"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
