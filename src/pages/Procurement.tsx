import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search, AlertCircle, TrendingUp, Package } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [isProcurementDialogOpen, setIsProcurementDialogOpen] = useState(false);
  const [procurements, setProcurements] = useState<any[]>([]);

  useEffect(() => {
    loadProcurements();
  }, []);

  const loadProcurements = async () => {
    const { data } = await supabase
      .from("procurements")
      .select(`
        *,
        product:products(name),
        supplier:partners(name)
      `)
      .order("date_needed", { ascending: true });
    
    if (data) setProcurements(data);
  };

  const filteredProcurements = procurements.filter(proc => {
    const matchesStatus = statusFilter === "all" || proc.status === statusFilter;
    const matchesSearch = 
      proc.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proc.product?.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const stats = {
    pending: procurements.filter(p => p.status === 'draft').length,
    inProgress: procurements.filter(p => p.status === 'ordered' || p.status === 'partial').length,
    urgent: procurements.filter(p => p.priority === 'urgent').length,
    completionRate: procurements.length > 0 
      ? Math.round((procurements.filter(p => p.status === 'done').length / procurements.length) * 100)
      : 0,
  };

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
            <div className="text-2xl font-bold">{stats.pending}</div>
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
            <div className="text-2xl font-bold text-warning">{stats.inProgress}</div>
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
            <div className="text-2xl font-bold text-destructive">{stats.urgent}</div>
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
            <div className="text-2xl font-bold text-success">{stats.completionRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">Complétés</p>
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
              {filteredProcurements.length > 0 ? filteredProcurements.map((proc) => {
                const PriorityIcon = priorityConfig[proc.priority as keyof typeof priorityConfig]?.icon || Package;
                return (
                  <TableRow key={proc.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">{proc.number}</TableCell>
                    <TableCell>{proc.product?.name || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {proc.supplier?.name || <span className="text-warning">Non défini</span>}
                    </TableCell>
                    <TableCell className="text-center font-semibold">{proc.qty_needed}</TableCell>
                    <TableCell className="text-center">{proc.qty_ordered || 0}</TableCell>
                    <TableCell className="text-center">{proc.qty_received || 0}</TableCell>
                    <TableCell>{new Date(proc.date_needed).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>
                      <Badge variant={priorityConfig[proc.priority as keyof typeof priorityConfig]?.variant || "outline"}>
                        <PriorityIcon className="mr-1 h-3 w-3" />
                        {priorityConfig[proc.priority as keyof typeof priorityConfig]?.label || proc.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[proc.status as keyof typeof statusConfig]?.variant || "secondary"}>
                        {statusConfig[proc.status as keyof typeof statusConfig]?.label || proc.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    {procurements.length === 0 
                      ? "Aucune demande d'approvisionnement"
                      : "Aucune demande ne correspond à votre recherche"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isProcurementDialogOpen} onOpenChange={setIsProcurementDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle Demande d'Approvisionnement</DialogTitle>
          </DialogHeader>
          <ProductForm onSuccess={() => setIsProcurementDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
