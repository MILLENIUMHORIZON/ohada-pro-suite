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

const targetFormSchema = z.object({
  user_id: z.string().min(1, "Le commercial est requis"),
  kpi_setting_id: z.string().min(1, "L'indicateur est requis"),
  period_start: z.string().min(1, "La date de début est requise"),
  period_end: z.string().min(1, "La date de fin est requise"),
  target_value: z.string().min(1, "La valeur cible est requise"),
});

type TargetFormValues = z.infer<typeof targetFormSchema>;

interface SalesTargetFormProps {
  onSuccess?: () => void;
}

export function SalesTargetForm({ onSuccess }: SalesTargetFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [kpiSettings, setKpiSettings] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile?.company_id) return;

      // Load users from the same company
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("company_id", profile.company_id);

      if (profilesData) setUsers(profilesData);

      // Load active KPI settings
      const { data: kpiData } = await supabase
        .from("sales_kpi_settings")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (kpiData) setKpiSettings(kpiData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const form = useForm<TargetFormValues>({
    resolver: zodResolver(targetFormSchema),
    defaultValues: {
      user_id: "",
      kpi_setting_id: "",
      period_start: "",
      period_end: "",
      target_value: "",
    },
  });

  const onSubmit = async (values: TargetFormValues) => {
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
        .from("sales_targets")
        .insert([{
          company_id: profile.company_id,
          user_id: values.user_id,
          kpi_setting_id: values.kpi_setting_id,
          period_start: values.period_start,
          period_end: values.period_end,
          target_value: parseFloat(values.target_value),
        }]);

      if (error) throw error;

      toast.success("Objectif créé avec succès");
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
          name="user_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Commercial *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un commercial" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.full_name}
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
          name="kpi_setting_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Indicateur *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un indicateur" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {kpiSettings.map((kpi) => (
                    <SelectItem key={kpi.id} value={kpi.id}>
                      {kpi.name} ({kpi.target_period})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="period_start"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date de début *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="period_end"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date de fin *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="target_value"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Valeur cible *</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="100000"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Création..." : "Créer l'objectif"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
