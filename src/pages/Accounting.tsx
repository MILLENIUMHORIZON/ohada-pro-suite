import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Download } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const mockJournalEntries = [
  {
    id: 1,
    number: "JE-2025-0012",
    date: "2025-01-15",
    journal: "Ventes",
    ref: "FAC-2025-0045",
    debit: "1,250,000",
    credit: "1,250,000",
    status: "posted",
  },
  {
    id: 2,
    number: "JE-2025-0011",
    date: "2025-01-14",
    journal: "Banque",
    ref: "PAY-2025-0032",
    debit: "3,450,000",
    credit: "3,450,000",
    status: "posted",
  },
  {
    id: 3,
    number: "JE-2025-0010",
    date: "2025-01-13",
    journal: "Achats",
    ref: "BILL-2025-0018",
    debit: "875,000",
    credit: "875,000",
    status: "draft",
  },
];

const accountingReports = [
  { name: "Balance Générale", desc: "Balance des comptes", icon: FileText },
  { name: "Grand Livre", desc: "Détail des écritures par compte", icon: FileText },
  { name: "Journaux", desc: "Écritures par journal", icon: FileText },
  { name: "Balance Âgée", desc: "Clients et fournisseurs", icon: FileText },
];

export default function Accounting() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Comptabilité</h1>
          <p className="text-muted-foreground mt-1">Gestion comptable OHADA</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle Écriture
        </Button>
      </div>

      {/* Accounting Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Actif Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">125M CDF</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Passif Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">85M CDF</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Résultat Net
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">+15M CDF</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              TVA à Déclarer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.4M CDF</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="entries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="entries">Écritures Comptables</TabsTrigger>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockJournalEntries.map((entry) => (
                    <TableRow key={entry.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">{entry.number}</TableCell>
                      <TableCell>{new Date(entry.date).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell>{entry.journal}</TableCell>
                      <TableCell className="text-muted-foreground">{entry.ref}</TableCell>
                      <TableCell className="text-right font-mono">{entry.debit} CDF</TableCell>
                      <TableCell className="text-right font-mono">{entry.credit} CDF</TableCell>
                      <TableCell>
                        <Badge variant={entry.status === "posted" ? "default" : "secondary"}>
                          {entry.status === "posted" ? "Validée" : "Brouillon"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
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
                      className="flex items-center gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent"
                    >
                      <Icon className="h-8 w-8 text-primary" />
                      <div className="flex-1">
                        <div className="font-semibold">{report.name}</div>
                        <div className="text-sm text-muted-foreground">{report.desc}</div>
                      </div>
                      <Download className="h-5 w-5 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
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
                    <div className="text-2xl font-bold">7,240,000 CDF</div>
                  </div>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">TVA Déductible</div>
                      <div className="text-sm text-muted-foreground">Achats du mois</div>
                    </div>
                    <div className="text-2xl font-bold">4,850,000 CDF</div>
                  </div>
                </div>
                <div className="rounded-lg bg-primary/5 border border-primary p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-primary">TVA à Payer</div>
                      <div className="text-sm text-muted-foreground">Solde à déclarer</div>
                    </div>
                    <div className="text-2xl font-bold text-primary">2,390,000 CDF</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
