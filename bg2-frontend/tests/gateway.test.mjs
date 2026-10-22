import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {authorized,gateway} from '../server/gateway.mjs';
const env={ARYA_OPERATOR_USER:'operator',ARYA_OPERATOR_PASSWORD:'test-only-long-password-with-more-than-32-characters',ARYA_BACKEND_API_KEY:'server-only-test-key',ARYA_BACKEND_URL:'https://backend.example',NODE_ENV:'production'};
const authorization='Basic '+Buffer.from(`${env.ARYA_OPERATOR_USER}:${env.ARYA_OPERATOR_PASSWORD}`).toString('base64');
function response(){const res=new EventEmitter();res.headers={};res.chunks=[];res.setHeader=(k,v)=>{res.headers[k]=v};res.status=code=>{res.statusCode=code;return res};res.json=body=>{res.body=body;res.writableEnded=true;return res};res.end=()=>{res.writableEnded=true};res.write=chunk=>{res.headersSent=true;res.chunks.push(chunk);return true};return res;}
test('missing configuration and unauthorized callers fail closed',async()=>{
 assert(!authorized(authorization,{}));assert(!authorized('Bearer public-key',env));
 let called=false;const res=response();await gateway('ask',{env,request:async()=>{called=true}})({headers:{},method:'POST',body:{}},res);
 assert.equal(res.statusCode,401);assert.equal(called,false);
});
test('backend key is injected only upstream and response contains no credential',async()=>{
 let outgoing;const res=response();await gateway('ask',{env,request:async(_url,options)=>{outgoing=options;return {ok:true,body:[Buffer.from('{"response_text":"test"}')]}}})({headers:{authorization,host:'app.example',origin:'https://app.example'},method:'POST',body:{question:'test'}},res);
 assert.equal(outgoing.headers.Authorization,'Bearer server-only-test-key');assert.equal(res.statusCode,200);
 assert(!JSON.stringify(res.headers).includes(env.ARYA_BACKEND_API_KEY));assert(!Buffer.concat(res.chunks).toString().includes(env.ARYA_BACKEND_API_KEY));
});
test('cross-origin mutations and oversized requests never reach the provider',async()=>{
 for(const [headers,body,status] of [[{origin:'https://other.example'}, {},403],[{},'x'.repeat(128*1024+1),413]]){
  const res=response();await gateway('ask',{env,request:()=>{throw new Error('Must not run')}})({headers:{authorization,host:'app.example',...headers},method:'POST',body},res);assert.equal(res.statusCode,status);
 }
});
test('provider usage refusal propagates without leaking provider response',async()=>{
 const res=response();await gateway('ask',{env,request:async()=>({ok:false,status:429})})({headers:{authorization,host:'app.example'},method:'POST',body:{}},res);assert.equal(res.statusCode,429);assert.equal(res.body.error,'Usage limit reached');
});
