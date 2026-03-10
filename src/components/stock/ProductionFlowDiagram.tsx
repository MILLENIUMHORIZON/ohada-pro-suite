import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, Clock, Wrench, Users, Package } from "lucide-react";

interface FlowStep {
  step_order: number;
  step_name: string;
  step_code: string;
  duration_minutes: number;
  machines: string[];
  labor_required: number;
}

interface ProductionFlowDiagramProps {
  productName: string;
  steps: FlowStep[];
  totalDuration: number;
  quantity?: number;
}

export function ProductionFlowDiagram({ productName, steps, totalDuration, quantity = 1 }: ProductionFlowDiagramProps) {
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

  const formatDuration = (min: number) => {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Schéma de Production — {productName}</span>
          <Badge variant="secondary" className="text-sm">
            <Clock className="h-3 w-3 mr-1" />
            Durée totale : {formatDuration(totalDuration)}
          </Badge>
        </CardTitle>
        {quantity > 1 && (
          <p className="text-sm text-muted-foreground">Pour {quantity} unité(s)</p>
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

          {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center gap-1 w-full">
              {/* Step card */}
              <div className="w-full max-w-md mx-auto border rounded-lg p-4 bg-card shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="bg-primary/10 text-primary rounded-full h-7 w-7 flex items-center justify-center text-xs font-bold">
                      {step.step_order}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{step.step_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{step.step_code}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {formatDuration(step.duration_minutes)}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2 mt-2">
                  {step.machines.length > 0 && step.machines.map((m, mi) => (
                    <Badge key={mi} variant="secondary" className="text-xs">
                      <Wrench className="h-3 w-3 mr-1" />
                      {m}
                    </Badge>
                  ))}
                  <Badge variant="secondary" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {step.labor_required} opérateur(s)
                  </Badge>
                </div>
              </div>

              {index < steps.length - 1 && (
                <ArrowDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          ))}

          <ArrowDown className="h-5 w-5 text-muted-foreground" />
          {/* End node */}
          <div className="flex items-center justify-center w-full max-w-md mx-auto">
            <div className="bg-green-600 text-white rounded-full px-6 py-2 text-sm font-medium shadow-sm">
              Produit fini ✓
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
