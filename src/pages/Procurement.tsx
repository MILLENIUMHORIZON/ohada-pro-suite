import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search, AlertCircle, TrendingUp, Package } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const mockProcurements = [
  {
    id: 1,
    number: "APP-2025-0012",
    product: "Ordinateur Portable Dell XPS",
    supplier: "Tech Supplier Ltd",
    qtyNeeded: 15,
    qtyOrdered: 15,
    qtyReceived: 10,
    dateNeeded: "2025-01-20",
    priority: "high",
    status: "partial",
  },
  {
    id: 2,
    number: "APP-2025-0011",
    product: "Imprimante HP LaserJet",
    supplier: "Office Supplies Co",
    qtyNeeded: 8,
    qtyOrdered: 8,
    qtyReceived: 8,
    dateNeeded: "2025-01-18",
    priority: "normal",
    status: "done",
  },
  {
    id: 3,
    number: "APP-2025-0010",
    product: "Papier A4 (Ramettes)",
    supplier: null,
    qtyNeeded: 50,
    qtyOrdered: 0,
    qtyReceived: 0,
    dateNeeded: "2025-01-25",
    priority: "urgent",
    status: "draft",
  },
];

const statusConfig = {
  draft: { label: "Brouillon", variant: "secondary" as const },
  ordered: { label: "Commandé", variant: "default" as const },
  partial: { label: "Partiel", variant: "default" as const },
  done: { label: "Terminé", variant: "default" as const },
  cancelled: { label: "Annulé", variant: "destructive" as const },
};

const priorityConfig = {
  low: { label: "Basse", variant: "secondary" as const, icon: Package },
  normal: { label: "Normale", variant: "outline" as const, icon: Package },
  high: { label: "Haute", variant: "default" as const, icon: TrendingUp },
  urgent: { label: "Urgente", variant: "destructive" as const, icon: AlertCircle },
};

export default function Procurement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Approvisionnements</h1>
          <p className="text-muted-foreground mt-1">Gestion des besoins et commandes fournisseurs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <AlertCircle className="mr-2 h-4 w-4" />
            Alertes Stock
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau Besoin
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              En Attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23</div>
            <p className="text-xs text-muted-foreground mt-1">Besoins à commander</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              En Cours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">15</div>
            <p className="text-xs text-muted-foreground mt-1">Commandes en livraison</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Urgents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">7</div>
            <p className="text-xs text-muted-foreground mt-1">À traiter rapidement</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taux Réalisation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">94%</div>
            <p className="text-xs text-success mt-1">+3% ce mois</p>
          </CardContent>
        </Card>
      </div>

      {/* Procurements Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Liste des Approvisionnements</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="draft">Brouillon</SelectItem>
                  <SelectItem value="ordered">Commandé</SelectItem>
                  <SelectItem value="partial">Partiel</SelectItem>
                  <SelectItem value="done">Terminé</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex w-72 items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-0 bg-muted/50"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead className="text-center">Besoin</TableHead>
                <TableHead className="text-center">Commandé</TableHead>
                <TableHead className="text-center">Reçu</TableHead>
                <TableHead>Date Besoin</TableHead>
                <TableHead>Priorité</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockProcurements.map((proc) => {
                const PriorityIcon = priorityConfig[proc.priority as keyof typeof priorityConfig].icon;
                return (
                  <TableRow key={proc.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">{proc.number}</TableCell>
                    <TableCell>{proc.product}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {proc.supplier || <span className="text-warning">Non défini</span>}
                    </TableCell>
                    <TableCell className="text-center font-semibold">{proc.qtyNeeded}</TableCell>
                    <TableCell className="text-center">{proc.qtyOrdered}</TableCell>
                    <TableCell className="text-center">{proc.qtyReceived}</TableCell>
                    <TableCell>{new Date(proc.dateNeeded).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>
                      <Badge variant={priorityConfig[proc.priority as keyof typeof priorityConfig].variant}>
                        <PriorityIcon className="mr-1 h-3 w-3" />
                        {priorityConfig[proc.priority as keyof typeof priorityConfig].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[proc.status as keyof typeof statusConfig].variant}>
                        {statusConfig[proc.status as keyof typeof statusConfig].label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
