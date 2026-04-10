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
}

export function printReceipt(data: ReceiptData) {
  const win = window.open('', '_blank', 'width=320,height=600')
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
<style>
  @page { size: 80mm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 80mm;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    color: #000;
    padding: 4mm;
  }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .logo { font-size: 20px; font-weight: bold; letter-spacing: 3px; margin-bottom: 2px; }
  .sub { font-size: 10px; color: #555; }
  .line { border-top: 1px dashed #000; margin: 4px 0; }
  .double-line { border-top: 2px solid #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; font-size: 12px; }
  .total-row td { font-size: 14px; font-weight: bold; padding-top: 4px; }
  .info { font-size: 10px; }
  .footer { font-size: 9px; color: #555; margin-top: 8px; }
  @media print {
    body { width: 80mm; }
  }
</style>
</head>
<body>
  <!-- Header -->
  <div class="center">
    <div class="logo">SHEEN</div>
    <div class="sub">Coffee Shop</div>
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
    </table>
  </div>

  <div class="double-line"></div>

  <!-- Items -->
  <table>
    <tr class="bold" style="font-size:11px">
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
    <tr style="font-size:10px;color:#666">
      <td>Commission:</td>
      <td class="right">-${data.commission.toFixed(2)}</td>
    </tr>` : ''}
    ${data.vatOnCommission && data.vatOnCommission > 0 ? `
    <tr style="font-size:10px;color:#666">
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
</body>
</html>`)
  win.document.close()
  setTimeout(() => { win.print() }, 300)
}
