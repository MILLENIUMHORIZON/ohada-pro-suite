import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Shield } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface User {
  id: string;
  user_id: string;
  full_name: string;
}

interface TreasuryAccount {
  id: string;
  code: string;
  name: string;
  currency: string | null;
}

interface UserAccess {
  user_id: string;
  account_id: string;
}

export function UserTreasuryAccess() {
  const [users, setUsers] = useState<User[]>([]);
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [userAccess, setUserAccess] = useState<UserAccess[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile?.company_id) return;
      setCompanyId(profile.company_id);

      const [usersRes, accountsRes, accessRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, user_id, full_name")
          .eq("company_id", profile.company_id)
          .order("full_name"),
        supabase
          .from("accounts")
          .select("id, code, name, currency")
          .eq("company_id", profile.company_id)
          .or("code.like.52%,code.like.57%,code.like.51%,code.like.53%")
          .order("code"),
        supabase
          .from("user_treasury_accounts")
          .select("user_id, account_id")
          .eq("company_id", profile.company_id),
      ]);

      if (usersRes.data) setUsers(usersRes.data);
      if (accountsRes.data) setAccounts(accountsRes.data);
      if (accessRes.data) setUserAccess(accessRes.data);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAccess = async (userId: string, accountId: string, hasAccess: boolean) => {
    if (!companyId) return;
    setSaving(true);

    try {
      if (hasAccess) {
        // Remove access
        const { error } = await supabase
          .from("user_treasury_accounts")
          .delete()
          .eq("user_id", userId)
          .eq("account_id", accountId);

        if (error) throw error;
        setUserAccess(userAccess.filter(a => !(a.user_id === userId && a.account_id === accountId)));
      } else {
        // Add access
        const { error } = await supabase
          .from("user_treasury_accounts")
          .insert({
            user_id: userId,
            account_id: accountId,
            company_id: companyId,
          });

        if (error) throw error;
        setUserAccess([...userAccess, { user_id: userId, account_id: accountId }]);
      }
      toast.success(hasAccess ? "Accès retiré" : "Accès accordé");
    } catch (error) {
      console.error("Error toggling access:", error);
      toast.error("Erreur lors de la modification de l'accès");
    } finally {
      setSaving(false);
    }
  };

  const hasAccess = (userId: string, accountId: string) => {
    return userAccess.some(a => a.user_id === userId && a.account_id === accountId);
  };

  const selectedUserData = users.find(u => u.user_id === selectedUser);
  const userAccountCount = selectedUser 
    ? userAccess.filter(a => a.user_id === selectedUser).length 
    : 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Autorisations Comptes de Trésorerie
        </CardTitle>
        <CardDescription>
          Définissez quels utilisateurs peuvent accéder à quels comptes de trésorerie.
          Un utilisateur ne peut utiliser que les comptes auxquels il est autorisé.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Select
            value={selectedUser || ""}
            onValueChange={setSelectedUser}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Sélectionner un utilisateur" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.user_id} value={user.user_id}>
                  {user.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {selectedUser && (
            <Badge variant="secondary">
              {userAccountCount} compte(s) autorisé(s)
            </Badge>
          )}
        </div>

        {selectedUser && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Accès</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Nom du compte</TableHead>
                <TableHead>Devise</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => {
                const access = hasAccess(selectedUser, account.id);
                return (
                  <TableRow key={account.id}>
                    <TableCell>
                      <Checkbox
                        checked={access}
                        onCheckedChange={() => handleToggleAccess(selectedUser, account.id, access)}
                        disabled={saving}
                      />
                    </TableCell>
                    <TableCell className="font-mono font-semibold">
                      {account.code}
                    </TableCell>
                    <TableCell>{account.name}</TableCell>
                    <TableCell>
                      {account.currency ? (
                        <Badge variant="outline">{account.currency}</Badge>
                      ) : (
                        <Badge variant="destructive">Non configuré</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {accounts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Aucun compte de trésorerie trouvé
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}

        {!selectedUser && (
          <div className="text-center py-8 text-muted-foreground">
            Sélectionnez un utilisateur pour gérer ses autorisations
          </div>
        )}
      </CardContent>
    </Card>
  );
}
