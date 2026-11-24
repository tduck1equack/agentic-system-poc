import 'dotenv/config';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
const enabled=process.env.INTEGRATION==='true';
test('Nest API: publish, install, isolate, run agent, disable, uninstall',{skip:!enabled,timeout:60000},async()=>{
 const env={...process.env,PORT:'3099',ALLOW_LOCAL_MCP:'true',REFERENCE_MCP_URL:'http://localhost:4100/mcp',CREDENTIAL_KEY:randomBytes(32).toString('hex'),OPENAI_API_KEY:'mock-key',OPENAI_BASE_URL:'http://localhost:4199/v1'};
 const children=[spawn(process.execPath,['--import','tsx','backend/main.ts'],{env,stdio:['ignore','pipe','pipe']}),spawn(process.execPath,['--import','tsx','reference/server.ts'],{env,stdio:['ignore','pipe','pipe']})];
 let logs='';for(const child of children){child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);}
 const mock=createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);const id=JSON.parse(body.instructions.split('Available installations: ')[1])[0]?.installationId;const outputs=body.input.filter((i:any)=>i.type==='function_call_output');let output:any;
 if(!id) output={type:'message',id:'m',role:'assistant',status:'completed',content:[{type:'output_text',text:'No plugin installed.',annotations:[]}]};
 else if(!outputs.length)output={type:'function_call',id:'f1',call_id:'c1',name:'read_plugin_instructions',arguments:JSON.stringify({installationId:id}),status:'completed'};
 else if(outputs.length===1)output={type:'function_call',id:'f2',call_id:'c2',name:body.tools.find((t:any)=>t.description==='Fetch an article by ID').name,arguments:JSON.stringify({articleId:'alice-refund'}),status:'completed'};
 else output={type:'message',id:'m',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.parse(JSON.parse(outputs[1].output).content[0].text).body,annotations:[]}]};
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id:'r',object:'response',status:'completed',output:[output]}));});
 await new Promise<void>(resolve=>mock.listen(4199,'127.0.0.1',resolve));
 const base='http://localhost:3099/api/';
 async function call(path:string,body?:unknown,cookie='',method=body?'POST':'GET') {return fetch(base+path,{method,headers:{'Content-Type':'application/json',cookie},...(body?{body:JSON.stringify(body)}:{})});}
 async function login(email:string){const r=await call('login',{email,password:process.env.DEMO_PASSWORD??'demo-password'});assert.equal(r.status,200);return r.headers.get('set-cookie')!.split(';')[0];}
 try {
 let ready=false;for(let i=0;i<60;i++){try{if((await call('me')).status===401){ready=true;break;}}catch{}await delay(250);}assert.ok(ready,logs);
 const developer=await login('developer@demo.local'),alice=await login('alice@demo.local'),bob=await login('bob@demo.local');
 const created=await call('developer/plugins',{name:'Integration '+Date.now(),description:'Customer knowledge',markdown:'Use get_article and cite the ID.',endpoint:env.REFERENCE_MCP_URL,auth:'bearer'},developer);assert.equal(created.status,200);const plugin=await created.json();
 assert.equal((await call(`developer/plugins/${plugin.id}/publish`,undefined,developer)).status,404);
 assert.equal((await call(`developer/plugins/${plugin.id}/publish`,{token:'alice-demo-token'},alice)).status,403);
 assert.equal((await call(`developer/plugins/${plugin.id}/publish`,{token:'wrong'},developer)).status,400);
 const publish=await call(`developer/plugins/${plugin.id}/publish`,{token:'alice-demo-token'},developer);assert.equal(publish.status,200);const version=await publish.json();
 assert.equal((await call(`developer/plugins/${plugin.id}`,{...plugin,markdown:'Changed draft instructions'},developer,'PATCH')).status,200);
 const publishedCatalog=await (await call('catalog',undefined,developer)).json();
 assert.equal(publishedCatalog.find((p:any)=>p.id===version.id).markdown,'Use get_article and cite the ID.');
 const install=await call('installations',{versionId:version.id,token:'alice-demo-token'},alice);assert.equal(install.status,200);const installed=await install.json();
 assert.equal((await call('installations',{versionId:version.id,token:'alice-demo-token'},alice)).status,409);
 assert.equal((await call(`installations/${installed.id}`,{enabled:false},bob,'PATCH')).status,404);
 const listed=await (await call('installations',undefined,alice)).text();assert.ok(!listed.includes('alice-demo-token'));assert.ok(!listed.includes('credential'));
 const c=await (await call('conversations',{},alice)).json();assert.equal((await call(`conversations/${c.id}`,undefined,bob)).status,404);
 const stream=await (await call(`conversations/${c.id}/messages`,{prompt:'Refund policy?'},alice)).text();assert.match(stream,/instructions/);assert.match(stream,/\"kind\":\"tool\"/);assert.ok(!stream.includes('\"kind\":\"error\"'));assert.match(stream,/14 days/);assert.ok(!stream.includes('Changed draft instructions'));assert.match(stream,/Use get_article and cite the ID/);assert.ok(!stream.includes('alice-demo-token'));
 await call(`installations/${installed.id}`,{enabled:false},alice,'PATCH');
 const c2=await (await call('conversations',{},alice)).json();const disabled=await (await call(`conversations/${c2.id}/messages`,{prompt:'Refund policy?'},alice)).text();assert.match(disabled,/No plugin installed/);assert.ok(!disabled.includes('"kind":"tool"'));
 assert.equal((await call(`installations/${installed.id}`,{},alice,'DELETE')).status,200);
 } finally {for(const child of children)child.kill('SIGTERM');await new Promise<void>(resolve=>mock.close(()=>resolve()));}
});
