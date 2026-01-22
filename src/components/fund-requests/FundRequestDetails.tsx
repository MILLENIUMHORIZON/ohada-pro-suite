import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, FileText, Clock, Wallet, Printer, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generatePaymentReceipt } from "@/utils/paymentReceiptGenerator";

type FundRequest = {
  id: string;
  request_number: string;
  beneficiary: string;
  amount: number;
  currency: string;
  description: string;
  request_date: string;
  status: string;
  created_at: string;
  requester_id: string;
};

type FundRequestLine = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

type HistoryEntry = {
  id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  performed_by_name: string | null;
  notes: string | null;
  created_at: string;
};

type Account = {
  id: string;
  code: string;
  name: string;
};

type AccountingData = {
  expense_account_id: string | null;
  treasury_account_id: string | null;
  third_party_account_id: string | null;
  notes: string | null;
};

interface FundRequestDetailsProps {
  request: FundRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const statusLabels: Record<string, string> = {
  draft: "Brouillon",
  submitted: "Soumise",
  accounting_review: "Comptabilisée",
  validated: "Validée",
  rejected: "Rejetée",
  paid: "Payée",
};

export function FundRequestDetails({ request, open, onOpenChange, onUpdate }: FundRequestDetailsProps) {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [lines, setLines] = useState<FundRequestLine[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountingData, setAccountingData] = useState<AccountingData>({
    expense_account_id: null,
    treasury_account_id: null,
    third_party_account_id: null,
    notes: null,
  });
  const [rejectionReason, setRejectionReason] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadHistory();
      loadLines();
      loadAccounts();
      loadAccountingData();
      loadUserRole();
    }
  }, [open, request.id]);

  const loadUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    setUserRole(roles?.role || null);
  };

  const loadHistory = async () => {
    const { data } = await supabase
      .from('fund_request_history')
      .select('*')
      .eq('fund_request_id', request.id)
      .order('created_at', { ascending: false });

    setHistory(data || []);
  };

  const loadLines = async () => {
    const { data } = await supabase
      .from('fund_request_lines')
      .select('*')
      .eq('fund_request_id', request.id)
      .order('created_at', { ascending: true });

    setLines(data || []);
  };

  const loadAccounts = async () => {
    const { data } = await supabase
      .from('accounts')
      .select('id, code, name')
      .order('code');

    setAccounts(data || []);
  };

  const loadAccountingData = async () => {
    const { data } = await supabase
      .from('fund_request_accounting')
      .select('*')
      .eq('fund_request_id', request.id)
      .single();

    if (data) {
      setAccountingData({
        expense_account_id: data.expense_account_id,
        treasury_account_id: data.treasury_account_id,
        third_party_account_id: data.third_party_account_id,
        notes: data.notes,
      });
    }
  };

  const addHistoryEntry = async (action: string, fromStatus: string, toStatus: string, notes?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .single();

    await supabase.from('fund_request_history').insert({
      fund_request_id: request.id,
      action: action,
      from_status: fromStatus as any,
      to_status: toStatus as any,
      performed_by: user.id,
      performed_by_name: profile?.full_name || user.email,
      notes: notes || null,
    });
  };

  const updateStatus = async (newStatus: string, action: string, notes?: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('fund_requests')
        .update({ status: newStatus as any })
        .eq('id', request.id);

      if (error) throw error;

      await addHistoryEntry(action, request.status, newStatus, notes);
      
      toast({
        title: "Succès",
        description: `Demande ${action.toLowerCase()} avec succès`,
      });

      loadHistory();
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => updateStatus('submitted', 'Soumission');

  const handleAccountingComplete = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Save or update accounting data
      const { data: existing } = await supabase
        .from('fund_request_accounting')
        .select('id')
        .eq('fund_request_id', request.id)
        .single();

      if (existing) {
        await supabase
          .from('fund_request_accounting')
          .update({
            ...accountingData,
            accountant_id: user.id,
            accounting_date: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('fund_request_accounting').insert({
          fund_request_id: request.id,
          ...accountingData,
          accountant_id: user.id,
        });
      }

      await updateStatus('accounting_review', 'Comptabilisation terminée');
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = () => updateStatus('validated', 'Validation');
  
  const handleReject = () => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez indiquer le motif du rejet",
        variant: "destructive",
      });
      return;
    }
    updateStatus('rejected', 'Rejet', rejectionReason);
  };

  const handlePay = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, full_name')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) throw new Error("Entreprise non trouvée");

      // Get next receipt number
      const { data: receiptNumber } = await supabase
        .rpc('get_next_receipt_number', { p_company_id: profile.company_id });

      // Create payment receipt
      await supabase.from('payment_receipts').insert({
        fund_request_id: request.id,
        receipt_number: receiptNumber,
        company_id: profile.company_id,
        beneficiary: request.beneficiary,
        amount: request.amount,
        currency: request.currency,
        description: request.description,
        cashier_id: user.id,
        cashier_name: profile.full_name || user.email,
      });

      await updateStatus('paid', 'Paiement effectué');
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReceipt = async () => {
    const { data: receipt } = await supabase
      .from('payment_receipts')
      .select('*')
      .eq('fund_request_id', request.id)
      .single();

    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .single();

    if (receipt && company) {
      generatePaymentReceipt(receipt, company);
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('fr-CD', {
      style: 'currency',
      currency: currency === 'CDF' ? 'CDF' : 'USD',
    }).format(amount);
  };

  const canSubmit = request.status === 'draft' && currentUserId === request.requester_id;
  const canDoAccounting = request.status === 'submitted' && (userRole === 'admin' || userRole === 'accountant');
  const canValidate = request.status === 'accounting_review' && (userRole === 'admin' || userRole === 'manager');
  const canPay = request.status === 'validated' && (userRole === 'admin' || userRole === 'cashier');
  const canReject = ['submitted', 'accounting_review', 'validated'].includes(request.status) && userRole === 'admin';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-4">
            <span>Demande {request.request_number}</span>
            <Badge>{statusLabels[request.status]}</Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Détails</TabsTrigger>
            <TabsTrigger value="articles">Articles ({lines.length})</TabsTrigger>
            <TabsTrigger value="accounting">Comptabilité</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Bénéficiaire</Label>
                    <p className="font-medium">{request.beneficiary}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Montant Total</Label>
                    <p className="font-medium text-lg">{formatAmount(request.amount, request.currency)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Date de demande</Label>
                    <p className="font-medium">{new Date(request.request_date).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Date de création</Label>
                    <p className="font-medium">{new Date(request.created_at).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Motif / Description</Label>
                    <p className="font-medium">{request.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              {canSubmit && (
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Clock className="mr-2 h-4 w-4" />
                  Soumettre
                </Button>
              )}

              {canValidate && (
                <Button onClick={handleValidate} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Valider
                </Button>
              )}

              {canPay && (
                <Button onClick={handlePay} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Wallet className="mr-2 h-4 w-4" />
                  Enregistrer le paiement
                </Button>
              )}

              {request.status === 'paid' && (
                <Button variant="outline" onClick={handlePrintReceipt}>
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimer le reçu
                </Button>
              )}

              {canReject && (
                <div className="flex items-center gap-2 w-full mt-4">
                  <Textarea
                    placeholder="Motif du rejet..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="destructive" onClick={handleReject} disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <XCircle className="mr-2 h-4 w-4" />
                    Rejeter
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="articles" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Articles de la demande</CardTitle>
              </CardHeader>
              <CardContent>
                {lines.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Aucun article (demande sans détail)</p>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50%]">Description</TableHead>
                          <TableHead className="text-right">Quantité</TableHead>
                          <TableHead className="text-right">Prix unitaire</TableHead>
                          <TableHead className="text-right">Sous-total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell>{line.description}</TableCell>
                            <TableCell className="text-right">{line.quantity}</TableCell>
                            <TableCell className="text-right">
                              {formatAmount(line.unit_price, request.currency)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatAmount(line.subtotal, request.currency)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="flex justify-end mt-4">
                      <div className="bg-muted rounded-lg px-6 py-3 text-right">
                        <span className="text-muted-foreground mr-4">Total:</span>
                        <span className="text-xl font-bold">
                          {formatAmount(request.amount, request.currency)}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accounting" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Informations Comptables</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Compte d'imputation de charge</Label>
                  <Select
                    value={accountingData.expense_account_id || ""}
                    onValueChange={(value) => setAccountingData(prev => ({ ...prev, expense_account_id: value }))}
                    disabled={!canDoAccounting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un compte" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.filter(a => a.code.startsWith('6')).map(account => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Compte de trésorerie</Label>
                  <Select
                    value={accountingData.treasury_account_id || ""}
                    onValueChange={(value) => setAccountingData(prev => ({ ...prev, treasury_account_id: value }))}
                    disabled={!canDoAccounting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un compte" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.filter(a => a.code.startsWith('5')).map(account => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Compte de tiers</Label>
                  <Select
                    value={accountingData.third_party_account_id || ""}
                    onValueChange={(value) => setAccountingData(prev => ({ ...prev, third_party_account_id: value }))}
                    disabled={!canDoAccounting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un compte" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.filter(a => a.code.startsWith('4')).map(account => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Notes comptables</Label>
                  <Textarea
                    value={accountingData.notes || ""}
                    onChange={(e) => setAccountingData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Notes additionnelles..."
                    disabled={!canDoAccounting}
                  />
                </div>

                {canDoAccounting && (
                  <Button onClick={handleAccountingComplete} disabled={loading} className="w-full">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <FileText className="mr-2 h-4 w-4" />
                    Valider la comptabilisation
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Historique des actions</CardTitle>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Aucun historique</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Par</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            {new Date(entry.created_at).toLocaleString('fr-FR')}
                          </TableCell>
                          <TableCell>{entry.action}</TableCell>
                          <TableCell>{entry.performed_by_name}</TableCell>
                          <TableCell>{entry.notes || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
