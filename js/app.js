"use strict";
/* Keysse Burger – site do cliente (menu, carrinho e pedidos via Supabase) */
var $=function(i){return document.getElementById(i)};
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function ic(){try{if(window.lucide)lucide.createIcons()}catch(e){}}
function toast(m,ms){var t=$("toast");t.textContent=m;t.classList.add("on");clearTimeout(toast.t);toast.t=setTimeout(function(){t.classList.remove("on")},ms||1600)}

/* ---- Ligação ao Supabase (configure em js/config.js) ---- */
var cfg=window.APP_CONFIG||{},sb=null;
try{if(window.supabase&&cfg.SUPABASE_URL&&cfg.SUPABASE_URL.indexOf("COLE")<0)sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY)}catch(e){console.error(e)}

/* ---- Produtos locais (usados só se o Supabase não estiver configurado) ---- */
var FALLBACK=[
 {id:1,category:"hamburguer",name:"Hambúrguer Tudo Duplo",description:"Duas carnes grelhadas, dois queijos derretidos e dois ovos, num pão fresquinho. O mais completo da casa.",price:160,image_url:"images/tudo-duplo.jpg"},
 {id:2,category:"hamburguer",name:"Hambúrguer Duplo",description:"Duas carnes grelhadas, ovo estrelado e queijo derretido.",price:120,image_url:"images/duplo.jpg"},
 {id:3,category:"hamburguer",name:"Hambúrguer Completo",description:"O clássico completo: uma carne, ovo e queijo, com salada fresca.",price:100,image_url:"images/completo.jpg"},
 {id:4,category:"hamburguer",name:"Hambúrguer com Ovo",description:"Carne grelhada com ovo estrelado, simples e saboroso.",price:90,image_url:"images/com-ovo.jpg"},
 {id:5,category:"hamburguer",name:"Hambúrguer com Queijo",description:"Carne suculenta com queijo derretido, o favorito de sempre.",price:90,image_url:"images/com-queijo.jpg"},
 {id:6,category:"bebida",name:"Sumo Cappy",description:"Sumo Cappy gelado, para acompanhar o seu hambúrguer.",price:60,image_url:"images/sumo-cappy-lata.jpg"},
 {id:7,category:"bebida",name:"Refresco em lata",description:"Refresco em lata, bem gelado.",price:50,image_url:"images/refresco-lata.jpg"},
 {id:8,category:"bebida",name:"Sumo Cappy em garrafa plástica",description:"Sumo Cappy em garrafa plástica, ideal para levar.",price:40,image_url:"images/sumo-cappy-garrafa.jpg"},
 {id:9,category:"bebida",name:"Refresco em garrafa plástica",description:"Refresco em garrafa plástica, bem gelado.",price:30,image_url:"images/refresco-garrafa-plastica.jpg"},
 {id:10,category:"bebida",name:"Refresco em garrafa",description:"Refresco em garrafa de vidro, bem gelado.",price:25,image_url:"images/refresco-garrafa-vidro.jpg"},
 {id:11,category:"bebida",name:"Água",description:"Água fresca para matar a sede.",price:25,image_url:"images/agua.jpg"}
];
var P=[],cart={};

function find(id){for(var i=0;i<P.length;i++)if(P[i].id==id)return P[i]}
function imgTag(it){return it.image_url?'<img src="'+esc(it.image_url)+'" alt="'+esc(it.name)+'" loading="lazy">':'<div class="ph"><i data-lucide="'+(it.category=="bebida"?"cup-soda":"sandwich")+'"></i></div>'}

/* ---- Menu ---- */
function card(it){
 var e=document.createElement("article");e.className="card";e.tabIndex=0;
 e.innerHTML=imgTag(it)+'<div class="cb"><h3>'+esc(it.name)+'</h3><p class="clamp">'+esc(it.description||"")+'</p><span class="pr">'+Number(it.price)+' MT</span></div><div class="ca"><button class="btn gh add"><i data-lucide="shopping-cart"></i>Adicionar ao carrinho</button><button class="btn now"><i data-lucide="zap"></i>Pedir agora</button></div>';
 e.onclick=function(){openM(it)};
 e.onkeydown=function(ev){if(ev.key=="Enter"&&ev.target==e)openM(it)};
 e.querySelector(".add").onclick=function(ev){ev.stopPropagation();add(it.id,1)};
 e.querySelector(".now").onclick=function(ev){ev.stopPropagation();orderNow(it.id,1)};
 return e
}
function renderMenu(){
 var g1=$("g1"),g2=$("g2");g1.innerHTML="";g2.innerHTML="";
 P.forEach(function(it){(it.category=="hamburguer"?g1:g2).appendChild(card(it))});
 document.querySelector('[data-g="1"]').hidden=!g1.children.length;
 document.querySelector('[data-g="2"]').hidden=!g2.children.length;
 upd();ic()
}
function loadProducts(){
 function done(list){P=list;restoreCart();renderMenu()}
 if(!sb){done(FALLBACK);return}
 sb.from("products").select("*").eq("available",true).order("sort").then(function(r){
  if(r.error||!r.data||!r.data.length){console.warn("A usar produtos locais.",r.error);done(FALLBACK)}else done(r.data)
 },function(){done(FALLBACK)})
}

/* ---- Janela de detalhes ---- */
function openM(it){
 var q=1,m=$("modal");
 m.innerHTML='<button class="x" aria-label="Fechar"><i data-lucide="x"></i></button>'+imgTag(it)+'<div class="mb"><h2>'+esc(it.name)+'</h2><p>'+esc(it.description||"")+'</p><div class="pr" style="font-size:1.3rem">'+Number(it.price)+' MT</div><div class="q"><button class="round s" id="mm" aria-label="Menos"><i data-lucide="minus"></i></button><b id="mq">1</b><button class="round" id="mp" aria-label="Mais"><i data-lucide="plus"></i></button></div><button class="btn gh" style="width:100%;margin-bottom:8px" id="ma"><i data-lucide="shopping-cart"></i>Adicionar ao carrinho</button><button class="btn" style="width:100%" id="mw"><i data-lucide="zap"></i>Pedir agora</button></div>';
 m.querySelector(".x").onclick=cl;
 $("mm").onclick=function(){if(q>1)$("mq").textContent=--q};
 $("mp").onclick=function(){if(q<50)$("mq").textContent=++q};
 $("ma").onclick=function(){add(it.id,q);cl()};
 $("mw").onclick=function(){cl();orderNow(it.id,q)};
 ic();$("ov").classList.add("on")
}
function cl(){$("ov").classList.remove("on")}
$("ov").onclick=function(e){if(e.target==this)cl()};

/* ---- Carrinho ---- */
function persist(){try{localStorage.setItem("kb_cart",JSON.stringify(cart))}catch(e){}}
function restoreCart(){try{var c=JSON.parse(localStorage.getItem("kb_cart")||"{}");cart={};for(var id in c)if(find(id)&&c[id]>0)cart[id]=Math.min(50,c[id])}catch(e){cart={}}}
function add(id,n){cart[id]=Math.min(50,(cart[id]||0)+n);upd();toast(find(id).name+" adicionado ao carrinho")}
function total(){var t=0;for(var id in cart){var p=find(id);if(p)t+=cart[id]*Number(p.price)}return t}
function upd(){
 var n=0,h="";
 for(var id in cart){var it=find(id);if(!it||cart[id]<1)continue;n+=cart[id];
  h+='<div class="li"><div class="nm"><b>'+esc(it.name)+'</b><br>'+Number(it.price)+' MT · '+Number(it.price)*cart[id]+' MT</div><button class="round s" data-i="'+id+'" data-d="-1" aria-label="Menos"><i data-lucide="minus"></i></button><b>'+cart[id]+'</b><button class="round s" data-i="'+id+'" data-d="1" aria-label="Mais"><i data-lucide="plus"></i></button><button class="round s" style="background:var(--rd);color:#fff" data-i="'+id+'" data-d="0" aria-label="Remover"><i data-lucide="trash-2"></i></button></div>'}
 $("items").innerHTML=h||'<p style="color:var(--mu)">O carrinho está vazio.</p>';
 $("tot").textContent=total()+" MT";$("cnt").textContent=n;$("send").disabled=!n;persist();ic()
}
$("items").onclick=function(e){var b=e.target.closest("button");if(!b)return;var i=b.dataset.i,d=+b.dataset.d;if(d===0)delete cart[i];else{cart[i]+=d;if(cart[i]<1)delete cart[i];if(cart[i]>50)cart[i]=50}upd()};
$("clr").onclick=function(){cart={};upd()};
function openCart(focus){$("drawer").classList.add("on");if(focus)setTimeout(function(){$("fn").scrollIntoView({block:"center"});$("fn").focus()},280)}
function orderNow(id,q){cart[id]=Math.min(50,(cart[id]||0)+q);upd();openCart(true)}
$("openCart").onclick=function(){openCart(false)};
$("closeCart").onclick=function(){$("drawer").classList.remove("on")};
$("fm").onchange=function(){$("fab").style.display=this.value=="entrega"?"block":"none"};
document.addEventListener("keydown",function(e){if(e.key=="Escape"){cl();$("drawer").classList.remove("on")}});

/* ---- Finalizar pedido (grava no Supabase) ---- */
$("send").onclick=function(){
 var nm=$("fn").value.trim(),ph=$("fp").value.trim(),mode=$("fm").value,ad=$("fa").value.trim();
 if(!nm){toast("Indique o seu nome",2200);$("fn").focus();return}
 if(ph.replace(/\D/g,"").length<9){toast("Indique um telefone válido",2200);$("fp").focus();return}
 if(mode=="entrega"&&!ad){toast("Indique o endereço de entrega",2200);$("fa").focus();return}
 if(!sb){toast("O sistema de pedidos ainda não está configurado.",3500);return}
 var items=[];for(var id in cart)if(cart[id]>0)items.push({id:+id,qty:cart[id]});
 if(!items.length)return;
 var btn=$("send"),old=btn.innerHTML,sum=total();
 btn.disabled=true;btn.textContent="A enviar…";
 function reset(){btn.innerHTML=old;btn.disabled=false;ic()}
 sb.rpc("place_order",{p_name:nm,p_phone:ph,p_mode:mode,p_address:ad||null,p_payment:$("fy").value,p_note:$("fo").value.trim()||null,p_items:items}).then(function(r){
  reset();
  if(r.error){console.error(r.error);toast("Não foi possível enviar o pedido. Tente novamente.",3500);return}
  cart={};upd();$("fo").value="";$("drawer").classList.remove("on");confirmM(r.data,ph,sum)
 },function(){reset();toast("Sem ligação. Verifique a internet e tente novamente.",3500)})
};
function confirmM(no,ph,sum){
 var m=$("modal");
 m.innerHTML='<button class="x" aria-label="Fechar"><i data-lucide="x"></i></button><div class="mb" style="text-align:center;padding-top:34px"><span class="okc"><i data-lucide="check"></i></span><h2>Pedido recebido!</h2><p>O seu pedido <b>#'+esc(no)+'</b> foi enviado com sucesso. Entraremos em contacto pelo número <b>'+esc(ph)+'</b>.</p><p class="pr">Total: '+sum+' MT</p><button class="btn" id="okb" style="width:100%">Continuar</button></div>';
 m.querySelector(".x").onclick=cl;$("okb").onclick=cl;ic();$("ov").classList.add("on")
}

/* ---- Navegação ---- */
document.querySelectorAll("#tabs button").forEach(function(b){b.onclick=function(){
 document.querySelectorAll("#tabs button").forEach(function(x){x.classList.remove("on")});
 b.classList.add("on");$("menu").dataset.f=b.dataset.f}});
(function(){var links=document.querySelectorAll("#nav a[href^='#']");
 if(!("IntersectionObserver" in window))return;
 var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)links.forEach(function(a){a.classList.toggle("on",a.getAttribute("href")=="#"+e.target.id)})})},{rootMargin:"-45% 0px -50% 0px"});
 ["inicio","menu","sobre","contacto"].forEach(function(id){var el=$(id);if(el)io.observe(el)})})();

/* ---- Logo e arranque ---- */
function logo(s){return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48" fill="#e8820c" stroke="#fff" stroke-width="3"/><path d="M24 52Q24 26 50 26Q76 26 76 52Z" fill="#fff3d6"/><circle cx="40" cy="38" r="2" fill="#e8820c"/><circle cx="52" cy="34" r="2" fill="#e8820c"/><circle cx="62" cy="40" r="2" fill="#e8820c"/><rect x="22" y="55" width="56" height="8" rx="4" fill="#4a1414"/><path d="M22 66Q30 72 38 66T54 66T70 66T78 66V70H22Z" fill="#3fa34d"/><path d="M26 73H74Q74 82 64 82H36Q26 82 26 73Z" fill="#fff3d6"/></svg>'}
$("logoS").innerHTML=logo(36);$("logoF").innerHTML=logo(36);
loadProducts();ic();
