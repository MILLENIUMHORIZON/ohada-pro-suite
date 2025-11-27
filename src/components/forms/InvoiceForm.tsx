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
import { Plus, Trash2 } from "lucide-react";

const invoiceLineSchema = z.object({
  product_id: z.string().min(1, "Le produit est requis"),
  description: z.string().optional(),
  qty: z.string().min(1, "La quantité est requise"),
  unit_price: z.string().min(1, "Le prix est requis"),
  tax_id: z.string().optional(),
});

const invoiceFormSchema = z.object({
  partner_id: z.string().min(1, "Le client est requis"),
  date: z.string().min(1, "La date est requise"),
  due_date: z.string().min(1, "L'échéance est requise"),
  number: z.string().optional(),
  invoice_reference_type: z.string().optional(),
  price_mode: z.enum(["TTC", "HT"]),
  payment_method: z.enum(["ESPECES", "MOBILEMONEY", "VIREMENT", "CARTEBANCAIRE", "CHEQUES", "CREDIT", "AUTRE"]),
  lines: z.array(invoiceLineSchema).min(1, "Au moins une ligne requise"),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

interface InvoiceFormProps {
  invoice?: any;
  invoiceTypeCode?: string;
  onSuccess?: () => void;
}

export function InvoiceForm({ invoice, invoiceTypeCode = 'FV', onSuccess }: InvoiceFormProps) {
  const [partners, setPartners] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      partner_id: "",
      date: new Date().toISOString().split('T')[0],
      due_date: "",
      number: "",
      invoice_reference_type: "",
      price_mode: "TTC",
      payment_method: "ESPECES",
      lines: [{ product_id: "", description: "", qty: "1", unit_price: "0", tax_id: "" }],
    },
  });

  useEffect(() => {
    if (invoice) {
      form.reset({
        partner_id: invoice.partner_id,
        date: invoice.date,
        due_date: invoice.due_date,
        number: invoice.number,
        invoice_reference_type: invoice.invoice_reference_type || "",
        price_mode: "TTC",
        payment_method: invoice.payment_method || "ESPECES",
        lines: invoice.lines.map((line: any) => ({
          product_id: line.product_id,
          description: line.description || "",
          qty: line.qty.toString(),
          unit_price: line.unit_price.toString(),
          tax_id: line.tax_id || "",
        })),
      });
    }
  }, [invoice, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [partnersRes, productsRes, taxesRes] = await Promise.all([
      supabase.from("partners").select("id, name").order("name"),
      supabase.from("products").select("id, name, unit_price").order("name"),
      supabase.from("taxes").select("id, name, rate").order("name"),
    ]);

    if (partnersRes.data) setPartners(partnersRes.data);
    if (productsRes.data) setProducts(productsRes.data);
    if (taxesRes.data) setTaxes(taxesRes.data);
  };

  const onSubmit = async (values: InvoiceFormValues) => {
    setIsLoading(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile) {
        toast.error("Erreur d'authentification");
        return;
      }

      // Calculer les totaux selon le mode de prix
      let totalHT = 0;
      let totalTax = 0;
      const priceMode = values.price_mode;

      const linesWithTotals = await Promise.all(
        values.lines.map(async (line) => {
          const qty = parseFloat(line.qty);
          const inputPrice = parseFloat(line.unit_price);
          
          let unitPriceHT = inputPrice;
          let taxAmount = 0;
          
          if (line.tax_id) {
            const { data: tax } = await supabase
              .from("taxes")
              .select("rate")
              .eq("id", line.tax_id)
              .single();
            
            if (tax && tax.rate > 0) {
              if (priceMode === "TTC") {
                // Prix saisi est TTC, on calcule le HT
                unitPriceHT = inputPrice / (1 + tax.rate / 100);
                taxAmount = inputPrice - unitPriceHT;
              } else {
                // Prix saisi est HT, on calcule la taxe
                unitPriceHT = inputPrice;
                taxAmount = (inputPrice * tax.rate) / 100;
              }
            }
          }

          const subtotalHT = qty * unitPriceHT;
          const subtotalTax = qty * taxAmount;
          
          totalHT += subtotalHT;
          totalTax += subtotalTax;

          return {
            invoice_id: "",
            product_id: line.product_id,
            description: line.description || null,
            qty,
            unit_price: unitPriceHT,
            tax_id: line.tax_id || null,
            subtotal: subtotalHT,
          };
        })
      );

      const totalTTC = totalHT + totalTax;

      let invoiceData;

      if (invoice) {
        // Mise à jour de la facture existante
        const { data: updatedInvoice, error: invoiceError } = await supabase
          .from("invoices")
          .update({
            partner_id: values.partner_id,
            date: values.date,
            due_date: values.due_date,
            invoice_type_code: invoiceTypeCode,
            invoice_reference_type: values.invoice_reference_type || null,
            payment_method: values.payment_method,
            currency: "CDF",
            total_ht: totalHT,
            total_tax: totalTax,
            total_ttc: totalTTC,
          })
          .eq("id", invoice.id)
          .select()
          .single();

        if (invoiceError) throw invoiceError;
        invoiceData = updatedInvoice;

        // Supprimer les anciennes lignes
        await supabase.from("invoice_lines").delete().eq("invoice_id", invoice.id);

        // Créer les nouvelles lignes
        const lines = linesWithTotals.map((line) => ({
          ...line,
          invoice_id: invoice.id,
        }));

        const { error: linesError } = await supabase
          .from("invoice_lines")
          .insert(lines);

        if (linesError) throw linesError;
      } else {
        // Créer une nouvelle facture
        const { data: newInvoice, error: invoiceError } = await supabase
          .from("invoices")
          .insert([{
            number: values.number || null,
            partner_id: values.partner_id,
            date: values.date,
            due_date: values.due_date,
            status: "draft",
            type: "customer",
            invoice_type_code: invoiceTypeCode,
            invoice_reference_type: values.invoice_reference_type || null,
            payment_method: values.payment_method,
            currency: "CDF",
            total_ht: totalHT,
            total_tax: totalTax,
            total_ttc: totalTTC,
          }])
          .select()
          .single();

        if (invoiceError) throw invoiceError;
        invoiceData = newInvoice;

        // Créer les lignes
        const lines = linesWithTotals.map((line) => ({
          ...line,
          invoice_id: newInvoice.id,
        }));

        const { error: linesError } = await supabase
          .from("invoice_lines")
          .insert(lines);

        if (linesError) throw linesError;

        // Créer les écritures comptables (uniquement pour les nouvelles factures)
        await createAccountingEntries(
          newInvoice,
          values.partner_id,
          totalHT,
          totalTax,
          totalTTC,
          profile.company_id
        );
      }

      // Send to DGI after creation/update
      if (invoiceData?.id) {
        try {
          const { data: dgiData, error: dgiError } = await supabase.functions.invoke(
            'send-invoice-to-dgi',
            {
              body: { invoiceId: invoiceData.id }
            }
          );

          if (dgiError) {
            console.error('DGI error:', dgiError);
            toast.error("Facture enregistrée mais erreur lors de l'envoi à la DGI");
          } else if (dgiData?.success) {
            console.log('DGI UID:', dgiData.dgi_uid);
            toast.success(`Facture envoyée à la DGI (UID: ${dgiData.dgi_uid})`);
          }
        } catch (dgiErr) {
          console.error('DGI send error:', dgiErr);
        }
      }

      toast.success(invoice ? "Facture mise à jour avec succès" : "Facture et écritures comptables créées avec succès");
      form.reset();
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la création");
    } finally {
      setIsLoading(false);
    }
  };

  const createAccountingEntries = async (
    invoice: any,
    partnerId: string,
    totalHT: number,
    totalTax: number,
    totalTTC: number,
    companyId: string
  ) => {
    try {
      // Récupérer le compte client du partenaire
      const { data: partner } = await supabase
        .from("partners")
        .select("account_id")
        .eq("id", partnerId)
        .single();

      if (!partner?.account_id) {
        console.error("Compte client non trouvé");
        return;
      }

      // Récupérer le journal de ventes
      const { data: salesJournal } = await supabase
        .from("journals")
        .select("id")
        .eq("company_id", companyId)
        .eq("type", "sales")
        .single();

      if (!salesJournal) {
        console.error("Journal de ventes non trouvé");
        return;
      }

      // Récupérer les comptes de vente et TVA
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, code")
        .eq("company_id", companyId)
        .in("code", ["707000", "445710"]);

      const salesAccount = accounts?.find((a) => a.code === "707000");
      const taxAccount = accounts?.find((a) => a.code === "445710");

      if (!salesAccount) {
        console.error("Compte de vente (707000) non trouvé");
        return;
      }

      // Créer l'écriture comptable
      const { data: move, error: moveError } = await supabase
        .from("account_moves")
        .insert({
          number: `FACT-${invoice.number}`,
          date: invoice.date,
          journal_id: salesJournal.id,
          ref: invoice.number,
          company_id: companyId,
          state: "draft",
        })
        .select()
        .single();

      if (moveError) throw moveError;

      // Ligne débit : Compte client (411xxx)
      await supabase.from("account_move_lines").insert({
        move_id: move.id,
        account_id: partner.account_id,
        debit: totalTTC,
        credit: 0,
        currency: "CDF",
      });

      // Ligne crédit : Compte de vente (707000)
      await supabase.from("account_move_lines").insert({
        move_id: move.id,
        account_id: salesAccount.id,
        debit: 0,
        credit: totalHT,
        currency: "CDF",
      });

      // Ligne crédit : Compte TVA collectée (445710) si TVA > 0
      if (totalTax > 0 && taxAccount) {
        await supabase.from("account_move_lines").insert({
          move_id: move.id,
          account_id: taxAccount.id,
          debit: 0,
          credit: totalTax,
          currency: "CDF",
        });
      }
    } catch (error) {
      console.error("Erreur lors de la création des écritures:", error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <FormField
            control={form.control}
            name="number"
            render={({ field }) => (
          <FormItem>
                <FormLabel>Numéro (généré automatiquement)</FormLabel>
                <FormControl>
                  <Input placeholder={`Auto-généré: ${invoiceTypeCode}-0001`} {...field} disabled />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="due_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Échéance *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price_mode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mode de Prix *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Mode" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="TTC">TTC (Toutes Taxes Comprises)</SelectItem>
                    <SelectItem value="HT">HT (Hors Taxes)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Show reference type selector only for FA and EA invoice types */}
        {(invoiceTypeCode === 'FA' || invoiceTypeCode === 'EA') && (
          <FormField
            control={form.control}
            name="invoice_reference_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type de Référence *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner le type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="COR">COR - Correction</SelectItem>
                    <SelectItem value="RAN">RAN - Annulation</SelectItem>
                    <SelectItem value="RAM">RAM - Avoir suite reprise</SelectItem>
                    <SelectItem value="RRR">RRR - Remise, ristourne, rabais</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="payment_method"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mode de Paiement *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner le mode" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="ESPECES">ESPECES</SelectItem>
                  <SelectItem value="MOBILEMONEY">MOBILE MONEY</SelectItem>
                  <SelectItem value="VIREMENT">VIREMENT</SelectItem>
                  <SelectItem value="CARTEBANCAIRE">CARTE BANCAIRE</SelectItem>
                  <SelectItem value="CHEQUES">CHEQUES</SelectItem>
                  <SelectItem value="CREDIT">CREDIT</SelectItem>
                  <SelectItem value="AUTRE">AUTRE</SelectItem>
                </SelectContent>
              </Select>
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

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Lignes de Facture</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ product_id: "", description: "", qty: "1", unit_price: "0", tax_id: "" })}
            >
              <Plus className="mr-2 h-4 w-4" />
              Ajouter une ligne
            </Button>
          </div>

          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-12 gap-2 items-start border p-4 rounded-lg">
              <div className="col-span-3">
                <FormField
                  control={form.control}
                  name={`lines.${index}.product_id`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Produit</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          const product = products.find(p => p.id === value);
                          if (product) {
                            form.setValue(`lines.${index}.unit_price`, product.unit_price.toString());
                          }
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Produit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name}
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
                  name={`lines.${index}.description`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder="Description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="col-span-2">
                <FormField
                  control={form.control}
                  name={`lines.${index}.qty`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Qté</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="col-span-2">
                <FormField
                  control={form.control}
                  name={`lines.${index}.unit_price`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prix</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="col-span-2">
                <FormField
                  control={form.control}
                  name={`lines.${index}.tax_id`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Taxe</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Taxe" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {taxes.map((tax) => (
                            <SelectItem key={tax.id} value={tax.id}>
                              {tax.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {fields.length > 1 && (
                <div className="col-span-12 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Totaux */}
        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-end gap-4 text-sm">
            <span className="text-muted-foreground">Total HT:</span>
            <span className="font-mono font-semibold min-w-[120px] text-right">
              {new Intl.NumberFormat('fr-FR', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              }).format(
                form.watch("lines").reduce((sum, line) => {
                  const qty = parseFloat(line.qty || "0");
                  const price = parseFloat(line.unit_price || "0");
                  return sum + (qty * price);
                }, 0)
              )} CDF
            </span>
          </div>
          <div className="flex justify-end gap-4 text-sm">
            <span className="text-muted-foreground">TVA:</span>
            <span className="font-mono font-semibold min-w-[120px] text-right">
              {new Intl.NumberFormat('fr-FR', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              }).format(
                form.watch("lines").reduce((sum, line) => {
                  const qty = parseFloat(line.qty || "0");
                  const price = parseFloat(line.unit_price || "0");
                  const subtotal = qty * price;
                  if (line.tax_id) {
                    const tax = taxes.find(t => t.id === line.tax_id);
                    return sum + (subtotal * (tax?.rate || 0) / 100);
                  }
                  return sum;
                }, 0)
              )} CDF
            </span>
          </div>
          <div className="flex justify-end gap-4 text-lg border-t pt-2">
            <span className="font-semibold">Total TTC:</span>
            <span className="font-mono font-bold min-w-[120px] text-right text-primary">
              {new Intl.NumberFormat('fr-FR', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              }).format(
                form.watch("lines").reduce((sum, line) => {
                  const qty = parseFloat(line.qty || "0");
                  const price = parseFloat(line.unit_price || "0");
                  const subtotal = qty * price;
                  let taxAmount = 0;
                  if (line.tax_id) {
                    const tax = taxes.find(t => t.id === line.tax_id);
                    taxAmount = subtotal * (tax?.rate || 0) / 100;
                  }
                  return sum + subtotal + taxAmount;
                }, 0)
              )} CDF
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Création..." : "Créer la facture"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
