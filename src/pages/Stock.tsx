import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search, ArrowUpDown, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const mockProducts = [
  {
    id: 1,
    sku: "PRD-001",
    name: "Ordinateur Portable Dell XPS 15",
    category: "Informatique",
    stock: 45,
    minStock: 20,
    cost: "850,000 CDF",
    price: "1,200,000 CDF",
    status: "ok",
  },
  {
    id: 2,
    sku: "PRD-002",
    name: "Imprimante HP LaserJet Pro",
    category: "Bureautique",
    stock: 12,
    minStock: 15,
    cost: "320,000 CDF",
    price: "450,000 CDF",
    status: "low",
  },
  {
    id: 3,
    sku: "PRD-003",
    name: "Smartphone Samsung Galaxy S24",
    category: "Téléphonie",
    stock: 0,
    minStock: 10,
    cost: "620,000 CDF",
    price: "890,000 CDF",
    status: "out",
  },
];

const stockStats = [
  { label: "Articles en Stock", value: "456", color: "text-primary" },
  { label: "Valeur Totale", value: "45M CDF", color: "text-success" },
  { label: "Stock Faible", value: "23", color: "text-warning" },
  { label: "Ruptures", value: "5", color: "text-destructive" },
];

export default function Stock() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Stock</h1>
          <p className="text-muted-foreground mt-1">Gestion des articles et inventaire</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <ArrowUpDown className="mr-2 h-4 w-4" />
            Mouvement
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nouvel Article
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {stockStats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Liste des Articles</CardTitle>
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
              {mockProducts.map((product) => (
                <TableRow key={product.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{product.sku}</TableCell>
                  <TableCell>{product.name}</TableCell>
                  <TableCell className="text-muted-foreground">{product.category}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{product.stock}</span>
                      <span className="text-xs text-muted-foreground">
                        / {product.minStock} min
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{product.cost}</TableCell>
                  <TableCell className="font-semibold">{product.price}</TableCell>
                  <TableCell>
                    {product.status === "ok" && <Badge>En Stock</Badge>}
                    {product.status === "low" && (
                      <Badge variant="secondary" className="bg-warning/20 text-warning-foreground">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        Faible
                      </Badge>
                    )}
                    {product.status === "out" && (
                      <Badge variant="destructive">Rupture</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
