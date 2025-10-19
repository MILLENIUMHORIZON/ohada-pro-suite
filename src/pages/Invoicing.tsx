import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search, FileText, Download } from "lucide-react";
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

const mockInvoices = [
  {
    id: 1,
    number: "FAC-2025-0045",
    partner: "Entreprise ABC",
    date: "2025-01-15",
    dueDate: "2025-02-14",
    amount: "1,250,000 CDF",
    status: "posted",
  },
  {
    id: 2,
    number: "FAC-2025-0044",
    partner: "Tech Solutions",
    date: "2025-01-14",
    dueDate: "2025-02-13",
    amount: "3,450,000 CDF",
    status: "paid",
  },
  {
    id: 3,
    number: "FAC-2025-0043",
    partner: "Industries XYZ",
    date: "2025-01-13",
    dueDate: "2025-02-12",
    amount: "875,000 CDF",
    status: "draft",
  },
];

const statusConfig = {
  draft: { label: "Brouillon", variant: "secondary" as const },
  posted: { label: "Validée", variant: "default" as const },
  paid: { label: "Payée", variant: "default" as const },
};

export default function Invoicing() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Facturation</h1>
          <p className="text-muted-foreground mt-1">Gestion des factures et paiements</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Devis
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle Facture
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Factures du Mois
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89</div>
            <p className="text-xs text-muted-foreground mt-1">+12 cette semaine</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Montant Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45,250,000 CDF</div>
            <p className="text-xs text-success mt-1">+15% vs mois dernier</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              À Encaisser
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12,800,000 CDF</div>
            <p className="text-xs text-warning mt-1">23 factures en attente</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              En Retard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2,450,000 CDF</div>
            <p className="text-xs text-destructive mt-1">5 factures échues</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Liste des Factures</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="draft">Brouillon</SelectItem>
                  <SelectItem value="posted">Validée</SelectItem>
                  <SelectItem value="paid">Payée</SelectItem>
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
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockInvoices.map((invoice) => (
                <TableRow key={invoice.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{invoice.number}</TableCell>
                  <TableCell>{invoice.partner}</TableCell>
                  <TableCell>{new Date(invoice.date).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell>{new Date(invoice.dueDate).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell className="font-semibold">{invoice.amount}</TableCell>
                  <TableCell>
                    <Badge variant={statusConfig[invoice.status as keyof typeof statusConfig].variant}>
                      {statusConfig[invoice.status as keyof typeof statusConfig].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon">
                      <Download className="h-4 w-4" />
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
