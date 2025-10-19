import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, FileText, Package, DollarSign } from "lucide-react";

const stats = [
  {
    name: "Chiffre d'Affaires",
    value: "2,450,000 CDF",
    change: "+12.5%",
    trend: "up",
    icon: DollarSign,
    color: "text-success",
  },
  {
    name: "Clients Actifs",
    value: "1,234",
    change: "+5.2%",
    trend: "up",
    icon: Users,
    color: "text-primary",
  },
  {
    name: "Factures en Cours",
    value: "89",
    change: "-3.1%",
    trend: "down",
    icon: FileText,
    color: "text-warning",
  },
  {
    name: "Articles en Stock",
    value: "456",
    change: "+8.7%",
    trend: "up",
    icon: Package,
    color: "text-accent-foreground",
  },
];

const recentActivities = [
  { id: 1, type: "invoice", desc: "Facture FAC-2025-0045 créée", time: "Il y a 5 min" },
  { id: 2, type: "payment", desc: "Paiement reçu de Client ABC", time: "Il y a 12 min" },
  { id: 3, type: "lead", desc: "Nouvelle opportunité ajoutée", time: "Il y a 1h" },
  { id: 4, type: "stock", desc: "Réception de marchandises", time: "Il y a 2h" },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Vue d'ensemble de votre activité</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.name}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.name}
                </CardTitle>
                <Icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <TrendingUp className={`h-3 w-3 ${stat.trend === 'up' ? 'text-success' : 'text-destructive'}`} />
                  <span className={stat.trend === 'up' ? 'text-success' : 'text-destructive'}>
                    {stat.change}
                  </span>
                  <span>ce mois</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activities */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Activités Récentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="mt-0.5 h-2 w-2 rounded-full bg-primary" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">{activity.desc}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions Rapides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <button className="flex items-center gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">Nouvelle Facture</div>
                  <div className="text-xs text-muted-foreground">Créer une facture client</div>
                </div>
              </button>
              <button className="flex items-center gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">Nouveau Client</div>
                  <div className="text-xs text-muted-foreground">Ajouter un client</div>
                </div>
              </button>
              <button className="flex items-center gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent">
                <Package className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">Mouvement de Stock</div>
                  <div className="text-xs text-muted-foreground">Entrée ou sortie</div>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
