import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LeadForm } from "@/components/forms/LeadForm";
import { PartnerForm } from "@/components/forms/PartnerForm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const mockLeads = [
  {
    id: 1,
    title: "Nouveau prospect - Entreprise ABC",
    partner: "Entreprise ABC",
    stage: "Qualification",
    revenue: "500,000 CDF",
    probability: 60,
    owner: "Jean Dupont",
  },
  {
    id: 2,
    title: "Opportunité système ERP",
    partner: "Tech Solutions",
    stage: "Proposition",
    revenue: "1,200,000 CDF",
    probability: 75,
    owner: "Marie Martin",
  },
  {
    id: 3,
    title: "Renouvellement contrat",
    partner: "Industries XYZ",
    stage: "Négociation",
    revenue: "850,000 CDF",
    probability: 85,
    owner: "Jean Dupont",
  },
];

const stages = [
  { name: "Nouveau", count: 12, color: "bg-muted" },
  { name: "Qualification", count: 8, color: "bg-primary/20" },
  { name: "Proposition", count: 5, color: "bg-warning/20" },
  { name: "Négociation", count: 3, color: "bg-success/20" },
  { name: "Gagné", count: 24, color: "bg-success" },
];

export default function CRM() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isLeadDialogOpen, setIsLeadDialogOpen] = useState(false);
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<any>(null);
  const [partners, setPartners] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPartners();
  }, []);

  const loadPartners = async () => {
    try {
      const { data, error } = await supabase
        .from("partners")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPartners(data || []);
    } catch (error: any) {
      toast.error("Erreur lors du chargement des partenaires");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditPartner = (partner: any) => {
    setEditingPartner(partner);
    setIsClientDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsClientDialogOpen(false);
    setEditingPartner(null);
    loadPartners();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">CRM</h1>
          <p className="text-muted-foreground mt-1">Gestion de la relation client</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsClientDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau Partenaire
          </Button>
          <Button onClick={() => setIsLeadDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle Opportunité
          </Button>
        </div>
      </div>

      {/* Pipeline Overview */}
      <div className="grid gap-4 md:grid-cols-5">
        {stages.map((stage) => (
          <Card key={stage.name}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{stage.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stage.count}</div>
              <div className={`mt-2 h-1 rounded-full ${stage.color}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Partners Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Partenaires</CardTitle>
            <div className="flex w-72 items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un partenaire..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-0 bg-muted/50"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : partners.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Aucun partenaire trouvé</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>NIF</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners
                  .filter((partner) =>
                    partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    partner.email?.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((partner) => (
                    <TableRow key={partner.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{partner.name}</TableCell>
                      <TableCell>{partner.email || "-"}</TableCell>
                      <TableCell>{partner.phone || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {partner.type === "customer" ? "Client" : 
                           partner.type === "vendor" ? "Fournisseur" : "Les deux"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{partner.nif || "-"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditPartner(partner)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle>Opportunités Actives</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titre</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Étape</TableHead>
                <TableHead>Revenu Estimé</TableHead>
                <TableHead>Probabilité</TableHead>
                <TableHead>Responsable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockLeads.map((lead) => (
                <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{lead.title}</TableCell>
                  <TableCell>{lead.partner}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{lead.stage}</Badge>
                  </TableCell>
                  <TableCell>{lead.revenue}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-success"
                          style={{ width: `${lead.probability}%` }}
                        />
                      </div>
                      <span className="text-sm">{lead.probability}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{lead.owner}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isLeadDialogOpen} onOpenChange={setIsLeadDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle Opportunité</DialogTitle>
          </DialogHeader>
          <LeadForm onSuccess={() => setIsLeadDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={isClientDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPartner ? "Modifier le Partenaire" : "Nouveau Partenaire"}</DialogTitle>
          </DialogHeader>
          <PartnerForm 
            partnerId={editingPartner?.id}
            onSuccess={handleDialogClose}
            defaultValues={editingPartner || { type: "customer" }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
