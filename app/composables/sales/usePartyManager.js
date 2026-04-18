/**
 * useInvoiceExport.js
 * Invoice export (CSV and PDF) composable for the Sales Invoice system.
 * Location: app/composables/sales/useInvoiceExport.js
 *
 * Replaces: invoiceExport.js
 *
 * GET requests (PDF / Excel blob downloads) use $fetch with credentials.
 * No CSRF needed for GET — no useApiWithAuth required here.
 *
 * The removed calculateGrandTotal() from the original is NOT ported —
 * grand total is derived reactively via calculateBillTotals() in salesUtils.js.
 *
 * Usage in a component:
 *   const { exportingPdf, exportToCsv, exportToPdf, downloadBillFile } = useInvoiceExport(state)
 */

import { ref } from 'vue'
import { useToast } from '#imports'
import { formatCurrency } from '~/utils/salesUtils'

/**
 * @param {import('vue').UnwrapNestedRefs<object>} state
 *   The reactive state object from useSalesState()
 */
export function useInvoiceExport(state) {
  const toast = useToast()

  const exportingPdf   = ref(false)
  const exportingExcel = ref(false)

  // ─── CSV (Excel-compatible) export ───────────────────────────────────────────

  /**
   * Builds a CSV string from current state and triggers a browser download.
   * No API call — entirely client-side.
   */
  function exportToCsv() {
    try {
      let csv = 'INVOICE EXPORT\n'
      csv += `Bill No,${state.meta.billNo}\n`
      csv += `Date,${state.meta.billDate}\n`
      csv += `Bill Type,${state.meta.billType}\n`
      csv += `Reverse Charge,${state.meta.reverseCharge ? 'Yes' : 'No'}\n\n`

      if (state.selectedParty) {
        csv += 'BILL TO\n'
        csv += `Party,"${state.selectedParty.firm}"\n`
        csv += `GSTIN,${state.selectedParty.gstin}\n`
        csv += `Address,"${state.selectedParty.addr}"\n\n`
      }

      if (state.selectedConsignee) {
        csv += 'CONSIGNEE\n'
        csv += `Name,"${state.selectedConsignee.name}"\n`
        csv += `Address,"${state.selectedConsignee.address}"\n\n`
      }

      csv += 'ITEMS\n'
      csv += 'Item,Batch,Qty,Unit,Rate,Disc %,Tax %,Total\n'

      state.cart.forEach((item) => {
        const qtyForCalc = parseFloat(item.qty) || 0
        const qty        = item.itemType === 'SERVICE' && qtyForCalc === 0 ? '' : qtyForCalc
        const rate       = parseFloat(item.rate)  || 0
        const disc       = parseFloat(item.disc)  || 0
        const grate      = parseFloat(item.grate) || 0

        let taxableAmount
        if (item.itemType === 'SERVICE' && qtyForCalc === 0) {
          // Flat-rate service: total = rate × (1 - disc/100)
          taxableAmount = rate * (1 - disc / 100)
        } else {
          taxableAmount = qtyForCalc * rate - (qtyForCalc * rate * disc) / 100
        }

        const taxAmount = (taxableAmount * grate) / 100
        const total     = taxableAmount + taxAmount

        csv += `"${item.item}",`
        csv += `"${item.itemType === 'SERVICE' ? '' : (item.batch || '-')}",`
        csv += `"${qty}",`
        csv += `"${item.itemType === 'SERVICE' ? (item.uom || '') : item.uom}",`
        csv += `${rate},${disc},${grate},${total.toFixed(2)}\n`
      })

      csv += '\nOTHER CHARGES\n'
      csv += 'Charge,Amount,GST %,Total\n'

      state.otherCharges.forEach((charge) => {
        const amount    = parseFloat(charge.amount)  || 0
        const gstRate   = parseFloat(charge.gstRate) || 0
        const gstAmount = (amount * gstRate) / 100
        csv += `"${charge.name}",${amount},${gstRate},${(amount + gstAmount).toFixed(2)}\n`
      })

      _triggerDownload(
        new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
        `Invoice_${state.meta.billNo}_${state.meta.billDate}.csv`,
      )

      toast.add({ title: 'Exported to CSV successfully', color: 'success' })
    } catch (err) {
      console.error('CSV export error:', err)
      toast.add({ title: 'Export failed: ' + err.message, color: 'error' })
    }
  }

  // ─── PDF download ────────────────────────────────────────────────────────────

  /**
   * Downloads the server-rendered PDF for a saved bill.
   * Uses $fetch with credentials — cookie auth is automatic.
   *
   * @param {string} billId   MongoDB _id of the saved bill
   */
  async function exportToPdf(billId) {
    if (!billId) {
      toast.add({ title: 'No bill ID — save the invoice first', color: 'warning' })
      return
    }

    exportingPdf.value = true
    try {
      await _downloadBlobFromApi(
        `/api/inventory/sales/bills/${billId}/pdf`,
        `Invoice_${state.meta.billNo || billId}.pdf`,
      )
    } catch (err) {
      console.error('PDF download error:', err)
      toast.add({ title: 'PDF download failed: ' + err.message, color: 'error' })
    } finally {
      exportingPdf.value = false
    }
  }

  // ─── Excel download ───────────────────────────────────────────────────────────

  /**
   * Downloads the server-rendered Excel file for a saved bill.
   *
   * @param {string} billId   MongoDB _id of the saved bill
   */
  async function exportToExcel(billId) {
    if (!billId) {
      toast.add({ title: 'No bill ID — save the invoice first', color: 'warning' })
      return
    }

    exportingExcel.value = true
    try {
      await _downloadBlobFromApi(
        `/api/inventory/sales/bills/${billId}/excel`,
        `Invoice_${state.meta.billNo || billId}.xlsx`,
      )
    } catch (err) {
      console.error('Excel download error:', err)
      toast.add({ title: 'Excel download failed: ' + err.message, color: 'error' })
    } finally {
      exportingExcel.value = false
    }
  }

  /**
   * Generic helper — fetches any bill file (pdf / excel) and triggers
   * a browser download. Shared by exportToPdf() and exportToExcel().
   *
   * Uses native fetch with credentials:'include' to stream the blob;
   * $fetch does not expose raw Response.blob() so we drop down to fetch here.
   *
   * @param {string} url
   * @param {string} filename
   */
  async function downloadBillFile(url, filename) {
    await _downloadBlobFromApi(url, filename)
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  async function _downloadBlobFromApi(url, filename) {
    const response = await fetch(url, {
      method:      'GET',
      credentials: 'include',
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const blob      = await response.blob()
    _triggerDownload(blob, filename)
  }

  function _triggerDownload(blob, filename) {
    const url  = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href          = url
    link.download      = filename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return {
    // Reactive loading flags — bind to UButton :loading
    exportingPdf,
    exportingExcel,
    // Actions
    exportToCsv,
    exportToPdf,
    exportToExcel,
    downloadBillFile,
  }
}