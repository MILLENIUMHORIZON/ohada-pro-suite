import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowUpDown, Search, MapPin, BarChart3 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProductForm } from "@/components/forms/ProductForm";
import { StockDashboard } from "@/components/stock/StockDashboard";
import { StockMovementForm } from "@/components/stock/StockMovementForm";
import { StockMovesHistory } from "@/components/stock/StockMovesHistory";
import { StockByProduct } from "@/components/stock/StockByProduct";
import { LocationManager } from "@/components/stock/LocationManager";

type TabType = "dashboard" | "stock" | "movements" | "history" | "locations";

export default function Stock() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey(k => k + 1);

  const tabs: { key: TabType; label: string; icon: React.ElementType }[] = [
    { key: "dashboard", label: "Tableau de bord", icon: BarChart3 },
    { key: "stock", label: "État du Stock", icon: Search },
    { key: "history", label: "Mouvements", icon: ArrowUpDown },
    { key: "locations", label: "Emplacements", icon: MapPin },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Stock</h1>
          <p className="text-muted-foreground mt-1">Gestion des articles, inventaire et mouvements</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsMovementDialogOpen(true)}>
            <ArrowUpDown className="mr-2 h-4 w-4" />
            Mouvement
          </Button>
          <Button onClick={() => setIsProductDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvel Article
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex gap-1 p-1 bg-muted rounded-lg">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon className="mr-2 h-4 w-4" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === "dashboard" && <StockDashboard key={refreshKey} />}

      {activeTab === "stock" && (
        <Card>
          <CardHeader>
            <CardTitle>État du Stock par Article</CardTitle>
          </CardHeader>
          <CardContent>
            <StockByProduct refreshKey={refreshKey} />
          </CardContent>
        </Card>
      )}

      {activeTab === "history" && (
        <Card>
          <CardHeader>
            <CardTitle>Historique des Mouvements</CardTitle>
          </CardHeader>
          <CardContent>
            <StockMovesHistory refreshKey={refreshKey} />
          </CardContent>
        </Card>
      )}

      {activeTab === "locations" && (
        <Card>
          <CardHeader>
            <CardTitle>Gestion des Emplacements</CardTitle>
          </CardHeader>
          <CardContent>
            <LocationManager />
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvel Article</DialogTitle>
          </DialogHeader>
          <ProductForm onSuccess={() => { setIsProductDialogOpen(false); refresh(); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={isMovementDialogOpen} onOpenChange={setIsMovementDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouveau Mouvement de Stock</DialogTitle>
          </DialogHeader>
          <StockMovementForm onSuccess={() => { setIsMovementDialogOpen(false); refresh(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
