/** Empty portal snapshot when the API has not loaded yet (no mock seed data). */
export function createEmptyPortalState() {
  return {
    version: 6,
    companies: [],
    selectedCompanyId: '',
    users: [],
    stockItems: [],
    consumptions: [],
    requisitions: [],
    invoices: [],
    supplierCatalog: [],
    messages: [],
    notifications: [],
    activity: [],
    masterStock: [],
    company: { name: 'Loading…', usersLimit: 0 },
    buyerConnectionsCount: 0,
  };
}
