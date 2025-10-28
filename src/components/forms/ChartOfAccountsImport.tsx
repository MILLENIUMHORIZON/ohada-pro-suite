import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ImportResult {
  success: number;
  errors: string[];
}

export function ChartOfAccountsImport({ onSuccess }: { onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    // Parse CSV properly handling quoted values
    const parseLine = (line: string): string[] => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    };

    const headers = parseLine(lines[0]).map(h => h.toLowerCase());
    const accounts = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.length >= 3) { // At minimum: code, name, type
        const account: any = {};
        headers.forEach((header, index) => {
          if (index < values.length) {
            account[header] = values[index];
          }
        });
        
        // Skip invalid entries
        if (account.code && account.name && account.type) {
          accounts.push(account);
        }
      }
    }

    return accounts;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setResult(null);
    } else {
      toast.error("Veuillez sélectionner un fichier CSV");
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Veuillez sélectionner un fichier");
      return;
    }

    setIsProcessing(true);
    const errors: string[] = [];
    let successCount = 0;

    try {
      const text = await file.text();
      const accounts = parseCSV(text);

      if (accounts.length === 0) {
        toast.error("Le fichier CSV est vide ou mal formaté");
        setIsProcessing(false);
        return;
      }

      // Get user's company_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile?.company_id) {
        toast.error("Impossible de récupérer les informations de la société");
        setIsProcessing(false);
        return;
      }

      // Check for existing accounts to avoid duplicates
      const { data: existingAccounts } = await supabase
        .from("accounts")
        .select("code")
        .eq("company_id", profile.company_id);
      
      const existingCodes = new Set(existingAccounts?.map(a => a.code) || []);

      // Import accounts one by one
      for (const account of accounts) {
        try {
          // Skip if already exists
          if (existingCodes.has(account.code)) {
            errors.push(`Compte ${account.code}: Déjà existant (ignoré)`);
            continue;
          }

          // Map type aliases (revenue -> income, as per database schema)
          let accountType = account.type.toLowerCase();
          if (accountType === 'revenue') {
            accountType = 'income';
          }
          
          // Validate type
          const validTypes = ['asset', 'liability', 'equity', 'income', 'expense', 'receivable', 'payable'];
          if (!validTypes.includes(accountType)) {
            errors.push(`Compte ${account.code}: Type invalide '${account.type}'`);
            continue;
          }
          
          const { error } = await supabase.from("accounts").insert({
            company_id: profile.company_id,
            code: account.code.trim(),
            name: (account.name || account.nom).trim(),
            type: accountType,
            reconcilable: account.reconcilable === 'true' || account.reconcilable === '1' || account.lettrable === 'true' || account.lettrable === '1' || false,
          });

          if (error) {
            errors.push(`Compte ${account.code}: ${error.message}`);
          } else {
            successCount++;
          }
        } catch (err: any) {
          errors.push(`Compte ${account.code}: ${err.message || 'Erreur inconnue'}`);
        }
      }

      setResult({ success: successCount, errors });

      if (successCount > 0) {
        toast.success(`${successCount} compte(s) importé(s) avec succès`);
        if (errors.length === 0) {
          setTimeout(() => onSuccess(), 1500);
        }
      }

      if (errors.length > 0) {
        toast.error(`${errors.length} erreur(s) lors de l'import`);
      }
    } catch (error) {
      console.error("Error importing accounts:", error);
      toast.error("Erreur lors de l'import du fichier");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    const template = `code,name,type,reconcilable
10,CAPITAUX PROPRES ET RESSOURCES ASSIMILEES,equity,false
101000,Capital social,equity,false
106000,Réserves,equity,false
110000,Report à nouveau,equity,false
120000,Résultat de l'exercice,equity,false
13,EMPRUNTS ET DETTES ASSIMILEES,liability,false
161000,Emprunts et dettes auprès des établissements de crédit,liability,false
164000,Emprunts et dettes auprès de l'Etat,liability,false
165000,Dépôts et cautionnements reçus,liability,false
20,CHARGES IMMOBILISEES,asset,false
201000,Frais de développement,asset,false
206000,Logiciels et sites internet,asset,false
21,IMMOBILISATIONS INCORPORELLES,asset,false
211000,Frais de recherche et de développement,asset,false
213000,Brevets licences logiciels,asset,false
215000,Fonds commercial,asset,false
22,TERRAINS,asset,false
221000,Terrains nus,asset,false
222000,Terrains aménagés,asset,false
23,BATIMENTS INSTALLATIONS TECHNIQUES ET AGENCEMENTS,asset,false
231000,Bâtiments industriels,asset,false
232000,Bâtiments administratifs et commerciaux,asset,false
233000,Bâtiments d'habitation,asset,false
237000,Agencements et aménagements de bureaux,asset,false
24,MATERIEL,asset,false
241000,Matériel et outillage industriel et commercial,asset,false
244000,Matériel de bureau,asset,false
245000,Matériel de transport,asset,false
246000,Matériel informatique,asset,false
40,FOURNISSEURS ET COMPTES RATTACHES,payable,false
401000,Fournisseurs dettes en compte,payable,true
408000,Fournisseurs factures non parvenues,payable,false
409000,Fournisseurs débiteurs avances et acomptes versés,payable,true
41,CLIENTS ET COMPTES RATTACHES,receivable,false
411000,Clients,receivable,true
413000,Clients effets à recevoir,receivable,true
416000,Créances clients douteuses,receivable,true
418000,Clients produits à recevoir,receivable,false
419000,Clients créditeurs avances et acomptes reçus,receivable,true
42,PERSONNEL ET ORGANISMES SOCIAUX,liability,false
421000,Personnel avances et acomptes,liability,true
422000,Personnel rémunérations dues,liability,false
423000,Personnel oppositions sur salaires,liability,false
425000,Personnel provisions pour congés à payer,liability,false
427000,Personnel charges à payer,liability,false
431000,Sécurité sociale,liability,false
432000,Autres organismes sociaux,liability,false
44,ETAT ET COLLECTIVITES PUBLIQUES,liability,false
441000,Etat subventions à recevoir,asset,false
442000,Etat impôts et taxes recouvrables,asset,false
443000,Operations particulieres avec l'Etat,liability,false
445000,Etat TVA facturée,liability,false
445710,TVA collectée,liability,false
445800,TVA à régulariser,liability,false
446000,Etat autres impôts et taxes,liability,false
447000,Etat impôts retenus à la source,liability,false
448000,Etat charges à payer,liability,false
45,ORGANISMES INTERNATIONAUX,asset,false
451000,Organismes internationaux opérations particulières,asset,false
458000,Organismes internationaux charges à payer et produits à recevoir,asset,false
46,ASSOCIES ET GROUPE,liability,false
461000,Associés capital souscrit appelé non versé,receivable,true
465000,Associés comptes courants,liability,true
467000,Actionnaires capital souscrit non appelé,equity,false
47,DEBITEURS ET CREDITEURS DIVERS,asset,false
471000,Débiteurs divers,asset,true
472000,Créditeurs divers,liability,true
475000,Créances sur cessions d'immobilisations,asset,true
476000,Dettes sur acquisitions d'immobilisations,liability,true
50,TITRES DE PLACEMENT,asset,false
501000,Titres du Trésor et bons de caisse à court terme,asset,false
502000,Actions,asset,false
506000,Obligations,asset,false
51,BANQUES ETABLISSEMENTS FINANCIERS ET ASSIMILES,asset,false
511000,Valeurs à l'encaissement,asset,false
512000,Banques,asset,true
514000,Chèques postaux,asset,true
52,INSTRUMENTS DE TRESORERIE,asset,false
521000,Titres de placement à court terme,asset,false
53,CAISSE,asset,false
571000,Caisse siège social,asset,true
572000,Caisse succursale,asset,true
60,ACHATS ET VARIATIONS DE STOCKS,expense,false
601000,Achats de marchandises,expense,false
602000,Achats de matières premières et fournitures liées,expense,false
604000,Achats stockés de matières et fournitures consommables,expense,false
605000,Autres achats,expense,false
608000,Achats d'emballages,expense,false
61,TRANSPORTS,expense,false
611000,Transports sur ventes,expense,false
612000,Transports sur achats,expense,false
613000,Transports pour le compte de tiers,expense,false
614000,Transports du personnel,expense,false
618000,Autres frais de transport,expense,false
62,SERVICES EXTERIEURS A,expense,false
621000,Sous-traitance générale,expense,false
622000,Locations et charges locatives,expense,false
623000,Redevances de crédit-bail,expense,false
624000,Entretien réparations et maintenance,expense,false
625000,Primes d'assurances,expense,false
626000,Etudes recherches et documentation,expense,false
627000,Publicité publications et relations publiques,expense,false
628000,Frais de télécommunications,expense,false
63,SERVICES EXTERIEURS B,expense,false
631000,Frais bancaires,expense,false
632000,Rémunérations d'intermédiaires et de conseils,expense,false
633000,Frais de formation du personnel,expense,false
634000,Réceptions,expense,false
635000,Missions et déplacements,expense,false
637000,Redevances pour brevets licences logiciels,expense,false
64,IMPOTS ET TAXES,expense,false
641000,Impôts et taxes directs,expense,false
645000,Autres impôts et taxes,expense,false
646000,Droits d'enregistrement,expense,false
647000,Pénalités et amendes fiscales,expense,false
65,AUTRES CHARGES,expense,false
651000,Pertes sur créances clients,expense,false
658000,Charges diverses,expense,false
66,CHARGES DE PERSONNEL,expense,false
661000,Appointements salaires et commissions,expense,false
662000,Primes et gratifications,expense,false
663000,Congés payés,expense,false
664000,Charges sociales,expense,false
665000,Autres charges sociales,expense,false
67,FRAIS FINANCIERS ET CHARGES ASSIMILEES,expense,false
671000,Intérêts des emprunts,expense,false
672000,Intérêts dans loyers de crédit-bail,expense,false
673000,Escomptes accordés,expense,false
674000,Autres frais financiers,expense,false
676000,Pertes de change,expense,false
677000,Charges sur cession de titres de placement,expense,false
70,VENTES,income,false
701000,Ventes de marchandises,income,false
702000,Ventes de produits finis,income,false
703000,Ventes de produits intermédiaires,income,false
704000,Ventes de produits résiduels,income,false
706000,Services vendus,income,false
707000,Produits de négoce,income,false
71,SUBVENTIONS D'EXPLOITATION,income,false
711000,Subventions d'équilibre,income,false
712000,Subventions compensatrices,income,false
718000,Autres subventions d'exploitation,income,false
72,PRODUCTION IMMOBILISEE,income,false
721000,Immobilisations incorporelles,income,false
722000,Immobilisations corporelles,income,false
73,VARIATIONS DES STOCKS DE BIENS ET DE SERVICES PRODUITS,income,false
734000,Variations des stocks de produits en cours,income,false
735000,Variations des stocks de services en cours,income,false
74,PRESTATIONS FOURNIES,income,false
741000,Travaux,income,false
742000,Etudes,income,false
743000,Prestations de services,income,false
75,AUTRES PRODUITS,income,false
751000,Redevances pour brevets licences,income,false
752000,Revenus des immeubles non affectés aux activités professionnelles,income,false
753000,Jetons de présence,income,false
754000,Ristournes perçues des coopératives,income,false
758000,Produits divers,income,false
77,REVENUS FINANCIERS ET PRODUITS ASSIMILES,income,false
771000,Intérêts de prêts,income,false
772000,Revenus de participations,income,false
773000,Escomptes obtenus,income,false
776000,Gains de change,income,false
777000,Produits de cession de titres de placement,income,false`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plan_comptable_ohada_complet.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success("Template OHADA complet téléchargé");
  };

  return (
    <div className="space-y-4">
      <Alert>
        <FileText className="h-4 w-4" />
        <AlertDescription>
          Format CSV attendu: code, name, type, reconcilable
          <br />
          Types valides: asset, liability, equity, income, expense, receivable, payable
          <br />
          Le template inclut un plan comptable OHADA complet avec plus de 150 comptes.
          <br />
          <Button
            variant="link"
            className="h-auto p-0 text-xs"
            onClick={downloadTemplate}
          >
            Télécharger le modèle OHADA complet
          </Button>
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <Label htmlFor="csv-file">Fichier CSV</Label>
        <div className="flex gap-2">
          <Input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={isProcessing}
          />
        </div>
        {file && (
          <p className="text-sm text-muted-foreground">
            Fichier sélectionné: {file.name}
          </p>
        )}
      </div>

      {result && (
        <div className="space-y-2">
          {result.success > 0 && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                {result.success} compte(s) importé(s) avec succès
              </AlertDescription>
            </Alert>
          )}
          {result.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-1">Erreurs d'import:</div>
                <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                  {result.errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          onClick={downloadTemplate}
          disabled={isProcessing}
        >
          <FileText className="mr-2 h-4 w-4" />
          Télécharger modèle
        </Button>
        <Button
          onClick={handleImport}
          disabled={!file || isProcessing}
        >
          <Upload className="mr-2 h-4 w-4" />
          {isProcessing ? "Import en cours..." : "Importer"}
        </Button>
      </div>
    </div>
  );
}
