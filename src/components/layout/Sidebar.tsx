import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
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
  Wallet,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";

const allNavigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, shortcut: "⌘D", module: "dashboard" },
  { name: "CRM", href: "/crm", icon: Users, shortcut: "⌘C", module: "crm" },
  { name: "Pro Forma", href: "/proforma", icon: ClipboardList, shortcut: "⌘P", module: "proforma" },
  { name: "Approvisionnements", href: "/procurement", icon: ShoppingCart, shortcut: "⌘A", module: "procurement" },
  { name: "Facturation", href: "/invoicing", icon: FileText, shortcut: "⌘F", module: "invoicing" },
  { name: "Demandes de Fonds", href: "/fund-requests", icon: Wallet, shortcut: "⌘R", module: "fund_requests" },
  { name: "Stock", href: "/stock", icon: Package, shortcut: "⌘S", module: "stock" },
  { name: "Comptabilité", href: "/accounting", icon: Calculator, shortcut: "⌘K", module: "accounting" },
  { name: "Paramètres", href: "/settings", icon: Settings, shortcut: "⌘,", module: "settings" },
];

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [navigation, setNavigation] = useState(allNavigation);
  const [isLoading, setIsLoading] = useState(true);

  // Load user permissions
  useEffect(() => {
    loadUserPermissions();
  }, []);

  const loadUserPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Check if user is admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      // If admin, show all modules
      if (roleData) {
        setNavigation(allNavigation);
        setIsLoading(false);
        return;
      }

      // Load user's module permissions
      const { data: permissions } = await supabase
        .from("user_module_permissions")
        .select("module")
        .eq("user_id", user.id);

      const allowedModules = new Set(permissions?.map(p => p.module) || []);
      
      // Always include settings for all users
      allowedModules.add("settings");

      // Filter navigation based on permissions
      const filteredNav = allNavigation.filter(nav => allowedModules.has(nav.module));
      setNavigation(filteredNav);
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading permissions:", error);
      // On error, show only settings
      setNavigation(allNavigation.filter(nav => nav.module === "settings"));
      setIsLoading(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        // Only allow shortcuts for visible navigation items
        const allowedPaths = new Set(navigation.map(n => n.href));
        
        let targetPath = '';
        switch (e.key.toLowerCase()) {
          case 'd':
            targetPath = '/';
            break;
          case 'c':
            targetPath = '/crm';
            break;
          case 'p':
            targetPath = '/proforma';
            break;
          case 'a':
            targetPath = '/procurement';
            break;
          case 'f':
            targetPath = '/invoicing';
            break;
          case 's':
            targetPath = '/stock';
            break;
          case 'k':
            targetPath = '/accounting';
            break;
          case ',':
            targetPath = '/settings';
            break;
        }

        if (targetPath && allowedPaths.has(targetPath)) {
          e.preventDefault();
          navigate(targetPath);
        }
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [navigate, navigation]);

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
        {isLoading ? (
          <div className="text-center text-sm text-muted-foreground py-4">
            Chargement...
          </div>
        ) : navigation.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-4">
            Aucun module disponible
          </div>
        ) : (
          navigation.map((item) => {
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
        })
        )}
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
