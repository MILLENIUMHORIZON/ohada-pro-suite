import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Users, Cog, Database } from "lucide-react";

const settingsSections = [
  {
    title: "Entreprise",
    description: "Informations de votre société",
    icon: Building2,
  },
  {
    title: "Utilisateurs & Rôles",
    description: "Gestion des accès et permissions",
    icon: Users,
  },
  {
    title: "Configuration",
    description: "Paramètres généraux de l'ERP",
    icon: Cog,
  },
  {
    title: "Données de Référence",
    description: "Plan comptable, taxes, journaux",
    icon: Database,
  },
];

export default function Settings() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Paramètres</h1>
        <p className="text-muted-foreground mt-1">Configuration de votre ERP</p>
      </div>

      {/* Settings Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title} className="cursor-pointer transition-colors hover:bg-accent/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{section.title}</CardTitle>
                    <CardDescription>{section.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
