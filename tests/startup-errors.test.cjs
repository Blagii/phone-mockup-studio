const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
const start=html.indexOf('            let studioStarted = false;');
const script=html.slice(start,html.indexOf('</script>',start));
function setup(){
 const nodes={'startup-error':{hidden:true},'startup-error-message':{},'startup-error-close':{},'studio-entry':{tagName:'SCRIPT'}};
 let errorHandler;const window={addEventListener:(name,handler)=>{if(name==='error')errorHandler=handler;}};
 vm.runInNewContext(script,{window,document:{getElementById:id=>nodes[id]},location:{protocol:'http:'}});
 return {nodes,window,dispatch:event=>errorHandler(event)};
}
test('only the application entry module resource failure is treated as fatal startup failure',()=>{
 const ctx=setup();ctx.dispatch({target:{tagName:'SCRIPT'}});assert.equal(ctx.nodes['startup-error'].hidden,true);
 ctx.dispatch({target:ctx.nodes['studio-entry']});assert.equal(ctx.nodes['startup-error'].hidden,false);
 ctx.nodes['startup-error-close'].onclick();assert.equal(ctx.nodes['startup-error'].hidden,true);
});
test('successful startup clears early warnings and ignores subsequent errors',()=>{
 const ctx=setup();ctx.dispatch({error:new Error('early'),message:'early'});assert.equal(ctx.nodes['startup-error'].hidden,false);
 ctx.window.markStudioStarted();assert.equal(ctx.nodes['startup-error'].hidden,true);
 ctx.dispatch({target:{tagName:'SCRIPT'}});ctx.dispatch({error:new Error('late'),message:'late'});
 assert.equal(ctx.nodes['startup-error'].hidden,true);
});
