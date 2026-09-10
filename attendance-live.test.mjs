import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../premium-panels.css',import.meta.url),'utf8');

test('live attendance snapshot refreshes owner dashboard summaries',()=>{
  const snapshotBlock=html.slice(html.indexOf('function startOwnerStaffListeners()'),html.indexOf('function getAttendanceForDate(date)'));
  assert.match(snapshotBlock,/onSnapshot\(staffAttendanceCol/);
  assert.match(snapshotBlock,/refreshOwnerAttendanceSummariesV103\(\)/);
  assert.match(snapshotBlock,/window\.renderV84Dashboard\?\.\(\)/);
  assert.match(snapshotBlock,/window\.renderStaffCenterV84\?\.\(\)/);
});

test('legacy attendance field names normalize before dashboard lookup',()=>{
  const normalizeBlock=html.slice(html.indexOf('function normalizeAttendanceV103'),html.indexOf('async function saveConfig'));
  assert.match(normalizeBlock,/a\.checkIn\|\|a\.checkInTime/);
  assert.match(normalizeBlock,/a\.checkOut\|\|a\.checkOutTime/);
  assert.match(normalizeBlock,/a\.minutesLate\?\?a\.lateMinutes/);
  assert.match(normalizeBlock,/m\.set\(normalizePhone\(a\.phone\),normalizeAttendanceV103\(a\)\)/);
});

test('salary breakdown switches to non-clipping mobile cards',()=>{
  assert.match(css,/@media\(max-width:620px\)[\s\S]*\.salary-break-v101 tr\{display:grid/);
  assert.match(css,/\.salary-panel-v101\{[^}]*min-width:0;max-width:100%;overflow:hidden/);
  assert.match(css,/\.salary-break-v101 td:last-child\{[^}]*white-space:normal/);
});
