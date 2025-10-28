import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Users, Cog, Database, Key, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

const settingsSections = [
  {
    title: "Entreprise",
    description: "Informations de votre société",
    icon: Building2,
    path: null,
  },
  {
    title: "Utilisateurs & Rôles",
    description: "Gestion des accès et permissions",
    icon: Users,
    path: "/users",
  },
  {
    title: "Activation du Compte",
    description: "Activer votre compte avec une clé",
    icon: Key,
    path: "/activation",
  },
  {
    title: "Gestion des Clés",
    description: "Créer et gérer les clés d'activation (Admin)",
    icon: Shield,
    path: "/manage-keys",
  },
  {
    title: "Configuration",
    description: "Paramètres généraux de l'ERP",
    icon: Cog,
    path: null,
  },
  {
    title: "Données de Référence",
    description: "Plan comptable, taxes, journaux",
    icon: Database,
    path: null,
  },
];

export default function Settings() {
  const navigate = useNavigate();

  const handleCardClick = (path: string | null) => {
    if (path) {
      navigate(path);
    }
  };

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
            <Card 
              key={section.title} 
              className="cursor-pointer transition-colors hover:bg-accent/50"
              onClick={() => handleCardClick(section.path)}
            >
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
