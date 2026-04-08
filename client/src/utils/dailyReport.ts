import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import type { Sale, SaleItem } from '../types'

interface OrderSource {
  id: string
  commission: number
  vat?: boolean
}

export function generateDailyReport(
  sales: (Sale & { sale_items?: SaleItem[] })[],
  orderSources: OrderSource[],
  reportDate?: Date,
) {
  const doc = new jsPDF()
  const today = reportDate ?? new Date()
  const dateStr = format(today, 'dd MMMM yyyy')
  const pageWidth = doc.internal.pageSize.getWidth()

  // ── Header ──
  doc.setFillColor(26, 26, 26)
  doc.rect(0, 0, pageWidth, 42, 'F')

  // Gold line
  doc.setFillColor(212, 168, 67)
  doc.rect(0, 42, pageWidth, 2, 'F')

  // Logo text
  doc.setTextColor(212, 168, 67)
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.text('SHEEN', pageWidth / 2, 20, { align: 'center' })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(160, 120, 90)
  doc.text('Coffee Shop', pageWidth / 2, 27, { align: 'center' })

  doc.setFontSize(9)
  doc.setTextColor(200, 200, 200)
  doc.text('Daily Sales Report', pageWidth / 2, 34, { align: 'center' })

  // ── Date ──
  doc.setTextColor(26, 26, 26)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(`Date: ${dateStr}`, 14, 54)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120, 120, 120)
  doc.text(`Generated: ${format(today, 'hh:mm a')}`, pageWidth - 14, 54, { align: 'right' })

  // ── Summary by Source ──
  const sourceMap: Record<string, { count: number; cups: number; gross: number; commission: number; vat: number; net: number }> = {}

  for (const sale of sales) {
    const src = sale.recorded_by || 'POS'
    if (!sourceMap[src]) sourceMap[src] = { count: 0, cups: 0, gross: 0, commission: 0, vat: 0, net: 0 }
    sourceMap[src].count++
    sourceMap[src].cups += sale.total_cups
    sourceMap[src].gross += sale.total_revenue

    const srcConfig = orderSources.find(s => s.id === src)
    const commRate = srcConfig?.commission ?? 0
    const commBase = sale.total_revenue * (commRate / 100)
    const vatAmt = srcConfig?.vat ? commBase * 0.05 : 0
    sourceMap[src].commission += commBase
    sourceMap[src].vat += vatAmt
    sourceMap[src].net += sale.total_revenue - commBase - vatAmt
  }

  let y = 62

  // Source summary table
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(26, 26, 26)
  doc.text('Sales by Source', 14, y)
  y += 2

  const sourceRows = Object.entries(sourceMap).map(([name, data]) => [
    name,
    String(data.count),
    String(data.cups),
    data.gross.toFixed(2),
    data.commission > 0 ? `-${data.commission.toFixed(2)}` : '—',
    data.vat > 0 ? `-${data.vat.toFixed(2)}` : '—',
    data.net.toFixed(2),
  ])

  const totals = Object.values(sourceMap).reduce(
    (acc, d) => ({
      count: acc.count + d.count,
      cups: acc.cups + d.cups,
      gross: acc.gross + d.gross,
      commission: acc.commission + d.commission,
      vat: acc.vat + d.vat,
      net: acc.net + d.net,
    }),
    { count: 0, cups: 0, gross: 0, commission: 0, vat: 0, net: 0 },
  )

  sourceRows.push([
    'TOTAL',
    String(totals.count),
    String(totals.cups),
    totals.gross.toFixed(2),
    totals.commission > 0 ? `-${totals.commission.toFixed(2)}` : '—',
    totals.vat > 0 ? `-${totals.vat.toFixed(2)}` : '—',
    totals.net.toFixed(2),
  ])

  autoTable(doc, {
    startY: y,
    head: [['Source', 'Orders', 'Cups', 'Gross (AED)', 'Commission', 'VAT', 'Net (AED)']],
    body: sourceRows,
    theme: 'grid',
    headStyles: { fillColor: [26, 26, 26], textColor: [212, 168, 67], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [26, 26, 26] },
    alternateRowStyles: { fillColor: [245, 240, 232] },
    columnStyles: {
      0: { fontStyle: 'bold' },
      3: { halign: 'right' },
      4: { halign: 'right', textColor: [200, 50, 50] },
      5: { halign: 'right', textColor: [200, 50, 50] },
      6: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data: any) => {
      // Bold the total row
      if (data.row.index === sourceRows.length - 1) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [212, 168, 67]
        data.cell.styles.textColor = [26, 26, 26]
      }
    },
  })

  y = (doc as any).lastAutoTable.finalY + 10

  // ── Items Breakdown ──
  const itemMap: Record<string, { qty: number; revenue: number }> = {}
  for (const sale of sales) {
    for (const item of sale.sale_items ?? []) {
      if (!itemMap[item.name]) itemMap[item.name] = { qty: 0, revenue: 0 }
      itemMap[item.name].qty += item.qty
      itemMap[item.name].revenue += item.total
    }
  }

  const itemRows = Object.entries(itemMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([name, data], idx) => [
      String(idx + 1),
      name,
      String(data.qty),
      data.revenue.toFixed(2),
    ])

  if (itemRows.length > 0) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(26, 26, 26)
    doc.text('Items Sold', 14, y)
    y += 2

    autoTable(doc, {
      startY: y,
      head: [['#', 'Item', 'Qty', 'Revenue (AED)']],
      body: itemRows,
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 26], textColor: [212, 168, 67], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [26, 26, 26] },
      alternateRowStyles: { fillColor: [245, 240, 232] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        2: { halign: 'center' },
        3: { halign: 'right', fontStyle: 'bold' },
      },
    })

    y = (doc as any).lastAutoTable.finalY + 10
  }

  // ── Grand Total Box ──
  doc.setFillColor(26, 26, 26)
  doc.roundedRect(14, y, pageWidth - 28, 24, 3, 3, 'F')

  doc.setTextColor(212, 168, 67)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Net Revenue', 22, y + 9)

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(`${totals.net.toFixed(2)} AED`, pageWidth - 22, y + 16, { align: 'right' })

  // ── Footer ──
  const footerY = doc.internal.pageSize.getHeight() - 15
  doc.setFillColor(212, 168, 67)
  doc.rect(0, footerY - 3, pageWidth, 1, 'F')

  doc.setTextColor(160, 120, 90)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text('SHEEN Coffee Shop — Daily Sales Report', pageWidth / 2, footerY + 2, { align: 'center' })
  doc.text(`@SheenCafe — Generated ${format(today, 'dd/MM/yyyy hh:mm a')}`, pageWidth / 2, footerY + 7, { align: 'center' })

  // Save
  doc.save(`SHEEN-Daily-Report-${format(today, 'yyyy-MM-dd')}.pdf`)
}
