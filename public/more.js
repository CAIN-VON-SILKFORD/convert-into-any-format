/* More tools: OCR, AI tools, signature requests. Loaded after tools.js and before the main script. */
APIOPT.pdfa='<p style="'+NOTE+'">Converts to PDF/A-2b for archiving. Complex layouts can shift slightly, so check the result.</p>';
SFX.pdfa="_pdfa";
const errOf=async r=>{try{return (await r.json()).error||"Something went wrong."}catch(e){return"Something went wrong."}};
const copyBtn=(label,text)=>{const b=document.createElement("button");b.className="sec";b.textContent=label;b.onclick=()=>navigator.clipboard.writeText(text).then(()=>{b.textContent="Copied ✓"}).catch(()=>{});return b};
const preview=(title,text)=>{const d=document.createElement("div");const h=document.createElement("p");h.style.cssText=NOTE;h.textContent=title;const p=document.createElement("div");p.style.cssText="white-space:pre-wrap;font-size:14px;background:var(--bg);border-radius:10px;padding:12px;margin-top:8px";p.textContent=text;d.append(h,p);$("#res").after(d)};
/* ---------- OCR (runs on your device) ---------- */
let TESS=null;
const loadTess=()=>TESS||(TESS=new Promise((res,rej)=>{const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";s.onload=()=>res(window.Tesseract);s.onerror=()=>{TESS=null;rej(Error("Could not load the OCR engine. Check your connection."))};document.head.appendChild(s)}));
/* Adds an invisible text layer so a scanned page becomes searchable. Returns how many words were added. */
function addOcrLayer(doc,font,pageIndex,words,scale){
 const p=doc.getPages()[pageIndex],H=p.getHeight();let n=0;
 for(const w of words){
  const t=(w.text||"").replace(/[^\x20-\x7E]/g,"").trim();if(!t||w.confidence<30)continue;
  const b=w.bbox,h=(b.y1-b.y0)/scale,size=Math.max(4,Math.min(h*.9,60));
  try{p.drawText(t,{x:b.x0/scale,y:H-b.y1/scale+h*.2,size,font,opacity:0});n++}catch(e){}
 }
 return n;
}
OPT.ocr=`<p style="${NOTE}">Reads English text from scanned pages and makes the PDF searchable. It runs on your device and takes about 10 to 20 seconds per page (up to 30 pages).</p>`;
X.ocr=async()=>{
 const pdfj=await pdfjsOpen(files[0]);if(pdfj.numPages>30)throw Error("OCR is limited to 30 pages. Split the PDF first.");
 msg("Loading the OCR engine…");const T=await loadTess(),worker=await T.createWorker("eng");
 try{
  const doc=await load(files[0]),font=await doc.embedFont(StandardFonts.Helvetica),all=[];let found=0;
  await render(files[0],2,"image/png",1,async(i,b,c)=>{msg("Reading page "+i+" of "+pdfj.numPages+"…");const {data}=await worker.recognize(c);found+=addOcrLayer(doc,font,i-1,data.words||[],2);all.push(data.text||"")});
  if(!found)throw Error("No text could be recognized in this PDF.");
  results.push({name:base(files[0])+"_ocr.pdf",blob:blobOf(await doc.save())});
  dlText(base(files[0])+"_ocr.txt",all.join("\n\n"));
 }finally{await worker.terminate()}
};
/* ---------- AI tools (need the server's API key) ---------- */
async function aiCall(body){
 const r=await fetch("/api/ai",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
 if(!r.ok)throw Error(await errOf(r));return (await r.json()).text;
}
const docText=async()=>{const t=(await linesOf(files[0])).join("\n");if(!t.trim())throw Error("No text found. This looks like a scanned PDF. Run PDF OCR first.");return t};
OPT.summarize=`<p style="${NOTE}">The text of your PDF is sent to the server's AI service to write the summary.</p>`;
X.summarize=async()=>{const s=await aiCall({task:"summarize",text:await docText()});dlText(base(files[0])+"_summary.txt",s);preview("Summary",s)};
let CHAT={text:null,hist:[]};
OPT.chat=`<div id="chatlog"></div><label>Your question<input type="text" id="o" placeholder="Ask anything about this PDF"></label><p style="${NOTE}">The text of your PDF is sent to the server's AI service to answer.</p>`;
HOOK.chat=async()=>{CHAT={text:await docText(),hist:[]};$("#chatlog").textContent="";msg("")};
const bubble=(who,t)=>{const d=document.createElement("div");d.style.cssText="margin:8px 0;padding:10px 12px;border-radius:12px;white-space:pre-wrap;font-size:14px;background:"+(who==="user"?"var(--bd)":"var(--bg)");d.textContent=t;$("#chatlog").appendChild(d)};
X.chat=async(t,q)=>{
 q=(q||"").trim();if(!q)throw Error("Type a question.");if(!CHAT.text)CHAT.text=await docText();
 bubble("user",q);$("#o").value="";msg("Thinking…");
 const a=await aiCall({task:"chat",text:CHAT.text,question:q,history:CHAT.hist});
 CHAT.hist.push({role:"user",content:q},{role:"assistant",content:a});bubble("assistant",a);msg("");return"custom";
};
const LANGS=["English","Tamil","Hindi","Telugu","Malayalam","Kannada","French","German","Spanish","Arabic","Japanese","Chinese"];
OPT.translate=`<label>Translate to<select id="o">${LANGS.map(l=>`<option>${l}</option>`).join("")}</select></label><p style="${NOTE}">The text of your PDF is sent to the server's AI service. You get the translation as a text file (up to about 30,000 characters).</p>`;
X.translate=async(t,lang)=>{
 const lines=(await linesOf(files[0])).filter(Boolean);if(!lines.length)throw Error("No text found. This looks like a scanned PDF. Run PDF OCR first.");
 const chunks=[];let cur="";lines.forEach(l=>{if(cur.length+l.length>6000){chunks.push(cur);cur=""}cur+=l+"\n"});if(cur)chunks.push(cur);
 if(chunks.length>5)throw Error("This PDF is too long to translate in one go (limit about 30,000 characters).");
 const out=[];for(let i=0;i<chunks.length;i++){msg("Translating part "+(i+1)+" of "+chunks.length+"…");out.push(await aiCall({task:"translate",text:chunks[i],lang}));prog((i+1)/chunks.length)}
 const s=out.join("\n");dlText(base(files[0])+"_"+lang.toLowerCase()+".txt",s);preview("Translation ("+lang+")",s.slice(0,3000)+(s.length>3000?"\n…":""));
};
/* ---------- request signatures ---------- */
OPT.signreq=`<p style="${NOTE}">Upload a PDF, send the signing link to the person who must sign, then download the signed copy. Links work for 24 hours. This is a simple signature tool, not a certified e-signature service.</p>`;
const linkBlock=(title,url,withQr)=>{
 const box=document.createElement("div");box.style.marginTop="14px";const h=document.createElement("b");h.textContent=title;const lk=document.createElement("div");lk.className="lk";lk.textContent=url;box.append(h,lk);
 if(withQr){const q=qrcode(0,"M");q.addData(url);q.make();const w=document.createElement("div");w.className="qr";w.innerHTML=q.createSvgTag(5,2);box.appendChild(w)}
 const row=document.createElement("div");row.className="row";row.appendChild(copyBtn("Copy link",url));box.appendChild(row);return box;
};
X.signreq=async()=>{
 const fd=new FormData();fd.append("file",files[0]);const r=await fetch("/api/signreq",{method:"POST",body:fd});if(!r.ok)throw Error(await errOf(r));
 const id=(await r.json()).id,res=$("#res");res.textContent="";
 res.append(linkBlock("1. Send this link to the signer",location.origin+"/#sign/"+id,true),linkBlock("2. Keep this link to get the signed PDF",location.origin+"/#signed/"+id,false));
 msg("Signing link created.");return"custom";
};
async function signView(id){
 app.innerHTML=`<div class="panel"><h2 style="margin-top:0">✍️ Sign this document</h2><div id="top"><p style="${NOTE}">Loading…</p></div><div id="ve"></div><div class="row"><button class="pri" id="go" hidden>Finish and send</button></div><div id="msg"></div><div id="res"></div></div>`;
 const r=await fetch("/api/signreq/"+encodeURIComponent(id));
 if(!r.ok){$("#top").textContent="This signing request has expired or does not exist.";return}
 const st=await fetch("/api/signreq/"+encodeURIComponent(id)+"/status");
 if(st.ok&&(await st.json()).signed){$("#top").textContent="This document has already been signed.";return}
 const blob=await r.blob();files=[new File([blob],"document.pdf",{type:"application/pdf"})];
 $("#top").innerHTML=`<p style="${NOTE}">Draw or type your signature, tap the page where it should go, then press Finish and send.</p>`;
 await HOOK.sign();const go=$("#go");go.hidden=false;
 go.onclick=async()=>{
  go.disabled=true;msg("Sending…");
  try{
   results=[];await X.sign();const fd=new FormData();fd.append("file",results[0].blob,"signed.pdf");
   const p=await fetch("/api/signreq/"+encodeURIComponent(id)+"/signed",{method:"POST",body:fd});if(!p.ok)throw Error(await errOf(p));
   $("#ve").textContent="";go.hidden=true;$("#top").textContent="";msg("Signed and sent. You can close this page.");
  }catch(e){msg(e.message,1);go.disabled=false}
 };
}
async function signedView(id){
 app.innerHTML=`<div class="panel"><h2 style="margin-top:0">📄 Signature status</h2><p id="top"></p><div class="row" id="act"></div></div>`;
 const here=location.hash;
 const check=async()=>{
  const r=await fetch("/api/signreq/"+encodeURIComponent(id)+"/status"),top=$("#top"),act=$("#act");if(!top||location.hash!==here)return;
  if(!r.ok){top.textContent="This request has expired or does not exist.";act.textContent="";return}
  if((await r.json()).signed){top.textContent="The document has been signed.";act.textContent="";const a=document.createElement("a");a.className="pri";a.style.cssText="text-decoration:none;display:inline-block";a.href="/api/signreq/"+id+"/signed";a.download="signed.pdf";a.textContent="Download signed PDF";act.appendChild(a);return}
  top.textContent="Waiting for the signature…";act.textContent="";const b=document.createElement("button");b.className="sec";b.textContent="Check again";b.onclick=check;act.appendChild(b);setTimeout(check,8000);
 };
 check();
}
