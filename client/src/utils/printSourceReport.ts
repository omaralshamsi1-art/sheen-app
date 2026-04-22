import { format, parseISO } from 'date-fns'
import type { Sale, SaleItem } from '../types'

type SaleWithItems = Sale & { sale_items?: SaleItem[] }

export function printSourceReport(
  source: string,
  sales: SaleWithItems[],
  from: string,
  to: string,
  fee: { pct: number; vat: boolean } = { pct: 0, vat: false },
) {
  const win = window.open('', '_blank', 'width=560,height=900')
  if (!win) return

  const rangeStr =
    from === to
      ? format(parseISO(from), 'dd/MM/yyyy')
      : `${format(parseISO(from), 'dd/MM/yyyy')} - ${format(parseISO(to), 'dd/MM/yyyy')}`
  const timeStr = format(new Date(), 'hh:mm:ss a')

  const totalRevenue = sales.reduce((s, x) => s + Number(x.total_revenue), 0)
  const totalCups = sales.reduce((s, x) => s + Number(x.total_cups), 0)
  const commission = totalRevenue * (fee.pct / 100)
  const vatOnCommission = fee.vat ? commission * 0.05 : 0
  const netPayout = totalRevenue - commission - vatOnCommission
  const hasFee = fee.pct > 0

  const byProduct: Record<string, { qty: number; total: number }> = {}
  for (const sale of sales) {
    for (const item of sale.sale_items ?? []) {
      if (!byProduct[item.name]) byProduct[item.name] = { qty: 0, total: 0 }
      byProduct[item.name].qty += item.qty
      byProduct[item.name].total += Number(item.total)
    }
  }

  const productRows = Object.entries(byProduct)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(
      ([name, d]) =>
        `<tr><td>${name}</td><td class="center">${d.qty}</td><td class="right">AED ${d.total.toFixed(2)}</td></tr>`,
    )
    .join('')

  const orderRows = sales
    .map((sale) => {
      const t = new Date(sale.recorded_at)
      t.setHours(t.getHours() + 4)
      const timeOnly = t.toISOString().slice(11, 16)
      const dateOnly = format(parseISO(sale.sale_date), 'dd/MM')
      const itemList = (sale.sale_items ?? [])
        .map((it) => `${it.name} x${it.qty}`)
        .join(', ')
      return `
        <tr>
          <td>${dateOnly} ${timeOnly}</td>
          <td class="right">AED ${Number(sale.total_revenue).toFixed(2)}</td>
        </tr>
        <tr><td colspan="2" class="sub-item">${itemList}</td></tr>`
    })
    .join('')

  win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${source} Report</title>
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
    .preview-container { margin-top: 65px; padding: 30px 20px 40px; display: flex; justify-content: center; }
    .receipt-card {
      background: #fff; width: 80mm; padding: 4mm;
      box-shadow: 0 6px 24px rgba(0,0,0,0.18); border-radius: 4px;
    }
  }

  @page { size: 80mm auto; margin: 0; }
  @media print {
    .toolbar { display: none !important; }
    .preview-container { margin: 0; padding: 0; }
    .receipt-card { box-shadow: none; border-radius: 0; width: 80mm; padding: 4mm; }
    body { background: #fff; }
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  .receipt-card { font-family: Arial, sans-serif; font-size: 13px; color: #000; }
  .center { text-align: center; }
  .right { text-align: right; }
  .logo { font-size: 18px; font-weight: bold; letter-spacing: 2px; margin-bottom: 2px; }
  .sub { font-size: 12px; color: #000; }
  .report-title { font-size: 15px; font-weight: bold; margin: 4px 0; }
  .line { border-top: 1px dashed #000; margin: 5px 0; }
  .double-line { border-top: 3px double #000; margin: 6px 0; }
  .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin: 4px 0 2px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; font-size: 13px; }
  .sub-item { font-size: 11px; color: #333; padding: 0 0 3px 6px; }
  .total-row td { font-weight: bold; font-size: 14px; border-top: 1px solid #000; padding-top: 3px; }
</style>
</head>
<body>

  <div class="toolbar">
    <span class="toolbar-title">${source} Report</span>
    <div class="toolbar-buttons">
      <button class="btn-close" onclick="window.close()">&#10005; Close</button>
      <button class="btn-print" onclick="window.print()">&#128438; Print</button>
    </div>
  </div>

  <div class="preview-container">
    <div class="receipt-card">

      <div class="center">
        <div class="logo">SHEEN SPECIALITY COFFEE</div>
        <div class="sub">0557306030</div>
        <div class="sub">sheencafe.ae</div>
      </div>

      <div class="line"></div>

      <div class="center"><div class="report-title">${source.toUpperCase()} REPORT</div></div>

      <table style="font-size:12px; margin-top:4px">
        <tr><td>Range:</td><td class="right">${rangeStr}</td></tr>
        <tr><td>Printed:</td><td class="right">${timeStr}</td></tr>
        <tr><td>Orders:</td><td class="right">${sales.length}</td></tr>
        <tr><td>Cups:</td><td class="right">${totalCups}</td></tr>
      </table>

      <div class="line"></div>

      <div class="section-title">Orders</div>
      <table>
        ${orderRows || '<tr><td colspan="2" class="center">No orders</td></tr>'}
        <tr class="total-row">
          <td>Gross Total</td>
          <td class="right">AED ${totalRevenue.toFixed(2)}</td>
        </tr>
        ${hasFee ? `
        <tr><td>Commission (${fee.pct}%)</td><td class="right">-AED ${commission.toFixed(2)}</td></tr>
        ${fee.vat ? `<tr><td>VAT 5% on commission</td><td class="right">-AED ${vatOnCommission.toFixed(2)}</td></tr>` : ''}
        <tr class="total-row"><td>Net Payout</td><td class="right">AED ${netPayout.toFixed(2)}</td></tr>
        ` : ''}
      </table>

      <div class="double-line"></div>

      <div class="section-title">Product Breakdown</div>
      <table>
        <tr style="font-size:11px; font-weight:bold"><td>Item</td><td class="center">Qty</td><td class="right">Total</td></tr>
        ${productRows || '<tr><td colspan="3" class="center">No items</td></tr>'}
        <tr class="total-row">
          <td>Items</td>
          <td class="center">${totalCups}</td>
          <td class="right">AED ${totalRevenue.toFixed(2)}</td>
        </tr>
      </table>

      <div class="line"></div>
      <div class="center" style="font-size:12px; margin-top:6px">
        <p>@SheenCafe</p>
      </div>
      <div style="margin-bottom: 10mm;"></div>

    </div>
  </div>

</body>
</html>`)
  win.document.close()
}
