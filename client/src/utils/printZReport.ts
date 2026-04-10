import { format } from 'date-fns'
import type { Sale, SaleItem } from '../types'

type SaleWithItems = Sale & { sale_items?: SaleItem[] }

export function printZReport(sales: SaleWithItems[], date: Date) {
  const win = window.open('', '_blank', 'width=560,height=900')
  if (!win) return

  const dateStr = format(date, 'dd/MM/yyyy')
  const timeStr = format(new Date(), 'hh:mm:ss a')
  const reportNum = sales.length

  // ── Sales by source ──
  const bySource: Record<string, number> = {}
  for (const sale of sales) {
    const src = sale.recorded_by || 'POS'
    bySource[src] = (bySource[src] ?? 0) + Number(sale.total_revenue)
  }
  const grandTotal = Object.values(bySource).reduce((s, v) => s + v, 0)

  // ── Items by category ──
  const byCategory: Record<string, number> = {}
  const byProduct: Record<string, number> = {}
  for (const sale of sales) {
    for (const item of sale.sale_items ?? []) {
      byCategory[item.category] = (byCategory[item.category] ?? 0) + item.qty
      byProduct[item.name] = (byProduct[item.name] ?? 0) + item.qty
    }
  }
  const totalItems = Object.values(byProduct).reduce((s, v) => s + v, 0)

  const sourceRows = Object.entries(bySource)
    .map(([src, amt]) => `
      <tr>
        <td>${src}</td>
        <td class="right">AED ${amt.toFixed(2)}</td>
      </tr>`)
    .join('')

  const categoryRows = Object.entries(byCategory)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cat, qty]) => `
      <tr>
        <td>${cat}</td>
        <td class="right">${qty}</td>
      </tr>`)
    .join('')

  const productRows = Object.entries(byProduct)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, qty]) => `
      <tr>
        <td>${name}</td>
        <td class="right">${qty}</td>
      </tr>`)
    .join('')

  win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>End of Day Report</title>
<style>
  @media screen {
    body { background: #e8e8e8; margin: 0; padding: 0; min-height: 100vh; }
    .toolbar {
      position: fixed; top: 0; left: 0; right: 0;
      background: #1a1a2e; padding: 12px 20px;
      display: flex; align-items: center; justify-content: space-between;
      z-index: 100; box-shadow: 0 2px 10px rgba(0,0,0,0.4);
    }
    .toolbar-title { color: #fff; font-family: Arial, sans-serif; font-size: 15px; font-weight: 600; }
    .toolbar-buttons { display: flex; gap: 10px; }
    .btn-close {
      background: transparent; color: #ccc; border: 1px solid #555;
      padding: 9px 18px; border-radius: 6px; font-size: 14px;
      font-family: Arial, sans-serif; cursor: pointer;
    }
    .btn-close:hover { background: #333; color: #fff; }
    .btn-print {
      background: #2ecc71; color: #fff; border: none;
      padding: 9px 24px; border-radius: 6px; font-size: 15px;
      font-weight: 700; font-family: Arial, sans-serif; cursor: pointer;
    }
    .btn-print:hover { background: #27ae60; }
    .preview-container { margin-top: 65px; padding: 30px 20px 40px; display: flex; flex-direction: column; align-items: center; gap: 24px; }
    .receipt-card {
      background: #fff; width: 80mm; padding: 4mm;
      box-shadow: 0 6px 24px rgba(0,0,0,0.18); border-radius: 4px;
    }
  }
  @page { size: 80mm auto; margin: 0; }
  @media print {
    .toolbar { display: none !important; }
    .preview-container { margin: 0; padding: 0; gap: 0; }
    .receipt-card { box-shadow: none; border-radius: 0; width: 80mm; padding: 4mm; page-break-after: always; }
    .receipt-card:last-child { page-break-after: avoid; }
    body { background: #fff; }
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  .receipt-card { font-family: Arial, sans-serif; font-size: 13px; color: #000; }
  .center { text-align: center; }
  .right { text-align: right; }
  .logo { font-size: 18px; font-weight: bold; letter-spacing: 2px; margin-bottom: 2px; }
  .sub { font-size: 12px; color: #000; }
  .report-title { font-size: 16px; font-weight: bold; margin: 6px 0 4px; }
  .line { border-top: 1px dashed #000; margin: 4px 0; }
  .double-line { border-top: 2px solid #000; margin: 4px 0; }
  .section-title { font-size: 12px; font-weight: bold; margin: 4px 0 2px; text-transform: uppercase; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; font-size: 13px; }
  .total-row td { font-weight: bold; font-size: 14px; border-top: 1px solid #000; padding-top: 3px; margin-top: 2px; }
  .info { font-size: 12px; }
  .footer { font-size: 12px; color: #000; margin-top: 8px; }
</style>
</head>
<body>

  <div class="toolbar">
    <span class="toolbar-title">End of Day Report</span>
    <div class="toolbar-buttons">
      <button class="btn-close" onclick="window.close()">&#10005; Close</button>
      <button class="btn-print" onclick="window.print()">&#128438; Print</button>
    </div>
  </div>

  <div class="preview-container">

    <!-- ── Z REPORT ── -->
    <div class="receipt-card">
      <div class="center">
        <div class="logo">SHEEN SPECIALITY COFFEE</div>
        <div class="sub">0557306030</div>
        <div class="sub">sheencafe.ae</div>
      </div>

      <div class="line"></div>

      <div class="center">
        <div class="report-title">Z REPORT</div>
      </div>

      <div class="info">
        <table>
          <tr><td>Date:</td><td class="right">${dateStr}</td></tr>
          <tr><td>Time:</td><td class="right">${timeStr}</td></tr>
          <tr><td>Report #:</td><td class="right">${reportNum}</td></tr>
        </table>
      </div>

      <div class="line"></div>

      <div class="section-title">User Sales</div>
      <table>
        ${sourceRows}
        <tr class="total-row">
          <td>= Total</td>
          <td class="right">AED ${grandTotal.toFixed(2)}</td>
        </tr>
      </table>

      <div class="line"></div>

      <div class="section-title">Tender Types</div>
      <table>
        ${sourceRows}
        <tr><td>Total tendered</td><td class="right">AED ${grandTotal.toFixed(2)}</td></tr>
        <tr><td>Total returns</td><td class="right">AED 0.00</td></tr>
        <tr><td>Discounts granted</td><td class="right">AED 0.00</td></tr>
        <tr><td>Taxable total</td><td class="right">AED ${grandTotal.toFixed(2)}</td></tr>
        <tr><td>Tax</td><td class="right">AED 0.00</td></tr>
        <tr class="total-row"><td>Total</td><td class="right">AED ${grandTotal.toFixed(2)}</td></tr>
      </table>

      <div class="line"></div>
      <div class="center footer"><p>@SheenCafe</p></div>
      <div style="margin-bottom:8mm"></div>
    </div>

    <!-- ── ITEMS REPORT ── -->
    <div class="receipt-card">
      <div class="center">
        <div class="logo">SHEEN SPECIALITY COFFEE</div>
        <div class="sub">0557306030</div>
        <div class="sub">sheencafe.ae</div>
      </div>

      <div class="line"></div>

      <div class="center">
        <div class="report-title">ITEMS REPORT</div>
      </div>

      <div class="info">
        <table>
          <tr><td>Date:</td><td class="right">${dateStr}</td></tr>
          <tr><td>Time:</td><td class="right">${timeStr}</td></tr>
          <tr><td>Report #:</td><td class="right">${reportNum}</td></tr>
        </table>
      </div>

      <div class="line"></div>

      <div class="section-title">Product Groups</div>
      <table>${categoryRows}</table>

      <div class="line"></div>

      <div class="section-title">Products</div>
      <table>
        ${productRows}
        <tr class="total-row">
          <td>Items count:</td>
          <td class="right">${totalItems}</td>
        </tr>
      </table>

      <div class="line"></div>
      <div class="center footer"><p>@SheenCafe</p></div>
      <div style="margin-bottom:8mm"></div>
    </div>

  </div>
</body>
</html>`)
  win.document.close()
}
