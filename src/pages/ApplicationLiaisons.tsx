import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Check, X, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type ApplicationType = Database["public"]["Enums"]["application_type"];
type LiaisonStatus = Database["public"]["Enums"]["liaison_status"];

const applicationNames: Record<ApplicationType, string> = {
  loyambo_resto_hotel: "Loyambo Resto-Hotel",
  millenium_payroll: "Millenium Payroll",
  other: "Autres Applications",
};

interface Liaison {
  id: string;
  application_type: ApplicationType;
  application_name: string;
  status: LiaisonStatus;
  request_message: string | null;
  response_message: string | null;
  created_at: string;
  approved_at: string | null;
  code_etablissement: string | null;
  nom_etablissement: string | null;
  type_etablissement: string | null;
  administrateur_etablissement: string | null;
  phone_etablissement: string | null;
}

export default function ApplicationLiaisons() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const [liaisons, setLiaisons] = useState<Liaison[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newLiasonName, setNewLiasonName] = useState("");
  const [newLiasonMessage, setNewLiasonMessage] = useState("");
  const [companyCode, setCompanyCode] = useState<string>("");

  const appName = appId && appId in applicationNames 
    ? applicationNames[appId as ApplicationType] 
    : "Application";

  useEffect(() => {
    loadLiaisons();
    loadCompanyCode();
  }, [appId]);

  const loadCompanyCode = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (profile?.company_id) {
        const { data: company } = await supabase
          .from("companies")
          .select("company_code")
          .eq("id", profile.company_id)
          .single();

        if (company?.company_code) {
          setCompanyCode(company.company_code);
        }
      }
    } catch (error: any) {
      console.error("Error loading company code:", error);
    }
  };

  const loadLiaisons = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !appId) return;

      const { data, error } = await supabase
        .from("application_liaisons")
        .select("*")
        .eq("application_type", appId as ApplicationType)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLiaisons(data || []);
    } catch (error: any) {
      toast.error("Erreur lors du chargement des liaisons");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLiaison = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vous devez être connecté");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.company_id) {
        toast.error("Erreur: Entreprise non trouvée");
        return;
      }

      const { error } = await supabase
        .from("application_liaisons")
        .insert({
          application_type: appId as ApplicationType,
          application_name: newLiasonName,
          company_id: profile.company_id,
          requested_by: user.id,
          request_message: newLiasonMessage,
          status: "pending" as LiaisonStatus,
        });

      if (error) throw error;

      toast.success("Demande de liaison créée avec succès");
      setIsDialogOpen(false);
      setNewLiasonName("");
      setNewLiasonMessage("");
      loadLiaisons();
    } catch (error: any) {
      toast.error("Erreur lors de la création de la demande");
      console.error(error);
    }
  };

  const getStatusBadge = (status: LiaisonStatus) => {
    const statusConfig: Record<LiaisonStatus, { label: string; icon: any; variant: "outline" | "default" | "destructive" }> = {
      pending: { label: "En attente", icon: Clock, variant: "outline" },
      approved: { label: "Approuvée", icon: Check, variant: "default" },
      rejected: { label: "Rejetée", icon: X, variant: "destructive" },
      active: { label: "Active", icon: Check, variant: "default" },
    };

    const config = statusConfig[status];
    if (!config) return null;

    const StatusIcon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <StatusIcon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Company Code Display */}
      {companyCode && (
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Code Entreprise
              </p>
              <p className="text-5xl font-bold text-primary tracking-wider">
                {companyCode}
              </p>
              <p className="text-sm text-muted-foreground mt-3">
                Communiquez ce code aux applications tierces pour recevoir des demandes de liaison
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/application-management")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Liaisons - {appName}
            </h1>
            <p className="text-muted-foreground mt-1">
              Gérez vos demandes de liaison avec {appName}
            </p>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle demande
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle demande de liaison</DialogTitle>
              <DialogDescription>
                Créez une demande pour lier votre ERP à {appName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom de l'application</Label>
                <Input
                  id="name"
                  placeholder="Ex: Mon Restaurant Principal"
                  value={newLiasonName}
                  onChange={(e) => setNewLiasonName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message (optionnel)</Label>
                <Textarea
                  id="message"
                  placeholder="Informations supplémentaires sur cette liaison..."
                  value={newLiasonMessage}
                  onChange={(e) => setNewLiasonMessage(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={handleCreateLiaison}
                disabled={!newLiasonName.trim()}
              >
                Créer la demande
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Liaisons Table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des demandes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Chargement...
            </div>
          ) : liaisons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucune demande de liaison pour le moment
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Établissement</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Administrateur</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liaisons.map((liaison) => (
                  <TableRow key={liaison.id}>
                    <TableCell className="font-medium">
                      {liaison.nom_etablissement || liaison.application_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {liaison.code_etablissement || "-"}
                    </TableCell>
                    <TableCell>
                      {liaison.type_etablissement || "-"}
                    </TableCell>
                    <TableCell>
                      {liaison.administrateur_etablissement || "-"}
                    </TableCell>
                    <TableCell>
                      {liaison.phone_etablissement || "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(liaison.status)}</TableCell>
                    <TableCell>
                      {format(new Date(liaison.created_at), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
