/**
 * inventoryMovement.js
 * Builds a per-product inventory movement history from client-side portal state.
 * Combines consumptions (OUT movements) and requisition lines (IN movements).
 */

import { isoInRange } from './reportFilters.js';

/**
 * Build a flat list of inventory movement events for all products or a specific one.
 *
 * @param {object}  opts
 * @param {Array}   opts.consumptions   - state.consumptions
 * @param {Array}   opts.requisitions   - state.requisitions
 * @param {Array}   opts.stockItems     - state.stockItems
 * @param {string}  opts.productSearch  - free-text filter on product name / SKU ('' = all)
 * @param {number}  opts.startMs        - period start in ms
 * @param {number}  opts.endMs          - period end in ms
 * @param {string}  [opts.clerkId]      - optional: restrict consumptions to a single clerk
 * @returns {{ events: MovementEvent[], summary: MovementSummary, matchedItems: StockItem[] }}
 */
export function buildInventoryMovement({ consumptions, requisitions, stockItems, productSearch, startMs, endMs, clerkId }) {
  const q = String(productSearch || '').trim().toLowerCase();
  const events = [];

  // ── Map stock items for quick lookup ──────────────────────────────────────
  const itemById = new Map(stockItems.map((i) => [String(i.id || i._id), i]));
  const itemByName = new Map(stockItems.map((i) => [String(i.name || '').toLowerCase(), i]));

  // ── Helper: does this product name / sku match the search? ────────────────
  function matchesSearch(name, sku) {
    if (!q) return true;
    return (
      String(name || '').toLowerCase().includes(q) ||
      String(sku || '').toLowerCase().includes(q)
    );
  }

  // ── OUT events from consumptions ──────────────────────────────────────────
  for (const c of consumptions) {
    if (!isoInRange(c.createdAt, startMs, endMs)) continue;
    if (clerkId && c.clerkId !== clerkId) continue;

    const item = itemById.get(String(c.itemId)) || itemByName.get(String(c.itemName || '').toLowerCase());
    const name = c.itemName || item?.name || c.itemId;
    const sku = item?.sku || '';
    const category = item?.category || '';
    const unit = c.unit || item?.unit || 'units';
    const location = c.location || item?.location || '';

    if (!matchesSearch(name, sku)) continue;

    events.push({
      id: `cons_${c.id || c._id}`,
      type: 'OUT',
      subtype: c.consumptionKind === 'bill' ? 'Bill' : c.consumptionKind === 'usage' ? 'Usage' : 'Consumption',
      productName: name,
      productSku: sku,
      category,
      quantity: Number(c.quantity || 0),
      unit,
      location,
      date: c.createdAt,
      dateMs: new Date(c.createdAt).getTime(),
      purpose: c.purpose || '',
      reference: c.relatedRequisitionId || '',
      clerkId: c.clerkId || '',
    });
  }

  // ── IN events from requisition lines (closed/paid = delivered) ────────────
  const IN_STATUSES = new Set(['paid', 'closed', 'deliveryNoteAttached', 'creditAndPaid', 'partiallyPaid', 'creditPurchase']);
  for (const req of requisitions) {
    if (!IN_STATUSES.has(req.status)) continue;
    const dateIso = req.updatedAt || req.createdAt;
    if (!isoInRange(dateIso, startMs, endMs)) continue;

    for (const line of req.lines || []) {
      const name = line.description || '';
      // Look up the matching stock item for sku / category
      const item = itemByName.get(name.toLowerCase());
      const sku = item?.sku || '';
      const category = item?.category || '';
      const unit = line.unit || item?.unit || 'units';
      const location = req.location || item?.location || '';

      if (!matchesSearch(name, sku)) continue;

      events.push({
        id: `req_${req.id}_${name}`,
        type: 'IN',
        subtype: 'Requisition',
        productName: name,
        productSku: sku,
        category,
        quantity: Number(line.suppliedQuantity ?? line.quantity ?? 0),
        unit,
        location,
        date: dateIso,
        dateMs: new Date(dateIso).getTime(),
        purpose: req.title || '',
        reference: req.id || '',
        clerkId: req.clerkId || '',
      });
    }
  }

  // ── Sort: newest first ─────────────────────────────────────────────────────
  events.sort((a, b) => b.dateMs - a.dateMs);

  // ── Per-product summary ───────────────────────────────────────────────────
  const summaryMap = new Map();
  for (const ev of events) {
    if (!summaryMap.has(ev.productName)) {
      summaryMap.set(ev.productName, {
        productName: ev.productName,
        productSku: ev.productSku,
        category: ev.category,
        unit: ev.unit,
        totalIn: 0,
        totalOut: 0,
        eventCount: 0,
        lastMovement: ev.date,
      });
    }
    const s = summaryMap.get(ev.productName);
    s.eventCount += 1;
    if (ev.type === 'IN') s.totalIn += ev.quantity;
    else s.totalOut += ev.quantity;
    if (new Date(ev.date) > new Date(s.lastMovement)) s.lastMovement = ev.date;
  }

  const summary = [...summaryMap.values()].map((s) => ({
    ...s,
    netMovement: s.totalIn - s.totalOut,
  })).sort((a, b) => b.eventCount - a.eventCount);

  // ── Matched stock items (for current quantity display) ───────────────────
  const matchedItems = stockItems.filter((i) => matchesSearch(i.name, i.sku));

  return { events, summary, matchedItems };
}

/**
 * Format a movement quantity with sign for display.
 * @param {'IN'|'OUT'} type
 * @param {number} qty
 * @param {string} unit
 */
export function formatMovementQty(type, qty, unit) {
  const sign = type === 'IN' ? '+' : '−';
  return `${sign}${qty} ${unit}`;
}
