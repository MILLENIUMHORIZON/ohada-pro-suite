import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search, ArrowUpDown, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProductForm } from "@/components/forms/ProductForm";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Stock() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("products");
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [inventories, setInventories] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalValue: 0,
    lowStock: 0,
    outOfStock: 0,
  });

  useEffect(() => {
    loadProducts();
    loadInventories();
  }, []);

  const loadProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select(`
        *,
        category:product_categories(name),
        uom:uom(code),
        tax:taxes(rate)
      `)
      .eq("active", true)
      .order("created_at", { ascending: false });
    
    if (data) {
      setProducts(data);
      
      // Calculate stats
      const totalValue = data.reduce((sum, p) => sum + ((p.cost_price || 0) * 10), 0); // Estimé
      const lowStock = data.filter(p => false).length; // À implémenter avec stock_quants
      const outOfStock = data.filter(p => false).length; // À implémenter avec stock_quants
      
      setStats({
        totalProducts: data.length,
        totalValue,
        lowStock,
        outOfStock,
      });
    }
  };

  const loadInventories = async () => {
    const { data } = await supabase
      .from("stock_inventories")
      .select(`
        *,
        location:stock_locations(name)
      `)
      .order("date", { ascending: false })
      .limit(10);
    
    if (data) setInventories(data);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Stock</h1>
          <p className="text-muted-foreground mt-1">Gestion des articles, inventaire et mouvements</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <ArrowUpDown className="mr-2 h-4 w-4" />
            Mouvement
          </Button>
          <Button variant="outline">
            <Search className="mr-2 h-4 w-4" />
            Inventaire
          </Button>
          <Button onClick={() => setIsProductDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvel Article
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Articles en Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.totalProducts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Valeur Totale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(stats.totalValue)} CDF
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Stock Faible
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.lowStock}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ruptures
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.outOfStock}</div>
          </CardContent>
        </Card>
      </div>

      {/* Products Table with Tabs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {activeTab === "products" && "Liste des Articles"}
              {activeTab === "inventory" && "Inventaires Physiques"}
            </CardTitle>
            <div className="flex w-72 items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un article..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-0 bg-muted/50"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="inline-flex gap-2 p-1 bg-muted rounded-lg">
              <Button
                variant={activeTab === "products" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("products")}
              >
                Articles
              </Button>
              <Button
                variant={activeTab === "inventory" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("inventory")}
              >
                Inventaires
              </Button>
            </div>
          </div>

          {activeTab === "products" && (
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Prix Coût</TableHead>
                <TableHead>Prix Vente</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length > 0 ? products.map((product) => (
                <TableRow key={product.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{product.sku}</TableCell>
                  <TableCell>{product.name}</TableCell>
                  <TableCell className="text-muted-foreground">{product.category?.name || '-'}</TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">N/A</span>
                  </TableCell>
                  <TableCell>
                    {new Intl.NumberFormat('fr-FR').format(product.cost_price || 0)} CDF
                  </TableCell>
                  <TableCell className="font-semibold">
                    {new Intl.NumberFormat('fr-FR').format(product.unit_price || 0)} CDF
                  </TableCell>
                  <TableCell>
                    <Badge>{product.active ? 'Actif' : 'Inactif'}</Badge>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Aucun produit enregistré
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          )}

          {activeTab === "inventory" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Emplacement</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Lignes</TableHead>
                  <TableHead>Écarts</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventories.length > 0 ? inventories.map((inv) => (
                  <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">{inv.number}</TableCell>
                    <TableCell>{inv.name}</TableCell>
                    <TableCell>{inv.location?.name || '-'}</TableCell>
                    <TableCell>{new Date(inv.date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>
                      <Badge variant={inv.state === 'draft' ? 'secondary' : 'default'}>
                        {inv.state === 'draft' ? 'Brouillon' : inv.state}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Aucun inventaire enregistré
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvel Article</DialogTitle>
          </DialogHeader>
          <ProductForm onSuccess={() => {
            setIsProductDialogOpen(false);
            loadProducts();
          }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
