import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search, Pencil, TrendingUp, DollarSign, Target, Users } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function CRM() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isLeadDialogOpen, setIsLeadDialogOpen] = useState(false);
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<any>(null);
  const [partners, setPartners] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPartners();
    loadLeads();
    loadStages();
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

  const loadLeads = async () => {
    const { data } = await supabase
      .from("crm_leads")
      .select(`
        *,
        partner:partners(name),
        stage:crm_stages(name),
        owner:profiles!crm_leads_owner_id_fkey(full_name)
      `)
      .order("created_at", { ascending: false });
    
    if (data) setLeads(data);
  };

  const loadStages = async () => {
    const { data: stagesData } = await supabase
      .from("crm_stages")
      .select("*, leads:crm_leads(count)")
      .order("order_seq");
    
    if (stagesData) {
      setStages(stagesData.map((stage: any) => ({
        name: stage.name,
        count: stage.leads?.length || 0,
        color: stage.won_flag ? "bg-success" : "bg-primary/20",
      })));
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

  // Calcul des KPIs
  const totalRevenue = leads.reduce((sum, lead) => sum + (lead.expected_revenue || 0), 0);
  const averageRevenue = leads.length > 0 ? totalRevenue / leads.length : 0;
  const wonLeads = leads.filter(lead => lead.stage?.won_flag);
  const conversionRate = leads.length > 0 ? (wonLeads.length / leads.length) * 100 : 0;
  const totalPartners = partners.length;
  const averageProbability = leads.length > 0 
    ? leads.reduce((sum, lead) => sum + (lead.probability || 0), 0) / leads.length 
    : 0;

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

      {/* KPIs Section */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revenu Total Prévu</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('fr-FR').format(totalRevenue)} CDF
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Sur {leads.length} opportunité{leads.length > 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Taux de Conversion</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionRate.toFixed(1)}%</div>
            <Progress value={conversionRate} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {wonLeads.length} opportunité{wonLeads.length > 1 ? 's' : ''} gagnée{wonLeads.length > 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Valeur Moyenne</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('fr-FR').format(averageRevenue)} CDF
            </div>
            <Progress value={averageProbability} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              Probabilité moyenne: {averageProbability.toFixed(0)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Partenaires Actifs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPartners}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {partners.filter(p => p.type === 'customer').length} client{partners.filter(p => p.type === 'customer').length > 1 ? 's' : ''} • {partners.filter(p => p.type === 'vendor').length} fournisseur{partners.filter(p => p.type === 'vendor').length > 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
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
              {leads.length > 0 ? leads.map((lead) => (
                <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{lead.title}</TableCell>
                  <TableCell>{lead.partner?.name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{lead.stage?.name || '-'}</Badge>
                  </TableCell>
                  <TableCell>
                    {new Intl.NumberFormat('fr-FR').format(lead.expected_revenue || 0)} CDF
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-success"
                          style={{ width: `${lead.probability || 0}%` }}
                        />
                      </div>
                      <span className="text-sm">{lead.probability || 0}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{lead.owner?.full_name || '-'}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Aucune opportunité enregistrée
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isLeadDialogOpen} onOpenChange={setIsLeadDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle Opportunité</DialogTitle>
          </DialogHeader>
          <LeadForm onSuccess={() => {
            setIsLeadDialogOpen(false);
            loadLeads();
            loadStages();
          }} />
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
