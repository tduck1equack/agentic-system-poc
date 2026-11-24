import {test} from 'node:test';
import assert from 'node:assert/strict';
import {discover,withMcp} from '../backend/shared/infrastructure/mcp';
const endpoint=process.env.TEST_MCP_URL;
test('reference MCP discovery, token isolation, invalid credentials',{skip:!endpoint},async()=>{
 process.env.ALLOW_LOCAL_MCP='true';process.env.REFERENCE_MCP_URL=endpoint;
 const tools=await discover(endpoint!,'alice-demo-token');assert.equal(tools.length,2);
 const call=(token:string,id:string)=>withMcp(endpoint!,token,c=>c.callTool({name:'get_article',arguments:{articleId:id}}));
 const own=await call('alice-demo-token','alice-refund');assert.match(JSON.stringify(own),/14 days/);
 const other=await call('bob-demo-token','alice-refund');assert.equal(other.isError,true);
 await assert.rejects(discover(endpoint!,'wrong-token'));
});
