import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  beneficiary: z.string().min(1, "Le bénéficiaire est requis"),
  amount: z.number().min(0.01, "Le montant doit être supérieur à 0"),
  currency: z.enum(["CDF", "USD"]),
  description: z.string().min(1, "Le motif est requis"),
  request_date: z.date(),
});

type FormValues = z.infer<typeof formSchema>;

interface FundRequestFormProps {
  onSuccess?: () => void;
}

export function FundRequestForm({ onSuccess }: FundRequestFormProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      beneficiary: "",
      amount: 0,
      currency: "CDF",
      description: "",
      request_date: new Date(),
    },
  });

  const onSubmit = async (values: FormValues, submitType: 'draft' | 'submit') => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) throw new Error("Entreprise non trouvée");

      // Get next request number
      const { data: requestNumber } = await supabase
        .rpc('get_next_fund_request_number', { p_company_id: profile.company_id });

      // Create fund request
      const { data: fundRequest, error } = await supabase
        .from('fund_requests')
        .insert({
          company_id: profile.company_id,
          request_number: requestNumber,
          beneficiary: values.beneficiary,
          amount: values.amount,
          currency: values.currency,
          description: values.description,
          request_date: values.request_date.toISOString().split('T')[0],
          status: submitType === 'submit' ? 'submitted' : 'draft',
          requester_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Create history entry
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      await supabase.from('fund_request_history').insert({
        fund_request_id: fundRequest.id,
        action: submitType === 'submit' ? 'Soumission' : 'Création brouillon',
        from_status: null,
        to_status: submitType === 'submit' ? 'submitted' : 'draft',
        performed_by: user.id,
        performed_by_name: profileData?.full_name || user.email,
      });

      // Create default workflow steps for company if not exists
      await supabase.rpc('create_default_workflow_steps', { p_company_id: profile.company_id });

      toast({
        title: "Succès",
        description: submitType === 'submit' 
          ? "Demande soumise avec succès" 
          : "Brouillon enregistré",
      });

      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form className="space-y-4">
        <FormField
          control={form.control}
          name="beneficiary"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bénéficiaire *</FormLabel>
              <FormControl>
                <Input placeholder="Nom du bénéficiaire" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Montant *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Devise *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="CDF">CDF - Franc Congolais</SelectItem>
                    <SelectItem value="USD">USD - Dollar Américain</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="request_date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date de la demande *</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "PPP", { locale: fr })
                      ) : (
                        <span>Sélectionner une date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Motif / Description *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Décrivez le motif de cette demande de fonds..."
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={form.handleSubmit((values) => onSubmit(values, 'draft'))}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer brouillon
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={form.handleSubmit((values) => onSubmit(values, 'submit'))}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Soumettre
          </Button>
        </div>
      </form>
    </Form>
  );
}
