import { useForm, useFieldArray } from "react-hook-form";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";

const creditNoteLineSchema = z.object({
  selected: z.boolean(),
  product_id: z.string(),
  description: z.string(),
  qty: z.string(),
  unit_price: z.string(),
  tax_id: z.string().optional(),
});

const creditNoteFormSchema = z.object({
  date: z.string().min(1, "La date est requise"),
  reason: z.string().min(1, "Le motif est requis"),
  lines: z.array(creditNoteLineSchema),
});

type CreditNoteFormValues = z.infer<typeof creditNoteFormSchema>;

interface CreditNoteFormProps {
  invoice: any;
  onSuccess?: () => void;
}

export function CreditNoteForm({ invoice, onSuccess }: CreditNoteFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<CreditNoteFormValues>({
    resolver: zodResolver(creditNoteFormSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      reason: "",
      lines: invoice.lines.map((line: any) => ({
        selected: true,
        product_id: line.product_id,
        description: line.description || line.product?.name || "",
        qty: line.qty.toString(),
        unit_price: line.unit_price.toString(),
        tax_id: line.tax_id || "",
      })),
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const watchLines = form.watch("lines");
  
  const calculateTotals = () => {
    let totalHT = 0;
    let totalTax = 0;

    watchLines.forEach((line, index) => {
      if (line.selected) {
        const qty = parseFloat(line.qty) || 0;
        const unitPrice = parseFloat(line.unit_price) || 0;
        const subtotal = qty * unitPrice;
        totalHT += subtotal;

        const originalLine = invoice.lines[index];
        if (originalLine?.tax) {
          totalTax += (subtotal * originalLine.tax.rate) / 100;
        }
      }
    });

    return { totalHT, totalTax, totalTTC: totalHT + totalTax };
  };

  const { totalHT, totalTax, totalTTC } = calculateTotals();

  const onSubmit = async (values: CreditNoteFormValues) => {
    setIsLoading(true);
    try {
      const selectedLines = values.lines.filter(line => line.selected);

      if (selectedLines.length === 0) {
        toast.error("Veuillez sélectionner au moins une ligne");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile) {
        toast.error("Erreur d'authentification");
        return;
      }

      // Calculate totals for selected lines
      let creditTotalHT = 0;
      let creditTotalTax = 0;

      const creditLines = await Promise.all(
        selectedLines.map(async (line, idx) => {
          const qty = parseFloat(line.qty);
          const unitPrice = parseFloat(line.unit_price);
          const subtotal = qty * unitPrice;
          creditTotalHT += subtotal;

          const originalLineIndex = values.lines.findIndex((l, i) => l === line);
          const originalLine = invoice.lines[originalLineIndex];
          
          let taxAmount = 0;
          if (originalLine?.tax) {
            taxAmount = (subtotal * originalLine.tax.rate) / 100;
            creditTotalTax += taxAmount;
          }

          return {
            product_id: line.product_id,
            description: line.description || null,
            qty: -qty, // Negative quantity for credit note
            unit_price: unitPrice,
            tax_id: line.tax_id || null,
            subtotal: -subtotal, // Negative subtotal
          };
        })
      );

      const creditTotalTTC = creditTotalHT + creditTotalTax;

      // Create credit note as an invoice with negative amounts
      const { data: creditNote, error: creditNoteError } = await supabase
        .from("invoices")
        .insert([{
          number: '', // Will be auto-generated
          partner_id: invoice.partner_id,
          date: values.date,
          due_date: values.date,
          status: "posted",
          type: "customer",
          total_ht: -creditTotalHT, // Negative amounts
          total_tax: -creditTotalTax,
          total_ttc: -creditTotalTTC,
          notes: `Note de crédit pour facture ${invoice.number}. Motif: ${values.reason}`,
          currency: invoice.currency,
        }])
        .select()
        .single();

      if (creditNoteError) throw creditNoteError;

      // Create credit note lines
      const lines = creditLines.map((line) => ({
        ...line,
        invoice_id: creditNote.id,
      }));

      const { error: linesError } = await supabase
        .from("invoice_lines")
        .insert(lines);

      if (linesError) throw linesError;

      // Update original invoice amount_paid (reduce by credit amount)
      const newAmountPaid = Math.max(0, (invoice.amount_paid || 0) - creditTotalTTC);
      const newStatus = newAmountPaid >= invoice.total_ttc ? "paid" : "posted";

      await supabase
        .from("invoices")
        .update({
          amount_paid: newAmountPaid,
          status: newStatus,
        })
        .eq("id", invoice.id);

      toast.success("Note de crédit créée avec succès");
      form.reset();
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la création de la note de crédit");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Facture d'origine:</span>
            <span className="font-semibold">{invoice.number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Client:</span>
            <span className="font-semibold">{invoice.partner?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Montant original:</span>
            <span className="font-mono font-semibold">
              {new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(invoice.total_ttc)} {invoice.currency}
            </span>
          </div>
        </div>

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date de la note de crédit *</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Motif *</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Retour marchandise, erreur de facturation, remise commerciale..." 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Lignes à créditer</h3>
          <div className="border rounded-lg divide-y">
            {fields.map((field, index) => (
              <div key={field.id} className="p-3 space-y-2">
                <div className="flex items-start gap-3">
                  <FormField
                    control={form.control}
                    name={`lines.${index}.selected`}
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2 pt-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="flex-1 grid grid-cols-4 gap-2">
                    <div className="col-span-2">
                      <p className="text-sm font-medium">{invoice.lines[index].product?.name}</p>
                      <p className="text-xs text-muted-foreground">{watchLines[index].description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">Qté: {watchLines[index].qty}</p>
                      <p className="text-xs text-muted-foreground">Prix: {watchLines[index].unit_price}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono">
                        {new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(
                          parseFloat(watchLines[index].qty) * parseFloat(watchLines[index].unit_price)
                        )} {invoice.currency}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-primary/5 p-4 rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span>Total HT:</span>
            <span className="font-mono">{new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(totalHT)} {invoice.currency}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Total TVA:</span>
            <span className="font-mono">{new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(totalTax)} {invoice.currency}</span>
          </div>
          <div className="flex justify-between font-bold pt-2 border-t">
            <span>Montant de la note de crédit:</span>
            <span className="font-mono text-destructive">-{new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(totalTTC)} {invoice.currency}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Création..." : "Créer la note de crédit"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
