import {createHash,timingSafeEqual} from 'node:crypto';

export function authorized(header,env=process.env) {
  if (!env.ARYA_OPERATOR_USER || !env.ARYA_OPERATOR_PASSWORD || env.ARYA_OPERATOR_PASSWORD.length<32) return false;
  const match=/^Basic ([A-Za-z0-9+/=]+)$/.exec(header || '');
  if (!match) return false;
  const hash=text=>createHash('sha256').update(text).digest();
  return timingSafeEqual(hash(Buffer.from(match[1],'base64').toString('utf8')),hash(`${env.ARYA_OPERATOR_USER}:${env.ARYA_OPERATOR_PASSWORD}`));
}
export function gateway(path,{env=process.env,request=fetch}={}) {
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    if (!authorized(req.headers.authorization,env)) {
      res.setHeader('WWW-Authenticate','Basic realm="Arya", charset="UTF-8"');
      return res.status(401).json({error:'Sign in required'});
    }
    if (path==='session') { res.setHeader('Location','/'); return res.status(303).end(); }
    if (req.method!=='POST') return res.status(405).json({error:'POST required'});
    const origin=req.headers.origin;
    if (origin && origin!==`https://${req.headers.host}` && !(env.NODE_ENV!=='production' && origin===`http://${req.headers.host}`)) return res.status(403).json({error:'Cross-origin request rejected'});
    if (!env.ARYA_BACKEND_API_KEY || !env.ARYA_BACKEND_URL) return res.status(503).json({error:'Service not configured'});
    let url;
    try { url=new URL(path,`${env.ARYA_BACKEND_URL.replace(/\/$/,'')}/`); }
    catch (_) { return res.status(503).json({error:'Service not configured'}); }
    if (url.protocol!=='https:') return res.status(503).json({error:'Secure backend required'});
    const body=typeof req.body==='string'?req.body:JSON.stringify(req.body);
    if (!body || Buffer.byteLength(body)>128*1024) return res.status(413).json({error:'Request too large'});
    const abort=new AbortController();
    const timer=setTimeout(()=>abort.abort(),90000);
    const disconnected=()=>{if (!res.writableEnded) abort.abort();};
    res.on('close',disconnected);
    try {
      const upstream=await request(url,{method:'POST',body,headers:{'Content-Type':'application/json',Authorization:`Bearer ${env.ARYA_BACKEND_API_KEY}`},signal:abort.signal,redirect:'error'});
      if (!upstream.ok) return res.status(upstream.status).json({error:upstream.status===429?'Usage limit reached':'AI service unavailable'});
      res.status(200);
      res.setHeader('Content-Type',path==='ask/stream'?'text/event-stream':'application/json');
      let count=0;
      for await (const chunk of upstream.body) {
        count+=chunk.byteLength;
        if (count>2*1024*1024) throw new Error('Response limit exceeded');
        if (!res.write(chunk)) await new Promise((resolve,reject)=>{res.once('drain',resolve);res.once('error',reject);abort.signal.addEventListener('abort',()=>reject(new Error('Disconnected')),{once:true});});
      }
      res.end();
    } catch (_) {
      if (!res.headersSent) res.status(502).json({error:'AI service unavailable'});
      else res.end();
    } finally {clearTimeout(timer);res.off('close',disconnected);}
  };
}
