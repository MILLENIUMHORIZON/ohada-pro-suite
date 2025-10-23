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
import { useEffect, useState } from "react";

const leadFormSchema = z.object({
  title: z.string().min(1, "Le titre est requis").max(200),
  partner_id: z.string().min(1, "Le client est requis"),
  stage_id: z.string().min(1, "L'étape est requise"),
  expected_revenue: z.string().optional(),
  probability: z.string().optional(),
  close_date: z.string().optional(),
  source: z.string().optional(),
  description: z.string().optional(),
});

type LeadFormValues = z.infer<typeof leadFormSchema>;

interface LeadFormProps {
  onSuccess?: () => void;
  defaultValues?: Partial<LeadFormValues>;
}

export function LeadForm({ onSuccess, defaultValues }: LeadFormProps) {
  const [partners, setPartners] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      title: "",
      partner_id: "",
      stage_id: "",
      expected_revenue: "0",
      probability: "0",
      close_date: "",
      source: "",
      description: "",
      ...defaultValues,
    },
  });

  useEffect(() => {
    loadPartners();
    loadStages();
  }, []);

  const loadPartners = async () => {
    const { data, error } = await supabase
      .from("partners")
      .select("id, name")
      .order("name");
    
    if (error) {
      toast.error("Erreur lors du chargement des clients");
      return;
    }
    setPartners(data || []);
  };

  const loadStages = async () => {
    const { data, error } = await supabase
      .from("crm_stages")
      .select("id, name, pipeline_id")
      .order("order_seq");
    
    if (error) {
      toast.error("Erreur lors du chargement des étapes");
      return;
    }
    setStages(data || []);
  };

  const onSubmit = async (values: LeadFormValues) => {
    setIsLoading(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id, user_id")
        .single();

      if (!profile) {
        toast.error("Impossible de récupérer les informations utilisateur");
        return;
      }

      const { error } = await supabase.from("crm_leads").insert({
        title: values.title,
        partner_id: values.partner_id,
        stage_id: values.stage_id,
        expected_revenue: parseFloat(values.expected_revenue || "0"),
        probability: parseInt(values.probability || "0"),
        close_date: values.close_date || null,
        source: values.source || null,
        description: values.description || null,
        company_id: profile.company_id,
        owner_id: profile.user_id,
      });

      if (error) throw error;

      toast.success("Opportunité créée avec succès");
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
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Titre *</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Vente système ERP" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="partner_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Client *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {partners.map((partner) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.name}
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
          name="stage_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Étape *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une étape" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
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
            name="expected_revenue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Revenu Estimé</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="probability"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Probabilité (%)</FormLabel>
                <FormControl>
                  <Input type="number" min="0" max="100" placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="close_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date de Clôture</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="source"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Source</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Site web, Appel" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Détails de l'opportunité..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Création..." : "Créer l'opportunité"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
