import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ArrowUp, ArrowDown, Loader2, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type WorkflowStep = {
  id: string;
  step_name: string;
  step_order: number;
  responsible_role: string;
  allowed_actions: string[];
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

const actionLabels: Record<string, string> = {
  submit: "Soumettre",
  approve: "Approuver",
  reject: "Rejeter",
  complete_accounting: "Comptabiliser",
  pay: "Payer",
  review: "Réviser",
};

interface WorkflowConfigurationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkflowConfiguration({ open, onOpenChange }: WorkflowConfigurationProps) {
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newStep, setNewStep] = useState({
    step_name: "",
    responsible_role: "",
    allowed_actions: [] as string[],
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadSteps();
    }
  }, [open]);

  const loadSteps = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) return;

      // Create default steps if none exist
      await supabase.rpc('create_default_workflow_steps', { p_company_id: profile.company_id });

      const { data, error } = await supabase
        .from('workflow_steps')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('step_order');

      if (error) throw error;
      setSteps(data || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de charger la configuration du workflow",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddStep = async () => {
    if (!newStep.step_name || !newStep.responsible_role) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs requis",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) return;

      const newOrder = steps.length > 0 ? Math.max(...steps.map(s => s.step_order)) + 1 : 1;

      const { error } = await supabase.from('workflow_steps').insert({
        company_id: profile.company_id,
        step_name: newStep.step_name,
        step_order: newOrder,
        responsible_role: newStep.responsible_role,
        allowed_actions: newStep.allowed_actions.length > 0 ? newStep.allowed_actions : ['approve', 'reject'],
      });

      if (error) throw error;

      setNewStep({ step_name: "", responsible_role: "", allowed_actions: [] });
      loadSteps();
      
      toast({
        title: "Succès",
        description: "Étape ajoutée avec succès",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('workflow_steps')
        .delete()
        .eq('id', stepId);

      if (error) throw error;
      loadSteps();
      
      toast({
        title: "Succès",
        description: "Étape supprimée",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (stepId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('workflow_steps')
        .update({ is_active: isActive })
        .eq('id', stepId);

      if (error) throw error;
      loadSteps();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleMoveStep = async (stepId: string, direction: 'up' | 'down') => {
    const stepIndex = steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) return;
    
    const swapIndex = direction === 'up' ? stepIndex - 1 : stepIndex + 1;
    if (swapIndex < 0 || swapIndex >= steps.length) return;

    const currentStep = steps[stepIndex];
    const swapStep = steps[swapIndex];

    try {
      await supabase
        .from('workflow_steps')
        .update({ step_order: swapStep.step_order })
        .eq('id', currentStep.id);

      await supabase
        .from('workflow_steps')
        .update({ step_order: currentStep.step_order })
        .eq('id', swapStep.id);

      loadSteps();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuration du Workflow</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Steps */}
            <Card>
              <CardHeader>
                <CardTitle>Étapes du Workflow</CardTitle>
              </CardHeader>
              <CardContent>
                {steps.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Aucune étape configurée
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Ordre</TableHead>
                        <TableHead>Nom de l'étape</TableHead>
                        <TableHead>Rôle responsable</TableHead>
                        <TableHead>Actions autorisées</TableHead>
                        <TableHead className="w-20">Actif</TableHead>
                        <TableHead className="w-32">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {steps.map((step, index) => (
                        <TableRow key={step.id}>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                              {step.step_order}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{step.step_name}</TableCell>
                          <TableCell>{roleLabels[step.responsible_role] || step.responsible_role}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {step.allowed_actions.map(action => (
                                <Badge key={action} variant="secondary">
                                  {actionLabels[action] || action}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={step.is_active}
                              onCheckedChange={(checked) => handleToggleActive(step.id, checked)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleMoveStep(step.id, 'up')}
                                disabled={index === 0}
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleMoveStep(step.id, 'down')}
                                disabled={index === steps.length - 1}
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteStep(step.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Add New Step */}
            <Card>
              <CardHeader>
                <CardTitle>Ajouter une Étape</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nom de l'étape *</Label>
                    <Input
                      value={newStep.step_name}
                      onChange={(e) => setNewStep(prev => ({ ...prev, step_name: e.target.value }))}
                      placeholder="Ex: Validation Directeur"
                    />
                  </div>
                  <div>
                    <Label>Rôle responsable *</Label>
                    <Select
                      value={newStep.responsible_role}
                      onValueChange={(value) => setNewStep(prev => ({ ...prev, responsible_role: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un rôle" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(roleLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Actions autorisées</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.entries(actionLabels).map(([value, label]) => (
                      <Badge
                        key={value}
                        variant={newStep.allowed_actions.includes(value) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          setNewStep(prev => ({
                            ...prev,
                            allowed_actions: prev.allowed_actions.includes(value)
                              ? prev.allowed_actions.filter(a => a !== value)
                              : [...prev.allowed_actions, value]
                          }));
                        }}
                      >
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Button onClick={handleAddStep} disabled={saving} className="w-full">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter l'étape
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
