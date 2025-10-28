import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface AgedBalanceItem {
  partner_name: string;
  partner_code: string;
  current: number;
  days_1_30: number;
  days_31_60: number;
  days_61_90: number;
  over_90: number;
  total: number;
}

export function BalanceAgee() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<AgedBalanceItem[]>([]);
  const [suppliers, setSuppliers] = useState<AgedBalanceItem[]>([]);

  useEffect(() => {
    loadBalanceAgee();
  }, []);

  const loadBalanceAgee = async () => {
    setLoading(true);
    try {
      const today = new Date();

      // Get customer invoices
      const { data: customerInvoices } = await supabase
        .from("invoices")
        .select(`
          id,
          date,
          due_date,
          total_ttc,
          amount_paid,
          partner:partners(id, name, account:accounts(code))
        `)
        .eq("type", "customer")
        .neq("status", "paid");

      // Get supplier invoices
      const { data: supplierInvoices } = await supabase
        .from("invoices")
        .select(`
          id,
          date,
          due_date,
          total_ttc,
          amount_paid,
          partner:partners(id, name, account:accounts(code))
        `)
        .eq("type", "vendor")
        .neq("status", "paid");

      const processInvoices = (invoices: any[]): AgedBalanceItem[] => {
        const partnerMap = new Map<string, AgedBalanceItem>();

        invoices?.forEach((invoice: any) => {
          const partner = invoice.partner;
          if (!partner) return;

          const balance = Number(invoice.total_ttc || 0) - Number(invoice.amount_paid || 0);
          if (balance <= 0) return;

          const dueDate = invoice.due_date ? new Date(invoice.due_date) : new Date(invoice.date);
          const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

          if (!partnerMap.has(partner.id)) {
            partnerMap.set(partner.id, {
              partner_name: partner.name,
              partner_code: partner.account?.code || "",
              current: 0,
              days_1_30: 0,
              days_31_60: 0,
              days_61_90: 0,
              over_90: 0,
              total: 0,
            });
          }

          const item = partnerMap.get(partner.id)!;

          if (daysOverdue < 0) {
            item.current += balance;
          } else if (daysOverdue <= 30) {
            item.days_1_30 += balance;
          } else if (daysOverdue <= 60) {
            item.days_31_60 += balance;
          } else if (daysOverdue <= 90) {
            item.days_61_90 += balance;
          } else {
            item.over_90 += balance;
          }

          item.total += balance;
        });

        return Array.from(partnerMap.values()).sort((a, b) => b.total - a.total);
      };

      setCustomers(processInvoices(customerInvoices || []));
      setSuppliers(processInvoices(supplierInvoices || []));
    } catch (error) {
      console.error("Error loading balance agee:", error);
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

  const downloadCSV = (type: "customers" | "suppliers") => {
    const data = type === "customers" ? customers : suppliers;
    const headers = ["Code", "Nom", "À échoir", "1-30j", "31-60j", "61-90j", "+90j", "Total"];
    const rows = data.map((item) => [
      item.partner_code,
      item.partner_name,
      formatAmount(item.current),
      formatAmount(item.days_1_30),
      formatAmount(item.days_31_60),
      formatAmount(item.days_61_90),
      formatAmount(item.over_90),
      formatAmount(item.total),
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `balance_agee_${type}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderTable = (data: AgedBalanceItem[], type: "customers" | "suppliers") => {
    const totals = data.reduce(
      (acc, item) => ({
        current: acc.current + item.current,
        days_1_30: acc.days_1_30 + item.days_1_30,
        days_31_60: acc.days_31_60 + item.days_31_60,
        days_61_90: acc.days_61_90 + item.days_61_90,
        over_90: acc.over_90 + item.over_90,
        total: acc.total + item.total,
      }),
      { current: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, over_90: 0, total: 0 }
    );

    return (
      <>
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {data.length} {type === "customers" ? "clients" : "fournisseurs"} avec soldes impayés
            </p>
          </div>
          <Button onClick={() => downloadCSV(type)} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Télécharger CSV
          </Button>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead className="text-right">À échoir</TableHead>
                <TableHead className="text-right">1-30 jours</TableHead>
                <TableHead className="text-right">31-60 jours</TableHead>
                <TableHead className="text-right">61-90 jours</TableHead>
                <TableHead className="text-right">+90 jours</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Aucun solde impayé
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {data.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono">{item.partner_code}</TableCell>
                      <TableCell>{item.partner_name}</TableCell>
                      <TableCell className="text-right font-mono">
                        {item.current > 0 ? formatAmount(item.current) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.days_1_30 > 0 ? (
                          <span className="text-yellow-600">{formatAmount(item.days_1_30)}</span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.days_31_60 > 0 ? (
                          <span className="text-orange-600">{formatAmount(item.days_31_60)}</span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.days_61_90 > 0 ? (
                          <span className="text-red-600">{formatAmount(item.days_61_90)}</span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.over_90 > 0 ? (
                          <span className="text-red-800 font-bold">{formatAmount(item.over_90)}</span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatAmount(item.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell colSpan={2}>TOTAUX</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(totals.current)}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(totals.days_1_30)}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(totals.days_31_60)}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(totals.days_61_90)}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(totals.over_90)}</TableCell>
                    <TableCell className="text-right font-mono text-lg">{formatAmount(totals.total)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Balance Âgée</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">Créances clients et dettes fournisseurs par ancienneté</p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="customers" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="customers">
              Clients
              {customers.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {customers.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="suppliers">
              Fournisseurs
              {suppliers.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {suppliers.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="customers">{renderTable(customers, "customers")}</TabsContent>
          <TabsContent value="suppliers">{renderTable(suppliers, "suppliers")}</TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
