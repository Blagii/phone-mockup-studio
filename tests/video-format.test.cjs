const {test}=require('node:test');const assert=require('node:assert/strict');const core=import('../promo-core.js');
test('explicit video formats select only matching supported containers',async()=>{
 const {videoMimeFor}=await core;
 assert.equal(videoMimeFor('webm',()=>true),'video/webm;codecs=vp8');
 assert.equal(videoMimeFor('mp4',()=>true),'video/mp4;codecs=avc1');
 assert.equal(videoMimeFor('mp4',type=>type==='video/mp4'),'video/mp4');
 assert.equal(videoMimeFor('mp4',type=>type.startsWith('video/webm')),null);
 assert.equal(videoMimeFor('webm',type=>type.startsWith('video/mp4')),null);
 assert.equal(videoMimeFor('auto',type=>type==='video/mp4'),null);
 assert.equal(videoMimeFor('auto',()=>false),null);
});
test('video format saves and loads with backwards-compatible defaults',async()=>{
 const {makeScene,validateProject}=await core;
 for(const videoFormat of ['mp4','webm'])assert.equal(validateProject({version:2,scenes:[makeScene('title')],videoFormat}).videoFormat,videoFormat);
 assert.equal(validateProject({version:1,scenes:[makeScene('title')]}).videoFormat,'webm');
 assert.equal(validateProject({version:2,scenes:[makeScene('title')],videoFormat:'bad'}).videoFormat,'webm');
});

test('legacy automatic preferences migrate to explicit WebM without auto switching',async()=>{const {makeScene,validateProject}=await core;assert.equal(validateProject({version:2,scenes:[makeScene('title')],videoFormat:'auto'}).videoFormat,'webm');});
