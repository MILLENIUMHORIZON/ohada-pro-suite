import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search, FileText, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InvoiceForm } from "@/components/forms/InvoiceForm";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const statusConfig = {
  draft: { label: "Brouillon", variant: "secondary" as const },
  sent: { label: "Envoyé", variant: "default" as const },
  accepted: { label: "Accepté", variant: "default" as const },
  rejected: { label: "Rejeté", variant: "destructive" as const },
  converted: { label: "Converti", variant: "default" as const },
};

export default function Proforma() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [isProformaDialogOpen, setIsProformaDialogOpen] = useState(false);
  const [proformas, setProformas] = useState<any[]>([]);

  useEffect(() => {
    loadProformas();
  }, []);

  const loadProformas = async () => {
    const { data } = await supabase
      .from("proformas")
      .select(`
        *,
        partner:partners(name)
      `)
      .order("date", { ascending: false });
    
    if (data) setProformas(data);
  };

  const filteredProformas = proformas.filter((pf) => {
    if (activeTab === "customer" && pf.type !== "customer") return false;
    if (activeTab === "supplier" && pf.type !== "supplier") return false;
    
    const matchesSearch = 
      pf.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pf.partner?.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  const stats = {
    total: proformas.length,
    pending: proformas.filter(p => p.status === 'sent').length,
    accepted: proformas.filter(p => p.status === 'accepted').length,
    totalAmount: proformas.reduce((sum, p) => sum + (p.total_ttc || 0), 0),
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pro Forma</h1>
          <p className="text-muted-foreground mt-1">Gestion des devis clients et fournisseurs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Modèles
          </Button>
          <Button onClick={() => setIsProformaDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau Pro Forma
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Pro Forma
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Enregistrés</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              En Attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.pending}</div>
            <p className="text-xs text-muted-foreground mt-1">À traiter</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Acceptés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.accepted}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : 0}% taux acceptation
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Montant Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(stats.totalAmount)} CDF
            </div>
            <p className="text-xs text-muted-foreground mt-1">Valeur cumulée</p>
          </CardContent>
        </Card>
      </div>

      {/* Proformas Table */}
      <Card>
        <CardHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="all">Tous</TabsTrigger>
                <TabsTrigger value="customer">Clients</TabsTrigger>
                <TabsTrigger value="supplier">Fournisseurs</TabsTrigger>
              </TabsList>
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
          </Tabs>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Partenaire</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Valable jusqu'au</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProformas.length > 0 ? filteredProformas.map((proforma) => (
                <TableRow key={proforma.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{proforma.number}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {proforma.type === "customer" ? "Client" : "Fournisseur"}
                    </Badge>
                  </TableCell>
                  <TableCell>{proforma.partner?.name || '-'}</TableCell>
                  <TableCell>{new Date(proforma.date).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell>
                    {proforma.valid_until ? new Date(proforma.valid_until).toLocaleDateString('fr-FR') : '-'}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {new Intl.NumberFormat('fr-FR').format(proforma.total_ttc || 0)} {proforma.currency}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusConfig[proforma.status as keyof typeof statusConfig]?.variant || "secondary"}>
                      {statusConfig[proforma.status as keyof typeof statusConfig]?.label || proforma.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon">
                      <Send className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {proformas.length === 0 
                      ? "Aucun pro forma enregistré"
                      : "Aucun pro forma ne correspond à votre recherche"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isProformaDialogOpen} onOpenChange={setIsProformaDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouveau Pro Forma</DialogTitle>
          </DialogHeader>
          <InvoiceForm onSuccess={() => {
            setIsProformaDialogOpen(false);
            loadProformas();
          }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
