import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNotificationFeed,notificationKey,submissionNotices} from '../task-notifications.js';
import {normalizeTask,selectTasks,taskTotals,submissionPatch,createTask} from '../task-model.js';
import {createTaskService} from '../task-service.js';
import {fakeSdk} from './fake-sdk.mjs';
const phone='03000000001',base='businesses/noor-traders',photo='data:image/jpeg;base64,/9j/2Q==';
const task=(id,revision=1)=>({id,phone,title:'Shelf '+id,staffName:'Sonu',status:'submitted',submissionId:'submission-'+revision,revision,photoIds:['picture-a','picture-b'],submittedAt:1000+revision,maxPoints:10});

test('missing, null and numeric work dates cannot break the whole task list',()=>{
 const legacy=[{id:'no-date',phone,title:'Clean shelf'},{id:'null-date',phone,date:null,status:'assigned'},{id:'bad-date',phone,date:123},{id:'new',phone,date:'2026-09-09',assignedAt:100},null];
 const rows=selectTasks(legacy);assert.equal(rows.length,4);assert.equal(rows[0].id,'new');assert.equal(rows.find(t=>t.id==='no-date').date,'');assert.equal(rows.find(t=>t.id==='no-date').status,'assigned');
 assert.equal(taskTotals(legacy).total,4);assert.equal(selectTasks(legacy,{from:'2026-09-01',to:'2026-09-30'}).length,1);
 const timestamp=normalizeTask({id:'old',phone,createdAt:{seconds:1788912000},photoIds:null});assert.match(timestamp.date,/^2026-09-09$/);assert.deepEqual(timestamp.photoIds,[]);
});
test('a legacy assigned task with missing revision/status submits through the actual service',async()=>{
 const f=fakeSdk({initialUser:{uid:'staff',isAnonymous:true}});f.records.set(base+'/staffTasks/old',{phone,title:'Clean shelf'});
 const service=createTaskService({fs:{},auth:f.auth,sdk:f.sdk,getStaffPhone:()=>phone});
 await service.submit('old',{photos:[photo],expectedRevision:0,submissionId:'legacy-submission'});
 const t=f.records.get(base+'/staffTasks/old');assert.equal(t.revision,1);assert.equal(t.status,'submitted');assert.equal(t.title,'Clean shelf');assert.equal(t.photoIds.length,1);
});
test('only new committed submissions alert once; approval and cache snapshots do not repeat them',()=>{
 const feed=createNotificationFeed();assert.equal(feed.update([],true).added.length,0);assert.equal(feed.update([task('old')]).added.length,0);
 assert.equal(feed.update([task('old'),task('new')],true).added.length,0);
 assert.deepEqual(feed.update([task('old'),task('new')]).added.map(t=>t.id),['new']);
 assert.equal(feed.update([{...task('new'),status:'approved'},task('old')]).added.length,0);
 assert.equal(feed.update([task('new',2),task('old')]).added.length,1);
 feed.reset();assert.equal(feed.update([task('new',2),task('old')]).added.length,0);
});
test('notification identity is per task and submission, and the inbox is bounded',()=>{
 assert.notEqual(notificationKey(task('one')),notificationKey(task('two')));
 assert.notEqual(notificationKey(task('one',1)),notificationKey(task('one',2)));
 assert.equal(submissionNotices([task('one'),{id:'draft',phone},null]).length,1);
 assert.equal(submissionNotices(Array.from({length:110},(_,i)=>task(String(i),i))).length,100);
});
test('read markers persist per owner and staff cannot access their service methods',async()=>{
 const f=fakeSdk({initialUser:{uid:'owner',email:'hp6235@gmail.com',isAnonymous:false}});const service=createTaskService({fs:{},auth:f.auth,sdk:f.sdk,getStaffPhone:()=>phone});
 const key=notificationKey(task('one'));await service.markNotificationsRead([key]);await service.markNotificationsRead([key]);assert.deepEqual(f.records.get(base+'/staffTaskNotificationReads/owner').seen,[key]);
 let read;const stop=service.listenNotificationReads(keys=>read=keys,assert.fail);await Promise.resolve();assert.deepEqual(read,[key]);stop();
 f.changeUser({uid:'staff',isAnonymous:true});await assert.rejects(()=>service.markNotificationsRead([key]));assert.throws(()=>service.listenNotificationReads(()=>{},()=>{}));
});
