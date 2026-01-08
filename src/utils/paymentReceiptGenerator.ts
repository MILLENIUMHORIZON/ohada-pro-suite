import jsPDF from "jspdf";

type PaymentReceipt = {
  receipt_number: string;
  beneficiary: string;
  amount: number;
  currency: string;
  description: string;
  payment_date: string;
  cashier_name: string | null;
};

type Company = {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  nif?: string | null;
  rccm?: string | null;
  logo_url?: string | null;
};

export function generatePaymentReceipt(receipt: PaymentReceipt, company: Company) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a5",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 20;

  // Header - Company Info
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(company.name || "Entreprise", pageWidth / 2, y, { align: "center" });
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (company.address) {
    doc.text(company.address, pageWidth / 2, y, { align: "center" });
    y += 4;
  }
  if (company.phone) {
    doc.text(`Tél: ${company.phone}`, pageWidth / 2, y, { align: "center" });
    y += 4;
  }
  if (company.nif) {
    doc.text(`NIF: ${company.nif}`, pageWidth / 2, y, { align: "center" });
    y += 4;
  }

  y += 8;

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("REÇU DE PAIEMENT", pageWidth / 2, y, { align: "center" });
  y += 4;

  // Receipt Number
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`N° ${receipt.receipt_number}`, pageWidth / 2, y, { align: "center" });
  y += 10;

  // Horizontal line
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Receipt Details
  const labelX = margin;
  const valueX = margin + 45;

  doc.setFontSize(10);
  
  // Date
  doc.setFont("helvetica", "bold");
  doc.text("Date:", labelX, y);
  doc.setFont("helvetica", "normal");
  doc.text(new Date(receipt.payment_date).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }), valueX, y);
  y += 7;

  // Beneficiary
  doc.setFont("helvetica", "bold");
  doc.text("Bénéficiaire:", labelX, y);
  doc.setFont("helvetica", "normal");
  doc.text(receipt.beneficiary, valueX, y);
  y += 7;

  // Amount
  doc.setFont("helvetica", "bold");
  doc.text("Montant:", labelX, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const formattedAmount = new Intl.NumberFormat("fr-CD", {
    style: "currency",
    currency: receipt.currency === "CDF" ? "CDF" : "USD",
  }).format(receipt.amount);
  doc.text(formattedAmount, valueX, y);
  doc.setFontSize(10);
  y += 10;

  // Description
  doc.setFont("helvetica", "bold");
  doc.text("Motif:", labelX, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  
  // Handle multiline description
  const splitDescription = doc.splitTextToSize(receipt.description, pageWidth - margin * 2);
  doc.text(splitDescription, labelX, y);
  y += splitDescription.length * 5 + 5;

  // Horizontal line
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Cashier signature area
  doc.setFont("helvetica", "normal");
  doc.text("Le Caissier:", labelX, y);
  y += 7;
  doc.setFont("helvetica", "italic");
  doc.text(receipt.cashier_name || "_______________", labelX, y);
  y += 15;

  // Signature line
  doc.text("Signature: _____________________", labelX, y);
  y += 15;

  // Footer
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text(
    "Ce reçu atteste du paiement effectué. Conservez-le précieusement.",
    pageWidth / 2,
    y,
    { align: "center" }
  );

  // Save PDF
  doc.save(`Recu_${receipt.receipt_number}.pdf`);
}
