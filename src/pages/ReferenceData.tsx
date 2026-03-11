import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
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

export default function ReferenceData() {
  const [taxes, setTaxes] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Dialog states
  const [taxDialog, setTaxDialog] = useState<{ open: boolean; item?: any }>({ open: false });
  const [uomDialog, setUomDialog] = useState<{ open: boolean; item?: any }>({ open: false });
  const [categoryDialog, setCategoryDialog] = useState<{ open: boolean; item?: any }>({ open: false });
  const [isCurrencyDialogOpen, setIsCurrencyDialogOpen] = useState(false);

  // Form states
  const [taxName, setTaxName] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [uomName, setUomName] = useState("");
  const [uomCode, setUomCode] = useState("");
  const [uomRatio, setUomRatio] = useState("1.0");
  const [uomType, setUomType] = useState("quantity");
  const [categoryName, setCategoryName] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const [currencyName, setCurrencyName] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState("");
  const [currencyRate, setCurrencyRate] = useState("1.0");
  const [currencyIsBase, setCurrencyIsBase] = useState("false");

  const loadCompanyId = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();
    if (profile?.company_id) setCompanyId(profile.company_id);
  }, []);

  const loadTaxes = useCallback(async () => {
    const { data } = await supabase.from("taxes").select("*").order("name");
    if (data) setTaxes(data);
  }, []);

  const loadUoms = useCallback(async () => {
    const { data } = await supabase.from("uom").select("*").order("name");
    if (data) setUoms(data);
  }, []);

  const loadCategories = useCallback(async () => {
    const { data } = await supabase.from("product_categories").select("*").order("name");
    if (data) setCategories(data);
  }, []);

  const loadCurrencies = useCallback(async () => {
    const { data } = await supabase.from("currencies").select("*").order("code");
    if (data) setCurrencies(data);
  }, []);

  useEffect(() => {
    const init = async () => {
      await loadCompanyId();
      await initializeDefaultCurrencies();
      loadTaxes();
      loadUoms();
      loadCategories();
      loadCurrencies();
    };
    init();
  }, []);

  const initializeDefaultCurrencies = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
      if (!profile?.company_id) return;

      const { data: company } = await supabase
        .from("companies")
        .select("country")
        .eq("id", profile.company_id)
        .single();

      if (company?.country !== "CD") return;

      const { data: existingCurrencies } = await supabase
        .from("currencies")
        .select("*")
        .eq("company_id", profile.company_id);

      const existingCodes = existingCurrencies?.map(c => c.code) || [];
      const usdCurrency = existingCurrencies?.find(c => c.code === "USD");

      const currenciesToCreate = [];

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

      let usdRate = 2800;
      let rateSource = "Fallback";
      let rateDate = null;

      try {
        const { data: dgiData } = await supabase.functions.invoke("get-dgi-exchange-rate");
        if (dgiData && dgiData.rate) {
          usdRate = dgiData.rate;
          rateSource = "DGI";
          rateDate = dgiData.date;
        }
      } catch (error) {
        console.error("Failed to fetch DGI rate:", error);
      }

      if (!existingCodes.includes("USD")) {
        currenciesToCreate.push({
          company_id: profile.company_id,
          code: "USD",
          name: `Dollar Américain (Source: ${rateSource})`,
          symbol: "$",
          rate: usdRate,
          is_base: false,
          last_updated: rateDate || new Date().toISOString(),
        });
      } else if (usdCurrency) {
        await supabase
          .from("currencies")
          .update({
            rate: usdRate,
            name: `Dollar Américain (Source: ${rateSource})`,
            last_updated: rateDate || new Date().toISOString(),
          })
          .eq("id", usdCurrency.id);
        toast.success(`Taux USD mis à jour: ${usdRate} CDF`);
      }

      if (currenciesToCreate.length > 0) {
        const { error } = await supabase.from("currencies").insert(currenciesToCreate);
        if (!error && rateSource === "DGI") {
          toast.success(`Taux USD DGI: ${usdRate} CDF`);
        }
      }
    } catch (error) {
      console.error("Error initializing default currencies:", error);
    }
  };

  // ---- TAX CRUD ----
  const openTaxDialog = (item?: any) => {
    setTaxName(item?.name || "");
    setTaxRate(item?.rate?.toString() || "");
    setTaxDialog({ open: true, item });
  };

  const handleTaxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) { toast.error("Entreprise non trouvée"); return; }

    if (taxDialog.item) {
      const { error } = await supabase.from("taxes").update({
        name: taxName,
        rate: parseFloat(taxRate),
      }).eq("id", taxDialog.item.id);
      if (error) { toast.error("Erreur: " + error.message); return; }
      toast.success("Taxe modifiée");
    } else {
      const { error } = await supabase.from("taxes").insert({
        company_id: companyId,
        name: taxName,
        rate: parseFloat(taxRate),
      });
      if (error) { toast.error("Erreur: " + error.message); return; }
      toast.success("Taxe créée");
    }
    setTaxDialog({ open: false });
    loadTaxes();
  };

  const deleteTax = async (id: string) => {
    const { error } = await supabase.from("taxes").delete().eq("id", id);
    if (error) { toast.error("Erreur: " + error.message); return; }
    toast.success("Taxe supprimée");
    loadTaxes();
  };

  // ---- UOM CRUD ----
  const openUomDialog = (item?: any) => {
    setUomName(item?.name || "");
    setUomCode(item?.code || "");
    setUomRatio(item?.ratio?.toString() || "1.0");
    setUomType(item?.uom_type || "quantity");
    setUomDialog({ open: true, item });
  };

  const handleUomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) { toast.error("Entreprise non trouvée"); return; }

    if (uomDialog.item) {
      const { error } = await supabase.from("uom").update({
        name: uomName,
        code: uomCode,
        ratio: parseFloat(uomRatio),
      }).eq("id", uomDialog.item.id);
      if (error) { toast.error("Erreur: " + error.message); return; }
      toast.success("Unité modifiée");
    } else {
      const { error } = await supabase.from("uom").insert({
        company_id: companyId,
        name: uomName,
        code: uomCode,
        ratio: parseFloat(uomRatio),
      });
      if (error) { toast.error("Erreur: " + error.message); return; }
      toast.success("Unité créée");
    }
    setUomDialog({ open: false });
    loadUoms();
  };

  const deleteUom = async (id: string) => {
    const { error } = await supabase.from("uom").delete().eq("id", id);
    if (error) { toast.error("Erreur: " + error.message); return; }
    toast.success("Unité supprimée");
    loadUoms();
  };

  // ---- CATEGORY CRUD ----
  const openCategoryDialog = (item?: any) => {
    setCategoryName(item?.name || "");
    setCategoryDialog({ open: true, item });
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) { toast.error("Entreprise non trouvée"); return; }

    if (categoryDialog.item) {
      const { error } = await supabase.from("product_categories").update({
        name: categoryName,
      }).eq("id", categoryDialog.item.id);
      if (error) { toast.error("Erreur: " + error.message); return; }
      toast.success("Catégorie modifiée");
    } else {
      const { error } = await supabase.from("product_categories").insert({
        company_id: companyId,
        name: categoryName,
      });
      if (error) { toast.error("Erreur: " + error.message); return; }
      toast.success("Catégorie créée");
    }
    setCategoryDialog({ open: false });
    loadCategories();
  };

  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from("product_categories").delete().eq("id", id);
    if (error) { toast.error("Erreur: " + error.message); return; }
    toast.success("Catégorie supprimée");
    loadCategories();
  };

  // ---- CURRENCY ----
  const handleCurrencySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) { toast.error("Entreprise non trouvée"); return; }

    let rate = parseFloat(currencyRate);
    let rateSource = "Manuel";

    if (currencyCode.toUpperCase() === "USD") {
      const { data: company } = await supabase
        .from("companies")
        .select("country")
        .eq("id", companyId)
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
          toast.warning("Impossible de récupérer le taux DGI");
        }
      }
    }

    const { error } = await supabase.from("currencies").insert({
      company_id: companyId,
      code: currencyCode.toUpperCase(),
      name: `${currencyName} (Source: ${rateSource})`,
      symbol: currencySymbol,
      rate,
      is_base: currencyIsBase === "true",
    });

    if (error) { toast.error("Erreur: " + error.message); return; }
    toast.success("Devise créée");
    setIsCurrencyDialogOpen(false);
    setCurrencyCode(""); setCurrencyName(""); setCurrencySymbol(""); setCurrencyRate("1.0"); setCurrencyIsBase("false");
    loadCurrencies();
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

        {/* TAXES TAB */}
        <TabsContent value="taxes" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Taxes</CardTitle>
                <Button onClick={() => openTaxDialog()}>
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
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taxes.map((tax) => (
                    <TableRow key={tax.id}>
                      <TableCell>{tax.name}</TableCell>
                      <TableCell className="text-right font-mono">{tax.rate}%</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openTaxDialog(tax)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteTax(tax.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* UOM TAB */}
        <TabsContent value="uom" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Unités de Mesure</CardTitle>
                <Button onClick={() => openUomDialog()}>
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
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uoms.map((uom) => (
                    <TableRow key={uom.id}>
                      <TableCell>{uom.name}</TableCell>
                      <TableCell className="font-mono">{uom.code}</TableCell>
                      <TableCell className="text-right">{uom.ratio}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openUomDialog(uom)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteUom(uom.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CATEGORIES TAB */}
        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Catégories de Produits</CardTitle>
                <Button onClick={() => openCategoryDialog()}>
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
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell>{category.name}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openCategoryDialog(category)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteCategory(category.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CURRENCIES TAB */}
        <TabsContent value="currencies" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Devises</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={async () => {
                    await initializeDefaultCurrencies();
                    loadCurrencies();
                    toast.success("Taux de change mis à jour depuis DGI");
                  }}>
                    Actualiser taux DGI
                  </Button>
                  <Button onClick={() => setIsCurrencyDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nouvelle Devise
                  </Button>
                </div>
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
                    <TableHead>Dernière mise à jour</TableHead>
                    <TableHead>Devise de Base</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currencies.map((currency) => (
                    <TableRow key={currency.id}>
                      <TableCell className="font-mono font-semibold">{currency.code}</TableCell>
                      <TableCell>{currency.name}</TableCell>
                      <TableCell className="font-mono">{currency.symbol}</TableCell>
                      <TableCell className="text-right font-mono">{currency.rate?.toFixed(4)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {currency.last_updated
                          ? new Date(currency.last_updated).toLocaleString('fr-FR', {
                              day: '2-digit', month: '2-digit', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })
                          : '-'}
                      </TableCell>
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
      <Dialog open={taxDialog.open} onOpenChange={(open) => !open && setTaxDialog({ open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{taxDialog.item ? "Modifier la Taxe" : "Nouvelle Taxe"}</DialogTitle>
            <DialogDescription>{taxDialog.item ? "Modifier cette taxe" : "Créer une nouvelle taxe"}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTaxSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={taxName} onChange={(e) => setTaxName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Taux (%)</Label>
              <Input type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} required />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setTaxDialog({ open: false })}>Annuler</Button>
              <Button type="submit">{taxDialog.item ? "Modifier" : "Créer"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* UOM Dialog */}
      <Dialog open={uomDialog.open} onOpenChange={(open) => !open && setUomDialog({ open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{uomDialog.item ? "Modifier l'Unité" : "Nouvelle Unité de Mesure"}</DialogTitle>
            <DialogDescription>{uomDialog.item ? "Modifier cette unité" : "Créer une nouvelle unité"}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUomSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={uomName} onChange={(e) => setUomName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={uomCode} onChange={(e) => setUomCode(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Ratio</Label>
              <Input type="number" step="0.01" value={uomRatio} onChange={(e) => setUomRatio(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setUomDialog({ open: false })}>Annuler</Button>
              <Button type="submit">{uomDialog.item ? "Modifier" : "Créer"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={categoryDialog.open} onOpenChange={(open) => !open && setCategoryDialog({ open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{categoryDialog.item ? "Modifier la Catégorie" : "Nouvelle Catégorie"}</DialogTitle>
            <DialogDescription>{categoryDialog.item ? "Modifier cette catégorie" : "Créer une nouvelle catégorie"}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCategorySubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} required />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCategoryDialog({ open: false })}>Annuler</Button>
              <Button type="submit">{categoryDialog.item ? "Modifier" : "Créer"}</Button>
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
          <form onSubmit={handleCurrencySubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Code (ex: USD, EUR, CDF)</Label>
              <Input value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} required maxLength={3} />
            </div>
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={currencyName} onChange={(e) => setCurrencyName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Symbole (ex: $, €, FC)</Label>
              <Input value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Taux de Change</Label>
              <Input type="number" step="0.0001" value={currencyRate} onChange={(e) => setCurrencyRate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Devise de Base</Label>
              <select value={currencyIsBase} onChange={(e) => setCurrencyIsBase(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2">
                <option value="false">Non</option>
                <option value="true">Oui</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCurrencyDialogOpen(false)}>Annuler</Button>
              <Button type="submit">Créer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
