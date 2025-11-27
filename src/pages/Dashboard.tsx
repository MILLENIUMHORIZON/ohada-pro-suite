import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, FileText, Package, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const [stats, setStats] = useState({
    revenue: 0,
    customers: 0,
    invoices: 0,
    products: 0,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Load invoices
    const { data: invoices } = await supabase
      .from("invoices")
      .select("total_ttc, date, status");
    
    const monthlyRevenue = (invoices || [])
      .filter(inv => {
        const invDate = new Date(inv.date);
        return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
      })
      .reduce((sum, inv) => sum + (inv.total_ttc || 0), 0);

    const pendingInvoices = (invoices || []).filter(inv => inv.status === 'posted').length;

    // Load customers
    const { data: customers } = await supabase
      .from("partners")
      .select("id");

    // Load products
    const { data: products } = await supabase
      .from("products")
      .select("id")
      .eq("active", true);

    setStats({
      revenue: monthlyRevenue,
      customers: customers?.length || 0,
      invoices: pendingInvoices,
      products: products?.length || 0,
    });
  };
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Vue d'ensemble de votre activité</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Chiffre d'Affaires
            </CardTitle>
            <DollarSign className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('fr-FR').format(stats.revenue)} CDF
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ce mois</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Clients Actifs
            </CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.customers}</div>
            <p className="text-xs text-muted-foreground mt-1">Partenaires clients</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Factures en Cours
            </CardTitle>
            <FileText className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.invoices}</div>
            <p className="text-xs text-muted-foreground mt-1">À encaisser</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Articles Actifs
            </CardTitle>
            <Package className="h-5 w-5 text-accent-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.products}</div>
            <p className="text-xs text-muted-foreground mt-1">Produits</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activities */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vue d'Ensemble</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Chiffre d'affaires mensuel</span>
                <span className="text-sm font-semibold">
                  {new Intl.NumberFormat('fr-FR').format(stats.revenue)} CDF
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Clients enregistrés</span>
                <span className="text-sm font-semibold">{stats.customers}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Factures en attente</span>
                <span className="text-sm font-semibold">{stats.invoices}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Articles en catalogue</span>
                <span className="text-sm font-semibold">{stats.products}</span>
              </div>
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
