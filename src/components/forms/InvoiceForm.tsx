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
  number: z.string().min(1, "Le numéro est requis"),
  lines: z.array(invoiceLineSchema).min(1, "Au moins une ligne requise"),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

interface InvoiceFormProps {
  onSuccess?: () => void;
}

export function InvoiceForm({ onSuccess }: InvoiceFormProps) {
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
      lines: [{ product_id: "", description: "", qty: "1", unit_price: "0", tax_id: "" }],
    },
  });

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

      // Créer la facture
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert([{
          number: values.number,
          partner_id: values.partner_id,
          date: values.date,
          due_date: values.due_date,
          status: "draft",
          type: "customer",
        }])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Créer les lignes
      const lines = values.lines.map(line => ({
        invoice_id: invoice.id,
        product_id: line.product_id,
        description: line.description || null,
        qty: parseFloat(line.qty),
        unit_price: parseFloat(line.unit_price),
        tax_id: line.tax_id || null,
        subtotal: parseFloat(line.qty) * parseFloat(line.unit_price),
      }));

      const { error: linesError } = await supabase
        .from("invoice_lines")
        .insert(lines);

      if (linesError) throw linesError;

      toast.success("Facture créée avec succès");
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Numéro *</FormLabel>
                <FormControl>
                  <Input placeholder="FA-0001" {...field} />
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
        </div>

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

        <div className="flex justify-end gap-2 pt-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Création..." : "Créer la facture"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
