import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Clock, Wrench, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
    machine: "",
    labor_required: 1,
    machine_hourly_cost: 0,
    labor_hourly_cost: 0,
  });

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
      setSteps((data as any[]) || []);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditingStep(null);
    setForm({ code: "", name: "", description: "", duration_minutes: 0, machine: "", labor_required: 1, machine_hourly_cost: 0, labor_hourly_cost: 0 });
    setDialogOpen(true);
  };

  const openEdit = (step: ProductionStep) => {
    setEditingStep(step);
    setForm({
      code: step.code,
      name: step.name,
      description: step.description || "",
      duration_minutes: step.duration_minutes,
      machine: step.machine || "",
      labor_required: step.labor_required,
      machine_hourly_cost: step.machine_hourly_cost,
      labor_hourly_cost: step.labor_hourly_cost,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
      if (!profile?.company_id) return;

      const payload = { ...form, company_id: profile.company_id };

      if (editingStep) {
        const { error } = await (supabase.from("production_steps" as any) as any).update(payload).eq("id", editingStep.id);
        if (error) throw error;
        toast({ title: "Étape modifiée" });
      } else {
        const { error } = await (supabase.from("production_steps" as any) as any).insert(payload);
        if (error) throw error;
        toast({ title: "Étape créée" });
      }

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
            <CardDescription>Définissez les étapes du processus de fabrication</CardDescription>
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
                <TableHead>Machine</TableHead>
                <TableHead>Main d'œuvre</TableHead>
                <TableHead>Coût/h Machine</TableHead>
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
                    {step.machine ? (
                      <span className="inline-flex items-center gap-1">
                        <Wrench className="h-3 w-3 text-muted-foreground" />
                        {step.machine}
                      </span>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      {step.labor_required}
                    </span>
                  </TableCell>
                  <TableCell>{step.machine_hourly_cost.toLocaleString()}</TableCell>
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
        <DialogContent className="max-w-lg">
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Durée standard (min)</Label>
                <Input type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Machine utilisée</Label>
                <Input value={form.machine} onChange={e => setForm({ ...form, machine: e.target.value })} placeholder="Optionnel" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Main d'œuvre requise</Label>
                <Input type="number" value={form.labor_required} onChange={e => setForm({ ...form, labor_required: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Coût/h Machine</Label>
                <Input type="number" value={form.machine_hourly_cost} onChange={e => setForm({ ...form, machine_hourly_cost: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Coût/h MO</Label>
                <Input type="number" value={form.labor_hourly_cost} onChange={e => setForm({ ...form, labor_hourly_cost: Number(e.target.value) })} />
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
