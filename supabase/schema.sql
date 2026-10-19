-- =====================================================================
-- KEYSSE BURGER – base de dados Supabase
-- Cole TUDO no Supabase: SQL Editor > New query > Run
-- =====================================================================

-- 1) Tabelas ----------------------------------------------------------
create table if not exists products (
  id serial primary key,
  category text not null check (category in ('hamburguer','bebida')),
  name text not null,
  description text,
  price numeric not null check (price >= 0),
  image_url text,
  available boolean not null default true,
  sort int not null default 0
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_no bigint generated always as identity,
  created_at timestamptz not null default now(),
  customer_name text not null,
  phone text not null,
  mode text not null check (mode in ('levantar','entrega')),
  address text,
  payment text not null,
  note text,
  total numeric not null default 0,
  status text not null default 'novo'
    check (status in ('novo','preparando','pronto','entregue','cancelado'))
);

create table if not exists order_items (
  id bigserial primary key,
  order_id uuid not null references orders(id) on delete cascade,
  product_name text not null,
  qty int not null check (qty > 0),
  price numeric not null
);

-- Administradores (emails com acesso ao painel) ----------------------
create table if not exists admins (email text primary key);
-- TROQUE pelo email que vai usar para entrar no painel (o mesmo criado em Authentication > Users)
insert into admins (email) values ('Leonildokeysse49@gmail.com') on conflict do nothing;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
$$;

-- 2) Segurança (RLS) ---------------------------------------------------
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table admins enable row level security;   -- sem políticas: ninguém lê pela API

create policy "menu publico"           on products for select using (true);
create policy "admin gere produtos"    on products for all    to authenticated using (is_admin()) with check (is_admin());
create policy "admin ve pedidos"       on orders   for select to authenticated using (is_admin());
create policy "admin atualiza pedidos" on orders   for update to authenticated using (is_admin()) with check (is_admin());
create policy "admin ve itens"         on order_items for select to authenticated using (is_admin());
-- Clientes NÃO escrevem direto nas tabelas: só através da função place_order abaixo.

-- 3) Função que cria o pedido (valida e calcula o total no servidor) ---
create or replace function place_order(
  p_name text, p_phone text, p_mode text, p_address text,
  p_payment text, p_note text, p_items jsonb
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := gen_random_uuid();
  v_no bigint;
  v_total numeric := 0;
  v_item jsonb;
  v_qty int;
  pr products%rowtype;
begin
  if coalesce(trim(p_name), '') = '' or length(regexp_replace(coalesce(p_phone,''), '\D', '', 'g')) < 9 then
    raise exception 'Dados do cliente em falta';
  end if;
  if p_mode not in ('levantar','entrega') then raise exception 'Tipo de pedido inválido'; end if;
  if p_mode = 'entrega' and coalesce(trim(p_address), '') = '' then raise exception 'Endereço em falta'; end if;
  if p_payment not in ('Dinheiro','e-Mola','M-Pesa') then raise exception 'Pagamento inválido'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Carrinho vazio'; end if;

  insert into orders (id, customer_name, phone, mode, address, payment, note)
  values (v_id, left(trim(p_name),100), left(trim(p_phone),30), p_mode,
          nullif(left(trim(coalesce(p_address,'')),200),''), p_payment,
          nullif(left(trim(coalesce(p_note,'')),300),''))
  returning order_no into v_no;

  for v_item in select jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'qty')::int;
    if v_qty < 1 or v_qty > 50 then raise exception 'Quantidade inválida'; end if;
    select * into pr from products where id = (v_item ->> 'id')::int and available;
    if not found then raise exception 'Produto indisponível'; end if;
    insert into order_items (order_id, product_name, qty, price) values (v_id, pr.name, v_qty, pr.price);
    v_total := v_total + pr.price * v_qty;
  end loop;

  update orders set total = v_total where id = v_id;
  return v_no;
end $$;

grant execute on function place_order(text,text,text,text,text,text,jsonb) to anon, authenticated;

-- 4) Tempo real para o painel -------------------------------------------
alter publication supabase_realtime add table orders;

-- 5) Produtos iniciais (CONFIRME os preços das bebidas) -----------------
insert into products (category, name, description, price, image_url, sort) values
 ('hamburguer','Hambúrguer Tudo Duplo','Duas carnes grelhadas, dois queijos derretidos e dois ovos, num pão fresquinho. O mais completo da casa.',160,'images/tudo-duplo.jpg',1),
 ('hamburguer','Hambúrguer Duplo','Duas carnes grelhadas, ovo estrelado e queijo derretido.',120,'images/duplo.jpg',2),
 ('hamburguer','Hambúrguer Completo','O clássico completo: uma carne, ovo e queijo, com salada fresca.',100,'images/completo.jpg',3),
 ('hamburguer','Hambúrguer com Ovo','Carne grelhada com ovo estrelado, simples e saboroso.',90,'images/com-ovo.jpg',4),
 ('hamburguer','Hambúrguer com Queijo','Carne suculenta com queijo derretido, o favorito de sempre.',90,'images/com-queijo.jpg',5),
 ('bebida','Sumo Cappy','Sumo Cappy gelado, para acompanhar o seu hambúrguer.',60,'images/sumo-cappy-lata.jpg',6),
 ('bebida','Refresco em lata','Refresco em lata, bem gelado.',50,'images/refresco-lata.jpg',7),
 ('bebida','Sumo Cappy em garrafa plástica','Sumo Cappy em garrafa plástica, ideal para levar.',40,'images/sumo-cappy-garrafa.jpg',8),
 ('bebida','Refresco em garrafa plástica','Refresco em garrafa plástica, bem gelado.',30,'images/refresco-garrafa-plastica.jpg',9),
 ('bebida','Refresco em garrafa','Refresco em garrafa de vidro, bem gelado.',25,'images/refresco-garrafa-vidro.jpg',10),
 ('bebida','Água','Água fresca para matar a sede.',25,'images/agua.jpg',11);
