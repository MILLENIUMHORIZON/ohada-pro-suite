import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Download, Upload, Wallet, Building2, CheckCircle, Loader2, Users, Truck, BookOpen } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { JournalEntryForm } from "@/components/forms/JournalEntryForm";
import { AccountForm } from "@/components/forms/AccountForm";
import { JournalForm } from "@/components/forms/JournalForm";
import { ChartOfAccountsImport } from "@/components/forms/ChartOfAccountsImport";
import { BalanceGenerale } from "@/components/reports/BalanceGenerale";
import { GrandLivre } from "@/components/reports/GrandLivre";
import { BilanOHADA } from "@/components/reports/BilanOHADA";
import { CompteResultat } from "@/components/reports/CompteResultat";
import { BalanceAgee } from "@/components/reports/BalanceAgee";
import { BalanceClients } from "@/components/reports/BalanceClients";
import { BalanceFournisseurs } from "@/components/reports/BalanceFournisseurs";
import { JournauxAuxiliaires } from "@/components/reports/JournauxAuxiliaires";
import { TFT } from "@/components/reports/TFT";
import { LivreCaisseBanque } from "@/components/reports/LivreCaisseBanque";
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
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";

const accountingReports = [
  { name: "Balance à 6 Colonnes", desc: "Soldes initiaux, mouvements et soldes finaux", icon: FileText },
  { name: "Grand Livre", desc: "Détail des écritures par compte", icon: FileText },
  { name: "Journaux Auxiliaires", desc: "Journal Ventes, Achats, Banque, OD", icon: BookOpen },
  { name: "Livre Caisse & Banque", desc: "Mouvements de trésorerie", icon: Wallet },
  { name: "Balance Clients", desc: "Soldes des comptes clients (411)", icon: Users },
  { name: "Balance Fournisseurs", desc: "Soldes des comptes fournisseurs (401)", icon: Truck },
  { name: "Balance Âgée", desc: "Créances et dettes par ancienneté", icon: FileText },
  { name: "Bilan OHADA", desc: "Actif et Passif (système normal)", icon: FileText },
  { name: "Compte de Résultat", desc: "Produits et Charges (OHADA)", icon: FileText },
  { name: "TFT", desc: "Tableau de Flux de Trésorerie (OHADA)", icon: FileText },
  { name: "État Annexé", desc: "Notes et informations complémentaires", icon: FileText },
];

export default function Accounting() {
  const [isJournalEntryDialogOpen, setIsJournalEntryDialogOpen] = useState(false);
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [isJournalDialogOpen, setIsJournalDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedJournalId, setSelectedJournalId] = useState<string | undefined>(undefined);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [moves, setMoves] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [validatingMoveId, setValidatingMoveId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({
    totalAssets: 0,
    totalLiabilities: 0,
    netResult: 0,
    vatPayable: 0,
    vatCollected: 0,
    vatDeductible: 0,
  });

  useEffect(() => {
    loadAccounts();
    loadJournals();
    loadMoves();
    loadMetrics();

    // Souscrire aux mises à jour en temps réel
    const accountsChannel = supabase
      .channel('accounts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts' }, () => {
        loadAccounts();
        loadMetrics();
      })
      .subscribe();

    const journalsChannel = supabase
      .channel('journals-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journals' }, () => {
        loadJournals();
      })
      .subscribe();

    const movesChannel = supabase
      .channel('moves-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'account_moves' }, () => {
        loadMoves();
        loadMetrics();
      })
      .subscribe();

    const moveLinesChannel = supabase
      .channel('move-lines-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'account_move_lines' }, () => {
        loadMetrics();
      })
      .subscribe();

    // Nettoyer les souscriptions lors du démontage
    return () => {
      supabase.removeChannel(accountsChannel);
      supabase.removeChannel(journalsChannel);
      supabase.removeChannel(movesChannel);
      supabase.removeChannel(moveLinesChannel);
    };
  }, []);

  const loadAccounts = async () => {
    const { data } = await supabase
      .from("accounts")
      .select("*")
      .order("code");
    
    if (data) setAccounts(data);
  };

  const loadJournals = async () => {
    const { data } = await supabase
      .from("journals")
      .select("*")
      .order("code");
    
    if (data) setJournals(data);
  };

  const loadMoves = async () => {
    const { data } = await supabase
      .from("account_moves")
      .select(`
        *,
        journal:journals(name)
      `)
      .order("date", { ascending: false })
      .limit(10);
    
    if (data) setMoves(data);
  };

  const loadMetrics = async () => {
    // Charger tous les comptes avec leurs lignes d'écriture
    const { data: accountsData } = await supabase
      .from("accounts")
      .select("id, code, type");

    const { data: linesData } = await supabase
      .from("account_move_lines")
      .select(`
        account_id,
        debit,
        credit,
        move:account_moves!inner(state)
      `);

    if (!accountsData || !linesData) return;

    // Filtrer uniquement les écritures validées
    const postedLines = linesData.filter((line: any) => line.move?.state === 'posted');

    // Calculer les soldes par compte
    const accountBalances = new Map<string, number>();
    postedLines.forEach((line: any) => {
      const balance = accountBalances.get(line.account_id) || 0;
      accountBalances.set(line.account_id, balance + Number(line.debit || 0) - Number(line.credit || 0));
    });

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    let vatCollected = 0;
    let vatDeductible = 0;

    accountsData.forEach((account: any) => {
      const balance = accountBalances.get(account.id) || 0;
      const code = account.code;

      // OHADA Classification:
      // Classe 1: Capitaux propres et passifs (solde créditeur = passif)
      // Classe 2: Immobilisations (solde débiteur = actif)
      // Classe 3: Stocks (solde débiteur = actif)
      // Classe 4: Tiers (clients débiteurs = actif, fournisseurs créditeurs = passif)
      // Classe 5: Trésorerie (solde débiteur = actif)
      // Classe 6: Charges (solde débiteur)
      // Classe 7: Produits (solde créditeur)

      // Classe 2 - Immobilisations (actifs)
      if (code.startsWith('2')) {
        totalAssets += Math.abs(balance);
      }

      // Classe 3 - Stocks (actifs)
      if (code.startsWith('3')) {
        totalAssets += Math.abs(balance);
      }

      // Classe 4 - Tiers
      if (code.startsWith('4')) {
        // 40x Fournisseurs = passif (solde créditeur)
        if (code.startsWith('40')) {
          if (balance < 0) totalLiabilities += Math.abs(balance);
        }
        // 41x Clients = actif (solde débiteur)
        else if (code.startsWith('41')) {
          if (balance > 0) totalAssets += balance;
        }
        // 443x TVA collectée = passif (solde créditeur)
        else if (code.startsWith('443')) {
          if (balance < 0) {
            vatCollected += Math.abs(balance);
            totalLiabilities += Math.abs(balance);
          }
        }
        // 445x TVA déductible = actif (solde débiteur)
        else if (code.startsWith('445')) {
          if (balance > 0) {
            vatDeductible += balance;
            totalAssets += balance;
          }
        }
        // Autres comptes de tiers
        else {
          if (balance > 0) totalAssets += balance;
          else if (balance < 0) totalLiabilities += Math.abs(balance);
        }
      }

      // Classe 5 - Trésorerie (actifs - Banque 52x, Caisse 57x)
      if (code.startsWith('5')) {
        if (balance > 0) totalAssets += balance;
        // Si solde négatif (découvert bancaire) = passif
        else if (balance < 0) totalLiabilities += Math.abs(balance);
      }

      // Classe 1 - Capitaux propres et passifs
      if (code.startsWith('1')) {
        // Les capitaux propres ont normalement un solde créditeur
        totalLiabilities += Math.abs(balance);
      }

      // Classe 7 - Produits (solde créditeur)
      if (code.startsWith('7')) {
        totalIncome += Math.abs(balance);
      }

      // Classe 6 - Charges (solde débiteur)
      if (code.startsWith('6')) {
        totalExpense += Math.abs(balance);
      }
    });

    const netResult = totalIncome - totalExpense;
    const vatPayable = vatCollected - vatDeductible;

    setMetrics({
      totalAssets,
      totalLiabilities,
      netResult,
      vatPayable,
      vatCollected,
      vatDeductible,
    });
  };

  const handleEditJournal = (journalId: string) => {
    setSelectedJournalId(journalId);
    setIsJournalDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsJournalDialogOpen(false);
    setSelectedJournalId(undefined);
    loadJournals();
  };

  const handleValidateMove = async (moveId: string) => {
    setValidatingMoveId(moveId);
    try {
      const { error } = await supabase
        .from("account_moves")
        .update({ state: "posted" })
        .eq("id", moveId);

      if (error) throw error;

      toast.success("Écriture validée avec succès");
      loadMoves();
      loadMetrics();
    } catch (error: any) {
      console.error("Error validating move:", error);
      toast.error("Erreur lors de la validation de l'écriture");
    } finally {
      setValidatingMoveId(null);
    }
  };


  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Comptabilité</h1>
          <p className="text-muted-foreground mt-1">Gestion comptable OHADA</p>
        </div>
        <Button onClick={() => setIsJournalEntryDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle Écriture
        </Button>
      </div>

      {/* Journal Entry Dialog */}
      <Dialog open={isJournalEntryDialogOpen} onOpenChange={setIsJournalEntryDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle Écriture Comptable</DialogTitle>
            <DialogDescription>
              Créer une nouvelle écriture comptable
            </DialogDescription>
          </DialogHeader>
          <JournalEntryForm onSuccess={() => {
            setIsJournalEntryDialogOpen(false);
            loadMoves();
          }} />
        </DialogContent>
      </Dialog>

      {/* Accounting Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Actif Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('fr-FR', { 
                style: 'decimal',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0 
              }).format(metrics.totalAssets)} CDF
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Passif Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('fr-FR', { 
                style: 'decimal',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0 
              }).format(metrics.totalLiabilities)} CDF
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Résultat Net
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${metrics.netResult >= 0 ? 'text-success' : 'text-destructive'}`}>
              {metrics.netResult >= 0 ? '+' : ''}
              {new Intl.NumberFormat('fr-FR', { 
                style: 'decimal',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0 
              }).format(metrics.netResult)} CDF
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              TVA à Déclarer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('fr-FR', { 
                style: 'decimal',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0 
              }).format(metrics.vatPayable)} CDF
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="entries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="entries">Écritures Comptables</TabsTrigger>
          <TabsTrigger value="journals">Journaux</TabsTrigger>
          <TabsTrigger value="accounts">Plan Comptable</TabsTrigger>
          <TabsTrigger value="reports">Rapports</TabsTrigger>
          <TabsTrigger value="taxes">TVA</TabsTrigger>
        </TabsList>

        <TabsContent value="entries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Écritures Récentes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Journal</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead className="text-right">Débit</TableHead>
                    <TableHead className="text-right">Crédit</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {moves.length > 0 ? moves.map((entry) => (
                    <TableRow key={entry.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">{entry.number}</TableCell>
                      <TableCell>{new Date(entry.date).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell>{entry.journal?.name || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{entry.ref || '-'}</TableCell>
                      <TableCell className="text-right font-mono">-</TableCell>
                      <TableCell className="text-right font-mono">-</TableCell>
                      <TableCell>
                        <Badge variant={entry.state === "posted" ? "default" : "secondary"}>
                          {entry.state === "posted" ? "Validée" : "Brouillon"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {entry.state === "draft" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleValidateMove(entry.id)}
                            disabled={validatingMoveId === entry.id}
                          >
                            {validatingMoveId === entry.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Valider
                              </>
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Aucune écriture comptable enregistrée
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="journals" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Journaux Comptables</CardTitle>
                <Button onClick={() => {
                  setSelectedJournalId(undefined);
                  setIsJournalDialogOpen(true);
                }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nouveau Journal
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {journals.map((journal) => (
                    <TableRow key={journal.id}>
                      <TableCell className="font-mono">{journal.code}</TableCell>
                      <TableCell>{journal.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {journal.type === 'sales' && 'Vente'}
                          {journal.type === 'purchases' && 'Achat'}
                          {journal.type === 'bank' && 'Banque'}
                          {journal.type === 'cash' && 'Caisse'}
                          {journal.type === 'misc' && 'Opérations Diverses'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditJournal(journal.id)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Plan Comptable OHADA</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Importer
                  </Button>
                  <Button onClick={() => setIsAccountDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nouveau Compte
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Lettrable</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-mono">{account.code}</TableCell>
                      <TableCell>{account.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {account.type === 'asset' && 'Actif'}
                          {account.type === 'liability' && 'Passif'}
                          {account.type === 'equity' && 'Capitaux'}
                          {account.type === 'income' && 'Produit'}
                          {account.type === 'expense' && 'Charge'}
                          {account.type === 'receivable' && 'Créance'}
                          {account.type === 'payable' && 'Dette'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {account.reconcilable ? (
                          <Badge variant="default">Oui</Badge>
                        ) : (
                          <Badge variant="secondary">Non</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          {!selectedReport ? (
            <Card>
              <CardHeader>
                <CardTitle>États Financiers OHADA</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {accountingReports.map((report) => {
                    const Icon = report.icon;
                    return (
                      <button
                        key={report.name}
                        onClick={() => setSelectedReport(report.name)}
                        className="flex items-center gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent"
                      >
                        <Icon className="h-8 w-8 text-primary" />
                        <div className="flex-1">
                          <div className="font-semibold">{report.name}</div>
                          <div className="text-sm text-muted-foreground">{report.desc}</div>
                        </div>
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Button variant="outline" onClick={() => setSelectedReport(null)}>
                ← Retour aux rapports
              </Button>
              {selectedReport === "Balance à 6 Colonnes" && <BalanceGenerale />}
              {selectedReport === "Grand Livre" && <GrandLivre />}
              {selectedReport === "Journaux Auxiliaires" && <JournauxAuxiliaires />}
              {selectedReport === "Livre Caisse & Banque" && <LivreCaisseBanque />}
              {selectedReport === "Balance Clients" && <BalanceClients />}
              {selectedReport === "Balance Fournisseurs" && <BalanceFournisseurs />}
              {selectedReport === "Bilan OHADA" && <BilanOHADA />}
              {selectedReport === "Compte de Résultat" && <CompteResultat />}
              {selectedReport === "Balance Âgée" && <BalanceAgee />}
              {selectedReport === "TFT" && <TFT />}
              {!["Balance à 6 Colonnes", "Grand Livre", "Journaux Auxiliaires", "Livre Caisse & Banque", "Balance Clients", "Balance Fournisseurs", "Bilan OHADA", "Compte de Résultat", "Balance Âgée", "TFT"].includes(selectedReport) && (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Ce rapport est en cours de développement</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="taxes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Déclaration TVA</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">TVA Collectée</div>
                      <div className="text-sm text-muted-foreground">Ventes du mois</div>
                    </div>
                    <div className="text-2xl font-bold">
                      {new Intl.NumberFormat('fr-FR', { 
                        style: 'decimal',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0 
                      }).format(metrics.vatCollected)} CDF
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">TVA Déductible</div>
                      <div className="text-sm text-muted-foreground">Achats du mois</div>
                    </div>
                    <div className="text-2xl font-bold">
                      {new Intl.NumberFormat('fr-FR', { 
                        style: 'decimal',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0 
                      }).format(metrics.vatDeductible)} CDF
                    </div>
                  </div>
                </div>
                <div className="rounded-lg bg-primary/5 border border-primary p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-primary">TVA à Payer</div>
                      <div className="text-sm text-muted-foreground">Solde à déclarer</div>
                    </div>
                    <div className="text-2xl font-bold text-primary">
                      {new Intl.NumberFormat('fr-FR', { 
                        style: 'decimal',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0 
                      }).format(metrics.vatPayable)} CDF
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Account Creation Dialog */}
      <Dialog open={isAccountDialogOpen} onOpenChange={setIsAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau Compte Comptable</DialogTitle>
            <DialogDescription>
              Créer un nouveau compte dans le plan comptable OHADA
            </DialogDescription>
          </DialogHeader>
          <AccountForm onSuccess={() => {
            setIsAccountDialogOpen(false);
            loadAccounts();
          }} />
        </DialogContent>
      </Dialog>

      {/* Journal Dialog */}
      <Dialog open={isJournalDialogOpen} onOpenChange={setIsJournalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedJournalId ? "Modifier le journal" : "Nouveau Journal"}</DialogTitle>
            <DialogDescription>
              {selectedJournalId ? "Modifier les informations du journal" : "Créer un nouveau journal comptable"}
            </DialogDescription>
          </DialogHeader>
          <JournalForm journalId={selectedJournalId} onSuccess={handleDialogClose} />
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importer le Plan Comptable</DialogTitle>
            <DialogDescription>
              Importer plusieurs comptes depuis un fichier CSV
            </DialogDescription>
          </DialogHeader>
          <ChartOfAccountsImport onSuccess={() => {
            setIsImportDialogOpen(false);
            loadAccounts();
          }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
