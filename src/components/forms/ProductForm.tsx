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
import { ImageUpload } from "@/components/stock/ImageUpload";

const productFormSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(200),
  sku: z.string().min(1, "La référence est requise"),
  category_id: z.string().optional(),
  uom_id: z.string().optional(),
  type: z.enum(["stock", "service", "tax", "raw_material", "semi_finished", "finished", "consumable", "spare_part"]),
  product_type_code: z.string().optional(),
  currency: z.string().min(1, "La devise est requise"),
  unit_price: z.string().min(1, "Le prix de vente est requis"),
  cost_price: z.string().optional(),
  stock_min: z.string().optional(),
  description: z.string().optional(),
  image_url: z.string().optional(),
  dimensions: z.string().optional(),
  specifications: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

interface ProductFormProps {
  onSuccess?: () => void;
  defaultValues?: Partial<ProductFormValues>;
}

export function ProductForm({ onSuccess, defaultValues }: ProductFormProps) {
  const [categories, setCategories] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [companyCountry, setCompanyCountry] = useState<string>("CD");

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      sku: "",
      category_id: "",
      uom_id: "",
      type: "stock",
      product_type_code: "",
      currency: "CDF",
      unit_price: "0",
      cost_price: "0",
      stock_min: "0",
      description: "",
      image_url: "",
      dimensions: "",
      specifications: "",
      ...defaultValues,
    },
  });

  useEffect(() => {
    loadCategories();
    loadUoms();
    loadCurrencies();
    loadCompanyCountry();
  }, []);

  const loadCompanyCountry = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.company_id) {
        const { data: company } = await supabase
          .from("companies")
          .select("country")
          .eq("id", profile.company_id)
          .single();

        if (company) {
          setCompanyCountry(company.country || "CD");
        }
      }
    } catch (error) {
      console.error("Error loading company country:", error);
    }
  };

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

  const loadCurrencies = async () => {
    const { data, error } = await supabase
      .from("currencies")
      .select("id, code, name, symbol")
      .order("code");
    
    if (error) {
      toast.error("Erreur lors du chargement des devises");
      return;
    }
    setCurrencies(data || []);
  };

  const onSubmit = async (values: ProductFormValues) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Utilisateur non connecté");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile?.company_id) {
        toast.error("Impossible de récupérer les informations utilisateur");
        return;
      }

      const { error } = await supabase.from("products").insert([{
        name: values.name,
        sku: values.sku,
        category_id: values.category_id || null,
        uom_id: values.uom_id || null,
        type: values.type,
        product_type_code: values.product_type_code || null,
        currency: values.currency,
        unit_price: parseFloat(values.unit_price),
        cost_price: parseFloat(values.cost_price || "0"),
        stock_min: parseFloat(values.stock_min || "0"),
        description: values.description || null,
        image_url: values.image_url || null,
        dimensions: values.dimensions || null,
        specifications: values.specifications || null,
        company_id: profile.company_id,
      }] as any);

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
                <Select 
                  onValueChange={(value) => {
                    field.onChange(value);
                    // Auto-fill product_type_code for RDC companies
                    if (companyCountry === "CD") {
                      const codeMap: Record<string, string> = {
                        stock: "BIE",
                        service: "SER",
                        tax: "TAX",
                      };
                      form.setValue("product_type_code", codeMap[value] || "");
                    }
                  }} 
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {companyCountry === "CD" ? (
                      <>
                        <SelectItem value="stock">BIE - Bien (produit physique)</SelectItem>
                        <SelectItem value="raw_material">Matière première</SelectItem>
                        <SelectItem value="semi_finished">Produit semi-fini</SelectItem>
                        <SelectItem value="finished">Produit fini</SelectItem>
                        <SelectItem value="consumable">Consommable</SelectItem>
                        <SelectItem value="spare_part">Pièce détachée</SelectItem>
                        <SelectItem value="service">SER - Service</SelectItem>
                        <SelectItem value="tax">TAX - Taxe / Redevance</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="stock">Stockable</SelectItem>
                        <SelectItem value="raw_material">Matière première</SelectItem>
                        <SelectItem value="semi_finished">Produit semi-fini</SelectItem>
                        <SelectItem value="finished">Produit fini</SelectItem>
                        <SelectItem value="consumable">Consommable</SelectItem>
                        <SelectItem value="spare_part">Pièce détachée</SelectItem>
                        <SelectItem value="service">Service</SelectItem>
                        <SelectItem value="tax">Taxe</SelectItem>
                      </>
                    )}
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
                  <FormLabel>Unité de Mesure *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {uoms.map((uom) => (
                        <SelectItem key={uom.id} value={uom.id}>
                          {uom.name} ({uom.code || ""})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

        <FormField
          control={form.control}
          name="currency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Devise *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une devise" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.id} value={currency.code}>
                      {currency.code} - {currency.name} ({currency.symbol})
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

        <FormField
          control={form.control}
          name="stock_min"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Stock Minimum (alerte)</FormLabel>
              <FormControl>
                <Input type="number" step="1" min="0" placeholder="0" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Image du produit */}
        <div className="space-y-2">
          <FormLabel>Image du produit</FormLabel>
          <ImageUpload
            folder="products"
            currentUrl={form.getValues("image_url") || null}
            onUploaded={(url) => form.setValue("image_url", url)}
            onRemoved={() => form.setValue("image_url", "")}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="dimensions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dimensions</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: 100x50x20 cm" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="specifications"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Spécifications</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Acier inoxydable" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Création..." : "Créer le produit"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
