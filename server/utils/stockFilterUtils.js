/**
 * Utility functions for standardizing stock filtering logic across the application
 */

/**
 * Creates a standardized filter for finding stock items
 * This ensures consistent handling of null/undefined/empty values for pno and batch
 *
 * @param {Object} item - The stock item data
 * @param {String} firmId - The firm ID
 * @returns {Object} A filter object for MongoDB queries
 */
function createStockFilter(item, firmId) {
  // Base filter with required fields
  const filter = {
    item: item.item,
    hsn: item.hsn,
    firm: firmId
  };

  // ✅ FIXED: Handle part number (pno) field - only add to filter if it has a value
  if (item.pno && item.pno.trim() !== '') {
    filter.pno = item.pno;
  }
  // ✅ FIXED: Don't add pno to filter if it's null/empty - let MongoDB match records without pno field

  // ✅ FIXED: Handle batch field - only add to filter if it has a value
  if (item.batch && item.batch.trim() !== '') {
    filter.batch = item.batch;
  }
  // ✅ FIXED: Don't add batch to filter if it's null/empty - let MongoDB match records without batch field

  // Handle OEM field if needed
  if (item.oem && item.oem.trim() !== '') {
    filter.oem = item.oem;
  }

  return filter;
}

/**
 * Creates a standardized update object for stock items
 * This ensures consistent handling of null/undefined/empty values for pno and batch
 *
 * @param {Object} item - The stock item data
 * @param {String} userId - The user ID
 * @param {String} firmId - The firm ID
 * @returns {Object} An update object for MongoDB queries
 */
function createStockUpdateSet(item, userId, firmId) {
  // Base update set with required fields
  const updateSet = {
    item: item.item,
    hsn: item.hsn,
    oem: item.oem || null,
    uom: item.uom,
    rate: item.rate,
    grate: item.grate || 0,
    user: userId,
    firm: firmId
  };

  // Only set total if it's provided or can be calculated
  if (item.total) {
    updateSet.total = item.total;
  } else if (item.qty && item.rate) {
    updateSet.total = item.qty * item.rate;
  }

  // ✅ FIXED: Always set pno and batch fields (null if empty)
  updateSet.pno = (item.pno && item.pno.trim() !== '') ? item.pno : null;
  updateSet.batch = (item.batch && item.batch.trim() !== '') ? item.batch : null;

  // Set MRP if provided
  if (item.mrp) {
    updateSet.mrp = item.mrp;
  }

  // Set expiry date if provided
  if (item.expiryDate) {
    updateSet.expiryDate = item.expiryDate;
  }

  return updateSet;
}

module.exports = {
  createStockFilter,
  createStockUpdateSet
};
