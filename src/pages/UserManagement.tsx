import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Shield, User, ChevronDown, ChevronUp, Search, UserPlus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ModulePermissions from "@/components/ModulePermissions";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type UserProfile = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  account_type: string;
  expires_at: string | null;
  email?: string;
  role?: string;
};

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    role: "user",
    account_type: "user"
  });

  useEffect(() => {
    checkAdminStatus();
    loadUsers();

    // Setup realtime listener for profile changes
    const channel = supabase
      .channel('profiles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          console.log('Profile changed:', payload);
          loadUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    setIsAdmin(!!data);
  };

  const loadUsers = async () => {
    try {
      // Get current user's company
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!currentProfile) return;

      // Get all profiles from the same company
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .eq("company_id", currentProfile.company_id)
        .order("full_name");

      if (profilesError) throw profilesError;

      // Get user roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Get emails from auth.users via admin query
      const userIds = profiles?.map(p => p.user_id) || [];
      const emailsMap = new Map<string, string>();
      
      // Fetch user emails (this requires admin privileges or a server function in production)
      for (const profile of profiles || []) {
        emailsMap.set(profile.user_id, profile.full_name); // Fallback to name if email not available
      }

      // Combine data
      const combinedData = profiles?.map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.user_id);
        return {
          ...profile,
          role: userRole?.role || "user",
          email: emailsMap.get(profile.user_id) || "",
        };
      }) || [];

      setUsers(combinedData);
    } catch (error: any) {
      console.error("Error loading users:", error);
      toast.error("Erreur lors du chargement des utilisateurs");
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      // Check if role exists
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingRole) {
        // Update existing role
        const { error } = await supabase
          .from("user_roles")
          .update({ role: newRole as any })
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from("user_roles")
          .insert([{ user_id: userId, role: newRole as any }]);

        if (error) throw error;
      }

      toast.success("Rôle mis à jour avec succès");
      loadUsers();
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast.error("Erreur lors de la mise à jour du rôle");
    }
  };

  const toggleUserExpanded = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  const createUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.full_name || !newUser.role) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    if (newUser.password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    setIsCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newUser),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la création');
      }

      toast.success("Utilisateur créé avec succès");
      
      // Wait a bit for trigger to complete and reload users
      await new Promise(resolve => setTimeout(resolve, 1000));
      await loadUsers();
      
      setIsCreateDialogOpen(false);
      setNewUser({
        email: "",
        password: "",
        full_name: "",
        phone: "",
        role: "user",
        account_type: "user"
      });
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Erreur lors de la création de l'utilisateur");
    } finally {
      setIsCreating(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Accès Restreint</h2>
            <p className="text-muted-foreground">
              Vous devez être administrateur pour accéder à cette page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Gestion des Utilisateurs</h1>
        <p className="text-muted-foreground mt-1">Gérer les utilisateurs et leurs rôles</p>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Utilisateurs</CardTitle>
              <CardDescription className="mt-1">
                {users.length} utilisateur{users.length > 1 ? 's' : ''} dans votre entreprise
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex w-64 items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un utilisateur..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-0 bg-muted/50"
                />
              </div>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Créer un utilisateur
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Chargement...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Type de Compte</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Expiration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users
                  .filter((user) =>
                    user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    user.phone?.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((user) => (
                  <Collapsible
                    key={user.id}
                    open={expandedUsers.has(user.user_id)}
                    asChild
                  >
                    <>
                      <TableRow>
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleUserExpanded(user.user_id)}
                            >
                              {expandedUsers.has(user.user_id) ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {user.full_name}
                          </div>
                        </TableCell>
                        <TableCell>{user.phone || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{user.account_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(value) => updateUserRole(user.user_id, value)}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue>
                                <Badge
                                  variant={
                                    user.role === "admin"
                                      ? "destructive"
                                      : user.role === "moderator"
                                      ? "default"
                                      : "secondary"
                                  }
                                >
                                  {user.role === "admin" && "Administrateur"}
                                  {user.role === "moderator" && "Modérateur"}
                                  {user.role === "user" && "Utilisateur"}
                                </Badge>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">Utilisateur</SelectItem>
                              <SelectItem value="moderator">Modérateur</SelectItem>
                              <SelectItem value="admin">Administrateur</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {user.expires_at ? (
                            <span className="text-sm text-muted-foreground">
                              {new Date(user.expires_at).toLocaleDateString('fr-FR')}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Illimité</span>
                          )}
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/50">
                            <div className="p-4">
                              <ModulePermissions userId={user.user_id} />
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Créer un utilisateur</DialogTitle>
            <DialogDescription>
              Ajoutez un nouvel utilisateur à votre entreprise
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="utilisateur@exemple.com"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Mot de passe *</Label>
              <Input
                id="password"
                type="password"
                placeholder="Au moins 6 caractères"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="full_name">Nom complet *</Label>
              <Input
                id="full_name"
                placeholder="Jean Dupont"
                value={newUser.full_name}
                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                placeholder="+243 XXX XXX XXX"
                value={newUser.phone}
                onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Rôle *</Label>
              <Select
                value={newUser.role}
                onValueChange={(value) => setNewUser({ ...newUser, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Utilisateur</SelectItem>
                  <SelectItem value="moderator">Modérateur</SelectItem>
                  <SelectItem value="admin">Administrateur</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="account_type">Type de compte</Label>
              <Select
                value={newUser.account_type}
                onValueChange={(value) => setNewUser({ ...newUser, account_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="demo">Demo (15 jours)</SelectItem>
                  <SelectItem value="user">Standard</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={isCreating}
            >
              Annuler
            </Button>
            <Button onClick={createUser} disabled={isCreating}>
              {isCreating ? "Création..." : "Créer l'utilisateur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPermissionsDialogOpen} onOpenChange={setIsPermissionsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Permissions des Modules</DialogTitle>
            <DialogDescription>
              Gérez les modules accessibles pour cet utilisateur
            </DialogDescription>
          </DialogHeader>
          {selectedUserId && <ModulePermissions userId={selectedUserId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
