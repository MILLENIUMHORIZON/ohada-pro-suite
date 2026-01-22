import { useState } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, Loader2, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
};

const formSchema = z.object({
  beneficiary: z.string().min(1, "Le bénéficiaire est requis"),
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
  const [lines, setLines] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: "", quantity: 1, unit_price: 0 }
  ]);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      beneficiary: "",
      currency: "CDF",
      description: "",
      request_date: new Date(),
    },
  });

  const addLine = () => {
    setLines([...lines, { id: crypto.randomUUID(), description: "", quantity: 1, unit_price: 0 }]);
  };

  const removeLine = (id: string) => {
    if (lines.length > 1) {
      setLines(lines.filter(line => line.id !== id));
    }
  };

  const updateLine = (id: string, field: keyof LineItem, value: string | number) => {
    setLines(lines.map(line => 
      line.id === id ? { ...line, [field]: value } : line
    ));
  };

  const calculateSubtotal = (line: LineItem) => line.quantity * line.unit_price;
  
  const calculateTotal = () => lines.reduce((sum, line) => sum + calculateSubtotal(line), 0);

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('fr-CD', {
      style: 'currency',
      currency: currency === 'CDF' ? 'CDF' : 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const onSubmit = async (values: FormValues, submitType: 'draft' | 'submit') => {
    // Validate lines
    const validLines = lines.filter(line => line.description.trim() !== "" && line.unit_price > 0);
    if (validLines.length === 0) {
      toast({
        title: "Erreur",
        description: "Veuillez ajouter au moins un article valide",
        variant: "destructive",
      });
      return;
    }

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

      const totalAmount = calculateTotal();

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
          amount: totalAmount,
          currency: values.currency,
          description: values.description,
          request_date: values.request_date.toISOString().split('T')[0],
          status: submitType === 'submit' ? 'submitted' : 'draft',
          requester_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Insert fund request lines
      const linesToInsert = validLines.map(line => ({
        fund_request_id: fundRequest.id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
      }));

      const { error: linesError } = await supabase
        .from('fund_request_lines')
        .insert(linesToInsert);

      if (linesError) throw linesError;

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
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Motif / Description générale *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Décrivez le motif général de cette demande de fonds..."
                  className="min-h-[80px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Articles / Lines */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <FormLabel className="text-base font-semibold">Articles</FormLabel>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Description</TableHead>
                  <TableHead className="w-[15%]">Quantité</TableHead>
                  <TableHead className="w-[20%]">Prix unitaire</TableHead>
                  <TableHead className="w-[20%]">Sous-total</TableHead>
                  <TableHead className="w-[5%]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <Input
                        placeholder="Description de l'article"
                        value={line.description}
                        onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.id, 'quantity', parseFloat(e.target.value) || 1)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unit_price}
                        onChange={(e) => updateLine(line.id, 'unit_price', parseFloat(e.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatAmount(calculateSubtotal(line), form.watch('currency'))}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(line.id)}
                        disabled={lines.length === 1}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Total */}
          <div className="flex justify-end">
            <div className="bg-muted rounded-lg px-6 py-3 text-right">
              <span className="text-muted-foreground mr-4">Total:</span>
              <span className="text-xl font-bold">
                {formatAmount(calculateTotal(), form.watch('currency'))}
              </span>
            </div>
          </div>
        </div>

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
