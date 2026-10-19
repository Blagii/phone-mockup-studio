const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
test('local server serves modules as JavaScript despite Windows MIME overrides',()=>{
 const code=`import importlib.util, mimetypes, threading, urllib.request
spec=importlib.util.spec_from_file_location('studio_server', ${JSON.stringify(path.resolve(__dirname,'../serve.py'))})
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
mimetypes.add_type('text/plain','.mjs')
mimetypes.add_type('text/plain','.js')
from functools import partial
server=module.ThreadingHTTPServer(('127.0.0.1',0),partial(module.StudioHandler,directory=${JSON.stringify(path.resolve(__dirname,'..'))}))
thread=threading.Thread(target=server.serve_forever,daemon=True)
thread.start()
try:
 for filename, expected in [('promo-core.js','text/javascript'),('promo.js','text/javascript'),('promo.css','text/css'),('index.html','text/html'),('vendor/three/three.module.js','text/javascript'),('vendor/three/examples/jsm/utils/BufferGeometryUtils.js','text/javascript')]:
  with urllib.request.urlopen('http://127.0.0.1:'+str(server.server_port)+'/'+filename) as response:
   assert response.headers.get_content_type()==expected,(filename,response.headers)
   assert len(response.read())>0
   assert response.headers.get('Cache-Control')=='no-store'
finally:
 server.shutdown()
 server.server_close()
`;
 const result=spawnSync('python3',['-c',code],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});
test('launcher serves the project from another directory and avoids an occupied port',()=>{
 const code=`import subprocess, sys, socket, urllib.request, tempfile
from pathlib import Path
launcher=Path(${JSON.stringify(path.resolve(__dirname,'../serve.py'))})
with socket.socket() as occupied:
 occupied.bind(('127.0.0.1',0))
 occupied.listen()
 port=occupied.getsockname()[1]
 with tempfile.TemporaryDirectory() as other_directory:
  child=subprocess.Popen([sys.executable,'-u',str(launcher),'--port',str(port)],cwd=other_directory,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
  try:
   child.stdout.readline()
   address=child.stdout.readline().strip().split('Studio: ')[1]
   assert ':'+str(port)+'/' not in address,'must not reopen the old server'
   with urllib.request.urlopen(address+'promo-core.js') as response:
    assert response.headers.get_content_type()=='text/javascript'
    assert b'export const SHOTS' in response.read()
  finally:
   child.terminate()
   child.communicate(timeout=5)
`;
 const result=spawnSync('python3',['-c',code],{encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,result.stderr||String(result.error));
});
