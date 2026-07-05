# Estação da Pizza - Sistema de Pedidos

## Estrutura
- `backend/` — API em Node.js + Express + MySQL + Socket.IO
- `frontend/cliente/` — tela do cliente (faz o pedido)
- `frontend/admin/` — painel administrativo (login, pedidos, criar pedido manual, cardápio, preços, horário)
- `frontend/cozinha/` — tela de acompanhamento em tempo real
- `frontend/imagens/logo.png` — logo já recortada com fundo transparente
- `frontend/css/theme.css` — paleta de cores da marca (verde, vermelho, terracota, creme)

## Como o preço da pizza funciona (v2)
O preço não é mais por sabor individual. Segue a lógica do cardápio físico:
**preço = categoria da pizza (Tradicional / Especial / Doce / Promoção) + tamanho (4/6/8/12/14 fatias)**.

Todos os sabores dentro da mesma categoria compartilham o mesmo preço por tamanho.
Borda recheada tem preço próprio, somado ao final. Ajuste os valores reais na
aba **💲 Preços** do painel admin (o script SQL cria a tabela zerada).

## 1. Criar o banco de dados
Execute `backend/database/schema.sql` no MySQL. Ele já vem com `DROP TABLE IF EXISTS`,
então pode rodar de novo sem medo de duplicar dados.

## 2. Configurar o backend
```bash
cd backend
npm install
npm run dev
```
Confira o `.env` (host, porta, senha do MySQL).

## 3. Criar o primeiro usuário admin
```bash
curl -X POST http://localhost:3000/api/auth/cadastrar \
  -H "Content-Type: application/json" \
  -d '{"nome":"Admin","email":"admin@pizzaria.com","senha":"123456","nivel":"admin"}'
```

## 4. Configurar os preços reais
Faça login no admin → aba **Preços** → preencha os valores de cada categoria/tamanho → Salvar.

## 5. Cadastrar sabores, bordas e bebidas
Aba **Cardápio** → ao escolher "Sabor de Pizza", selecione também a categoria correspondente.

## 6. Abrir o frontend
- `frontend/cliente/index.html` — cliente faz o pedido
- `frontend/admin/index.html` — login e gestão completa
- `frontend/cozinha/index.html` — acompanhamento em tempo real (precisa estar logado no admin)

## Novidades desta versão
- Preço por categoria + tamanho (fatias), igual ao cardápio físico
- **Cálculo do preço agora é feito no servidor** — o cliente nunca envia o preço/total, evitando fraude
- Painel admin agora tem aba própria para **criar pedidos manualmente** (telefone/balcão), sem bloqueio de horário
- Nova identidade visual: logo e paleta de cores da Estação da Pizza

## Próximos passos (ainda não incluídos)
- Impressão real em impressora térmica USB 80mm (`node-thermal-printer`)
- Envio automático da comanda para o WhatsApp da pizzaria (`whatsapp-web.js`)
- Arquivo de som `frontend/sounds/sino.mp3` (adicione o seu)
