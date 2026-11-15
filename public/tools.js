/* Extra tools. Loaded before the main script; everything here runs only when a tool is opened. */
const X={},OPT={},HOOK={},SFX={protect:"_protected",unlock:"_unlocked"};
const APIOPT={
 protect:'<label>Password<input type="text" id="o" placeholder="Choose a password"></label>',
 unlock:'<label>Password of this PDF<input type="text" id="o" placeholder="Enter its password"></label>',
 media:'<label>Convert to<select id="o"><option value="mp3">MP3 (audio)</option><option value="wav">WAV (audio)</option><option value="ogg">OGG (audio)</option><option value="mp4">MP4 (video)</option><option value="gif">GIF (first 10 seconds)</option></select></label>'
};
const NOTE="font-size:13px;color:var(--mut)";
const dlText=(name,txt)=>results.push({name,blob:new Blob([txt],{type:"text/plain"})});
const pdfjsOpen=async f=>pdfjsLib.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise;
async function linesOf(f){
 const pdf=await pdfjsOpen(f),out=[];
 for(let i=1;i<=pdf.numPages;i++){
  const tc=await (await pdf.getPage(i)).getTextContent();let y=null,line="";
  tc.items.forEach(it=>{const ny=Math.round(it.transform[5]);if(y!==null&&Math.abs(ny-y)>3){out.push(line.trim());line=""}y=ny;line+=it.str+(it.hasEOL?"\n":"")});
  out.push(line.trim());prog(i/pdf.numPages)}
 return out.filter(Boolean);
}
/* ---------- simple browser tools ---------- */
X.text=async()=>{const l=await linesOf(files[0]);if(!l.length)throw Error("No text found. This looks like a scanned PDF.");dlText(base(files[0])+".txt",l.join("\n"))};
OPT.crop=`<label>Trim top, right, bottom, left (%)<input type="text" id="o" value="5,5,5,5"></label>`;
X.crop=async(t,o)=>{
 const v=(o||"").split(",").map(Number);if(v.length!==4||v.some(n=>isNaN(n)||n<0||n>45))throw Error("Enter four numbers between 0 and 45, like 5,5,5,5.");
 const s=await load(files[0]);
 s.getPages().forEach(p=>{const {width:w,height:h}=p.getSize();p.setCropBox(w*v[3]/100,h*v[2]/100,w*(1-(v[1]+v[3])/100),h*(1-(v[0]+v[2])/100))});
 results.push({name:base(files[0])+"_cropped.pdf",blob:blobOf(await s.save())});
};
OPT.metadata=`<label>Title<input type="text" id="m1"></label><label>Author<input type="text" id="m2"></label><label>Subject<input type="text" id="m3"></label><label>Keywords (comma separated)<input type="text" id="m4"></label>`;
HOOK.metadata=async()=>{try{const s=await load(files[0]);$("#m1").value=s.getTitle()||"";$("#m2").value=s.getAuthor()||"";$("#m3").value=s.getSubject()||"";$("#m4").value=s.getKeywords()||""}catch(e){}};
X.metadata=async()=>{const s=await load(files[0]);s.setTitle($("#m1").value);s.setAuthor($("#m2").value);s.setSubject($("#m3").value);s.setKeywords($("#m4").value.split(",").map(x=>x.trim()).filter(Boolean));
 results.push({name:base(files[0])+"_metadata.pdf",blob:blobOf(await s.save())})};
X.flatten=async()=>{const s=await load(files[0]);s.getForm().flatten();results.push({name:base(files[0])+"_flat.pdf",blob:blobOf(await s.save())})};
X.repair=async()=>{
 let src;try{src=await PDFDocument.load(await files[0].arrayBuffer(),{ignoreEncryption:true,throwOnInvalidObject:false})}catch(e){throw Error("This file is too damaged to repair.")}
 const d=await PDFDocument.create();(await d.copyPages(src,src.getPageIndices())).forEach(p=>d.addPage(p));
 results.push({name:base(files[0])+"_repaired.pdf",blob:blobOf(await d.save())});
};
OPT.imgconv=`<label>Convert to<select id="o"><option value="png">PNG</option><option value="jpeg">JPG</option><option value="webp">WebP</option></select></label>`;
X.imgconv=async(t,o)=>{
 for(let i=0;i<files.length;i++){const bm=await createImageBitmap(files[i]),c=document.createElement("canvas");c.width=bm.width;c.height=bm.height;const x=c.getContext("2d");
  if(o==="jpeg"){x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height)}x.drawImage(bm,0,0);
  const b=await canvasBlob(c,"image/"+o,.92);if(!b||b.type!=="image/"+o)throw Error("This browser cannot create "+o.toUpperCase()+" files.");
  results.push({name:base(files[i])+"."+(o==="jpeg"?"jpg":o),blob:b});prog((i+1)/files.length)}
};
/* ---------- compare ---------- */
X.compare=async()=>{
 if(files.length!==2)throw Error("Add exactly two PDFs to compare.");
 const a=await linesOf(files[0]),b=await linesOf(files[1]),n=a.length,m=b.length;
 if(n*m>25e6)throw Error("These files are too long to compare in the browser.");
 const L=Array.from({length:n+1},()=>new Uint16Array(m+1));
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)L[i][j]=a[i]===b[j]?L[i+1][j+1]+1:Math.max(L[i+1][j],L[i][j+1]);
 const d=[];let i=0,j=0;
 while(i<n&&j<m){if(a[i]===b[j]){i++;j++}else if(L[i+1][j]>=L[i][j+1])d.push("- "+a[i++]);else d.push("+ "+b[j++])}
 while(i<n)d.push("- "+a[i++]);while(j<m)d.push("+ "+b[j++]);
 if(!d.length){msg("The text of both PDFs is identical.");return"custom"}
 dlText("comparison.txt","Lines marked - are only in "+files[0].name+"\nLines marked + are only in "+files[1].name+"\n\n"+d.join("\n"));
 const pv=document.createElement("div");pv.innerHTML=`<p style="${NOTE}">${d.length} difference${d.length>1?"s":""} found (text only${d.length>60?", first 60 shown":""}). Red = only in the first file, green = only in the second.</p><ul></ul>`;
 d.slice(0,60).forEach(l=>{const li=document.createElement("li");li.style.color=l[0]==="-"?"#d33":"#0a8a4a";li.textContent=l;pv.querySelector("ul").appendChild(li)});
 $("#res").after(pv);
};
/* ---------- form filler ---------- */
OPT.formfill=`<div id="ff"></div>`;
HOOK.formfill=async()=>{
 const box=$("#ff");box.textContent="";let form;try{form=(await load(files[0])).getForm()}catch(e){return}
 const fs=form.getFields();if(!fs.length){box.textContent="This PDF has no fillable form fields.";return}
 fs.forEach((f,i)=>{const w=document.createElement("label"),tx=document.createElement("span");tx.textContent=f.getName();w.appendChild(tx);let el;
  if(f instanceof PDFLib.PDFTextField){el=document.createElement("input");el.type="text";el.value=f.getText()||""}
  else if(f instanceof PDFLib.PDFCheckBox){el=document.createElement("input");el.type="checkbox";el.checked=f.isChecked();el.style.width="auto";w.style.display="flex";w.style.gap="8px"}
  else if(f instanceof PDFLib.PDFDropdown||f instanceof PDFLib.PDFRadioGroup||f instanceof PDFLib.PDFOptionList){el=document.createElement("select");f.getOptions().forEach(op=>{const o=document.createElement("option");o.textContent=op;el.appendChild(o)});const sel=f.getSelected();if(sel&&sel.length!==0)el.value=Array.isArray(sel)?sel[0]:sel}
  else return;
  el.dataset.i=i;w.appendChild(el);box.appendChild(w)});
};
X.formfill=async()=>{
 const s=await load(files[0]),form=s.getForm(),fs=form.getFields();
 document.querySelectorAll("#ff [data-i]").forEach(el=>{const f=fs[+el.dataset.i];
  if(f instanceof PDFLib.PDFTextField)f.setText(el.value);else if(f instanceof PDFLib.PDFCheckBox){el.checked?f.check():f.uncheck()}else if(el.value)f.select(el.value)});
 results.push({name:base(files[0])+"_filled.pdf",blob:blobOf(await s.save())});
};
/* ---------- reader ---------- */
OPT.reader=`<div id="ve"></div>`;
HOOK.reader=async()=>{
 $("#go").style.display="none";const box=$("#ve");box.textContent="Loading…";const pdf=await pdfjsOpen(files[0]);box.textContent="";
 for(let i=1;i<=Math.min(pdf.numPages,60);i++){const pg=await pdf.getPage(i),w=Math.min(app.clientWidth-40,720),vp0=pg.getViewport({scale:1}),vp=pg.getViewport({scale:w/vp0.width}),c=document.createElement("canvas");
  c.width=vp.width;c.height=vp.height;c.style.cssText="width:100%;border:1px solid var(--bd);margin-bottom:8px;background:#fff";box.appendChild(c);await pg.render({canvasContext:c.getContext("2d"),viewport:vp}).promise}
 if(pdf.numPages>60){const p=document.createElement("p");p.textContent="Showing the first 60 pages.";box.appendChild(p)}
};
/* ---------- share ---------- */
OPT.share=`<p style="${NOTE}">This uploads your PDF and makes a link that anyone can open for 1 hour.</p>`;
X.share=async()=>{
 const fd=new FormData();fd.append("file",files[0]);const r=await fetch("/api/share",{method:"POST",body:fd});
 if(!r.ok){let m="Could not create the link.";try{m=(await r.json()).error||m}catch(e){}throw Error(m)}
 const url=location.origin+"/s/"+(await r.json()).id,q=qrcode(0,"M");q.addData(url);q.make();
 $("#res").innerHTML=`<p>Anyone with this link can open the PDF for 1 hour.</p><div class="qr">${q.createSvgTag(5,2)}</div><div class="lk"></div>`;
 $("#res .lk").textContent=url;const b=document.createElement("button");b.className="pri";b.textContent="Copy link";b.onclick=()=>navigator.clipboard.writeText(url).then(()=>b.textContent="Copied ✓").catch(()=>{});$("#res").appendChild(b);
 msg("Link created.");return"custom"
};
/* ---------- visual editor: Edit, Annotate, Sign, Redact ---------- */
const VIS={
 edit:{modes:[["text","Add text"],["white","White box (cover)"]],sfx:"_edited"},
 annotate:{modes:[["highlight","Highlight"],["note","Text note"]],sfx:"_annotated"},
 sign:{modes:[["sig","Place signature"]],sfx:"_signed"},
 redact:{modes:[["black","Black box (redact)"]],sfx:"_redacted"}
};
let V=null;
for(const k in VIS)OPT[k]=`<div id="ve"></div>`;
function visUI(k){
 const cfg=VIS[k],box=$("#ve");
 box.innerHTML=`<label>Page<select id="vp"></select></label><label>Tool<select id="vm">${cfg.modes.map(m=>`<option value="${m[0]}">${m[1]}</option>`).join("")}</select></label>
 <div id="vt" class="row"><input type="text" id="vtx" placeholder="Text to add" style="flex:1;min-width:140px"><input type="number" id="vsz" value="14" min="6" max="120" style="width:70px"><input type="color" id="vcl" value="#000000"></div>
 <div id="vs" hidden><canvas id="pad" width="300" height="110" style="width:100%;max-width:300px;border:1px dashed var(--bd);border-radius:10px;touch-action:none;background:#fff"></canvas>
 <div class="row"><button class="sec" id="pcl">Clear</button><input type="text" id="ptx" placeholder="or type your name" style="flex:1"><button class="sec" id="pty">Use typed</button></div></div>
 <p style="${NOTE}" id="vh"></p><canvas id="vc" style="width:100%;border:1px solid var(--bd);touch-action:none;background:#fff"></canvas>
 <div class="row"><button class="sec" id="vun">Undo</button><span style="${NOTE}" id="vn"></span></div>`;
 const pad=$("#pad"),px=pad.getContext("2d");let drawing=false,sigData=null;
 px.lineWidth=2.5;px.lineCap="round";px.strokeStyle="#0b2a6f";
 const pp=e=>{const r=pad.getBoundingClientRect();return[(e.clientX-r.left)*pad.width/r.width,(e.clientY-r.top)*pad.height/r.height]};
 pad.onpointerdown=e=>{drawing=true;pad.setPointerCapture(e.pointerId);const[x,y]=pp(e);px.beginPath();px.moveTo(x,y)};
 pad.onpointermove=e=>{if(!drawing)return;const[x,y]=pp(e);px.lineTo(x,y);px.stroke()};
 pad.onpointerup=()=>{drawing=false;sigData=pad.toDataURL()};
 $("#pcl").onclick=()=>{px.clearRect(0,0,pad.width,pad.height);sigData=null};
 $("#pty").onclick=()=>{const t=$("#ptx").value.trim();if(!t)return;px.clearRect(0,0,pad.width,pad.height);px.fillStyle="#0b2a6f";px.font="italic 52px 'Brush Script MT','Segoe Script',cursive";px.textBaseline="middle";px.fillText(t,10,pad.height/2,pad.width-20);sigData=pad.toDataURL()};
 V={k,items:[],page:0,scale:1,sig:()=>sigData,pdf:null,base:null,drag:null,imgs:{}};
 const mode=()=>$("#vm").value,vc=$("#vc");
 const hint=()=>{const m=mode();$("#vt").hidden=!(m==="text"||m==="note");$("#vs").hidden=m!=="sig";
  $("#vh").textContent={text:"Type the text, then tap the page where it should start.",note:"Type the note, then tap the page where it should start.",white:"Drag a box on the page to cover something.",highlight:"Drag a box over the text to highlight.",black:"Drag a box over what to hide. Redacted pages become images, so the hidden text is truly removed.",sig:"Draw or type your signature above, then tap where it should go."}[m];
  if(m==="note")$("#vcl").value="#c00000"};
 $("#vm").onchange=hint;hint();
 $("#vp").onchange=()=>showPage(+$("#vp").value);
 $("#vun").onclick=()=>{V.items.pop();draw()};
 const cp=e=>{const r=vc.getBoundingClientRect();return[(e.clientX-r.left)*vc.width/r.width,(e.clientY-r.top)*vc.height/r.height]};
 vc.onpointerdown=e=>{if(!V.base)return;vc.setPointerCapture(e.pointerId);const[x,y]=cp(e);V.drag={x,y,x2:x,y2:y}};
 vc.onpointermove=e=>{if(!V.drag)return;const[x,y]=cp(e);V.drag.x2=x;V.drag.y2=y;draw()};
 vc.onpointerup=async()=>{const d=V.drag;V.drag=null;if(!d)return;const m=mode(),s=V.scale,pg=V.page;
  const x=Math.min(d.x,d.x2),y=Math.min(d.y,d.y2),w=Math.abs(d.x2-d.x),h=Math.abs(d.y2-d.y);
  if(m==="white"||m==="highlight"||m==="black"){if(w>4&&h>4)V.items.push({pg,type:m,x:x/s,y:y/s,w:w/s,h:h/s})}
  else if(m==="text"||m==="note"){const t=$("#vtx").value;if(!t)return msg("Type some text first.",1);msg("");V.items.push({pg,type:"text",x:d.x/s,y:d.y/s,text:t,size:+$("#vsz").value||14,color:$("#vcl").value})}
  else if(m==="sig"){const u=sigData;if(!u)return msg("Draw or type your signature first.",1);msg("");const im=await sigImg(u);const w=150;V.items.push({pg,type:"sig",x:d.x/s-w/2,y:d.y/s-w*im.height/im.width/2,w,h:w*im.height/im.width,data:u})}
  draw()};
}
const sigImg=u=>V.imgs[u]?Promise.resolve(V.imgs[u]):new Promise(r=>{const i=new Image();i.onload=()=>{V.imgs[u]=i;r(i)};i.src=u});
async function showPage(n){
 V.page=n;const pg=await V.pdf.getPage(n+1),vp0=pg.getViewport({scale:1}),sc=Math.min(1.6,720/vp0.width),vp=pg.getViewport({scale:sc}),c=document.createElement("canvas");
 c.width=vp.width;c.height=vp.height;await pg.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;
 V.base=c;V.scale=sc;const vc=$("#vc");vc.width=c.width;vc.height=c.height;draw();
}
async function draw(){
 const vc=$("#vc");if(!vc||!V.base)return;const x=vc.getContext("2d"),s=V.scale;x.clearRect(0,0,vc.width,vc.height);x.drawImage(V.base,0,0);
 const paint=async it=>{
  if(it.type==="text"){x.fillStyle=it.color;x.font=it.size*s+"px Helvetica,Arial,sans-serif";x.fillText(it.text,it.x*s,it.y*s)}
  else if(it.type==="sig"){x.drawImage(await sigImg(it.data),it.x*s,it.y*s,it.w*s,it.h*s)}
  else{x.fillStyle=it.type==="white"?"#fff":it.type==="black"?"#000":"rgba(255,235,60,.45)";x.fillRect(it.x*s,it.y*s,it.w*s,it.h*s);if(it.type==="white"){x.strokeStyle="#bbb";x.strokeRect(it.x*s,it.y*s,it.w*s,it.h*s)}}};
 for(const it of V.items.filter(i=>i.pg===V.page))await paint(it);
 if(V.drag){const d=V.drag;x.strokeStyle="#4f46e5";x.setLineDash([6,4]);x.strokeRect(Math.min(d.x,d.x2),Math.min(d.y,d.y2),Math.abs(d.x2-d.x),Math.abs(d.y2-d.y));x.setLineDash([])}
 $("#vn").textContent=V.items.length+" change"+(V.items.length===1?"":"s")+" so far";
}
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
/* Applies items to a pdf-lib document. Coordinates are in PDF points from the top-left of the page. */
async function applyItems(doc,items,rasterPage){
 const font=await doc.embedFont(StandardFonts.Helvetica),pages=doc.getPages();
 for(const it of items){
  const p=pages[it.pg],H=p.getHeight();
  if(it.type==="text"){const c=hex(it.color);p.drawText(it.text,{x:it.x,y:H-it.y,size:it.size,font,color:rgb(c[0],c[1],c[2])})}
  else if(it.type==="sig"){const im=await doc.embedPng(it.data.split(",")[1]);p.drawImage(im,{x:it.x,y:H-it.y-it.h,width:it.w,height:it.h})}
  else if(it.type==="white")p.drawRectangle({x:it.x,y:H-it.y-it.h,width:it.w,height:it.h,color:rgb(1,1,1)});
  else if(it.type==="highlight")p.drawRectangle({x:it.x,y:H-it.y-it.h,width:it.w,height:it.h,color:rgb(1,.92,.2),opacity:.4});
 }
 const red=[...new Set(items.filter(i=>i.type==="black").map(i=>i.pg))];
 for(const n of red){
  const {w,h,jpg}=await rasterPage(n,items.filter(i=>i.pg===n&&i.type==="black"));
  doc.removePage(n);const np=doc.insertPage(n,[w,h]);np.drawImage(await doc.embedJpg(jpg),{x:0,y:0,width:w,height:h});
 }
}
async function rasterOf(n,blacks){
 const pg=await V.pdf.getPage(n+1),vp1=pg.getViewport({scale:1}),sc=2,vp=pg.getViewport({scale:sc}),c=document.createElement("canvas");
 c.width=vp.width;c.height=vp.height;const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);await pg.render({canvasContext:x,viewport:vp}).promise;
 x.fillStyle="#000";blacks.forEach(b=>x.fillRect(b.x*sc,b.y*sc,b.w*sc,b.h*sc));
 return{w:vp1.width,h:vp1.height,jpg:await (await canvasBlob(c,"image/jpeg",.92)).arrayBuffer()};
}
const visRun=k=>async()=>{
 if(!V||!V.items.length)throw Error("Make at least one change first.");
 const s=await load(files[0]);
 try{await applyItems(s,V.items,rasterOf)}catch(e){throw Error(/encode/i.test(e.message)?"The built-in font can only write English letters and numbers.":e.message)}
 results.push({name:base(files[0])+VIS[k].sfx+".pdf",blob:blobOf(await s.save())});
};
for(const k in VIS){
 X[k]=visRun(k);
 HOOK[k]=async()=>{visUI(k);V.pdf=await pdfjsOpen(files[0]);const sel=$("#vp");for(let i=1;i<=V.pdf.numPages;i++)sel.add(new Option("Page "+i,i-1));await showPage(0)};
}
