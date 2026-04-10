import { format } from 'date-fns'

interface ReceiptItem {
  name: string
  qty: number
  total: number
}

interface ReceiptData {
  orderNumber?: string
  date: Date
  cashier?: string
  source?: string
  items: ReceiptItem[]
  subtotal: number
  commission?: number
  vatOnCommission?: number
  total: number
  customerName?: string
  paymentMethod?: string
  plateNumber?: string
}

export function printReceipt(data: ReceiptData) {
  const win = window.open('', '_blank', 'width=560,height=750')
  if (!win) return

  const itemRows = data.items.map(item =>
    `<tr>
      <td style="text-align:left">${item.name}</td>
      <td style="text-align:center">x${item.qty}</td>
      <td style="text-align:right">${item.total.toFixed(2)}</td>
    </tr>`
  ).join('')

  win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt Preview</title>
<style>
  /* ── Screen: preview mode ── */
  @media screen {
    body {
      background: #e8e8e8;
      margin: 0;
      padding: 0;
      min-height: 100vh;
    }
    .toolbar {
      position: fixed;
      top: 0; left: 0; right: 0;
      background: #1a1a2e;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 100;
      box-shadow: 0 2px 10px rgba(0,0,0,0.4);
    }
    .toolbar-title {
      color: #fff;
      font-family: Arial, sans-serif;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .toolbar-buttons { display: flex; gap: 10px; }
    .btn-close {
      background: transparent;
      color: #ccc;
      border: 1px solid #555;
      padding: 9px 18px;
      border-radius: 6px;
      font-size: 14px;
      font-family: Arial, sans-serif;
      cursor: pointer;
    }
    .btn-close:hover { background: #333; color: #fff; }
    .btn-print {
      background: #2ecc71;
      color: #fff;
      border: none;
      padding: 9px 24px;
      border-radius: 6px;
      font-size: 15px;
      font-weight: 700;
      font-family: Arial, sans-serif;
      cursor: pointer;
      letter-spacing: 0.5px;
    }
    .btn-print:hover { background: #27ae60; }
    .preview-container {
      margin-top: 65px;
      padding: 30px 20px 40px;
      display: flex;
      justify-content: center;
    }
    .receipt-card {
      background: #fff;
      width: 80mm;
      padding: 4mm;
      box-shadow: 0 6px 24px rgba(0,0,0,0.18);
      border-radius: 4px;
    }
  }

  /* ── Print: receipt only ── */
  @page { size: 80mm auto; margin: 0; }
  @media print {
    .toolbar { display: none !important; }
    .preview-container { margin: 0; padding: 0; }
    .receipt-card { box-shadow: none; border-radius: 0; width: 80mm; padding: 4mm; }
    body { background: #fff; }
  }

  /* ── Receipt styles (shared) ── */
  * { margin: 0; padding: 0; box-sizing: border-box; }
  .receipt-card {
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: #000;
  }
  .center { text-align: center; }
  .right { text-align: right; }
  .logo { font-size: 20px; font-weight: bold; letter-spacing: 2px; margin-bottom: 2px; }
  .sub { font-size: 13px; color: #000; }
  .line { border-top: 1px dashed #000; margin: 4px 0; }
  .double-line { border-top: 2px solid #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; font-size: 14px; }
  .total-row td { font-size: 16px; font-weight: bold; padding-top: 4px; }
  .info { font-size: 13px; }
  .footer { font-size: 13px; color: #000; margin-top: 8px; }
</style>
</head>
<body>

  <!-- Toolbar -->
  <div class="toolbar">
    <span class="toolbar-title">Receipt Preview</span>
    <div class="toolbar-buttons">
      <button class="btn-close" onclick="window.close()">&#10005; Close</button>
      <button class="btn-print" onclick="window.print()">&#128438; Print</button>
    </div>
  </div>

  <!-- Receipt preview -->
  <div class="preview-container">
    <div class="receipt-card">

      <!-- Header -->
      <div class="center">
        <div class="logo">SHEEN SPECIALITY COFFEE</div>
        <div class="sub">0557306030</div>
        <div class="sub">sheencafe.ae</div>
      </div>

      <div class="line"></div>

      <!-- Order info -->
      <div class="info">
        <table>
          <tr>
            <td>Date:</td>
            <td class="right">${format(data.date, 'dd MMM yyyy hh:mm a')}</td>
          </tr>
          ${data.orderNumber ? `<tr><td>Order #:</td><td class="right">${data.orderNumber}</td></tr>` : ''}
          ${data.cashier ? `<tr><td>Cashier:</td><td class="right">${data.cashier}</td></tr>` : ''}
          ${data.source && data.source !== 'POS' ? `<tr><td>Source:</td><td class="right">${data.source}</td></tr>` : ''}
          ${data.customerName ? `<tr><td>Customer:</td><td class="right">${data.customerName}</td></tr>` : ''}
          ${data.paymentMethod ? `<tr><td>Payment:</td><td class="right">${data.paymentMethod}</td></tr>` : ''}
          ${data.plateNumber ? `<tr><td>Plate #:</td><td class="right"><strong>${data.plateNumber}</strong></td></tr>` : ''}
        </table>
      </div>

      <div class="double-line"></div>

      <!-- Items -->
      <table>
        <tr style="font-size:13px">
          <td>Item</td>
          <td style="text-align:center">Qty</td>
          <td style="text-align:right">AED</td>
        </tr>
        ${itemRows}
      </table>

      <div class="double-line"></div>

      <!-- Totals -->
      <table>
        <tr>
          <td>Subtotal:</td>
          <td class="right">${data.subtotal.toFixed(2)}</td>
        </tr>
        ${data.commission && data.commission > 0 ? `
        <tr style="font-size:12px;color:#444">
          <td>Commission:</td>
          <td class="right">-${data.commission.toFixed(2)}</td>
        </tr>` : ''}
        ${data.vatOnCommission && data.vatOnCommission > 0 ? `
        <tr style="font-size:12px;color:#444">
          <td>VAT on comm:</td>
          <td class="right">-${data.vatOnCommission.toFixed(2)}</td>
        </tr>` : ''}
        <tr class="total-row">
          <td>TOTAL:</td>
          <td class="right">${data.total.toFixed(2)} AED</td>
        </tr>
      </table>

      <div class="line"></div>

      <!-- Footer -->
      <div class="center footer">
        <p>Thank you for visiting!</p>
        <p>@SheenCafe</p>
      </div>

      <div style="margin-bottom: 10mm;"></div>

    </div>
  </div>

</body>
</html>`)
  win.document.close()
}
