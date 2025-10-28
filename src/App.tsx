import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { AppLayout } from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import CRM from "./pages/CRM";
import Invoicing from "./pages/Invoicing";
import Stock from "./pages/Stock";
import Accounting from "./pages/Accounting";
import Settings from "./pages/Settings";
import AccountActivation from "./pages/AccountActivation";
import ManageActivationKeys from "./pages/ManageActivationKeys";
import UserManagement from "./pages/UserManagement";
import Proforma from "./pages/Proforma";
import Procurement from "./pages/Procurement";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Chargement...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="*" element={<Auth />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppLayout><Dashboard /></AppLayout>} />
            <Route path="/crm" element={<AppLayout><CRM /></AppLayout>} />
            <Route path="/invoicing" element={<AppLayout><Invoicing /></AppLayout>} />
            <Route path="/stock" element={<AppLayout><Stock /></AppLayout>} />
            <Route path="/accounting" element={<AppLayout><Accounting /></AppLayout>} />
            <Route path="/proforma" element={<AppLayout><Proforma /></AppLayout>} />
            <Route path="/procurement" element={<AppLayout><Procurement /></AppLayout>} />
            <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
            <Route path="/activation" element={<AppLayout><AccountActivation /></AppLayout>} />
            <Route path="/manage-keys" element={<AppLayout><ManageActivationKeys /></AppLayout>} />
            <Route path="/users" element={<AppLayout><UserManagement /></AppLayout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
