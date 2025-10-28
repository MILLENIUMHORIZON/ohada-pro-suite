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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

const paymentFormSchema = z.object({
  date: z.string().min(1, "La date est requise"),
  amount: z.string().min(1, "Le montant est requis"),
  method: z.string().min(1, "Le mode de paiement est requis"),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

interface PaymentFormProps {
  invoice: any;
  onSuccess?: () => void;
}

export function PaymentForm({ invoice, onSuccess }: PaymentFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const remainingAmount = invoice.total_ttc - (invoice.amount_paid || 0);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      amount: remainingAmount.toString(),
      method: "",
      reference: "",
      notes: "",
    },
  });

  const onSubmit = async (values: PaymentFormValues) => {
    setIsLoading(true);
    try {
      const amount = parseFloat(values.amount);

      if (amount <= 0) {
        toast.error("Le montant doit être supérieur à 0");
        return;
      }

      if (amount > remainingAmount) {
        toast.error("Le montant ne peut pas dépasser le montant restant à payer");
        return;
      }

      // Create payment record
      const { error: paymentError } = await supabase
        .from("payments")
        .insert([{
          number: '', // Will be auto-generated
          partner_id: invoice.partner_id,
          invoice_id: invoice.id,
          date: values.date,
          amount,
          method: values.method,
          reference: values.reference || null,
          notes: values.notes || null,
          status: "posted",
          currency: invoice.currency,
        }]);

      if (paymentError) throw paymentError;

      // Update invoice amount_paid and status
      const newAmountPaid = (invoice.amount_paid || 0) + amount;
      const newStatus = newAmountPaid >= invoice.total_ttc ? "paid" : "posted";

      const { error: invoiceError } = await supabase
        .from("invoices")
        .update({
          amount_paid: newAmountPaid,
          status: newStatus,
        })
        .eq("id", invoice.id);

      if (invoiceError) throw invoiceError;

      toast.success("Paiement enregistré avec succès");
      form.reset();
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de l'enregistrement du paiement");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Facture:</span>
            <span className="font-semibold">{invoice.number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Montant total:</span>
            <span className="font-mono font-semibold">
              {new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(invoice.total_ttc)} {invoice.currency}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Déjà payé:</span>
            <span className="font-mono">
              {new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(invoice.amount_paid || 0)} {invoice.currency}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t">
            <span className="text-sm font-medium">Restant à payer:</span>
            <span className="font-mono font-bold text-primary">
              {new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(remainingAmount)} {invoice.currency}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date de paiement *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Montant *</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="method"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mode de paiement *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un mode" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="cash">Espèces</SelectItem>
                  <SelectItem value="bank_transfer">Virement bancaire</SelectItem>
                  <SelectItem value="check">Chèque</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="card">Carte bancaire</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="reference"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Référence</FormLabel>
              <FormControl>
                <Input placeholder="N° de transaction, chèque..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea placeholder="Notes additionnelles..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Enregistrement..." : "Enregistrer le paiement"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
