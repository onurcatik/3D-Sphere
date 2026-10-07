const fs = require('fs');
const path = require('path');
let ts;
try { ts = require('typescript'); }
catch (_) { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js'); }
const root = path.resolve(__dirname, '..');
const files = [];
function walk(dir){
  for(const name of fs.readdirSync(dir)){
    const p = path.join(dir,name);
    const st = fs.statSync(p);
    if(st.isDirectory()) walk(p);
    else if(/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) files.push(p);
  }
}
for(const dir of ['app','components','lib']) walk(path.join(root,dir));
const errors=[];
for(const file of files){
  const source=fs.readFileSync(file,'utf8');
  const out=ts.transpileModule(source,{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.Preserve}});
  for(const d of out.diagnostics||[]){
    if(d.category===ts.DiagnosticCategory.Error){
      errors.push({file:path.relative(root,file),code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,' ')})
    }
  }
}
console.log(JSON.stringify({files:files.length,errors},null,2));
process.exit(errors.length?1:0);
