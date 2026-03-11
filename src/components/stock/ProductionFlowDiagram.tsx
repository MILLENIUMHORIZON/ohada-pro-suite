import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowDown, Clock, Wrench, Users, Package, CheckCircle, Play, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FlowStep {
  step_order: number;
  step_name: string;
  step_code: string;
  duration_minutes: number;
  machines: string[];
  labor_required: number;
  status?: "pending" | "in_progress" | "completed";
  actual_duration_minutes?: number;
  materials?: { name: string; quantity: number; uom: string }[];
}

interface ProductionFlowDiagramProps {
  productName: string;
  steps: FlowStep[];
  totalDuration: number;
  quantity?: number;
  showStatus?: boolean;
}

export function ProductionFlowDiagram({ productName, steps, totalDuration, quantity = 1, showStatus = false }: ProductionFlowDiagramProps) {
  if (steps.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-muted-foreground">
          <Package className="mx-auto h-10 w-10 mb-2 opacity-50" />
          <p>Aucune étape de production définie dans la nomenclature.</p>
        </CardContent>
      </Card>
    );
  }

  const completedCount = steps.filter(s => s.status === "completed").length;
  const progressPercent = showStatus && steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;
  const actualTotalDuration = steps.reduce((s, st) => s + (st.actual_duration_minutes || 0), 0);

  const formatDuration = (min: number) => {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };

  const getStatusConfig = (status?: string) => {
    switch (status) {
      case "completed": return { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50 border-green-200", badge: "bg-green-100 text-green-700", label: "Terminée" };
      case "in_progress": return { icon: Play, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200 shadow-md ring-2 ring-yellow-300/50", badge: "bg-yellow-100 text-yellow-700", label: "En cours" };
      default: return { icon: Circle, color: "text-muted-foreground", bg: "bg-card border", badge: "bg-muted text-muted-foreground", label: "En attente" };
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Schéma de Production — {productName}</span>
          <div className="flex items-center gap-2">
            {showStatus && (
              <Badge variant="secondary" className="text-sm">
                {progressPercent}% complété
              </Badge>
            )}
            <Badge variant="secondary" className="text-sm">
              <Clock className="h-3 w-3 mr-1" />
              {showStatus && actualTotalDuration > 0
                ? `${formatDuration(actualTotalDuration)} / ${formatDuration(totalDuration)}`
                : `Durée totale : ${formatDuration(totalDuration)}`}
            </Badge>
          </div>
        </CardTitle>
        {quantity > 1 && (
          <p className="text-sm text-muted-foreground">Pour {quantity} unité(s)</p>
        )}
        {showStatus && (
          <Progress value={progressPercent} className="h-2 mt-2" />
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-1">
          {/* Start node */}
          <div className="flex items-center justify-center w-full max-w-md mx-auto">
            <div className="bg-primary text-primary-foreground rounded-full px-6 py-2 text-sm font-medium shadow-sm">
              Début de fabrication
            </div>
          </div>
          <ArrowDown className="h-5 w-5 text-muted-foreground" />

          {steps.map((step, index) => {
            const config = getStatusConfig(step.status);
            const StatusIcon = config.icon;

            return (
              <div key={index} className="flex flex-col items-center gap-1 w-full">
                <div className={cn(
                  "w-full max-w-md mx-auto rounded-lg p-4 transition-all",
                  config.bg,
                  step.status === "in_progress" && "animate-pulse-subtle"
                )}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "rounded-full h-7 w-7 flex items-center justify-center text-xs font-bold",
                        step.status === "completed" ? "bg-green-100 text-green-700"
                          : step.status === "in_progress" ? "bg-yellow-100 text-yellow-700"
                          : "bg-primary/10 text-primary"
                      )}>
                        {step.status === "completed" ? <CheckCircle className="h-4 w-4" /> : step.step_order}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{step.step_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{step.step_code}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {showStatus && (
                        <Badge className={cn("text-xs", config.badge)}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {step.actual_duration_minutes
                          ? `${formatDuration(step.actual_duration_minutes)} / ${formatDuration(step.duration_minutes)}`
                          : formatDuration(step.duration_minutes)}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-2">
                    {step.machines.length > 0 && step.machines.map((m, mi) => (
                      <Badge key={mi} variant="secondary" className="text-xs">
                        <Wrench className="h-3 w-3 mr-1" />{m}
                      </Badge>
                    ))}
                    <Badge variant="secondary" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      {step.labor_required} opérateur(s)
                    </Badge>
                  </div>

                  {/* Materials consumed at this step */}
                  {step.materials && step.materials.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-dashed">
                      <p className="text-xs text-muted-foreground mb-1 font-medium">Matières consommées :</p>
                      <div className="flex flex-wrap gap-1">
                        {step.materials.map((m, mi) => (
                          <Badge key={mi} variant="outline" className="text-xs">
                            <Package className="h-3 w-3 mr-1" />
                            {m.quantity} {m.uom} {m.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {index < steps.length - 1 && (
                  <ArrowDown className={cn(
                    "h-5 w-5",
                    step.status === "completed" ? "text-green-500" : "text-muted-foreground"
                  )} />
                )}
              </div>
            );
          })}

          <ArrowDown className={cn(
            "h-5 w-5",
            completedCount === steps.length && showStatus ? "text-green-500" : "text-muted-foreground"
          )} />
          {/* End node */}
          <div className="flex items-center justify-center w-full max-w-md mx-auto">
            <div className={cn(
              "rounded-full px-6 py-2 text-sm font-medium shadow-sm",
              completedCount === steps.length && showStatus
                ? "bg-green-600 text-white"
                : "bg-muted text-muted-foreground"
            )}>
              {completedCount === steps.length && showStatus ? "Production terminée ✓" : "Produit fini"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
