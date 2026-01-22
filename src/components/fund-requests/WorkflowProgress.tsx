import { CheckCircle, Circle, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type WorkflowStep = {
  id: string;
  step_name: string;
  step_order: number;
  responsible_role: string;
  is_active: boolean;
};

const roleLabels: Record<string, string> = {
  requester: "Demandeur",
  accountant: "Comptable",
  manager: "Gérant / Validateur",
  cashier: "Caissier",
  admin: "Administrateur",
  director: "Directeur Financier",
  auditor: "Auditeur",
};

// Map status to step order
const statusToStepOrder: Record<string, number> = {
  draft: 0,
  submitted: 1,
  accounting_review: 2,
  validated: 3,
  paid: 4,
  rejected: -1,
};

interface WorkflowProgressProps {
  steps: WorkflowStep[];
  currentStatus: string;
  className?: string;
}

export function WorkflowProgress({ steps, currentStatus, className }: WorkflowProgressProps) {
  const isRejected = currentStatus === 'rejected';
  const currentStepOrder = statusToStepOrder[currentStatus] ?? 0;

  // Filter active steps and sort by order
  const activeSteps = steps
    .filter(s => s.is_active)
    .sort((a, b) => a.step_order - b.step_order);

  const getStepStatus = (stepOrder: number): 'completed' | 'current' | 'pending' | 'rejected' => {
    if (isRejected) return 'rejected';
    if (stepOrder < currentStepOrder) return 'completed';
    if (stepOrder === currentStepOrder) return 'current';
    return 'pending';
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between relative">
        {/* Progress Line */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-muted" />
        <div 
          className={cn(
            "absolute top-4 left-0 h-0.5 transition-all duration-300",
            isRejected ? "bg-destructive" : "bg-primary"
          )}
          style={{ 
            width: isRejected 
              ? `${Math.min((currentStepOrder / activeSteps.length) * 100, 100)}%`
              : `${Math.min(((currentStepOrder) / activeSteps.length) * 100, 100)}%` 
          }}
        />

        {/* Steps */}
        {activeSteps.map((step, index) => {
          const status = getStepStatus(step.step_order);
          
          return (
            <div 
              key={step.id} 
              className="flex flex-col items-center relative z-10"
              style={{ flex: 1 }}
            >
              {/* Icon */}
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all",
                  status === 'completed' && "bg-primary border-primary text-primary-foreground",
                  status === 'current' && "bg-background border-primary text-primary",
                  status === 'pending' && "bg-background border-muted text-muted-foreground",
                  status === 'rejected' && step.step_order <= currentStepOrder && "bg-destructive border-destructive text-destructive-foreground"
                )}
              >
                {status === 'completed' && <CheckCircle className="h-4 w-4" />}
                {status === 'current' && <Clock className="h-4 w-4 animate-pulse" />}
                {status === 'pending' && <Circle className="h-4 w-4" />}
                {status === 'rejected' && step.step_order <= currentStepOrder && <XCircle className="h-4 w-4" />}
              </div>

              {/* Label */}
              <div className="mt-2 text-center">
                <p className={cn(
                  "text-xs font-medium",
                  status === 'completed' && "text-primary",
                  status === 'current' && "text-primary font-semibold",
                  status === 'pending' && "text-muted-foreground",
                  status === 'rejected' && "text-destructive"
                )}>
                  {step.step_name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {roleLabels[step.responsible_role] || step.responsible_role}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
