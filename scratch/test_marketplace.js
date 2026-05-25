const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../server/.env') });

const API_BASE = 'http://localhost:5000/api';

async function runTest() {
  console.log('--- STARTING MARKETPLACE SAME-INDUSTRY TEST ---');

  // 1. Login as Fabrice
  const passwords = ['91073@Tecy', 'Masangano@16', 'Demo@1234'];
  let token = null;
  
  for (const password of passwords) {
    try {
      const loginRes = await axios.post(`${API_BASE}/auth/login`, {
        email: 'hr@ivuriro.rw',
        password
      });
      token = loginRes.data.token;
      console.log(`Login successful for hr@ivuriro.rw using password: ${password}`);
      break;
    } catch (e) {
      // try next
    }
  }
  
  if (!token) {
    throw new Error('TEST FAILED: Unable to authenticate with any known password!');
  }

  const headers = { Authorization: `Bearer ${token}` };

  // 2. Fetch Supplier Directory
  const dirRes = await axios.get(`${API_BASE}/supplier-directory`, { headers });
  const suppliers = dirRes.data.suppliers;

  console.log(`Buyer industry: ${dirRes.data.buyerIndustry || '(none)'}, locked: ${dirRes.data.buyerIndustryLocked}`);
  console.log(`Linked count: ${dirRes.data.linkedCount}, total: ${dirRes.data.total}`);
  
  console.log(`Fetched directory. Total suppliers returned: ${suppliers.length}`);

  const stateBefore = await axios.get(`${API_BASE}/portal/state`, { headers });
  console.log(`Portal marketplaceAvailableCount: ${stateBefore.data.marketplaceAvailableCount}`);
  
  const alu = suppliers.find(s => s.companyName === 'ALU');
  const eCungaStore = suppliers.find(s => s.companyName === 'eCunga store');
  const labscrollMedicals = suppliers.find(s => s.companyName === 'Labscroll medicals');

  console.log('Suppliers List:');
  suppliers.forEach(s => console.log(`- ${s.companyName} (Industry: ${s.industry})`));

  if (alu) {
    throw new Error('TEST FAILED: ALU (Other industry) should not be returned in the marketplace!');
  } else {
    console.log('✓ SUCCESS: ALU was correctly filtered out.');
  }

  if (!eCungaStore || !labscrollMedicals) {
    throw new Error('TEST FAILED: Healthcare suppliers eCunga store and Labscroll medicals should be returned!');
  } else {
    console.log('✓ SUCCESS: eCunga store and Labscroll medicals are visible.');
  }

  // 3. Connect to eCunga store
  const connectRes = await axios.post(`${API_BASE}/supplier-directory/${eCungaStore.id}/connect`, {}, { headers });
  console.log('Connect response:', connectRes.data.message);

  // 4. Verify in buildPortalState
  const stateRes = await axios.get(`${API_BASE}/portal/state`, { headers });
  const users = stateRes.data.users;
  const irene = users.find(u => u.email === 'benithehirwa@gmail.com');

  if (!irene) {
    throw new Error('TEST FAILED: Irene Fiston HIRWA (eCunga store supplier user) should now be in state.users!');
  } else {
    console.log(`✓ SUCCESS: Irene Fiston HIRWA is now available in state.users with role ${irene.role} and status ${irene.isActive ? 'Active' : 'Inactive'}.`);
  }

  // 5. Try to connect to ALU (different industry) directly via POST
  const aluId = 'supplier_company_b2caa9e8-bcb1-425d-8811-9ad427521a2c';
  try {
    await axios.post(`${API_BASE}/supplier-directory/${aluId}/connect`, {}, { headers });
    throw new Error('TEST FAILED: Direct connection to ALU (Other industry) should have failed!');
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('✓ SUCCESS: Direct connection to ALU failed with 400 Bad Request, as expected.');
      console.log('  Error message from server:', error.response.data.error);
    } else {
      throw error;
    }
  }

  console.log('--- ALL TESTS PASSED SUCCESSFULLY! ---');
}

runTest().catch(err => {
  console.error('Test run failed:', err.message);
  if (err.response) {
    console.error('Response data:', err.response.data);
  }
  process.exit(1);
});
