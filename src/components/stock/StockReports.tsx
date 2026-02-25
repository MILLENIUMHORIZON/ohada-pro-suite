import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Package, TrendingUp, Clock, DollarSign, Users, Wrench, BarChart3 } from "lucide-react";

const reports = [
  { title: "Fiche stock détaillée", description: "Stock par article avec détail par emplacement", icon: Package, available: true },
  { title: "Historique des mouvements", description: "Tous les mouvements avec filtres avancés", icon: FileText, available: true },
  { title: "Rapport consommation matière", description: "Matières consommées par période et par OF", icon: TrendingUp, available: false },
  { title: "Rapport production par période", description: "Production réalisée par jour/semaine/mois", icon: BarChart3, available: false },
  { title: "Rapport productivité opérateur", description: "Performance par opérateur et temps réels vs théoriques", icon: Users, available: false },
  { title: "Rapport rendement machine", description: "Utilisation et performance des machines", icon: Wrench, available: false },
  { title: "Coût réel vs théorique", description: "Comparaison des coûts planifiés et réels de production", icon: DollarSign, available: false },
  { title: "État valorisé du stock", description: "Valeur totale du stock par catégorie et emplacement", icon: Package, available: true },
];

export function StockReports() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Rapports & Analyses</CardTitle>
          <CardDescription>Rapports industriels pour le suivi de la production et du stock</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {reports.map((report) => {
              const Icon = report.icon;
              return (
                <Card
                  key={report.title}
                  className={`cursor-pointer transition-colors ${report.available ? "hover:bg-accent/50" : "opacity-60"}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-sm">{report.title}</CardTitle>
                        <CardDescription className="text-xs">{report.description}</CardDescription>
                      </div>
                      {!report.available && (
                        <span className="text-xs bg-muted px-2 py-1 rounded">Phase 2</span>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
