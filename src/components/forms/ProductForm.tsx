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
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useState } from "react";

const productFormSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(200),
  sku: z.string().min(1, "La référence est requise"),
  category_id: z.string().optional(),
  uom_id: z.string().optional(),
  type: z.enum(["stock", "service", "consumable"]),
  unit_price: z.string().min(1, "Le prix de vente est requis"),
  cost_price: z.string().optional(),
  description: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

interface ProductFormProps {
  onSuccess?: () => void;
  defaultValues?: Partial<ProductFormValues>;
}

export function ProductForm({ onSuccess, defaultValues }: ProductFormProps) {
  const [categories, setCategories] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      sku: "",
      category_id: "",
      uom_id: "",
      type: "stock",
      unit_price: "0",
      cost_price: "0",
      description: "",
      ...defaultValues,
    },
  });

  useEffect(() => {
    loadCategories();
    loadUoms();
  }, []);

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from("product_categories")
      .select("id, name")
      .order("name");
    
    if (error) {
      toast.error("Erreur lors du chargement des catégories");
      return;
    }
    setCategories(data || []);
  };

  const loadUoms = async () => {
    const { data, error } = await supabase
      .from("uom")
      .select("id, name")
      .order("name");
    
    if (error) {
      toast.error("Erreur lors du chargement des unités");
      return;
    }
    setUoms(data || []);
  };

  const onSubmit = async (values: ProductFormValues) => {
    setIsLoading(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile) {
        toast.error("Impossible de récupérer les informations utilisateur");
        return;
      }

      const { error } = await supabase.from("products").insert({
        name: values.name,
        sku: values.sku,
        category_id: values.category_id || null,
        uom_id: values.uom_id || null,
        type: values.type,
        unit_price: parseFloat(values.unit_price),
        cost_price: parseFloat(values.cost_price || "0"),
        description: values.description || null,
        company_id: profile.company_id,
      });

      if (error) throw error;

      toast.success("Produit créé avec succès");
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
              <FormLabel>Nom *</FormLabel>
              <FormControl>
                <Input placeholder="Nom du produit" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="sku"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Référence *</FormLabel>
                <FormControl>
                  <Input placeholder="SKU" {...field} />
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
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="stock">Stockable</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="consumable">Consommable</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="category_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Catégorie</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
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
            name="uom_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unité de Mesure</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {uoms.map((uom) => (
                      <SelectItem key={uom.id} value={uom.id}>
                        {uom.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="unit_price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prix de Vente *</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="0.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="cost_price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prix de Coût</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="0.00" {...field} />
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
                <Textarea placeholder="Description du produit..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Création..." : "Créer le produit"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
