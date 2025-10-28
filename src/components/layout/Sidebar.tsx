import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  FileText,
  Package,
  Calculator,
  Settings,
  Building2,
  ClipboardList,
  ShoppingCart,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, shortcut: "⌘D" },
  { name: "CRM", href: "/crm", icon: Users, shortcut: "⌘C" },
  { name: "Pro Forma", href: "/proforma", icon: ClipboardList, shortcut: "⌘P" },
  { name: "Approvisionnements", href: "/procurement", icon: ShoppingCart, shortcut: "⌘A" },
  { name: "Facturation", href: "/invoicing", icon: FileText, shortcut: "⌘F" },
  { name: "Stock", href: "/stock", icon: Package, shortcut: "⌘S" },
  { name: "Comptabilité", href: "/accounting", icon: Calculator, shortcut: "⌘K" },
  { name: "Paramètres", href: "/settings", icon: Settings, shortcut: "⌘," },
];

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 'd':
            e.preventDefault();
            navigate('/');
            break;
          case 'c':
            e.preventDefault();
            navigate('/crm');
            break;
          case 'p':
            e.preventDefault();
            navigate('/proforma');
            break;
          case 'a':
            e.preventDefault();
            navigate('/procurement');
            break;
          case 'f':
            e.preventDefault();
            navigate('/invoicing');
            break;
          case 's':
            e.preventDefault();
            navigate('/stock');
            break;
          case 'k':
            e.preventDefault();
            navigate('/accounting');
            break;
          case ',':
            e.preventDefault();
            navigate('/settings');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [navigate]);

  return (
    <div className="flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <div className="flex items-center gap-2">
          <Building2 className="h-8 w-8 text-sidebar-primary" />
          <div>
            <h1 className="text-lg font-bold text-sidebar-foreground">ERP Pro</h1>
            <p className="text-xs text-sidebar-foreground/60">Gestion Intégrée</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          
          return (
            <Tooltip key={item.name} delayDuration={300}>
              <TooltipTrigger asChild>
                <Link
                  to={item.href}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </div>
                  <span className="text-xs text-sidebar-foreground/40">{item.shortcut}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Raccourci: {item.shortcut}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-4">
        <div className="text-xs text-sidebar-foreground/60">
          © 2025 ERP Pro v1.0
        </div>
      </div>
    </div>
  );
};
