const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../promo.js'),'utf8');
const code=source.slice(source.indexOf('    const downloads = new Map();'),source.indexOf("    $('promo-save').onclick"));
function setup(){
 const urls=[],revoked=[];let blocked=0;
 function element(){return{children:[],dataset:{},hidden:false,setAttribute(){},querySelector(){return this.button ||= {};},append(child){this.children.push(child);child.parent=this;},remove(){this.parent.children=this.parent.children.filter(c=>c!==this);},click(){blocked++;throw new Error('automatic downloads blocked');}};}
 const links=element(),body=element(),win={};win.self=win;win.top=win;
 const sandbox={Map,Blob,window:win,document:{body,createElement:element},$:()=>links,console:{warn(){}},URL:{createObjectURL(){const url=`blob:file-${urls.length}`;urls.push(url);return url;},revokeObjectURL(url){revoked.push(url);}}};
 vm.createContext(sandbox);vm.runInContext(code,sandbox);
 return {sandbox,links,panel:body.children[0],revoked,get blocked(){return blocked;}};
}
test('completed files remain linked when automatic downloads are blocked',()=>{
 const ctx=setup();ctx.sandbox.download(new Blob(['{}'],{type:'application/json'}),'promo-studio.json');
 assert.equal(ctx.blocked,1);assert.equal(ctx.panel.hidden,false);assert.equal(ctx.links.children.length,1);
 assert.equal(ctx.links.children[0].download,'promo-studio.json');assert.equal(ctx.links.children[0].dataset.file,'project');
 assert.deepEqual(ctx.revoked,[],'URLs must not expire after a timeout');
});
test('replacing a project releases only its previous URL, retaining the video link',()=>{
 const ctx=setup();ctx.sandbox.download(new Blob(['{}'],{type:'application/json'}),'a.json');
 ctx.sandbox.download(new Blob(['video'],{type:'video/webm'}),'video.webm');
 ctx.sandbox.download(new Blob(['new'],{type:'application/json'}),'b.json');
 assert.equal(ctx.links.children.length,2);assert.deepEqual(ctx.revoked,['blob:file-0']);
 assert.equal(ctx.links.children[0].href,'blob:file-1');assert.equal(ctx.links.children[1].download,'b.json');
 ctx.panel.button.onclick();assert.equal(ctx.panel.hidden,true);
});
