'use strict';

const assert = require('assert');
const {
  normalizeStudentName,
  studentNameIdentity,
  hasAtLeastThreeNameParts
} = require('../functions/lib/student-name');

assert.strictEqual(normalizeStudentName('  أَحْمَد   مُحَمَّد علي  '), 'احمد محمد علي');
assert.strictEqual(normalizeStudentName('إبراهيم أحمد على'), 'ابراهيم احمد علي');
assert.strictEqual(normalizeStudentName('آدمـ  محمد، سعيد'), 'ادم محمد سعيد');
assert.strictEqual(hasAtLeastThreeNameParts('محمد علي'), false);
assert.strictEqual(hasAtLeastThreeNameParts('محمد أحمد علي'), true);
assert.strictEqual(
  studentNameIdentity('أحمد محمد علي').nameKey,
  studentNameIdentity('احمد  مُحَمَّد على').nameKey
);
assert.strictEqual(studentNameIdentity('أحمد محمد علي').nameKey.length, 40);

console.log('✓ Arabic triple-name normalization and duplicate identity checks passed');
