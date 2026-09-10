import {test} from 'node:test';
import assert from 'node:assert/strict';
import {staffStatusV104} from '../staff-upgrades.js';
const s={phone:'03000000001'},date='2026-09-11';
test('staff status handles per-person grace, AM/PM, leave, weekly off and attendance precedence',()=>{
 assert.equal(staffStatusV104(s,{checkIn:'10:15 AM'},[],date,{shiftStart:'10:00',grace:15}),'present');
 assert.equal(staffStatusV104(s,{checkInTime:'10:16 AM'},[],date,{shiftStart:'10:00',grace:15}),'late');
 assert.equal(staffStatusV104(s,{},[],date,{weeklyOff:[5]}),'off');
 const leave=[{phone:s.phone,kind:'leave',date,to:date,status:'approved'}];
 assert.equal(staffStatusV104(s,{},leave,date,{}),'leave');
 assert.equal(staffStatusV104(s,{checkIn:'09:00'},leave,date,{shiftStart:'09:00'}),'present');
 assert.equal(staffStatusV104(s,{},[{...leave[0],status:'pending'}],date,{}),'absent');
});
