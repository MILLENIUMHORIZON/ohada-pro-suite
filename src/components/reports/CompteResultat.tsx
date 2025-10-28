import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

interface ResultatItem {
  code: string;
  name: string;
  amount: number;
}

interface SoldesIntermediaires {
  marge_commerciale: number;
  valeur_ajoutee: number;
  excedent_brut_exploitation: number;
  resultat_exploitation: number;
  resultat_financier: number;
  resultat_activites_ordinaires: number;
  resultat_hao: number;
  resultat_net: number;
}

interface ResultatData {
  produits: {
    ventes: ResultatItem[];
    production_vendue: ResultatItem[];
    production_stockee: ResultatItem[];
    production_immobilisee: ResultatItem[];
    subventions_exploitation: ResultatItem[];
    autres_produits: ResultatItem[];
    reprises_provisions: ResultatItem[];
    transferts_charges: ResultatItem[];
    produits_financiers: ResultatItem[];
    produits_hao: ResultatItem[];
  };
  charges: {
    achats_marchandises: ResultatItem[];
    variation_stocks_marchandises: ResultatItem[];
    achats_matieres: ResultatItem[];
    variation_stocks_matieres: ResultatItem[];
    transports: ResultatItem[];
    services_exterieurs_a: ResultatItem[];
    services_exterieurs_b: ResultatItem[];
    impots_taxes: ResultatItem[];
    autres_charges: ResultatItem[];
    charges_personnel: ResultatItem[];
    dotations_amortissements: ResultatItem[];
    charges_financieres: ResultatItem[];
    charges_hao: ResultatItem[];
    participation_impots: ResultatItem[];
  };
  soldes: SoldesIntermediaires;
  totals: {
    total_produits_exploitation: number;
    total_charges_exploitation: number;
    total_produits_financiers: number;
    total_charges_financieres: number;
    total_produits_hao: number;
    total_charges_hao: number;
  };
}

export function CompteResultat() {
  const [loading, setLoading] = useState(true);
  const [resultat, setResultat] = useState<ResultatData | null>(null);

  useEffect(() => {
    loadCompteResultat();
  }, []);

  const loadCompteResultat = async () => {
    setLoading(true);
    try {
      // Get all revenue and expense accounts with their balances
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, code, name, type")
        .in("type", ["expense", "income"])
        .order("code");

      if (!accounts) return;

      // Get all account move lines
      const { data: lines } = await supabase
        .from("account_move_lines")
        .select("account_id, debit, credit");

      // Calculate balances
      const balanceMap = new Map<string, number>();
      lines?.forEach((line) => {
        const current = balanceMap.get(line.account_id) || 0;
        // For P&L: credits are revenue, debits are expenses
        balanceMap.set(line.account_id, current + Number(line.credit || 0) - Number(line.debit || 0));
      });

      const resultatData: ResultatData = {
        produits: {
          ventes: [],
          production_vendue: [],
          production_stockee: [],
          production_immobilisee: [],
          subventions_exploitation: [],
          autres_produits: [],
          reprises_provisions: [],
          transferts_charges: [],
          produits_financiers: [],
          produits_hao: [],
        },
        charges: {
          achats_marchandises: [],
          variation_stocks_marchandises: [],
          achats_matieres: [],
          variation_stocks_matieres: [],
          transports: [],
          services_exterieurs_a: [],
          services_exterieurs_b: [],
          impots_taxes: [],
          autres_charges: [],
          charges_personnel: [],
          dotations_amortissements: [],
          charges_financieres: [],
          charges_hao: [],
          participation_impots: [],
        },
        soldes: {
          marge_commerciale: 0,
          valeur_ajoutee: 0,
          excedent_brut_exploitation: 0,
          resultat_exploitation: 0,
          resultat_financier: 0,
          resultat_activites_ordinaires: 0,
          resultat_hao: 0,
          resultat_net: 0,
        },
        totals: {
          total_produits_exploitation: 0,
          total_charges_exploitation: 0,
          total_produits_financiers: 0,
          total_charges_financieres: 0,
          total_produits_hao: 0,
          total_charges_hao: 0,
        },
      };

      // Totaux intermédiaires
      let ventes_marchandises = 0;
      let achats_marchandises = 0;
      let production = 0;
      let matieres_consommees = 0;
      let autres_charges_externes = 0;
      let impots_taxes_total = 0;

      accounts.forEach((account) => {
        const balance = balanceMap.get(account.id) || 0;
        if (balance === 0) return;

        const item: ResultatItem = {
          code: account.code,
          name: account.name,
          amount: Math.abs(balance),
        };

        // PRODUITS D'EXPLOITATION (Classe 70-75)
        if (account.code.startsWith("701")) {
          resultatData.produits.ventes.push(item);
          ventes_marchandises += item.amount;
          resultatData.totals.total_produits_exploitation += item.amount;
        } else if (account.code.startsWith("702") || account.code.startsWith("703") || account.code.startsWith("704") || account.code.startsWith("706")) {
          resultatData.produits.production_vendue.push(item);
          production += item.amount;
          resultatData.totals.total_produits_exploitation += item.amount;
        } else if (account.code.startsWith("73")) {
          resultatData.produits.production_stockee.push(item);
          production += balance > 0 ? item.amount : -item.amount;
          resultatData.totals.total_produits_exploitation += balance > 0 ? item.amount : -item.amount;
        } else if (account.code.startsWith("72")) {
          resultatData.produits.production_immobilisee.push(item);
          production += item.amount;
          resultatData.totals.total_produits_exploitation += item.amount;
        } else if (account.code.startsWith("71")) {
          resultatData.produits.subventions_exploitation.push(item);
          resultatData.totals.total_produits_exploitation += item.amount;
        } else if (account.code.startsWith("75")) {
          resultatData.produits.autres_produits.push(item);
          resultatData.totals.total_produits_exploitation += item.amount;
        } else if (account.code.startsWith("78")) {
          resultatData.produits.reprises_provisions.push(item);
          resultatData.totals.total_produits_exploitation += item.amount;
        } else if (account.code.startsWith("79")) {
          resultatData.produits.transferts_charges.push(item);
          resultatData.totals.total_produits_exploitation += item.amount;
        }
        
        // PRODUITS FINANCIERS (Classe 77)
        else if (account.code.startsWith("77")) {
          resultatData.produits.produits_financiers.push(item);
          resultatData.totals.total_produits_financiers += item.amount;
        }
        
        // PRODUITS HAO (Classe 84)
        else if (account.code.startsWith("84")) {
          resultatData.produits.produits_hao.push(item);
          resultatData.totals.total_produits_hao += item.amount;
        }

        // CHARGES D'EXPLOITATION (Classe 60-66, 68)
        if (account.code.startsWith("601")) {
          resultatData.charges.achats_marchandises.push(item);
          achats_marchandises += item.amount;
          resultatData.totals.total_charges_exploitation += item.amount;
        } else if (account.code.startsWith("602") || account.code.startsWith("604") || account.code.startsWith("605") || account.code.startsWith("608")) {
          resultatData.charges.achats_matieres.push(item);
          matieres_consommees += item.amount;
          resultatData.totals.total_charges_exploitation += item.amount;
        } else if (account.code.startsWith("603")) {
          resultatData.charges.variation_stocks_matieres.push(item);
          matieres_consommees += balance > 0 ? item.amount : -item.amount;
          resultatData.totals.total_charges_exploitation += balance > 0 ? item.amount : -item.amount;
        } else if (account.code.startsWith("61")) {
          resultatData.charges.transports.push(item);
          autres_charges_externes += item.amount;
          resultatData.totals.total_charges_exploitation += item.amount;
        } else if (account.code.startsWith("62")) {
          resultatData.charges.services_exterieurs_a.push(item);
          autres_charges_externes += item.amount;
          resultatData.totals.total_charges_exploitation += item.amount;
        } else if (account.code.startsWith("63")) {
          resultatData.charges.services_exterieurs_b.push(item);
          autres_charges_externes += item.amount;
          resultatData.totals.total_charges_exploitation += item.amount;
        } else if (account.code.startsWith("64")) {
          resultatData.charges.impots_taxes.push(item);
          impots_taxes_total += item.amount;
          resultatData.totals.total_charges_exploitation += item.amount;
        } else if (account.code.startsWith("65")) {
          resultatData.charges.autres_charges.push(item);
          resultatData.totals.total_charges_exploitation += item.amount;
        } else if (account.code.startsWith("66")) {
          resultatData.charges.charges_personnel.push(item);
          resultatData.totals.total_charges_exploitation += item.amount;
        } else if (account.code.startsWith("68")) {
          resultatData.charges.dotations_amortissements.push(item);
          resultatData.totals.total_charges_exploitation += item.amount;
        }
        
        // CHARGES FINANCIERES (Classe 67)
        else if (account.code.startsWith("67")) {
          resultatData.charges.charges_financieres.push(item);
          resultatData.totals.total_charges_financieres += item.amount;
        }
        
        // CHARGES HAO (Classe 83)
        else if (account.code.startsWith("83")) {
          resultatData.charges.charges_hao.push(item);
          resultatData.totals.total_charges_hao += item.amount;
        }
        
        // PARTICIPATION ET IMPOTS (Classe 87, 89)
        else if (account.code.startsWith("87") || account.code.startsWith("89")) {
          resultatData.charges.participation_impots.push(item);
        }
      });

      // Calcul des Soldes Intermédiaires de Gestion (SIG)
      
      // 1. Marge commerciale
      resultatData.soldes.marge_commerciale = ventes_marchandises - achats_marchandises;
      
      // 2. Valeur ajoutée
      const production_totale = production;
      const consommations_intermediaires = matieres_consommees + autres_charges_externes;
      resultatData.soldes.valeur_ajoutee = resultatData.soldes.marge_commerciale + production_totale - consommations_intermediaires;
      
      // 3. Excédent brut d'exploitation (EBE)
      const charges_personnel_total = resultatData.charges.charges_personnel.reduce((sum, c) => sum + c.amount, 0);
      const subventions_total = resultatData.produits.subventions_exploitation.reduce((sum, p) => sum + p.amount, 0);
      resultatData.soldes.excedent_brut_exploitation = resultatData.soldes.valeur_ajoutee + subventions_total - charges_personnel_total - impots_taxes_total;
      
      // 4. Résultat d'exploitation
      const autres_produits_total = resultatData.produits.autres_produits.reduce((sum, p) => sum + p.amount, 0);
      const reprises_total = resultatData.produits.reprises_provisions.reduce((sum, p) => sum + p.amount, 0);
      const transferts_total = resultatData.produits.transferts_charges.reduce((sum, p) => sum + p.amount, 0);
      const autres_charges_total = resultatData.charges.autres_charges.reduce((sum, c) => sum + c.amount, 0);
      const dotations_total = resultatData.charges.dotations_amortissements.reduce((sum, c) => sum + c.amount, 0);
      resultatData.soldes.resultat_exploitation = resultatData.soldes.excedent_brut_exploitation + autres_produits_total + reprises_total + transferts_total - autres_charges_total - dotations_total;
      
      // 5. Résultat financier
      resultatData.soldes.resultat_financier = resultatData.totals.total_produits_financiers - resultatData.totals.total_charges_financieres;
      
      // 6. Résultat des activités ordinaires
      resultatData.soldes.resultat_activites_ordinaires = resultatData.soldes.resultat_exploitation + resultatData.soldes.resultat_financier;
      
      // 7. Résultat HAO (Hors Activités Ordinaires)
      resultatData.soldes.resultat_hao = resultatData.totals.total_produits_hao - resultatData.totals.total_charges_hao;
      
      // 8. Résultat net (avant participation et impôts)
      const participation_impots_total = resultatData.charges.participation_impots.reduce((sum, c) => sum + c.amount, 0);
      resultatData.soldes.resultat_net = resultatData.soldes.resultat_activites_ordinaires + resultatData.soldes.resultat_hao - participation_impots_total;

      setResultat(resultatData);
    } catch (error) {
      console.error("Error loading compte resultat:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const downloadPDF = () => {
    // TODO: Implement PDF generation
    alert("Génération PDF en cours de développement");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!resultat) return null;

  const renderSection = (title: string, items: ResultatItem[]) => {
    if (items.length === 0) return null;
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    return (
      <>
        <TableRow className="bg-muted/50">
          <TableCell colSpan={2} className="font-semibold">
            {title}
          </TableCell>
          <TableCell className="text-right font-semibold">{formatAmount(total)}</TableCell>
        </TableRow>
        {items.map((item, idx) => (
          <TableRow key={idx}>
            <TableCell className="font-mono pl-6">{item.code}</TableCell>
            <TableCell>{item.name}</TableCell>
            <TableCell className="text-right font-mono">{formatAmount(item.amount)}</TableCell>
          </TableRow>
        ))}
      </>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Compte de Résultat OHADA - Système Normal</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Exercice {new Date().getFullYear()} - Avec Soldes Intermédiaires de Gestion
            </p>
          </div>
          <Button onClick={downloadPDF} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Télécharger PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* I. ACTIVITÉ D'EXPLOITATION */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead colSpan={3} className="bg-primary/10">
                    <span className="text-lg font-bold">I. ACTIVITÉ D'EXPLOITATION</span>
                  </TableHead>
                </TableRow>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="text-right">Montant (CDF)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {renderSection("A. Ventes de marchandises", resultat.produits.ventes)}
                {renderSection("B. Achats de marchandises", resultat.charges.achats_marchandises)}
                
                <TableRow className="font-semibold bg-blue-50 dark:bg-blue-950">
                  <TableCell colSpan={2} className="pl-8">RA - MARGE COMMERCIALE (A - B)</TableCell>
                  <TableCell className={`text-right font-mono ${resultat.soldes.marge_commerciale >= 0 ? "text-blue-600" : "text-red-600"}`}>
                    {formatAmount(resultat.soldes.marge_commerciale)}
                  </TableCell>
                </TableRow>

                {renderSection("C. Production vendue", resultat.produits.production_vendue)}
                {renderSection("D. Production stockée", resultat.produits.production_stockee)}
                {renderSection("E. Production immobilisée", resultat.produits.production_immobilisee)}
                {renderSection("F. Achats de matières et fournitures", resultat.charges.achats_matieres)}
                {renderSection("G. Variation des stocks matières", resultat.charges.variation_stocks_matieres)}
                {renderSection("H. Transports", resultat.charges.transports)}
                {renderSection("I. Services extérieurs A", resultat.charges.services_exterieurs_a)}
                {renderSection("J. Services extérieurs B", resultat.charges.services_exterieurs_b)}

                <TableRow className="font-semibold bg-blue-50 dark:bg-blue-950">
                  <TableCell colSpan={2} className="pl-8">RB - VALEUR AJOUTÉE (RA + C + D + E - F - G - H - I - J)</TableCell>
                  <TableCell className={`text-right font-mono ${resultat.soldes.valeur_ajoutee >= 0 ? "text-blue-600" : "text-red-600"}`}>
                    {formatAmount(resultat.soldes.valeur_ajoutee)}
                  </TableCell>
                </TableRow>

                {renderSection("K. Subventions d'exploitation", resultat.produits.subventions_exploitation)}
                {renderSection("L. Charges de personnel", resultat.charges.charges_personnel)}
                {renderSection("M. Impôts et taxes", resultat.charges.impots_taxes)}

                <TableRow className="font-bold bg-blue-100 dark:bg-blue-900">
                  <TableCell colSpan={2} className="pl-8">RC - EXCÉDENT BRUT D'EXPLOITATION (RB + K - L - M)</TableCell>
                  <TableCell className={`text-right font-mono text-lg ${resultat.soldes.excedent_brut_exploitation >= 0 ? "text-blue-700" : "text-red-700"}`}>
                    {formatAmount(resultat.soldes.excedent_brut_exploitation)}
                  </TableCell>
                </TableRow>

                {renderSection("N. Autres produits", resultat.produits.autres_produits)}
                {renderSection("O. Autres charges", resultat.charges.autres_charges)}
                {renderSection("P. Reprises de provisions", resultat.produits.reprises_provisions)}
                {renderSection("Q. Dotations aux amortissements", resultat.charges.dotations_amortissements)}
                {renderSection("R. Transferts de charges", resultat.produits.transferts_charges)}

                <TableRow className="font-bold bg-primary/10 text-lg">
                  <TableCell colSpan={2} className="pl-8">RD - RÉSULTAT D'EXPLOITATION (RC + N - O + P - Q + R)</TableCell>
                  <TableCell className={`text-right font-mono ${resultat.soldes.resultat_exploitation >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatAmount(resultat.soldes.resultat_exploitation)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* II. ACTIVITÉ FINANCIÈRE */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead colSpan={3} className="bg-yellow-100 dark:bg-yellow-950">
                    <span className="text-lg font-bold">II. ACTIVITÉ FINANCIÈRE</span>
                  </TableHead>
                </TableRow>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="text-right">Montant (CDF)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {renderSection("S. Produits financiers", resultat.produits.produits_financiers)}
                {renderSection("T. Charges financières", resultat.charges.charges_financieres)}

                <TableRow className="font-bold bg-yellow-50 dark:bg-yellow-900">
                  <TableCell colSpan={2} className="pl-8">RE - RÉSULTAT FINANCIER (S - T)</TableCell>
                  <TableCell className={`text-right font-mono ${resultat.soldes.resultat_financier >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatAmount(resultat.soldes.resultat_financier)}
                  </TableCell>
                </TableRow>

                <TableRow className="font-bold bg-yellow-100 dark:bg-yellow-950 text-lg">
                  <TableCell colSpan={2} className="pl-4">RF - RÉSULTAT DES ACTIVITÉS ORDINAIRES (RD ± RE)</TableCell>
                  <TableCell className={`text-right font-mono ${resultat.soldes.resultat_activites_ordinaires >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatAmount(resultat.soldes.resultat_activites_ordinaires)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* III. HORS ACTIVITÉS ORDINAIRES (HAO) */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead colSpan={3} className="bg-purple-100 dark:bg-purple-950">
                    <span className="text-lg font-bold">III. HORS ACTIVITÉS ORDINAIRES (HAO)</span>
                  </TableHead>
                </TableRow>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="text-right">Montant (CDF)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {renderSection("U. Produits des cessions d'immobilisations", resultat.produits.produits_hao)}
                {renderSection("V. Charges HAO", resultat.charges.charges_hao)}

                <TableRow className="font-bold bg-purple-50 dark:bg-purple-900">
                  <TableCell colSpan={2} className="pl-8">RG - RÉSULTAT HAO (U - V)</TableCell>
                  <TableCell className={`text-right font-mono ${resultat.soldes.resultat_hao >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatAmount(resultat.soldes.resultat_hao)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* IV. RÉSULTAT NET */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead colSpan={3} className="bg-slate-200 dark:bg-slate-800">
                    <span className="text-lg font-bold">IV. DÉTERMINATION DU RÉSULTAT NET</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {renderSection("W. Participation des travailleurs", resultat.charges.participation_impots)}
                
                <TableRow className={`font-bold text-xl border-t-2 ${resultat.soldes.resultat_net >= 0 ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"}`}>
                  <TableCell colSpan={2} className="py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">RH - RÉSULTAT NET</span>
                      <span className="text-base font-normal text-muted-foreground">
                        (RF ± RG - W)
                      </span>
                    </div>
                    <div className="text-sm font-normal text-muted-foreground mt-1">
                      {resultat.soldes.resultat_net >= 0 ? "Bénéfice de l'exercice" : "Perte de l'exercice"}
                    </div>
                  </TableCell>
                  <TableCell className={`text-right font-mono text-2xl py-4 ${resultat.soldes.resultat_net >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                    {formatAmount(resultat.soldes.resultat_net)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* TABLEAU DES SOLDES INTERMÉDIAIRES DE GESTION */}
          <div className="rounded-md border bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead colSpan={2} className="bg-slate-300 dark:bg-slate-700">
                    <span className="text-lg font-bold">TABLEAU RÉCAPITULATIF DES SOLDES INTERMÉDIAIRES DE GESTION (SIG)</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-semibold">RA - Marge Commerciale</TableCell>
                  <TableCell className="text-right font-mono">{formatAmount(resultat.soldes.marge_commerciale)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-semibold">RB - Valeur Ajoutée</TableCell>
                  <TableCell className="text-right font-mono">{formatAmount(resultat.soldes.valeur_ajoutee)}</TableCell>
                </TableRow>
                <TableRow className="bg-blue-50 dark:bg-blue-950/30">
                  <TableCell className="font-bold">RC - Excédent Brut d'Exploitation (EBE)</TableCell>
                  <TableCell className="text-right font-mono font-bold">{formatAmount(resultat.soldes.excedent_brut_exploitation)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-bold">RD - Résultat d'Exploitation</TableCell>
                  <TableCell className="text-right font-mono font-bold">{formatAmount(resultat.soldes.resultat_exploitation)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-semibold">RE - Résultat Financier</TableCell>
                  <TableCell className="text-right font-mono">{formatAmount(resultat.soldes.resultat_financier)}</TableCell>
                </TableRow>
                <TableRow className="bg-yellow-50 dark:bg-yellow-950/30">
                  <TableCell className="font-bold">RF - Résultat des Activités Ordinaires</TableCell>
                  <TableCell className="text-right font-mono font-bold">{formatAmount(resultat.soldes.resultat_activites_ordinaires)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-semibold">RG - Résultat HAO</TableCell>
                  <TableCell className="text-right font-mono">{formatAmount(resultat.soldes.resultat_hao)}</TableCell>
                </TableRow>
                <TableRow className={`border-t-2 ${resultat.soldes.resultat_net >= 0 ? "bg-green-100 dark:bg-green-950/30" : "bg-red-100 dark:bg-red-950/30"}`}>
                  <TableCell className="font-bold text-lg">RH - RÉSULTAT NET</TableCell>
                  <TableCell className={`text-right font-mono font-bold text-lg ${resultat.soldes.resultat_net >= 0 ? "text-green-700" : "text-red-700"}`}>
                    {formatAmount(resultat.soldes.resultat_net)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
