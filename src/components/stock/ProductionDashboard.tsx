import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Factory, CheckCircle, Clock, Package, TrendingUp, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

interface ProductionStats {
  inProgress: number;
  completed: number;
  totalProduced: number;
  avgDuration: number;
  totalMaterialCost: number;
  activeSteps: { order_number: string; step_name: string; progress: number }[];
  recentCompletions: { number: string; product: string; quantity: number; date: string }[];
  topConsumedMaterials: { name: string; qty: number; uom: string; cost: number }[];
}

export function ProductionDashboard() {
  const [stats, setStats] = useState<ProductionStats>({
    inProgress: 0, completed: 0, totalProduced: 0, avgDuration: 0,
    totalMaterialCost: 0, activeSteps: [], recentCompletions: [], topConsumedMaterials: [],
  });

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
    if (!profile?.company_id) return;
    const cid = profile.company_id;

    const [ordersRes, completedRes, stepsRes, consumptionsRes] = await Promise.all([
      (supabase.from("manufacturing_orders" as any) as any)
        .select("*, products(name)")
        .eq("company_id", cid)
        .eq("status", "in_progress"),
      (supabase.from("manufacturing_orders" as any) as any)
        .select("*, products(name)")
        .eq("company_id", cid)
        .eq("status", "done")
        .order("completion_date", { ascending: false })
        .limit(5),
      (supabase.from("manufacturing_order_steps" as any) as any)
        .select("*, manufacturing_orders!inner(company_id, number)")
        .eq("manufacturing_orders.company_id", cid)
        .eq("status", "in_progress"),
      (supabase.from("manufacturing_order_consumptions" as any) as any)
        .select("*, products(name, uom:uom(code))")
        .eq("manufacturing_orders.company_id", cid)
        .limit(100),
    ]);

    const inProgressOrders = ordersRes.data || [];
    const completedOrders = completedRes.data || [];

    const totalProduced = completedOrders.reduce((s: number, o: any) => s + (o.quantity || 0), 0);
    const durations = completedOrders.filter((o: any) => o.actual_duration_minutes).map((o: any) => o.actual_duration_minutes);
    const avgDuration = durations.length > 0 ? Math.round(durations.reduce((s: number, d: number) => s + d, 0) / durations.length) : 0;
    const totalMaterialCost = completedOrders.reduce((s: number, o: any) => s + (o.actual_cost || 0), 0);

    // Active steps with progress
    const activeSteps: ProductionStats["activeSteps"] = [];
    for (const order of inProgressOrders) {
      const { data: orderSteps } = await (supabase.from("manufacturing_order_steps" as any) as any)
        .select("*").eq("order_id", order.id).order("step_order");
      const steps = orderSteps || [];
      const done = steps.filter((s: any) => s.status === "completed").length;
      const total = steps.length;
      const currentStep = steps.find((s: any) => s.status === "in_progress");
      if (total > 0) {
        activeSteps.push({
          order_number: order.number,
          step_name: currentStep?.step_name || "En attente",
          progress: Math.round((done / total) * 100),
        });
      }
    }

    setStats({
      inProgress: inProgressOrders.length,
      completed: completedOrders.length,
      totalProduced,
      avgDuration,
      totalMaterialCost,
      activeSteps,
      recentCompletions: completedOrders.map((o: any) => ({
        number: o.number, product: o.products?.name || "", quantity: o.quantity, date: o.completion_date,
      })),
      topConsumedMaterials: [],
    });
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Factory className="h-4 w-4" /> Production en cours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.inProgress}</div>
            <p className="text-xs text-muted-foreground mt-1">ordres actifs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> Terminées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.totalProduced} unités produites</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" /> Temps moyen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.avgDuration > 60 ? `${Math.floor(stats.avgDuration / 60)}h ${stats.avgDuration % 60}m` : `${stats.avgDuration} min`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">par fabrication</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Coût matières
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(stats.totalMaterialCost)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">total consommé</p>
          </CardContent>
        </Card>
      </div>

      {/* Active production with progress */}
      {stats.activeSteps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5 text-primary" />
              Production en cours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.activeSteps.map((a, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono font-medium">{a.order_number}</span>
                    <span className="text-sm text-muted-foreground ml-2">— {a.step_name}</span>
                  </div>
                  <Badge variant="secondary">{a.progress}%</Badge>
                </div>
                <Progress value={a.progress} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent completions */}
      {stats.recentCompletions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Dernières productions terminées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.recentCompletions.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <span className="font-mono font-medium">{c.number}</span>
                    <span className="text-sm text-muted-foreground ml-2">— {c.product}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{c.quantity} unités</Badge>
                    <span className="text-xs text-muted-foreground">{c.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
