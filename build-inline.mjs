// Keep the three-file upload workflow: index.html contains its own UI/auth code.
import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../',import.meta.url),read=n=>readFileSync(new URL(n,root),'utf8');
function namespace(file,name,prelude=''){
 const source=read(file),exports=[...source.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(\w+)/g)].map(m=>m[1]);
 const code=source.replace(/import[\s\S]*?from\s*["'][^"']+["'];/g,'').replace(/export /g,'');
 return `const ${name}=(()=>{\n${prelude}\n${code}\nreturn {${exports.join(',')}};\n})();\n`;
}
let bundle='/* BEGIN V99 INLINE MODULES */\n';
bundle+=namespace('auth-controller.js','AuthV99');
bundle+=namespace('task-model.js','TaskModelV99');
bundle+=namespace('task-service.js','TaskServiceV99','const {createTask,submissionPatch,reviewPatch,validPhoto,requireValue,normalizeTask}=TaskModelV99;const {isOwnerUser}=AuthV99;');
bundle+=namespace('task-notifications.js','TaskNoticeV100','const {normalizeTasks,escapeHtml:e}=TaskModelV99;');
bundle+=namespace('staff-tasks.js','TaskUIV99','const {installTaskNotifications}=TaskNoticeV100;const {MAX_PHOTOS,MAX_PHOTO_CHARS,STATUS,escapeHtml:e,workDate,selectTasks,taskTotals,reportDocument,requireValue}=TaskModelV99;');
bundle+='const {createAuthController,isOwnerUser,loginErrorMessage}=AuthV99;\nconst {createTaskService}=TaskServiceV99;\nconst {installTaskUI}=TaskUIV99;\n/* END V99 INLINE MODULES */';
let html=read('index.html');
if(html.includes('/* BEGIN V99 INLINE MODULES */'))html=html.replace(/\/\* BEGIN V99 INLINE MODULES \*\/[\s\S]*?\/\* END V99 INLINE MODULES \*\//,()=>bundle);
else html=html.replace(/import \{createAuthController,isOwnerUser,loginErrorMessage\} from '\.\/auth-controller\.js';\s*import \{createTaskService\} from '\.\/task-service\.js';\s*import \{installTaskUI\} from '\.\/staff-tasks\.js';/,()=>bundle);
const css='<style id="taskStylesV99">\n'+read('staff-tasks.css')+'\n</style>';
html=html.includes('<style id="taskStylesV99">')?html.replace(/<style id="taskStylesV99">[\s\S]*?<\/style>/,()=>css):html.replace('<link rel="stylesheet" href="./staff-tasks.css?v=v99">',()=>css);
const premium='<style id="premiumPanelsV100">\n'+read('premium-panels.css')+'\n</style>';
html=html.includes('<style id="premiumPanelsV100">')?html.replace(/<style id="premiumPanelsV100">[\s\S]*?<\/style>/,()=>premium):html.slice(0,html.lastIndexOf('</body>'))+premium+'\n'+html.slice(html.lastIndexOf('</body>'));
html=html.replace(/\/\* BEGIN V104 STAFF MODULE \*\/[\s\S]*?\/\* END V104 STAFF MODULE \*\//,()=> '/* BEGIN V104 STAFF MODULE */\n'+namespace('staff-upgrades.js','StaffUpgradesV104')+'/* END V104 STAFF MODULE */');
const declared=JSON.parse(read('version.json')).version;
for(const id of ['loginVersionLabel','staffVersionLabel','headerVersionLabel','settingsVersionV84']){
 html=html.replace(new RegExp(`(id="${id}"[^>]*>)[^<]*`),`$1${declared}`);
}
writeFileSync(new URL('index.html',root),html);
// Safety: app ka andar wala version aur version.json hamesha barabar hone chahiye,
// warna boot gate update loop mein phans jata hai.
const inApp=(html.match(/const APP_VERSION_V85='([^']+)'/)||[])[1];
const inSw=(read('sw.js').match(/const APP_VERSION='([^']+)'/)||[])[1];
if(declared!==inApp||declared!==inSw){console.error(`VERSION MISMATCH: version.json=${declared}, APP_VERSION_V85=${inApp}, sw.js=${inSw}`);process.exit(1)}
console.log(`Built standalone ${declared} index.html`);
