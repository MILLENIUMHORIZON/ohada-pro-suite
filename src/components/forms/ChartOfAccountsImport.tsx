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

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const accounts = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length === headers.length) {
        const account: any = {};
        headers.forEach((header, index) => {
          account[header] = values[index];
        });
        accounts.push(account);
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

      // Import accounts one by one
      for (const account of accounts) {
        try {
          const { error } = await supabase.from("accounts").insert({
            company_id: profile.company_id,
            code: account.code,
            name: account.name || account.nom,
            type: account.type,
            reconcilable: account.reconcilable === 'true' || account.reconcilable === '1' || account.lettrable === 'true' || account.lettrable === '1',
          });

          if (error) {
            errors.push(`Compte ${account.code}: ${error.message}`);
          } else {
            successCount++;
          }
        } catch (err) {
          errors.push(`Compte ${account.code}: Erreur inconnue`);
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
101,Caisse,asset,false
411,Clients,receivable,true
512,Banque,asset,true
601,Achats de marchandises,expense,false
701,Ventes de marchandises,income,false`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plan_comptable_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
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
          <Button
            variant="link"
            className="h-auto p-0 text-xs"
            onClick={downloadTemplate}
          >
            Télécharger un modèle
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
