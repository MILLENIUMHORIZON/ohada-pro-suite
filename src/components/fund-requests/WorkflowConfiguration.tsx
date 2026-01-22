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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, ArrowUp, ArrowDown, Loader2, GripVertical, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

type WorkflowStep = {
  id: string;
  step_name: string;
  step_order: number;
  responsible_role: string;
  allowed_actions: string[];
  is_active: boolean;
};

type UserProfile = {
  user_id: string;
  full_name: string;
  email?: string;
};

type StepUserAssignment = {
  step_id: string;
  user_ids: string[];
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
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stepAssignments, setStepAssignments] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null);
  const [newStep, setNewStep] = useState({
    step_name: "",
    responsible_role: "",
    allowed_actions: [] as string[],
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
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

      // Load workflow steps
      const { data: stepsData, error: stepsError } = await supabase
        .from('workflow_steps')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('step_order');

      if (stepsError) throw stepsError;
      setSteps(stepsData || []);

      // Load company users
      const { data: usersData } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('company_id', profile.company_id);

      setUsers(usersData || []);

      // Load step assignments
      const { data: assignmentsData } = await supabase
        .from('workflow_step_users')
        .select('workflow_step_id, user_id')
        .eq('company_id', profile.company_id);

      const assignments: Record<string, string[]> = {};
      (assignmentsData || []).forEach(a => {
        if (!assignments[a.workflow_step_id]) {
          assignments[a.workflow_step_id] = [];
        }
        assignments[a.workflow_step_id].push(a.user_id);
      });
      setStepAssignments(assignments);

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
      loadData();
      
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
      loadData();
      
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
      loadData();
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

      loadData();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleUserAssignment = async (stepId: string, userId: string, assigned: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) return;

      if (assigned) {
        await supabase.from('workflow_step_users').insert({
          workflow_step_id: stepId,
          user_id: userId,
          company_id: profile.company_id,
        });
      } else {
        await supabase
          .from('workflow_step_users')
          .delete()
          .eq('workflow_step_id', stepId)
          .eq('user_id', userId);
      }

      // Update local state
      setStepAssignments(prev => {
        const current = prev[stepId] || [];
        if (assigned) {
          return { ...prev, [stepId]: [...current, userId] };
        } else {
          return { ...prev, [stepId]: current.filter(id => id !== userId) };
        }
      });

    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const isRequesterRole = (role: string) => role === 'requester';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
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
                        <TableHead>Utilisateurs assignés</TableHead>
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
                            {isRequesterRole(step.responsible_role) ? (
                              <Badge variant="outline" className="text-xs">
                                Tous les utilisateurs
                              </Badge>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedStep(step)}
                                className="flex items-center gap-2"
                              >
                                <Users className="h-3 w-3" />
                                {(stepAssignments[step.id] || []).length} utilisateur(s)
                              </Button>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {step.allowed_actions.map(action => (
                                <Badge key={action} variant="secondary" className="text-xs">
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

            {/* User Assignment Dialog */}
            {selectedStep && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">
                    Assigner des utilisateurs à : {selectedStep.step_name}
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedStep(null)}>
                    Fermer
                  </Button>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Sélectionnez les utilisateurs qui pourront effectuer les actions de cette étape ({roleLabels[selectedStep.responsible_role]})
                  </p>
                  <ScrollArea className="h-[200px] border rounded-md p-4">
                    <div className="space-y-2">
                      {users.length === 0 ? (
                        <p className="text-muted-foreground text-sm">Aucun utilisateur trouvé</p>
                      ) : (
                        users.map(user => (
                          <div key={user.user_id} className="flex items-center space-x-3">
                            <Checkbox
                              id={`user-${user.user_id}`}
                              checked={(stepAssignments[selectedStep.id] || []).includes(user.user_id)}
                              onCheckedChange={(checked) => 
                                handleToggleUserAssignment(selectedStep.id, user.user_id, !!checked)
                              }
                            />
                            <Label htmlFor={`user-${user.user_id}`} className="font-normal cursor-pointer">
                              {user.full_name}
                            </Label>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

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
