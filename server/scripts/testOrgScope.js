/**
 * Quick regression checks for department/location scope normalization (Lab vs Laboratory, etc.).
 * Run: npm run test:scope -w server
 */
import assert from 'node:assert/strict';
import {
  normalizeOrgScopePart,
  userOrgScopeKey,
  portalBroadcastMatchesUser,
} from '../src/services/orgScope.js';
import * as clientOrg from '../../client/src/utils/orgScope.js';

function run() {
  assert.equal(normalizeOrgScopePart('Lab'), 'laboratory');
  assert.equal(normalizeOrgScopePart('LAB'), 'laboratory');
  assert.equal(normalizeOrgScopePart('labs'), 'laboratory');
  assert.equal(normalizeOrgScopePart('laboratory'), 'laboratory');
  assert.equal(normalizeOrgScopePart('Nurse'), 'nursing');
  assert.equal(normalizeOrgScopePart('nurses'), 'nursing');

  const kLab = userOrgScopeKey({ location: 'Silver back', department: 'Lab' });
  const kLx = userOrgScopeKey({ location: 'Sliverback Mall', department: 'Laboratory' });
  assert.equal(kLab, kLx, 'Lab clerk + Laboratory stock should share scope key');

  assert.ok(
    portalBroadcastMatchesUser(
      { scopeDepartment: 'Laboratory', scopeLocation: 'Silverback Mall' },
      { location: 'silver back', department: 'lab', team: '' }
    ),
    'Scoped notification should match Lab user against Laboratory + mall location'
  );

  assert.equal(clientOrg.normalizeOrgScopePart('Lab'), 'laboratory');
  assert.equal(clientOrg.normalizeOrgScopePart('laboratory'), 'laboratory');
  const ck1 = clientOrg.userOrgScopeKey({ location: 'Silver back', department: 'Labs' });
  const ck2 = clientOrg.userOrgScopeKey({ location: 'Sliverback Mall', department: 'Laboratory' });
  assert.equal(ck1, ck2, 'client orgScope must match server for clerk directory / pooling');
}

run();
console.log('testOrgScope: all assertions passed');
