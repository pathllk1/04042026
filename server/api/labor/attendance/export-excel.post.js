import { createClient } from '@supabase/supabase-js'
import SupabaseConfig from '../../../models/SupabaseConfig'
import ExcelJS from 'exceljs'

export default defineEventHandler(async (event) => {
  try {
    const user = event.context.user
    if (!user || !user.firmId) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const firmId = user.firmId

    const body = await readBody(event)
    const { filters = {} } = body || {}
    const { groupId = '', startDate = '', endDate = '' } = filters

    const config = await SupabaseConfig.findOne({ firmId, isActive: true })
    if (!config) {
      throw createError({ statusCode: 404, statusMessage: 'No active Supabase configuration found' })
    }

    const supabase = createClient(config.supabaseUrl, config.getDecryptedServiceKey())

    // Build query - fetch up to 5000 rows to avoid extremely large exports
    let q = supabase
      .from('attendance_records')
      .select(`
        labor_id,
        attendance_date,
        days_worked,
        daily_rate,
        amount,
        period_start,
        period_end,
        custom_expenses,
        labor_profiles!inner(
          id,
          name,
          group_id,
          labor_groups(id,name,color)
        )
      `)
      .eq('firm_id', firmId)
      .order('attendance_date', { ascending: true })
      .range(0, 4999)

    if (groupId) q = q.eq('labor_profiles.group_id', groupId)
    if (startDate) q = q.gte('attendance_date', startDate)
    if (endDate) q = q.lte('attendance_date', endDate)

    const { data: rows, error } = await q
    if (error) {
      throw createError({ statusCode: 500, statusMessage: `Database error: ${error.message}` })
    }

    // Prepare pivot: columns by date
    const formatDateISO = (d) => new Date(d).toISOString().split('T')[0]
    const uniqueDateKeys = Array.from(new Set((rows || []).map(r => formatDateISO(r.attendance_date)))).sort()

    // Resolve selected group name (if filtered)
    let selectedGroupName = null
    if (groupId) {
      try {
        const { data: gRow } = await supabase.from('labor_groups').select('name').eq('id', groupId).single()
        selectedGroupName = gRow?.name || groupId
      } catch {
        selectedGroupName = groupId
      }
    }

    // Helper: compute record amount consistent with UI
    const getRecordAmount = (record) => {
      const isGroupExpense = record?.labor_profiles?.name?.startsWith?.('GROUP_EXPENSES_')
      if (isGroupExpense) {
        if (record.custom_expenses && Array.isArray(record.custom_expenses)) {
          return record.custom_expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
        }
        return 0
      }
      return Number(record.amount || 0)
    }

    // Group data by labor
    const laborMap = new Map()
    for (const r of rows || []) {
      const laborId = r.labor_id || r.labor_profiles?.id || 'unknown'
      const key = laborId
      if (!laborMap.has(key)) {
        laborMap.set(key, {
          laborId,
          laborName: r?.labor_profiles?.name || 'Unknown',
          groupName: r?.labor_profiles?.labor_groups?.name || 'Unassigned',
          groupColor: r?.labor_profiles?.labor_groups?.color || '#64748B',
          byDate: Object.fromEntries(uniqueDateKeys.map(k => [k, 0])),
          totalDays: 0,
          totalAmount: 0,
          records: []
        })
      }
      const entry = laborMap.get(key)
      const dk = formatDateISO(r.attendance_date)
      const amt = getRecordAmount(r)
      entry.byDate[dk] = (entry.byDate[dk] || 0) + amt
      entry.totalDays += r.days_worked || 0
      entry.totalAmount += amt
      entry.records.push(r)
    }

    // Build Excel workbook
    const wb = new ExcelJS.Workbook()
    wb.creator = 'BusinessPro Suite'
    wb.created = new Date()

    // Sheet 1: Summary by Date (pivot)
    const ws1 = wb.addWorksheet('By Date', { properties: { tabColor: { argb: 'FF6366F1' } } })
    const title = ws1.getCell('A1')
    title.value = `Attendance History — By Labor and Date${selectedGroupName ? ' — Group: ' + selectedGroupName : ' — All Groups'}`
    title.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF1F2937' } }
    ws1.mergeCells(1, 1, 1, 4 + uniqueDateKeys.length)
    ws1.getRow(1).height = 28

    // Header row
    const headers = ['Labor Name', 'Group', ...uniqueDateKeys.map(d => new Date(d).toLocaleDateString('en-IN')), 'Total Days', 'Total Amount']
    ws1.addRow(headers)
    const headerRow = ws1.getRow(2)
    headerRow.height = 22
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
    })

    // Data rows
    const laborRows = Array.from(laborMap.values()).sort((a, b) => b.totalAmount - a.totalAmount)
    for (const lr of laborRows) {
      const rowData = [lr.laborName, lr.groupName]
      for (const d of uniqueDateKeys) rowData.push(lr.byDate[d] || 0)
      rowData.push(lr.totalDays)
      rowData.push(lr.totalAmount)
      const row = ws1.addRow(rowData)
      row.eachCell((cell, col) => {
        if (col >= 3 && col < 3 + uniqueDateKeys.length) {
          cell.numFmt = '₹#,##0.00'
          cell.font = { name: 'Arial', size: 11, color: { argb: 'FF111827' } }
          cell.alignment = { horizontal: 'right' }
        } else if (col === 3 + uniqueDateKeys.length + 1) {
          // Total Days
          cell.font = { name: 'Arial', bold: true, color: { argb: 'FF1F2937' } }
        } else if (col === 3 + uniqueDateKeys.length + 2) {
          // Total Amount
          cell.numFmt = '₹#,##0.00'
          cell.font = { name: 'Arial', bold: true, color: { argb: 'FF2563EB' } }
          cell.alignment = { horizontal: 'right' }
        }
        cell.border = { top: { style: 'thin', color: { argb: 'FFE5E7EB' } }, left: { style: 'thin', color: { argb: 'FFE5E7EB' } }, bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }, right: { style: 'thin', color: { argb: 'FFE5E7EB' } } }
      })
    }

    // Totals row
    if (laborRows.length > 0) {
      const startRow = 3
      const endRow = 2 + laborRows.length
      const totals = ['TOTAL', '']
      for (let i = 0; i < uniqueDateKeys.length; i++) {
        const col = 3 + i
        totals.push({ formula: `SUM(${colLetter(col)}${startRow}:${colLetter(col)}${endRow})` })
      }
      totals.push({ formula: `SUM(${colLetter(3 + uniqueDateKeys.length + 1)}${startRow}:${colLetter(3 + uniqueDateKeys.length + 1)}${endRow})` })
      totals.push({ formula: `SUM(${colLetter(3 + uniqueDateKeys.length + 2)}${startRow}:${colLetter(3 + uniqueDateKeys.length + 2)}${endRow})` })
      const tRow = ws1.addRow(totals)
      tRow.eachCell((cell, col) => {
        cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }
        if (col >= 3) cell.numFmt = col === 3 + uniqueDateKeys.length + 1 ? '0' : '₹#,##0.00'
        cell.alignment = { horizontal: 'right' }
      })
    }

    // Autosize columns for By Date sheet
    autoFitColumns(ws1, 6, 30)

    // Sheet 2: Labor Summary (per labor totals)
    const wsG = wb.addWorksheet('Labor Summary', { properties: { tabColor: { argb: 'FF8B5CF6' } } })
    wsG.mergeCells(1, 1, 1, 6)
    const gTitle = wsG.getCell('A1')
    gTitle.value = `Labor Summary${selectedGroupName ? ' — Group: ' + selectedGroupName : ' — All Groups'}`
    gTitle.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF1F2937' } }
    wsG.getRow(1).height = 28

    // Date range view
    const rangeText = (startDate || endDate) ? `Date Range: ${startDate ? new Date(startDate).toLocaleDateString('en-IN') : '...'} to ${endDate ? new Date(endDate).toLocaleDateString('en-IN') : '...'}` : 'Date Range: All dates'
    wsG.mergeCells(2, 1, 2, 6)
    const rangeCell = wsG.getCell('A2')
    rangeCell.value = rangeText
    rangeCell.font = { name: 'Arial', size: 12, italic: true, color: { argb: 'FF6B7280' } }
    rangeCell.alignment = { horizontal: 'left', vertical: 'middle' }
    wsG.getRow(2).height = 20

    wsG.addRow(['Labor Name', 'Group', 'Records', 'Total Days', 'Total Amount', 'Avg Amount / Day'])
    const gHeader = wsG.lastRow
    gHeader.height = 22
    gHeader.eachCell((cell) => {
      cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9333EA' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
    })

    const laborHeaderRowNumber = gHeader.number
    let gRowIndex = laborHeaderRowNumber
    laborRows.forEach((lr, idx) => {
      const recordsCount = lr.records?.length || 0
      const avgPerDay = lr.totalDays > 0 ? lr.totalAmount / lr.totalDays : 0
      const row = wsG.addRow([
        lr.laborName,
        lr.groupName,
        recordsCount,
        lr.totalDays,
        lr.totalAmount,
        avgPerDay
      ])
      row.getCell(5).numFmt = '₹#,##0.00'
      row.getCell(6).numFmt = '₹#,##0.00'
      row.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 11 }
        cell.border = { top: { style: 'thin', color: { argb: 'FFE5E7EB' } }, left: { style: 'thin', color: { argb: 'FFE5E7EB' } }, bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }, right: { style: 'thin', color: { argb: 'FFE5E7EB' } } }
        cell.alignment = { horizontal: typeof cell.value === 'number' ? 'right' : 'left', vertical: 'middle' }
      })
      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } }
        })
      }
      gRowIndex++
    })

    let paymentsStartRowPointer = null
    let laborAmountTotalCell = null
    if (laborRows.length > 0) {
      const firstDataRow = laborHeaderRowNumber + 1
      const lastDataRow = wsG.lastRow.number
      const laborTotalRow = wsG.addRow([
        'TOTAL',
        '',
        { formula: `SUM(C${firstDataRow}:C${lastDataRow})` },
        { formula: `SUM(D${firstDataRow}:D${lastDataRow})` },
        { formula: `SUM(E${firstDataRow}:E${lastDataRow})` },
        0
      ])
      // Set Avg per Day formula referencing the same total row
      laborTotalRow.getCell(6).value = { formula: `IF(D${laborTotalRow.number}>0,E${laborTotalRow.number}/D${laborTotalRow.number},0)` }
      laborTotalRow.eachCell((cell, col) => {
        cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }
        if (col >= 5) cell.numFmt = '₹#,##0.00'
      })
      laborAmountTotalCell = `E${laborTotalRow.number}`
      paymentsStartRowPointer = wsG.lastRow.number + 2
    }

    // Payments summary (within selected date range; includes Final Payment)
    try {
      // Payments list (date-wise, ungrouped)
      let pq = supabase
        .from('payment_records')
        .select('group_id, payment_type, amount, payment_date, payment_method, project')
        .eq('firm_id', firmId)

      if (groupId) pq = pq.eq('group_id', groupId)
      if (startDate) pq = pq.gte('payment_date', startDate)
      if (endDate) pq = pq.lte('payment_date', endDate)

      const { data: allPayments, error: payErr } = await pq
      if (payErr) throw payErr

      // Filter out final payments that don't belong to the selected work period
      const payments = []

      for (const payment of allPayments || []) {
        // For non-final payments, include them as-is (they are made for current period work)
        if (payment.payment_type !== 'Final Payment') {
          payments.push(payment)
          continue
        }

        // For final payments, check if they correspond to work periods that overlap with the selected date range
        if (startDate && endDate) {
          // Get labor profiles for this payment's group
          const { data: paymentGroupProfiles } = await supabase
            .from('labor_profiles')
            .select('id')
            .eq('group_id', payment.group_id)
            .eq('firm_id', firmId)

          if (paymentGroupProfiles && paymentGroupProfiles.length > 0) {
            const laborIds = paymentGroupProfiles.map(p => p.id)

            // Check if this final payment was made for work periods that overlap with the selected date range
            // A final payment should only appear in a period export if it was made for work done in that period
            const { data: workPeriods } = await supabase
              .from('attendance_records')
              .select('period_start, period_end')
              .in('labor_id', laborIds)
              .eq('firm_id', firmId)
              .lte('period_end', payment.payment_date) // Only consider periods that ended before the final payment was made

            // Check if any of the work periods overlap with the selected date range
            let belongsToSelectedPeriod = false

            if (workPeriods && workPeriods.length > 0) {
              // Get unique periods
              const uniquePeriods = [...new Set(workPeriods.map(p => `${p.period_start}|${p.period_end}`))].map(p => {
                const [start, end] = p.split('|')
                return { period_start: start, period_end: end }
              })

              // Check if any work period overlaps with the selected date range
              for (const period of uniquePeriods) {
                const periodStart = new Date(period.period_start)
                const periodEnd = new Date(period.period_end)
                const rangeStart = new Date(startDate)
                const rangeEnd = new Date(endDate)

                // Check for meaningful overlap: work period must have substantial overlap with selected range
                // Not just touching at endpoints - the work period should actually fall within or significantly overlap the selected range
                const hasOverlap = periodStart < rangeEnd && periodEnd > rangeStart

                if (hasOverlap) {
                  belongsToSelectedPeriod = true
                  break
                }
              }
            }

            if (belongsToSelectedPeriod) {
              payments.push(payment)
            }
          }
        } else {
          // If no date range specified, include all final payments
          payments.push(payment)
        }
      }

      // sort by date ascending
      const sortedPayments = (payments || []).slice().sort((a,b)=> new Date(a.payment_date) - new Date(b.payment_date))
      const groupIds = new Set(sortedPayments.map(p=>p.group_id))

      // Map group names
      let groupNameMap = new Map()
      if (groupIds.size > 0) {
        const { data: groupRowsFetch } = await supabase
          .from('labor_groups')
          .select('id,name')
          .in('id', Array.from(groupIds))
          .eq('firm_id', firmId)
        groupNameMap = new Map((groupRowsFetch || []).map(r => [r.id, r.name]))
      }

      // Render section only if we have payments
      if (sortedPayments.length > 0) {
        const startRow = paymentsStartRowPointer || wsG.lastRow.number + 2
        wsG.mergeCells(startRow, 1, startRow, 6)
        const pTitle = wsG.getCell(startRow, 1)
        pTitle.value = `Payments (within selected range — Final Payments only for work periods overlapping this range)${selectedGroupName ? ' — Group: ' + selectedGroupName : ''}`
        pTitle.font = { name: 'Arial', size: 14, bold: true }
        wsG.getRow(startRow).height = 22

        const headerRowIdx = startRow + 1
        const header = wsG.getRow(headerRowIdx)
        header.values = ['Date', 'Group', 'Payment Type', 'Method', 'Amount']
        header.eachCell(c => {
          c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } }
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
          c.alignment = { horizontal: 'center', vertical: 'middle' }
        })

        const rows = sortedPayments
        let r = headerRowIdx + 1
        rows.forEach((p, idx) => {
          const row = wsG.getRow(r++)
          row.values = [new Date(p.payment_date).toLocaleDateString('en-IN'), groupNameMap.get(p.group_id) || p.group_id, p.payment_type || 'Payment', p.payment_method || '-', Number(p.amount || 0)]
          row.getCell(5).numFmt = '₹#,##0.00'
          row.eachCell((cell) => {
            cell.border = { top: { style: 'thin', color: { argb: 'FFE5E7EB' } }, left: { style: 'thin', color: { argb: 'FFE5E7EB' } }, bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }, right: { style: 'thin', color: { argb: 'FFE5E7EB' } } }
            cell.alignment = { horizontal: typeof cell.value === 'number' ? 'right' : 'left', vertical: 'middle' }
          })
          if (idx % 2 === 1) {
            row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } } })
          }
        })

        // Totals
        const endIdx = r - 1
        const paymentsTotalRow = wsG.getRow(r)
        paymentsTotalRow.values = ['TOTAL', '', '', '', { formula: `SUM(E${headerRowIdx + 1}:E${endIdx})` }]
        paymentsTotalRow.eachCell((cell, col) => {
          cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }
          if (col === 5) cell.numFmt = '₹#,##0.00'
        })

        // Unpaid = Labor total - Payments total
        if (laborAmountTotalCell) {
          const unpaidRow = wsG.getRow(r + 1)
          unpaidRow.values = ['UNPAID (Labor Total - Payments)', '', '', '', { formula: `${laborAmountTotalCell} - E${paymentsTotalRow.number}` }]
          unpaidRow.eachCell((cell, col) => {
            cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } } // Amber
            if (col === 5) cell.numFmt = '₹#,##0.00'
          })
        }
      }
    } catch (paymentsSectionError) {
      console.error('Payments summary build error:', paymentsSectionError)
    }

    // Autosize Labor Summary sheet
    autoFitColumns(wsG, 10, 32)

    // Sheet 3: Raw Records
    const ws2 = wb.addWorksheet('Raw Records', { properties: { tabColor: { argb: 'FF34D399' } } })
    ws2.addRow(['Worker', 'Group', 'Date', 'Days', 'Rate', 'Amount', 'Period Start', 'Period End'])
    ws2.getRow(1).eachCell(c => {
      c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }
      c.alignment = { horizontal: 'center' }
    })
    for (const r of rows || []) {
      const amount = getRecordAmount(r)
      ws2.addRow([
        r?.labor_profiles?.name || '',
        r?.labor_profiles?.labor_groups?.name || 'Unassigned',
        new Date(r.attendance_date).toLocaleDateString('en-IN'),
        r.days_worked || 0,
        r.daily_rate || 0,
        amount,
        new Date(r.period_start).toLocaleDateString('en-IN'),
        new Date(r.period_end).toLocaleDateString('en-IN')
      ])
    }
    // Autosize Raw Records sheet
    autoFitColumns(ws2, 8, 30)
    ws2.getColumn(6).numFmt = '₹#,##0.00'

    const buffer = await wb.xlsx.writeBuffer()
    event.node.res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    event.node.res.setHeader('Content-Disposition', `attachment; filename=attendance-history-${new Date().toISOString().split('T')[0]}.xlsx`)
    // Return as a Uint8Array to avoid JSON serialization by Nitro
    return new Uint8Array(buffer)
  } catch (error) {
    console.error('Export Excel error:', error)
    throw createError({ statusCode: error.statusCode || 500, statusMessage: error.statusMessage || error.message || 'Failed to export Excel' })
  }
})

function colLetter(n) {
  let s = ''
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

// Utility: auto fit columns based on content length
function autoFitColumns(worksheet, minWidth = 8, maxWidth = 30) {
  worksheet.columns.forEach((column) => {
    let maxLength = 0
    column.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value
      const text = v == null ? '' : (typeof v === 'object' && v.text ? v.text : v.toString())
      maxLength = Math.max(maxLength, text.length)
    })
    column.width = Math.max(minWidth, Math.min(maxWidth, maxLength + 2))
  })
}

