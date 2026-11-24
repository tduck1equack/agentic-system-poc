import 'dotenv/config';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
const app=express();app.use(express.json({limit:'1mb'}));
app.post('/mcp',async(req,res)=>{
 const token=req.headers.authorization;
 const tenant=token==='Bearer alice-demo-token'?'Alice':token==='Bearer bob-demo-token'?'Bob':null;
 if(!tenant){res.status(401).json({error:'Invalid reference token'});return;}
 const articles=[{id:`${tenant.toLowerCase()}-refund`,title:'Refund policy',body:`${tenant} workspace: refunds are available within ${tenant==='Alice'?14:30} days. Contact ${tenant.toLowerCase()}-support@example.test.`},{id:`${tenant.toLowerCase()}-hours`,title:'Support hours',body:`${tenant} support is available Monday to Friday, 09:00–17:00 ICT.`}];
 const server=new McpServer({name:'customer-knowledge',version:'1.0.0'});
 server.registerTool('search_articles',{description:'Search customer knowledge articles',inputSchema:{query:z.string()}},async({query})=>({content:[{type:'text',text:JSON.stringify(articles.filter(a=>(a.title+' '+a.body).toLowerCase().includes(query.toLowerCase())).map(({id,title})=>({id,title})))}]}));
 server.registerTool('get_article',{description:'Fetch an article by ID',inputSchema:{articleId:z.string()}},async({articleId})=>{const article=articles.find(a=>a.id===articleId);return {isError:!article,content:[{type:'text',text:JSON.stringify(article??{error:'Article not found'})}]};});
 const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
 res.on('close',()=>{void transport.close();void server.close();});
 await server.connect(transport);await transport.handleRequest(req,res,req.body);
});
app.get('/health',(_,res)=>res.json({ok:true}));
const port=Number(process.env.REFERENCE_PORT??4100);
app.listen(port,'0.0.0.0',()=>console.log(`Reference MCP listening on ${port}`));
