/**
 * useCart.js
 * Cart operations composable for the Sales Invoice system.
 * Location: app/composables/sales/useCart.js
 *
 * Replaces: cartManager.js
 *
 * Receives the shared reactive `state` object from useSalesState()
 * and mutates it directly — Vue reactivity propagates changes to all
 * components that hold a reference to the same state object.
 *
 * No API calls in this file — pure in-memory cart operations only.
 */

/**
 * @param {import('vue').UnwrapNestedRefs<object>} state
 *   The reactive state object from useSalesState()
 */
export function useCart(state) {

  // ─── Add ────────────────────────────────────────────────────────────────────

  /**
   * Adds a stock item to the cart, or increments qty if an identical
   * stock+batch GOODS line already exists.
   */
  function addItemToCart(stockItem) {
    const existing = state.cart.find(
      (i) =>
        i.stockId === stockItem.id &&
        i.batch === stockItem.batch &&
        i.itemType !== 'SERVICE',
    )

    if (existing) {
      existing.qty    += 1
      existing.showQty = true
    } else {
      state.cart.push({
        stockId:   stockItem.id,
        itemType:  'GOODS',
        item:      stockItem.item,
        narration: '',
        batch:     stockItem.batch  || null,
        oem:       stockItem.oem    || '',
        hsn:       stockItem.hsn    || '',
        qty:       1,
        showQty:   true,
        uom:       stockItem.uom,
        rate:      parseFloat(stockItem.rate)  || 0,
        grate:     parseFloat(stockItem.grate) || 0,
        disc:      0,
      })
    }
  }

  /**
   * Same as addItemToCart but lets the caller override rate and/or disc
   * (used when selecting from batch-history with a remembered price).
   *
   * @param {object} stockItem
   * @param {{ rate?: number, disc?: number }} overrides
   */
  function addItemToCartWithOverrides(stockItem, overrides = {}) {
    const existing = state.cart.find(
      (i) =>
        i.stockId === stockItem.id &&
        i.batch === stockItem.batch &&
        i.itemType !== 'SERVICE',
    )

    const resolvedRate = overrides.rate !== undefined
      ? parseFloat(overrides.rate)
      : parseFloat(stockItem.rate)
    const resolvedDisc = overrides.disc !== undefined
      ? parseFloat(overrides.disc)
      : 0

    if (existing) {
      existing.qty += 1
      if (!isNaN(resolvedRate)) existing.rate = resolvedRate
      if (!isNaN(resolvedDisc)) existing.disc = resolvedDisc
    } else {
      state.cart.push({
        stockId:   stockItem.id,
        itemType:  'GOODS',
        item:      stockItem.item,
        narration: '',
        batch:     stockItem.batch  || null,
        oem:       stockItem.oem    || '',
        hsn:       stockItem.hsn    || '',
        qty:       1,
        showQty:   true,
        uom:       stockItem.uom,
        rate:      isNaN(resolvedRate) ? (parseFloat(stockItem.rate) || 0) : resolvedRate,
        grate:     parseFloat(stockItem.grate) || 0,
        disc:      isNaN(resolvedDisc) ? 0 : resolvedDisc,
      })
    }
  }

  /**
   * Appends a blank SERVICE line to the cart.
   * The user fills in description, HSN/SAC, rate, and GST% inline.
   */
  function addServiceToCart() {
    state.cart.push({
      stockId:   null,
      itemType:  'SERVICE',
      item:      '',
      narration: '',
      batch:     null,
      oem:       '',
      hsn:       '',
      qty:       1,
      showQty:   false,
      uom:       '',
      rate:      0,
      grate:     18,
      disc:      0,
    })
  }

  // ─── Remove ─────────────────────────────────────────────────────────────────

  function removeItemFromCart(index) {
    state.cart.splice(index, 1)
  }

  // ─── Update ─────────────────────────────────────────────────────────────────

  /**
   * Updates a single field on a cart line.
   *
   * Text fields (item, hsn, uom) are stored as-is.
   * Numeric fields are parsed to floats; invalid values default to 0.
   * qty / returnQty have special handling for SERVICE lines.
   *
   * @param {number} index
   * @param {string} field  cart item field name
   * @param {*}      value  raw input value (string from <input> is fine)
   */
  function updateCartItem(index, field, value) {
    const item = state.cart[index]
    if (!item) return

    // ── Text fields — store verbatim ───────────────────────────────────────
    if (field === 'item' || field === 'hsn' || field === 'uom') {
      item[field] = value
      return
    }

    // ── Quantity fields ────────────────────────────────────────────────────
    if (field === 'qty' || field === 'returnQty') {
      const isReturn = field === 'returnQty'

      // SERVICE qty: empty / zero / invalid → qty=1, showQty=false
      if (item.itemType === 'SERVICE' && !isReturn) {
        if (value === '' || value === null || value === undefined) {
          item.qty     = 1
          item.showQty = false
          return
        }
        const parsed = parseFloat(value)
        if (!Number.isFinite(parsed) || parsed <= 0) {
          item.qty     = 1
          item.showQty = false
          return
        }
        item.qty     = parsed
        item.showQty = true
        return
      }

      let parsed = parseFloat(value)
      if (!Number.isFinite(parsed) || parsed < 0) parsed = 0

      if (isReturn) {
        item.returnQty = parsed
      } else {
        item.qty     = parsed
        item.showQty = true
      }
      return
    }

    // ── Other numeric fields (rate, disc, grate) ───────────────────────────
    let val = parseFloat(value)
    if (isNaN(val) || val < 0) val = 0
    item[field] = val
  }

  function updateCartItemNarration(index, narration) {
    if (state.cart[index]) {
      state.cart[index].narration = narration
    }
  }

  // ─── Clear ──────────────────────────────────────────────────────────────────

  /**
   * Clears cart, party, consignee and other-charges — a full invoice reset.
   * Does NOT reset meta fields (bill date, bill type, etc.) — call
   * useSalesState().resetState() for a complete wipe.
   */
  function clearCart() {
    state.cart                  = []
    state.selectedParty         = null
    state.otherCharges          = []
    state.selectedConsignee     = null
    state.consigneeSameAsBillTo = true
  }

  // ─── Return mode helpers ─────────────────────────────────────────────────────

  /**
   * Stamps each existing cart item with returnQty=0 and originalItem=true
   * so the return-mode UI can show original qty alongside the return qty input.
   * Call this immediately after loadExistingBillData() when isReturnMode=true.
   */
  function prepareCartForReturn() {
    state.cart = state.cart.map((item) => ({
      ...item,
      returnQty:    0,
      originalItem: true,
    }))
  }

  return {
    addItemToCart,
    addItemToCartWithOverrides,
    addServiceToCart,
    removeItemFromCart,
    updateCartItem,
    updateCartItemNarration,
    clearCart,
    prepareCartForReturn,
  }
}