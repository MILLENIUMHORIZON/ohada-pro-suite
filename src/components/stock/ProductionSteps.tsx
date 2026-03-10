import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Clock, Wrench, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface StepMachine {
  id?: string;
  machine_name: string;
  hourly_cost: number;
}

interface ProductionStep {
  id: string;
  code: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  machine: string | null;
  labor_required: number;
  machine_hourly_cost: number;
  labor_hourly_cost: number;
  machines?: StepMachine[];
}

export function ProductionSteps() {
  const [steps, setSteps] = useState<ProductionStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<ProductionStep | null>(null);
  const { toast } = useToast();

  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    duration_minutes: 0,
    labor_required: 1,
    labor_hourly_cost: 0,
  });

  const [machines, setMachines] = useState<StepMachine[]>([]);
  const [newMachine, setNewMachine] = useState({ machine_name: "", hourly_cost: 0 });

  useEffect(() => {
    loadSteps();
  }, []);

  const loadSteps = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
      if (!profile?.company_id) return;

      const { data, error } = await supabase
        .from("production_steps" as any)
        .select("*")
        .eq("company_id", profile.company_id)
        .order("code");

      if (error) throw error;

      const stepsData = (data as any[]) || [];
      
      // Load machines for all steps
      if (stepsData.length > 0) {
        const stepIds = stepsData.map(s => s.id);
        const { data: machinesData } = await (supabase.from("step_machines" as any) as any)
          .select("*")
          .in("step_id", stepIds);

        const machinesByStep: Record<string, StepMachine[]> = {};
        (machinesData || []).forEach((m: any) => {
          if (!machinesByStep[m.step_id]) machinesByStep[m.step_id] = [];
          machinesByStep[m.step_id].push(m);
        });

        stepsData.forEach(s => {
          s.machines = machinesByStep[s.id] || [];
        });
      }

      setSteps(stepsData);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditingStep(null);
    setForm({ code: "", name: "", description: "", duration_minutes: 0, labor_required: 1, labor_hourly_cost: 0 });
    setMachines([]);
    setNewMachine({ machine_name: "", hourly_cost: 0 });
    setDialogOpen(true);
  };

  const openEdit = (step: ProductionStep) => {
    setEditingStep(step);
    setForm({
      code: step.code,
      name: step.name,
      description: step.description || "",
      duration_minutes: step.duration_minutes,
      labor_required: step.labor_required,
      labor_hourly_cost: step.labor_hourly_cost,
    });
    setMachines(step.machines || []);
    setNewMachine({ machine_name: "", hourly_cost: 0 });
    setDialogOpen(true);
  };

  const addMachineToList = () => {
    if (!newMachine.machine_name.trim()) return;
    setMachines(prev => [...prev, { ...newMachine }]);
    setNewMachine({ machine_name: "", hourly_cost: 0 });
  };

  const removeMachineFromList = (index: number) => {
    setMachines(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
      if (!profile?.company_id) return;

      const totalMachineCost = machines.reduce((sum, m) => sum + m.hourly_cost, 0);
      const machineNames = machines.map(m => m.machine_name).join(", ");

      const payload = {
        ...form,
        company_id: profile.company_id,
        machine: machineNames || null,
        machine_hourly_cost: totalMachineCost,
      };

      let stepId: string;

      if (editingStep) {
        const { error } = await (supabase.from("production_steps" as any) as any).update(payload).eq("id", editingStep.id);
        if (error) throw error;
        stepId = editingStep.id;
        // Delete old machines
        await (supabase.from("step_machines" as any) as any).delete().eq("step_id", stepId);
      } else {
        const { data, error } = await (supabase.from("production_steps" as any) as any).insert(payload).select("id").single();
        if (error) throw error;
        stepId = (data as any).id;
      }

      // Insert machines
      if (machines.length > 0) {
        await (supabase.from("step_machines" as any) as any).insert(
          machines.map(m => ({ step_id: stepId, machine_name: m.machine_name, hourly_cost: m.hourly_cost }))
        );
      }

      toast({ title: editingStep ? "Étape modifiée" : "Étape créée" });
      setDialogOpen(false);
      loadSteps();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette étape ?")) return;
    const { error } = await (supabase.from("production_steps" as any) as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Étape supprimée" });
      loadSteps();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Étapes de Production</CardTitle>
            <CardDescription>Définissez les étapes du processus de fabrication avec les machines associées</CardDescription>
          </div>
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle Étape
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-center py-8">Chargement...</p>
        ) : steps.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Aucune étape configurée. Créez votre première étape de production.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Durée (min)</TableHead>
                <TableHead>Machines</TableHead>
                <TableHead>Main d'œuvre</TableHead>
                <TableHead>Coût/h MO</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {steps.map((step) => (
                <TableRow key={step.id}>
                  <TableCell className="font-mono">{step.code}</TableCell>
                  <TableCell className="font-medium">{step.name}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {step.duration_minutes}
                    </span>
                  </TableCell>
                  <TableCell>
                    {(step.machines && step.machines.length > 0) ? (
                      <div className="flex flex-wrap gap-1">
                        {step.machines.map((m, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            <Wrench className="h-3 w-3 mr-1" />
                            {m.machine_name} ({m.hourly_cost}/h)
                          </Badge>
                        ))}
                      </div>
                    ) : step.machine ? (
                      <Badge variant="outline" className="text-xs">
                        <Wrench className="h-3 w-3 mr-1" />
                        {step.machine}
                      </Badge>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      {step.labor_required}
                    </span>
                  </TableCell>
                  <TableCell>{step.labor_hourly_cost.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(step)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(step.id)}>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStep ? "Modifier l'étape" : "Nouvelle Étape de Production"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Code</Label>
                <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="EX: DEC" />
              </div>
              <div>
                <Label>Nom</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Découpe" />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Durée standard (min)</Label>
                <Input type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Main d'œuvre requise</Label>
                <Input type="number" value={form.labor_required} onChange={e => setForm({ ...form, labor_required: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Coût/h MO</Label>
                <Input type="number" value={form.labor_hourly_cost} onChange={e => setForm({ ...form, labor_hourly_cost: Number(e.target.value) })} />
              </div>
            </div>

            {/* Machines section */}
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Machines utilisées
              </h4>
              
              {machines.length > 0 && (
                <div className="space-y-2">
                  {machines.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 bg-background rounded-md p-2 border">
                      <span className="flex-1 text-sm font-medium">{m.machine_name}</span>
                      <span className="text-sm text-muted-foreground">{m.hourly_cost}/h</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeMachineFromList(i)}>
                        <X className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs">Nom de la machine</Label>
                  <Input
                    value={newMachine.machine_name}
                    onChange={e => setNewMachine(p => ({ ...p, machine_name: e.target.value }))}
                    placeholder="Ex: Presse hydraulique"
                    className="h-9"
                  />
                </div>
                <div className="w-28">
                  <Label className="text-xs">Coût/h</Label>
                  <Input
                    type="number"
                    value={newMachine.hourly_cost}
                    onChange={e => setNewMachine(p => ({ ...p, hourly_cost: Number(e.target.value) }))}
                    className="h-9"
                  />
                </div>
                <Button size="sm" variant="outline" onClick={addMachineToList} disabled={!newMachine.machine_name.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Button onClick={handleSave} className="w-full">
              {editingStep ? "Enregistrer" : "Créer l'étape"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
