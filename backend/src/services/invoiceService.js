
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const INVOICES_DIR = path.resolve(__dirname, '../../invoices');
if (!fs.existsSync(INVOICES_DIR)) fs.mkdirSync(INVOICES_DIR, { recursive: true });

const TAX_RATE = 0.05; // 5% - flat illustrative tax rate for a student project

function generateInvoiceNumber(bookingId) {
  const ts = Date.now().toString().slice(-6);
  return `INV-${String(bookingId).padStart(5, '0')}-${ts}`;
}

/**
 * Generates a PDF invoice on disk and returns metadata for saving to DB.
 */
async function generateInvoicePdf({ booking, station, user, energyKwh, pricePerKwh, payment, block, includeBlockchain = false }) {
  const subtotal = Number((energyKwh * pricePerKwh).toFixed(2));
  const taxAmount = Number((subtotal * TAX_RATE).toFixed(2));
  const total = Number((subtotal + taxAmount).toFixed(2));
  const invoiceNumber = generateInvoiceNumber(booking.id);
  const fileName = `${invoiceNumber}.pdf`;
  const filePath = path.join(INVOICES_DIR, fileName);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // Header
  doc.fontSize(22).fillColor('#0f766e').text('Smart EV Charging Platform', { align: 'left' });
  doc.fontSize(10).fillColor('#555').text('Tax Invoice / Receipt', { align: 'left' });
  doc.moveDown(1);
  doc.strokeColor('#0f766e').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);

  doc.fillColor('#111').fontSize(12);
  doc.text(`Invoice Number: ${invoiceNumber}`);
  doc.text(`Date: ${new Date().toLocaleString()}`);
  doc.moveDown(0.5);
  doc.text(`Billed To: ${user.name} (${user.email})`);
  doc.moveDown(1);

  doc.fontSize(13).fillColor('#0f766e').text('Charging Station Details');
  doc.fontSize(11).fillColor('#111');
  doc.text(`Station: ${station.name}`);
  doc.text(`Network: ${station.network || 'Independent'}`);
  doc.text(`Address: ${station.address}, ${station.city}`);
  doc.moveDown(1);

  doc.fontSize(13).fillColor('#0f766e').text('Session Summary');
  doc.fontSize(11).fillColor('#111');
  doc.text(`Booking ID: #${booking.id}`);
  doc.text(`Slot: ${new Date(booking.slotStart).toLocaleString()} - ${new Date(booking.slotEnd).toLocaleString()}`);
  doc.text(`Battery: ${booking.startBatteryPercent}% -> ${booking.targetBatteryPercent}%`);
  doc.moveDown(1);

  // Billing table (simple manual layout)
  const tableTop = doc.y;
  doc.fontSize(11).fillColor('#0f766e');
  doc.text('Description', 50, tableTop);
  doc.text('Qty (kWh)', 260, tableTop);
  doc.text('Rate (₹/kWh)', 360, tableTop);
  doc.text('Amount (₹)', 470, tableTop);
  doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

  const rowY = tableTop + 25;
  doc.fillColor('#111');
  doc.text('EV Charging - Energy Delivered', 50, rowY);
  doc.text(`${energyKwh}`, 260, rowY);
  doc.text(`${pricePerKwh}`, 360, rowY);
  doc.text(`${subtotal}`, 470, rowY);

  const y2 = rowY + 30;
  doc.text('Subtotal', 360, y2);
  doc.text(`₹ ${subtotal}`, 470, y2);
  doc.text(`Tax (${TAX_RATE * 100}%)`, 360, y2 + 18);
  doc.text(`₹ ${taxAmount}`, 470, y2 + 18);
  doc.fontSize(12).fillColor('#0f766e');
  doc.text('Total', 360, y2 + 40);
  doc.text(`₹ ${total}`, 470, y2 + 40);

  if (payment) {
    doc.moveDown(1.2);
    const recordTop = doc.y;
    const recordHeight = includeBlockchain && block ? 132 : 86;
    doc.roundedRect(50, recordTop, 495, recordHeight, 8)
      .fillAndStroke('#f0fdfa', '#99f6e4');
    doc.fontSize(13).fillColor('#0f766e').text(includeBlockchain && block ? 'Payment & Blockchain Record' : 'Payment Details', 64, recordTop + 12);
    doc.fontSize(9.5).fillColor('#111');
    doc.text('Payment gateway', 64, recordTop + 36);
    doc.text(`${payment.gateway || 'ChargeIQ DemoPay'} (demo)`, 220, recordTop + 36, { width: 300 });
    doc.text('Card', 64, recordTop + 52);
    doc.text(`${payment.cardBrand || ''} ${payment.maskedCard || ''}`, 220, recordTop + 52, { width: 300 });
    doc.text('Transaction ID', 64, recordTop + 68);
    doc.text(payment.transactionId || 'N/A', 220, recordTop + 68, { width: 300 });
    if (includeBlockchain && block) {
      doc.text('Ledger block', 64, recordTop + 84);
      doc.text(`#${block.index}`, 220, recordTop + 84, { width: 300 });
      doc.text('Block hash', 64, recordTop + 100);
      doc.fontSize(8).text(String(block.hash || 'N/A'), 220, recordTop + 100, { width: 300 });
    }
    doc.y = recordTop + recordHeight;
  }

  doc.moveDown(1);
  doc.fontSize(9).fillColor('#888').text(
    includeBlockchain
      ? 'This is a system-generated invoice for your charging session. Payment and blockchain details above are recorded by a simulated demo gateway/ledger built for this academic project - no real currency was transferred.'
      : 'This is a system-generated invoice for your charging session. No real currency was transferred.',
    50, doc.y, { width: 495, align: 'center' }
  );

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return { invoiceNumber, fileName, filePath, subtotal, taxAmount, total };
}

module.exports = { generateInvoicePdf, INVOICES_DIR };
