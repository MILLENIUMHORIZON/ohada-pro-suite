import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search, FileText, Send } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const mockProformas = [
  {
    id: 1,
    number: "PRO-2025-0001",
    type: "customer",
    partner: "Entreprise ABC",
    date: "2025-01-15",
    validUntil: "2025-02-15",
    amount: "2,500,000 CDF",
    status: "sent",
  },
  {
    id: 2,
    number: "PRO-2025-0002",
    type: "supplier",
    partner: "Fournisseur XYZ",
    date: "2025-01-14",
    validUntil: "2025-02-14",
    amount: "1,800,000 CDF",
    status: "accepted",
  },
  {
    id: 3,
    number: "PRO-2025-0003",
    type: "customer",
    partner: "Tech Solutions",
    date: "2025-01-13",
    validUntil: "2025-02-13",
    amount: "4,200,000 CDF",
    status: "draft",
  },
];

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

  const filteredProformas = mockProformas.filter((pf) => {
    if (activeTab === "customer" && pf.type !== "customer") return false;
    if (activeTab === "supplier" && pf.type !== "supplier") return false;
    return true;
  });

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
          <Button>
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
            <div className="text-2xl font-bold">124</div>
            <p className="text-xs text-muted-foreground mt-1">+8 cette semaine</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              En Attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">28</div>
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
            <div className="text-2xl font-bold text-success">67</div>
            <p className="text-xs text-muted-foreground mt-1">54% taux acceptation</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Montant Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">38M CDF</div>
            <p className="text-xs text-success mt-1">+22% vs mois dernier</p>
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
              {filteredProformas.map((proforma) => (
                <TableRow key={proforma.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{proforma.number}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {proforma.type === "customer" ? "Client" : "Fournisseur"}
                    </Badge>
                  </TableCell>
                  <TableCell>{proforma.partner}</TableCell>
                  <TableCell>{new Date(proforma.date).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell>{new Date(proforma.validUntil).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell className="font-semibold">{proforma.amount}</TableCell>
                  <TableCell>
                    <Badge variant={statusConfig[proforma.status as keyof typeof statusConfig].variant}>
                      {statusConfig[proforma.status as keyof typeof statusConfig].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon">
                      <Send className="h-4 w-4" />
                    </Button>
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
