import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  subtotal: number;
}

interface InvoiceData {
  number: string;
  date: string;
  dueDate: string;
  partner: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    nif?: string;
  };
  company: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    nif?: string;
    rccm?: string;
    logoUrl?: string;
  };
  lines: InvoiceLine[];
  totalHT: number;
  totalTax: number;
  totalTTC: number;
  currency: string;
  notes?: string;
  dgi_uid?: string;
  dgi_qrcode?: string;
  dgi_normalization_data?: any;
}

export function generateInvoicePDF(invoice: InvoiceData, action: 'download' | 'print' = 'download') {
  const doc = new jsPDF();
  
  let startY = 20;

  // Add logo if available
  if (invoice.company.logoUrl) {
    try {
      doc.addImage(invoice.company.logoUrl, 'PNG', 20, startY, 30, 30);
      startY = 55;
    } catch (error) {
      console.error("Error adding logo to PDF:", error);
      startY = 20;
    }
  }
  
  // Header - Company Info
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.company.name, invoice.company.logoUrl ? 55 : 20, invoice.company.logoUrl ? 25 : 20);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  let yPos = invoice.company.logoUrl ? 33 : 28;
  
  if (invoice.company.address) {
    doc.text(invoice.company.address, invoice.company.logoUrl ? 55 : 20, yPos);
    yPos += 5;
  }
  if (invoice.company.phone) {
    doc.text(`Tél: ${invoice.company.phone}`, invoice.company.logoUrl ? 55 : 20, yPos);
    yPos += 5;
  }
  if (invoice.company.email) {
    doc.text(`Email: ${invoice.company.email}`, invoice.company.logoUrl ? 55 : 20, yPos);
    yPos += 5;
  }
  if (invoice.company.nif) {
    doc.text(`NIF: ${invoice.company.nif}`, invoice.company.logoUrl ? 55 : 20, yPos);
    yPos += 5;
  }
  if (invoice.company.rccm) {
    doc.text(`RCCM: ${invoice.company.rccm}`, invoice.company.logoUrl ? 55 : 20, yPos);
    yPos += 5;
  }

  // Invoice Title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURE', 150, 20);
  
  // Invoice Number and Dates
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`N° ${invoice.number}`, 150, 30);
  doc.text(`Date: ${new Date(invoice.date).toLocaleDateString('fr-FR')}`, 150, 36);
  doc.text(`Échéance: ${new Date(invoice.dueDate).toLocaleDateString('fr-FR')}`, 150, 42);

  // Customer Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Facturé à:', 20, 60);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  yPos = 68;
  doc.text(invoice.partner.name, 20, yPos);
  yPos += 6;
  
  if (invoice.partner.address) {
    doc.text(invoice.partner.address, 20, yPos);
    yPos += 5;
  }
  if (invoice.partner.phone) {
    doc.text(`Tél: ${invoice.partner.phone}`, 20, yPos);
    yPos += 5;
  }
  if (invoice.partner.email) {
    doc.text(`Email: ${invoice.partner.email}`, 20, yPos);
    yPos += 5;
  }
  if (invoice.partner.nif) {
    doc.text(`NIF: ${invoice.partner.nif}`, 20, yPos);
    yPos += 5;
  }

  // Invoice Lines Table
  const tableStartY = Math.max(yPos + 10, 95);
  
  const tableData = invoice.lines.map(line => [
    line.description,
    line.quantity.toString(),
    `${formatNumber(line.unitPrice)} ${invoice.currency}`,
    `${line.taxRate}%`,
    `${formatNumber(line.subtotal)} ${invoice.currency}`,
  ]);

  autoTable(doc, {
    startY: tableStartY,
    head: [['Description', 'Qté', 'Prix Unit.', 'TVA', 'Total']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 40, halign: 'right' },
    },
    styles: {
      fontSize: 9,
    },
  });

  // Totals
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const rightX = 150;
  const amountX = 180;
  
  doc.text('Total HT:', rightX, finalY);
  doc.text(`${formatNumber(invoice.totalHT)} ${invoice.currency}`, amountX, finalY, { align: 'right' });
  
  doc.text('Total TVA:', rightX, finalY + 6);
  doc.text(`${formatNumber(invoice.totalTax)} ${invoice.currency}`, amountX, finalY + 6, { align: 'right' });
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total TTC:', rightX, finalY + 14);
  doc.text(`${formatNumber(invoice.totalTTC)} ${invoice.currency}`, amountX, finalY + 14, { align: 'right' });

  // Notes
  if (invoice.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Notes:', 20, finalY + 30);
    const splitNotes = doc.splitTextToSize(invoice.notes, 170);
    doc.text(splitNotes, 20, finalY + 36);
  }

  // Add QR code if available (normalized by DGI)
  if (invoice.dgi_qrcode) {
    const qrCodeY = finalY + 30;
    try {
      // The QR code is in base64 format from DGI
      const qrCodeImage = invoice.dgi_qrcode.startsWith('data:image')
        ? invoice.dgi_qrcode
        : `data:image/png;base64,${invoice.dgi_qrcode}`;
      
      doc.addImage(qrCodeImage, 'PNG', 20, qrCodeY, 40, 40);
      
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('QR Code DGI', 20, qrCodeY + 45);
      if (invoice.dgi_uid) {
        doc.text(`UID: ${invoice.dgi_uid}`, 20, qrCodeY + 50);
      }
    } catch (error) {
      console.error('Error adding QR code to PDF:', error);
    }
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text('Merci pour votre confiance', 105, 280, { align: 'center' });

  // Action
  if (action === 'download') {
    doc.save(`Facture_${invoice.number}.pdf`);
  } else {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  }
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}
