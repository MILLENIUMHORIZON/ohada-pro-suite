import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, DollarSign, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";

const applications = [
  {
    id: "loyambo_resto_hotel",
    name: "Loyambo Resto-Hotel",
    description: "Gestion de restaurants et hôtels",
    icon: Building2,
    color: "bg-blue-500",
  },
  {
    id: "millenium_payroll",
    name: "Millenium Payroll",
    description: "Gestion de la paie et ressources humaines",
    icon: DollarSign,
    color: "bg-green-500",
  },
  {
    id: "other",
    name: "Autres Applications",
    description: "Autres intégrations tierces",
    icon: Package,
    color: "bg-purple-500",
  },
];

export default function ApplicationManagement() {
  const navigate = useNavigate();

  const handleApplicationClick = (appId: string) => {
    navigate(`/application-liaisons/${appId}`);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Gestion d'Applications</h1>
        <p className="text-muted-foreground mt-1">
          Liez votre ERP à d'autres applications
        </p>
      </div>

      {/* Applications Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {applications.map((app) => {
          const Icon = app.icon;
          return (
            <Card
              key={app.id}
              className="cursor-pointer transition-all hover:shadow-lg hover:scale-105"
              onClick={() => handleApplicationClick(app.id)}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg ${app.color} p-3`}>
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{app.name}</CardTitle>
                    <CardDescription>{app.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Badge variant="outline">Cliquez pour voir les demandes</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
