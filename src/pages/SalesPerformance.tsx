import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Target, TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { KPISettingForm } from "@/components/forms/KPISettingForm";
import { SalesTargetForm } from "@/components/forms/SalesTargetForm";
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
import { Progress } from "@/components/ui/progress";

export default function SalesPerformance() {
  const [isKPIDialogOpen, setIsKPIDialogOpen] = useState(false);
  const [isTargetDialogOpen, setIsTargetDialogOpen] = useState(false);
  const [kpiSettings, setKpiSettings] = useState<any[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load KPI settings
      const { data: kpiData } = await supabase
        .from("sales_kpi_settings")
        .select("*")
        .order("name");

      if (kpiData) setKpiSettings(kpiData);

      // Load targets with user and KPI info
      const { data: targetsData } = await supabase
        .from("sales_targets")
        .select(`
          *,
          kpi:sales_kpi_settings(name, unit, target_period),
          user:profiles!sales_targets_user_id_fkey(full_name)
        `)
        .order("period_start", { ascending: false });

      if (targetsData) setTargets(targetsData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getUnitLabel = (unit: string) => {
    switch (unit) {
      case "amount": return "CDF";
      case "count": return "";
      case "percentage": return "%";
      default: return "";
    }
  };

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case "daily": return "Journalier";
      case "weekly": return "Hebdomadaire";
      case "monthly": return "Mensuel";
      case "quarterly": return "Trimestriel";
      case "yearly": return "Annuel";
      default: return period;
    }
  };

  const formatValue = (value: number, unit: string) => {
    if (unit === "amount") {
      return new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);
    }
    return value.toFixed(2);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Performance Commerciale</h1>
          <p className="text-muted-foreground mt-1">Suivi des indicateurs et objectifs de vente</p>
        </div>
      </div>

      <Tabs defaultValue="targets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="targets">
            <Target className="mr-2 h-4 w-4" />
            Objectifs
          </TabsTrigger>
          <TabsTrigger value="kpis">
            <TrendingUp className="mr-2 h-4 w-4" />
            Indicateurs KPI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="targets" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Objectifs de Vente</CardTitle>
                  <CardDescription>Objectifs par commercial et période</CardDescription>
                </div>
                <Button onClick={() => setIsTargetDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nouvel Objectif
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Commercial</TableHead>
                    <TableHead>Indicateur</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead className="text-right">Objectif</TableHead>
                    <TableHead className="text-right">Réalisé</TableHead>
                    <TableHead className="text-right">Taux</TableHead>
                    <TableHead>Progression</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {targets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Aucun objectif défini. Créez votre premier objectif pour commencer.
                      </TableCell>
                    </TableRow>
                  ) : (
                    targets.map((target) => (
                      <TableRow key={target.id}>
                        <TableCell className="font-medium">
                          {target.user?.full_name || "N/A"}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{target.kpi?.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {getPeriodLabel(target.kpi?.target_period)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(target.period_start).toLocaleDateString('fr-FR')} 
                            {" - "}
                            {new Date(target.period_end).toLocaleDateString('fr-FR')}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatValue(target.target_value, target.kpi?.unit)} 
                          {" "}
                          {getUnitLabel(target.kpi?.unit)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatValue(target.achieved_value || 0, target.kpi?.unit)}
                          {" "}
                          {getUnitLabel(target.kpi?.unit)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={target.achievement_rate >= 100 ? "default" : target.achievement_rate >= 75 ? "secondary" : "outline"}>
                            {target.achievement_rate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="w-full">
                            <Progress value={Math.min(target.achievement_rate, 100)} className="h-2" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kpis" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Indicateurs de Performance (KPI)</CardTitle>
                  <CardDescription>Configuration des indicateurs de suivi</CardDescription>
                </div>
                <Button onClick={() => setIsKPIDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nouvel Indicateur
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Unité</TableHead>
                    <TableHead>Type de calcul</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kpiSettings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Aucun indicateur configuré. Créez votre premier indicateur pour commencer.
                      </TableCell>
                    </TableRow>
                  ) : (
                    kpiSettings.map((kpi) => (
                      <TableRow key={kpi.id}>
                        <TableCell className="font-medium">{kpi.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {kpi.description || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {kpi.unit === "amount" && "Montant (CDF)"}
                            {kpi.unit === "count" && "Nombre"}
                            {kpi.unit === "percentage" && "Pourcentage (%)"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {kpi.calculation_type === "sum" && "Somme"}
                            {kpi.calculation_type === "average" && "Moyenne"}
                            {kpi.calculation_type === "count" && "Comptage"}
                            {kpi.calculation_type === "custom" && "Personnalisé"}
                          </Badge>
                        </TableCell>
                        <TableCell>{getPeriodLabel(kpi.target_period)}</TableCell>
                        <TableCell>
                          {kpi.is_active ? (
                            <Badge variant="default">Actif</Badge>
                          ) : (
                            <Badge variant="secondary">Inactif</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* KPI Dialog */}
      <Dialog open={isKPIDialogOpen} onOpenChange={setIsKPIDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel Indicateur KPI</DialogTitle>
            <DialogDescription>
              Créer un nouvel indicateur de performance pour le suivi commercial
            </DialogDescription>
          </DialogHeader>
          <KPISettingForm
            onSuccess={() => {
              setIsKPIDialogOpen(false);
              loadData();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Target Dialog */}
      <Dialog open={isTargetDialogOpen} onOpenChange={setIsTargetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel Objectif de Vente</DialogTitle>
            <DialogDescription>
              Définir un objectif de vente pour un commercial
            </DialogDescription>
          </DialogHeader>
          <SalesTargetForm
            onSuccess={() => {
              setIsTargetDialogOpen(false);
              loadData();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
