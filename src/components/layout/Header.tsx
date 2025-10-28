import { Bell, Search, User, Plus, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export const Header = () => {
  const shortcuts = [
    { key: "⌘D", action: "Dashboard", path: "/" },
    { key: "⌘C", action: "CRM", path: "/crm" },
    { key: "⌘P", action: "Pro Forma", path: "/proforma" },
    { key: "⌘A", action: "Approvisionnements", path: "/procurement" },
    { key: "⌘F", action: "Facturation", path: "/invoicing" },
    { key: "⌘S", action: "Stock", path: "/stock" },
    { key: "⌘K", action: "Comptabilité", path: "/accounting" },
    { key: "⌘,", action: "Paramètres", path: "/settings" },
  ];

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-6">
      {/* Search */}
      <div className="flex w-96 items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher... (⌘K pour raccourcis)"
          className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Quick Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Actions Rapides</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/crm" className="cursor-pointer">
                Client / Opportunité
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/proforma" className="cursor-pointer">
                Pro Forma
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/invoicing" className="cursor-pointer">
                Facture
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/stock" className="cursor-pointer">
                Produit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/accounting" className="cursor-pointer">
                Écriture Comptable
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/procurement" className="cursor-pointer">
                Demande d'Approvisionnement
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Keyboard Shortcuts Dialog */}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon">
              <Keyboard className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Raccourcis Clavier</DialogTitle>
              <DialogDescription>
                Utilisez ces raccourcis pour naviguer rapidement
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {shortcuts.map((shortcut) => (
                <div key={shortcut.key} className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm">{shortcut.action}</span>
                  <Badge variant="secondary" className="font-mono">
                    {shortcut.key}
                  </Badge>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5" />
        </Button>
        
        <Button variant="ghost" size="icon">
          <User className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
};
