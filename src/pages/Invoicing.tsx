import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search, FileText, Download, Printer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InvoiceForm } from "@/components/forms/InvoiceForm";
import { supabase } from "@/integrations/supabase/client";
import { generateInvoicePDF } from "@/utils/invoicePdfGenerator";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  posted: { label: "Validée", variant: "default" as const },
  paid: { label: "Payée", variant: "default" as const },
};

export default function Invoicing() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);

  useEffect(() => {
    loadInvoices();
    loadCompany();
  }, []);

  const loadInvoices = async () => {
    const { data } = await supabase
      .from("invoices")
      .select(`
        *,
        partner:partners(*),
        lines:invoice_lines(*, product:products(*), tax:taxes(*))
      `)
      .order("date", { ascending: false });
    
    if (data) setInvoices(data);
  };

  const loadCompany = async () => {
    const { data: profile } = await supabase.from("profiles").select("company_id").single();
    if (profile?.company_id) {
      const { data } = await supabase.from("companies").select("*").eq("id", profile.company_id).single();
      if (data) setCompany(data);
    }
  };

  // Filter invoices based on search and status
  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch = 
      invoice.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.partner?.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Calculate stats from real invoices
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const monthlyInvoices = invoices.filter(inv => {
    const invDate = new Date(inv.date);
    return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
  });

  const totalAmount = monthlyInvoices.reduce((sum, inv) => sum + (inv.total_ttc || 0), 0);
  const unpaidInvoices = invoices.filter(inv => inv.status === 'posted');
  const amountToPay = unpaidInvoices.reduce((sum, inv) => sum + (inv.total_ttc || 0), 0);
  
  const overdueInvoices = invoices.filter(inv => {
    if (!inv.due_date || inv.status === 'paid') return false;
    return new Date(inv.due_date) < new Date();
  });
  const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + (inv.total_ttc || 0), 0);

  const handleDownloadInvoice = async (invoice: any) => {
    try {
      const invoiceData = {
        number: invoice.number,
        date: invoice.date,
        dueDate: invoice.due_date,
        partner: {
          name: invoice.partner.name,
          address: invoice.partner.address,
          phone: invoice.partner.phone,
          email: invoice.partner.email,
          nif: invoice.partner.nif,
        },
        company: {
          name: company?.name || "Votre Entreprise",
          address: company?.address,
          phone: company?.phone,
          email: company?.email,
          nif: company?.nif,
          rccm: company?.rccm,
          logoUrl: company?.logo_url,
        },
        lines: invoice.lines.map((line: any) => ({
          description: line.product?.name || line.description || "",
          quantity: line.qty,
          unitPrice: line.unit_price,
          taxRate: line.tax?.rate || 0,
          subtotal: line.subtotal,
        })),
        totalHT: invoice.total_ht,
        totalTax: invoice.total_tax,
        totalTTC: invoice.total_ttc,
        currency: invoice.currency,
        notes: invoice.notes,
      };

      generateInvoicePDF(invoiceData, 'download');
      toast.success("Facture téléchargée");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Erreur lors de la génération du PDF");
    }
  };

  const handlePrintInvoice = async (invoice: any) => {
    try {
      const invoiceData = {
        number: invoice.number,
        date: invoice.date,
        dueDate: invoice.due_date,
        partner: {
          name: invoice.partner.name,
          address: invoice.partner.address,
          phone: invoice.partner.phone,
          email: invoice.partner.email,
          nif: invoice.partner.nif,
        },
        company: {
          name: company?.name || "Votre Entreprise",
          address: company?.address,
          phone: company?.phone,
          email: company?.email,
          nif: company?.nif,
          rccm: company?.rccm,
          logoUrl: company?.logo_url,
        },
        lines: invoice.lines.map((line: any) => ({
          description: line.product?.name || line.description || "",
          quantity: line.qty,
          unitPrice: line.unit_price,
          taxRate: line.tax?.rate || 0,
          subtotal: line.subtotal,
        })),
        totalHT: invoice.total_ht,
        totalTax: invoice.total_tax,
        totalTTC: invoice.total_ttc,
        currency: invoice.currency,
        notes: invoice.notes,
      };

      generateInvoicePDF(invoiceData, 'print');
    } catch (error) {
      console.error("Error printing PDF:", error);
      toast.error("Erreur lors de l'impression");
    }
  };

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
          <Button onClick={() => setIsInvoiceDialogOpen(true)}>
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
            <div className="text-2xl font-bold">{monthlyInvoices.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {invoices.length} au total
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
              {new Intl.NumberFormat('fr-FR').format(totalAmount)} CDF
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ce mois</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              À Encaisser
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('fr-FR').format(amountToPay)} CDF
            </div>
            <p className="text-xs text-warning mt-1">
              {unpaidInvoices.length} facture{unpaidInvoices.length > 1 ? 's' : ''} en attente
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              En Retard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('fr-FR').format(overdueAmount)} CDF
            </div>
            <p className="text-xs text-destructive mt-1">
              {overdueInvoices.length} facture{overdueInvoices.length > 1 ? 's' : ''} échue{overdueInvoices.length > 1 ? 's' : ''}
            </p>
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
              {filteredInvoices.length > 0 ? filteredInvoices.map((invoice) => (
                <TableRow key={invoice.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{invoice.number}</TableCell>
                  <TableCell>{invoice.partner?.name}</TableCell>
                  <TableCell>{new Date(invoice.date).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell>{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('fr-FR') : '-'}</TableCell>
                  <TableCell className="font-semibold">{new Intl.NumberFormat('fr-FR').format(invoice.total_ttc)} {invoice.currency}</TableCell>
                  <TableCell>
                    <Badge variant={statusConfig[invoice.status as keyof typeof statusConfig]?.variant || "secondary"}>
                      {statusConfig[invoice.status as keyof typeof statusConfig]?.label || invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Download className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleDownloadInvoice(invoice)}>
                          <Download className="mr-2 h-4 w-4" />
                          Télécharger PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handlePrintInvoice(invoice)}>
                          <Printer className="mr-2 h-4 w-4" />
                          Imprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {invoices.length === 0 
                      ? "Aucune facture enregistrée. Créez votre première facture pour commencer."
                      : "Aucune facture ne correspond à votre recherche"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle Facture</DialogTitle>
          </DialogHeader>
          <InvoiceForm onSuccess={() => {
            setIsInvoiceDialogOpen(false);
            loadInvoices();
          }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
