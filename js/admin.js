"use strict";
/* Painel do administrador – pedidos em tempo real e gestão de produtos (Supabase) */
var $=function(i){return document.getElementById(i)};
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function ic(){try{if(window.lucide)lucide.createIcons()}catch(e){}}
function toast(m,ms){var t=$("toast");t.textContent=m;t.classList.add("on");clearTimeout(toast.t);toast.t=setTimeout(function(){t.classList.remove("on")},ms||1800)}
var cfg=window.APP_CONFIG||{},sb=null;
try{if(window.supabase&&cfg.SUPABASE_URL&&cfg.SUPABASE_URL.indexOf("COLE")<0)sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY)}catch(e){console.error(e)}
var ST=["novo","preparando","pronto","entregue"],LB={novo:"Novo",preparando:"Em preparação",pronto:"Pronto",entregue:"Entregue",cancelado:"Cancelado"};
var orders=[],prods=[],filter="todos",chan=null,ac=null;
function show(id){["setup","login","app"].forEach(function(x){$(x).hidden=x!=id});ic()}
function beep(){try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();var o=ac.createOscillator(),g=ac.createGain();o.connect(g);g.connect(ac.destination);o.frequency.value=880;g.gain.value=.2;o.start();o.stop(ac.currentTime+.3)}catch(e){}}
$("logoS").innerHTML='<svg width="30" height="30" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48" fill="#e8820c" stroke="#fff" stroke-width="3"/><path d="M24 52Q24 26 50 26Q76 26 76 52Z" fill="#fff3d6"/><rect x="22" y="55" width="56" height="8" rx="4" fill="#4a1414"/><path d="M22 66Q30 72 38 66T54 66T70 66T78 66V70H22Z" fill="#3fa34d"/><path d="M26 73H74Q74 82 64 82H36Q26 82 26 73Z" fill="#fff3d6"/></svg>';

if(!sb){show("setup")}else{
 sb.auth.getSession().then(function(r){if(r.data&&r.data.session)enter();else show("login")});
 function loginMsg(err){var m=(err&&err.message||"").toLowerCase(),st=err&&err.status;
  if(m.indexOf("not confirmed")>=0)return "Email ainda não confirmado. No Supabase: Authentication > Users > clique no utilizador > Confirm email (ou recrie-o com Auto Confirm User marcado).";
  if(m.indexOf("invalid login")>=0)return "Email ou palavra-passe incorretos. Confirme que o utilizador existe no Supabase com este email exato.";
  if(m.indexOf("api key")>=0||st==401||st==403)return "Chave inválida em js/config.js. Use a chave anon public (ou publishable) do mesmo projeto.";
  if(m.indexOf("fetch")>=0||m.indexOf("network")>=0||st===0)return "Sem ligação ao Supabase. Verifique a internet e o Project URL em js/config.js.";
  return "Erro ao entrar: "+(err&&err.message||"desconhecido")}
 $("lf").onsubmit=function(e){e.preventDefault();$("lerr").textContent="";
  sb.auth.signInWithPassword({email:$("le").value.trim().toLowerCase(),password:$("lp").value}).then(function(r){
   if(r.error){console.error(r.error);$("lerr").textContent=loginMsg(r.error);return}enter()},
   function(err){console.error(err);$("lerr").textContent=loginMsg({message:"fetch"})})};
 $("out").onclick=function(){if(chan){sb.removeChannel(chan);chan=null}sb.auth.signOut().then(function(){show("login")})};
}
function enter(){show("app");loadOrders();loadProducts();subscribe()}

/* ---- Pedidos ---- */
function loadOrders(){
 sb.from("orders").select("*, order_items(*)").order("created_at",{ascending:false}).limit(200).then(function(r){
  if(r.error){$("ostat").textContent="Sem permissão ou erro: "+r.error.message+" (confirme que o seu email está na tabela admins).";return}
  $("ostat").textContent="";orders=r.data||[];renderOrders()})
}
function renderOrders(){
 var today=new Date().toDateString(),nw=0,cnt=0,sum=0,counts={todos:orders.length};
 orders.forEach(function(o){counts[o.status]=(counts[o.status]||0)+1;if(o.status=="novo")nw++;if(new Date(o.created_at).toDateString()==today){cnt++;if(o.status!="cancelado")sum+=Number(o.total)}});
 $("s1").textContent=nw;$("s2").textContent=cnt;$("s3").textContent=sum+" MT";
 $("chips").innerHTML=["todos"].concat(ST,["cancelado"]).map(function(s){return '<button data-f="'+s+'" class="'+(filter==s?"on":"")+'">'+(s=="todos"?"Todos":LB[s])+' ('+(counts[s]||0)+')</button>'}).join("");
 var list=orders.filter(function(o){return filter=="todos"||o.status==filter});
 $("ol").innerHTML=list.length?list.map(function(o){
  var nx=ST[ST.indexOf(o.status)+1],d=new Date(o.created_at);
  var items=(o.order_items||[]).map(function(i){return '<li>'+esc(i.qty)+'x '+esc(i.product_name)+' — '+Number(i.price)*i.qty+' MT</li>'}).join("");
  return '<div class="ord'+(o.status=="novo"?" new":"")+'"><div class="dh"><b>Pedido #'+esc(o.order_no)+' · '+esc(o.customer_name)+' · '+Number(o.total)+' MT</b><span class="bd '+esc(o.status)+'">'+LB[o.status]+'</span></div>'
  +'<div class="meta">'+d.toLocaleString("pt-PT")+' · <a href="tel:'+esc(o.phone)+'">'+esc(o.phone)+'</a> · '+(o.mode=="entrega"?"Entrega – "+esc(o.address):"Levantar no local")+' · '+esc(o.payment)+'</div>'
  +'<ul>'+items+'</ul>'+(o.note?'<div><i>Obs.: '+esc(o.note)+'</i></div>':'')
  +'<div class="ab">'+(nx&&o.status!="cancelado"?'<button class="btn" data-id="'+esc(o.id)+'" data-s="'+nx+'">Marcar: '+LB[nx]+'</button>':'')
  +(o.status!="cancelado"&&o.status!="entregue"?'<button class="btn rd" data-id="'+esc(o.id)+'" data-s="cancelado">Cancelar</button>':'')
  +'<a class="btn gh" href="tel:'+esc(o.phone)+'"><i data-lucide="phone"></i>Ligar</a></div></div>'}).join(""):'<p class="sub">Sem pedidos nesta categoria.</p>';
 ic()
}
$("chips").onclick=function(e){var b=e.target.closest("button[data-f]");if(b){filter=b.dataset.f;renderOrders()}};
$("ol").onclick=function(e){var b=e.target.closest("button[data-s]");if(!b)return;b.disabled=true;
 sb.from("orders").update({status:b.dataset.s}).eq("id",b.dataset.id).then(function(r){if(r.error)toast("Não foi possível atualizar o pedido",3000);else loadOrders()})};
function subscribe(){
 if(chan)return;
 chan=sb.channel("pedidos").on("postgres_changes",{event:"*",schema:"public",table:"orders"},function(p){
  if(p.eventType=="INSERT"){beep();toast("Novo pedido recebido!",4000)}
  loadOrders()}).subscribe(function(s){var on=s=="SUBSCRIBED";$("live").className="live "+(on?"on":"off");$("livet").textContent=on?"Ligado em tempo real":"A reconectar…"})
}

/* ---- Produtos ---- */
function loadProducts(){
 sb.from("products").select("*").order("category",{ascending:false}).order("sort").then(function(r){prods=r.data||[];renderProducts()})
}
function renderProducts(){
 $("pl").innerHTML=prods.map(function(p){return '<div class="prow" data-id="'+p.id+'"><div><input class="pn" value="'+esc(p.name)+'" aria-label="Nome"><small class="sub">'+(p.category=="bebida"?"Bebida":"Hambúrguer")+'</small></div><input class="pr2" type="number" min="0" value="'+Number(p.price)+'" aria-label="Preço"><label><input type="checkbox" class="pa" '+(p.available?"checked":"")+'>Disponível</label><button class="btn" data-sp="1"><i data-lucide="save"></i>Guardar</button></div>'}).join("");ic()
}
$("pl").onclick=function(e){var b=e.target.closest("button[data-sp]");if(!b)return;var row=b.closest(".prow");
 sb.from("products").update({name:row.querySelector(".pn").value.trim(),price:Number(row.querySelector(".pr2").value),available:row.querySelector(".pa").checked}).eq("id",row.dataset.id).then(function(r){toast(r.error?"Erro ao guardar":"Produto guardado");if(!r.error)loadProducts()})};
$("npb").onclick=function(){var n=$("npn").value.trim(),p=Number($("npp").value);if(!n||!(p>=0)||$("npp").value===""){toast("Preencha o nome e o preço",2200);return}
 sb.from("products").insert({category:$("npc").value,name:n,description:$("npd").value.trim()||null,price:p,image_url:$("npi").value.trim()||null,sort:100}).then(function(r){
  if(r.error){toast("Erro ao adicionar",2500);return}["npn","npp","npd","npi"].forEach(function(i){$(i).value=""});toast("Produto adicionado");loadProducts()})};
$("atabs").onclick=function(e){var b=e.target.closest("button[data-t]");if(!b)return;
 document.querySelectorAll("#atabs button").forEach(function(x){x.classList.toggle("on",x==b)});
 $("po").hidden=b.dataset.t!="o";$("pp").hidden=b.dataset.t!="p"};
