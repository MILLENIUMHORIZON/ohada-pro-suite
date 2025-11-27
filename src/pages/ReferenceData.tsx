import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useForm } from "react-hook-form";

export default function ReferenceData() {
  const [taxes, setTaxes] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [isTaxDialogOpen, setIsTaxDialogOpen] = useState(false);
  const [isUomDialogOpen, setIsUomDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isCurrencyDialogOpen, setIsCurrencyDialogOpen] = useState(false);

  const taxForm = useForm();
  const uomForm = useForm();
  const categoryForm = useForm();
  const currencyForm = useForm();

  const loadTaxes = async () => {
    const { data } = await supabase.from("taxes").select("*").order("name");
    if (data) setTaxes(data);
  };

  const loadUoms = async () => {
    const { data } = await supabase.from("uom").select("*").order("name");
    if (data) setUoms(data);
  };

  const loadCategories = async () => {
    const { data } = await supabase.from("product_categories").select("*").order("name");
    if (data) setCategories(data);
  };

  const loadCurrencies = async () => {
    const { data } = await supabase.from("currencies").select("*").order("code");
    if (data) setCurrencies(data);
  };

  useEffect(() => {
    const initializeReferenceData = async () => {
      await initializeDefaultCurrencies();
      loadTaxes();
      loadUoms();
      loadCategories();
      loadCurrencies();
    };
    initializeReferenceData();
  }, []);

  const initializeDefaultCurrencies = async () => {
    try {
      const { data: profile } = await supabase.from("profiles").select("company_id").single();
      if (!profile?.company_id) return;

      const { data: company } = await supabase
        .from("companies")
        .select("country")
        .eq("id", profile.company_id)
        .single();

      if (company?.country !== "CD") return;

      // Check if currencies already exist
      const { data: existingCurrencies } = await supabase
        .from("currencies")
        .select("code")
        .eq("company_id", profile.company_id);

      const existingCodes = existingCurrencies?.map(c => c.code) || [];

      const currenciesToCreate = [];

      // Create CDF if not exists
      if (!existingCodes.includes("CDF")) {
        currenciesToCreate.push({
          company_id: profile.company_id,
          code: "CDF",
          name: "Franc Congolais (Devise de base)",
          symbol: "FC",
          rate: 1.0,
          is_base: true,
        });
      }

      // Create USD if not exists, with DGI rate
      if (!existingCodes.includes("USD")) {
        let usdRate = 2800; // Fallback rate
        let rateSource = "Fallback";

        try {
          const { data: dgiData } = await supabase.functions.invoke("get-dgi-exchange-rate");
          if (dgiData && dgiData.rate) {
            usdRate = dgiData.rate;
            rateSource = "DGI";
          }
        } catch (error) {
          console.error("Failed to fetch DGI rate:", error);
        }

        currenciesToCreate.push({
          company_id: profile.company_id,
          code: "USD",
          name: `Dollar Américain (Source: ${rateSource})`,
          symbol: "$",
          rate: usdRate,
          is_base: false,
        });
      }

      // Insert currencies if needed
      if (currenciesToCreate.length > 0) {
        const { error } = await supabase.from("currencies").insert(currenciesToCreate);
        if (error) {
          console.error("Error creating default currencies:", error);
        }
      }
    } catch (error) {
      console.error("Error initializing default currencies:", error);
    }
  };

  const handleTaxSubmit = async (formData: any) => {
    const { data: profile } = await supabase.from("profiles").select("company_id").single();
    
    const { error } = await supabase.from("taxes").insert({
      company_id: profile?.company_id,
      name: formData.name,
      rate: parseFloat(formData.rate),
    });

    if (error) {
      toast.error("Erreur lors de la création de la taxe");
    } else {
      toast.success("Taxe créée avec succès");
      setIsTaxDialogOpen(false);
      taxForm.reset();
      loadTaxes();
    }
  };

  const handleUomSubmit = async (formData: any) => {
    const { data: profile } = await supabase.from("profiles").select("company_id").single();
    
    const { error } = await supabase.from("uom").insert({
      company_id: profile?.company_id,
      name: formData.name,
      code: formData.code,
      ratio: formData.ratio ? parseFloat(formData.ratio) : 1.0,
    });

    if (error) {
      toast.error("Erreur lors de la création de l'unité");
    } else {
      toast.success("Unité créée avec succès");
      setIsUomDialogOpen(false);
      uomForm.reset();
      loadUoms();
    }
  };

  const handleCategorySubmit = async (formData: any) => {
    const { data: profile } = await supabase.from("profiles").select("company_id").single();
    
    const { error } = await supabase.from("product_categories").insert({
      company_id: profile?.company_id,
      name: formData.name,
    });

    if (error) {
      toast.error("Erreur lors de la création de la catégorie");
    } else {
      toast.success("Catégorie créée avec succès");
      setIsCategoryDialogOpen(false);
      categoryForm.reset();
      loadCategories();
    }
  };

  const handleCurrencySubmit = async (formData: any) => {
    const { data: profile } = await supabase.from("profiles").select("company_id").single();
    
    let rate = parseFloat(formData.rate);
    let rateSource = "Manuel";

    // For RDC companies, fetch USD rate from DGI if creating USD currency
    if (formData.code.toUpperCase() === "USD") {
      const { data: company } = await supabase
        .from("companies")
        .select("country")
        .eq("id", profile?.company_id)
        .single();

      if (company?.country === "CD") {
        try {
          const { data: dgiData } = await supabase.functions.invoke("get-dgi-exchange-rate");
          if (dgiData && dgiData.rate) {
            rate = dgiData.rate;
            rateSource = "DGI";
            toast.success(`Taux DGI récupéré: ${rate} CDF`);
          }
        } catch (error) {
          console.error("Failed to fetch DGI rate:", error);
          toast.warning("Impossible de récupérer le taux DGI, utilisation du taux manuel");
        }
      }
    }
    
    const { error } = await supabase.from("currencies").insert({
      company_id: profile?.company_id,
      code: formData.code.toUpperCase(),
      name: `${formData.name} (Source: ${rateSource})`,
      symbol: formData.symbol,
      rate: rate,
      is_base: formData.is_base === "true",
    });

    if (error) {
      toast.error("Erreur lors de la création de la devise");
    } else {
      toast.success("Devise créée avec succès");
      setIsCurrencyDialogOpen(false);
      currencyForm.reset();
      loadCurrencies();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Données de Référence</h1>
        <p className="text-muted-foreground mt-1">Configuration des données de base</p>
      </div>

      <Tabs defaultValue="taxes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="taxes">Taxes</TabsTrigger>
          <TabsTrigger value="uom">Unités de Mesure</TabsTrigger>
          <TabsTrigger value="categories">Catégories de Produits</TabsTrigger>
          <TabsTrigger value="currencies">Devises</TabsTrigger>
        </TabsList>

        <TabsContent value="taxes" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Taxes</CardTitle>
                <Button onClick={() => setIsTaxDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nouvelle Taxe
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead className="text-right">Taux (%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taxes.map((tax) => (
                    <TableRow key={tax.id}>
                      <TableCell>{tax.name}</TableCell>
                      <TableCell className="text-right font-mono">{tax.rate}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="uom" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Unités de Mesure</CardTitle>
                <Button onClick={() => setIsUomDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nouvelle Unité
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">Ratio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uoms.map((uom) => (
                    <TableRow key={uom.id}>
                      <TableCell>{uom.name}</TableCell>
                      <TableCell className="font-mono">{uom.code}</TableCell>
                      <TableCell className="text-right">{uom.ratio}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Catégories de Produits</CardTitle>
                <Button onClick={() => setIsCategoryDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nouvelle Catégorie
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell>{category.name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="currencies" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Devises</CardTitle>
                <Button onClick={() => setIsCurrencyDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nouvelle Devise
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Symbole</TableHead>
                    <TableHead className="text-right">Taux de Change</TableHead>
                    <TableHead>Devise de Base</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currencies.map((currency) => (
                    <TableRow key={currency.id}>
                      <TableCell className="font-mono font-semibold">{currency.code}</TableCell>
                      <TableCell>{currency.name}</TableCell>
                      <TableCell className="font-mono">{currency.symbol}</TableCell>
                      <TableCell className="text-right font-mono">{currency.rate}</TableCell>
                      <TableCell>{currency.is_base ? "✓" : ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Tax Dialog */}
      <Dialog open={isTaxDialogOpen} onOpenChange={setIsTaxDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle Taxe</DialogTitle>
            <DialogDescription>Créer une nouvelle taxe</DialogDescription>
          </DialogHeader>
          <form onSubmit={taxForm.handleSubmit(handleTaxSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tax-name">Nom</Label>
              <Input id="tax-name" {...taxForm.register("name")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax-rate">Taux (%)</Label>
              <Input id="tax-rate" type="number" step="0.01" {...taxForm.register("rate")} required />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsTaxDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">Créer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* UOM Dialog */}
      <Dialog open={isUomDialogOpen} onOpenChange={setIsUomDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle Unité de Mesure</DialogTitle>
            <DialogDescription>Créer une nouvelle unité</DialogDescription>
          </DialogHeader>
          <form onSubmit={uomForm.handleSubmit(handleUomSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="uom-name">Nom</Label>
              <Input id="uom-name" {...uomForm.register("name")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uom-code">Code</Label>
              <Input id="uom-code" {...uomForm.register("code")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uom-ratio">Ratio</Label>
              <Input id="uom-ratio" type="number" step="0.01" defaultValue="1.0" {...uomForm.register("ratio")} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsUomDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">Créer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle Catégorie</DialogTitle>
            <DialogDescription>Créer une nouvelle catégorie de produit</DialogDescription>
          </DialogHeader>
          <form onSubmit={categoryForm.handleSubmit(handleCategorySubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Nom</Label>
              <Input id="category-name" {...categoryForm.register("name")} required />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">Créer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Currency Dialog */}
      <Dialog open={isCurrencyDialogOpen} onOpenChange={setIsCurrencyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle Devise</DialogTitle>
            <DialogDescription>Créer une nouvelle devise</DialogDescription>
          </DialogHeader>
          <form onSubmit={currencyForm.handleSubmit(handleCurrencySubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currency-code">Code (ex: USD, EUR, CDF)</Label>
              <Input id="currency-code" {...currencyForm.register("code")} required maxLength={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency-name">Nom</Label>
              <Input id="currency-name" {...currencyForm.register("name")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency-symbol">Symbole (ex: $, €, FC)</Label>
              <Input id="currency-symbol" {...currencyForm.register("symbol")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency-rate">Taux de Change</Label>
              <Input id="currency-rate" type="number" step="0.0001" defaultValue="1.0" {...currencyForm.register("rate")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency-is-base">Devise de Base</Label>
              <select id="currency-is-base" {...currencyForm.register("is_base")} className="w-full rounded-md border border-input bg-background px-3 py-2">
                <option value="false">Non</option>
                <option value="true">Oui</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCurrencyDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">Créer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
