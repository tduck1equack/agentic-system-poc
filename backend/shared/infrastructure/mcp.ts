import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Agent, fetch as safeFetch } from 'undici';
import { lookup } from 'node:dns';
import { localException, publicAddress, validateEndpoint } from './security';
const dispatcher = new Agent({connect:{lookup(host, options, callback) {
 lookup(host, {...options, all:true}, (error, addresses) => {
  if (error) return callback(error, [], 0);
  if (addresses.some(a => !publicAddress(a.address))) return callback(new Error('Blocked private address'), [], 0);
  if (options.all) callback(null, addresses, 0); else callback(null, addresses[0].address, addresses[0].family);
 });
}}});
export async function withMcp<T>(endpoint:string, token:string, run:(client:Client)=>Promise<T>):Promise<T> {
 const url = await validateEndpoint(endpoint);
 const client = new Client({name:'plugin-lab',version:'1.0.0'});
 const transport = new StreamableHTTPClientTransport(url, {requestInit:{headers:token?{Authorization:`Bearer ${token}`} : {}}, fetch: async (input, init) => {
  const response = await safeFetch(input.toString(), {...init as object, redirect:'error', signal:AbortSignal.timeout(15000), ...(localException(url)?{}:{dispatcher})});
  let size=0;
  const reader=response.body?.getReader();
  const bounded=reader?new ReadableStream({async pull(controller){const {done,value}=await reader.read();if(done){controller.close();return;}size+=value.length;if(size>1048576){await reader.cancel();controller.error(new Error('MCP response too large'));return;}controller.enqueue(value);},cancel(){return reader.cancel();}}):null;
  return new Response(response.status===204?null:bounded, {status:response.status,headers:Object.fromEntries(response.headers)});
 }});
 try { await client.connect(transport); return await run(client); } finally { await client.close().catch(()=>{}); }
}
export async function discover(endpoint:string,token:string) {
 return withMcp(endpoint,token,async c => {
  const tools=[]; let cursor:string|undefined;
  do { const page=await c.listTools({cursor}); tools.push(...page.tools); cursor=page.nextCursor; if(tools.length>50) throw new Error('Maximum 50 tools supported'); } while(cursor);
  if(!tools.length) throw new Error('Plugin must expose at least one tool');
  return tools;
 });
}
