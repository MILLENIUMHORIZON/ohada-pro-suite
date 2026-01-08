import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FileText, Clock, CheckCircle, XCircle, Wallet, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FundRequestForm } from "@/components/forms/FundRequestForm";
import { FundRequestDetails } from "@/components/fund-requests/FundRequestDetails";
import { WorkflowConfiguration } from "@/components/fund-requests/WorkflowConfiguration";

type FundRequest = {
  id: string;
  request_number: string;
  beneficiary: string;
  amount: number;
  currency: string;
  description: string;
  request_date: string;
  status: string;
  created_at: string;
  requester_id: string;
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  draft: { label: "Brouillon", variant: "secondary", icon: <FileText className="h-3 w-3" /> },
  submitted: { label: "Soumise", variant: "default", icon: <Clock className="h-3 w-3" /> },
  accounting_review: { label: "Comptabilisée", variant: "outline", icon: <FileText className="h-3 w-3" /> },
  validated: { label: "Validée", variant: "default", icon: <CheckCircle className="h-3 w-3" /> },
  rejected: { label: "Rejetée", variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
  paid: { label: "Payée", variant: "default", icon: <Wallet className="h-3 w-3" /> },
};

export default function FundRequests() {
  const [requests, setRequests] = useState<FundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<FundRequest | null>(null);
  const [showWorkflowConfig, setShowWorkflowConfig] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadRequests();
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    setIsAdmin(roles?.role === 'admin');
  };

  const loadRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('fund_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les demandes de fonds",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = 
      req.request_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.beneficiary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === "all") return matchesSearch;
    return matchesSearch && req.status === activeTab;
  });

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('fr-CD', {
      style: 'currency',
      currency: currency === 'CDF' ? 'CDF' : 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleCreateSuccess = () => {
    setShowCreateDialog(false);
    loadRequests();
    toast({
      title: "Succès",
      description: "Demande de fonds créée avec succès",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Demandes de Fonds</h1>
          <p className="text-muted-foreground">
            Gérez les demandes de fonds et suivez leur workflow
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setShowWorkflowConfig(true)}>
              <Settings className="mr-2 h-4 w-4" />
              Configuration Workflow
            </Button>
          )}
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle Demande
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Créer une Demande de Fonds</DialogTitle>
              </DialogHeader>
              <FundRequestForm onSuccess={handleCreateSuccess} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Liste des Demandes</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">Toutes</TabsTrigger>
              <TabsTrigger value="draft">Brouillons</TabsTrigger>
              <TabsTrigger value="submitted">Soumises</TabsTrigger>
              <TabsTrigger value="accounting_review">Comptabilisées</TabsTrigger>
              <TabsTrigger value="validated">Validées</TabsTrigger>
              <TabsTrigger value="paid">Payées</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="text-muted-foreground">Chargement...</div>
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Aucune demande trouvée</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° Demande</TableHead>
                      <TableHead>Bénéficiaire</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((request) => {
                      const status = statusConfig[request.status] || statusConfig.draft;
                      return (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{request.request_number}</TableCell>
                          <TableCell>{request.beneficiary}</TableCell>
                          <TableCell>{formatAmount(request.amount, request.currency)}</TableCell>
                          <TableCell>{new Date(request.request_date).toLocaleDateString('fr-FR')}</TableCell>
                          <TableCell>
                            <Badge variant={status.variant} className="flex items-center gap-1 w-fit">
                              {status.icon}
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedRequest(request)}
                            >
                              Voir détails
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {selectedRequest && (
        <FundRequestDetails
          request={selectedRequest}
          open={!!selectedRequest}
          onOpenChange={(open) => !open && setSelectedRequest(null)}
          onUpdate={loadRequests}
        />
      )}

      {showWorkflowConfig && (
        <WorkflowConfiguration
          open={showWorkflowConfig}
          onOpenChange={setShowWorkflowConfig}
        />
      )}
    </div>
  );
}
