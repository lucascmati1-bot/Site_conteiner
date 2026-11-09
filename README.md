# EcoContainer Piracaia — PIX e reservas

Site público hospedado em Sites, com Worker e banco persistente D1. Esta é a fonte da versão publicada em https://ecocontainer-piracaia.suportecma-ti.chatgpt.site.

## Implementação

- Checkout Transparente via Orders API (`POST /v1/orders`), exclusivamente PIX.
- Diária R$ 600, limpeza R$ 150 e adicionais definidos no servidor. Datas em America/Sao_Paulo; no máximo 30 noites por solicitação.
- Cada noite tem uma chave única no banco. Reserva e bloqueios são gravados numa transação.
- Tentativas repetidas usam a mesma chave de idempotência, persistida na sessão do navegador.
- O webhook valida HMAC-SHA256 e consulta a ordem diretamente no Mercado Pago. Não confia em status enviado no corpo da notificação.
- A confirmação exige referência, valor e situação de pagamento corretos. A consulta do hóspede também atualiza a situação pela API.
- Cobranças PIX vencem em 30 minutos. As datas só são liberadas após cancelamento/falha confirmada pelo provedor; ambiguidades conservam o bloqueio.
- O guia público não contém códigos de acesso. Eles precisam ser entregues em particular pelo anfitrião.

## Operação

Credenciais ficam nas variáveis secretas de Sites `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET`. `PUBLIC_BASE_URL` identifica a origem do site. `PAYMENTS_ENABLED=true` libera o checkout; false o desativa. Alterações nas variáveis exigem publicar uma versão salva.

Webhook de produção: `/api/mercadopago-webhook`, tópico **Order (Mercado Pago)**. A consulta de status requer uma chave aleatória específica da reserva, que nunca vai na URL. Não há rota de aprovação simulada.

Reservas e dados de contato podem ser consultados pelo proprietário no banco do Site. Não há painel administrativo, envio automático de SMS/e-mail, cartão ou sincronização com Airbnb nesta versão. Reembolsos e bloqueios externos devem ser acompanhados pelo proprietário; uma reserva já aprovada não libera datas automaticamente após reembolso.

Falha de rede após criar uma ordem pode deixar uma reserva em `creating`: o hóspede deve retomar **a mesma solicitação** no mesmo navegador. Não apague bloqueios sem conferir o provedor. Ordens com valor divergente ficam em `review`, com datas preservadas.

## Desenvolvimento e publicação

Requer Node.js 24 ou superior; não há dependências externas para instalar. Os testes e o banco local usam o módulo nativo `node:sqlite`.

```powershell
node --test tests/payments.test.mjs
node scripts/build.mjs
node --check dist/server/index.js
```

O build inclui somente os recursos em `public/` e os módulos do Worker; `.env` não é copiado. A hospedagem aplica as migrações schema-only de `drizzle/` antes da publicação. Não modifique migrações já aplicadas; acrescente novas.

O servidor local executa o mesmo Worker usado na hospedagem. Um adaptador SQLite persistente fornece localmente a interface D1; as reservas locais ficam separadas do banco hospedado.

## Validação

Testes automatizados cobrem preço, conflito de noites, idempotência, falhas ambíguas, rejeição definitiva, autenticação de consulta e confirmação por webhook assinado com notificações repetidas. Não representam liquidação bancária real. A primeira transação real deve ser acompanhada no painel do Mercado Pago e no banco, sem tratar QR Code gerado como aprovação.

Documentação usada:
- https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/websites/pix
- https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/notifications

## Valor da reserva
Novas reservas custam R$ 600 por diária, com estadia mínima de 2 diárias, mais R$ 150 de limpeza. Cobranças já criadas conservam o valor original.

## Modelo baseado nas fotos
O tour foi remodelado com base nas fotografias do anúncio Airbnb 1213833985011094710: ala amarela, varanda com redes, pavilhão gourmet envidraçado com telhado de quatro águas, piscina, fogueira, balanço e jardim. A planta interna, dimensões e distâncias são estimadas. Acesso à represa é externo; não foi colocado artificialmente ao lado da residência. O modelo geométrico é definido em public/js/residence-model.js e o visualizador em public/js/residence-viewer.js. A renderização ocorre sob demanda para reduzir o uso de GPU.

## Rodar em outra máquina após clonar

1. Instale Git e Node.js 24 ou superior.
2. Clone este repositório e abra o terminal na pasta clonada.
3. Execute `npm start` ou `node scripts/start-local.mjs`. No Windows, também pode abrir `iniciar-local.bat`.
4. Acesse http://localhost:3000 e http://localhost:3000/modelo-residencia.html.

Não é necessário `npm install`: não há dependências externas. A primeira execução copia `.env.example` para `.env`, gera o build e aplica as migrações ao banco `.local/reservas.sqlite`. Inicializações seguintes preservam os dados. Depois de editar código ou recursos públicos, encerre com Ctrl+C e inicie novamente para reconstruir a aplicação.

O banco local e o `.env` são ignorados pelo Git. Não copie segredos por commits. O clone não traz as reservas da hospedagem. `npm test` verifica APIs, validação de pagamento, persistência e transações do banco local.

### Pagamentos locais

Os pagamentos começam desativados. Para testar a integração com o provedor, preencha no `.env` o `MP_ACCESS_TOKEN` e o `MP_WEBHOOK_SECRET` do ambiente de teste e defina `PAYMENTS_ENABLED=true`. Credenciais de produção podem criar cobranças reais mesmo que o site esteja em localhost. O total é calculado com as tarifas normais da reserva.

O Mercado Pago não acessa webhooks em localhost. Para testar notificações recebidas, é necessário um túnel HTTPS público apontando para o servidor local, cadastrar essa URL em uma aplicação de testes do Mercado Pago e ajustar `PUBLIC_BASE_URL` no `.env` para a origem HTTPS do túnel. A consulta de situação pela tela também verifica a API do provedor. Não altere o webhook de produção para fazer testes locais.

### Porta ocupada

Edite `PORT` e `PUBLIC_BASE_URL` juntos, por exemplo `PORT=3013` e `PUBLIC_BASE_URL=http://localhost:3013`. O servidor aceita conexões somente na interface de loopback (127.0.0.1).

## Cartão parcelado
A página de reserva inclui cartão de crédito com Card Payment Brick do Mercado Pago, limitado a até 12 parcelas conforme disponibilidade do provedor. O servidor calcula o valor base e valida token, bandeira, documento e parcelas; confirmação exige consulta da order, mantendo bloqueios e idempotência. Dados brutos de cartão e CVV são tratados pelo SDK do provedor, não por inputs próprios do site.

Para ativar, preencha MP_PUBLIC_KEY no .env com a chave da mesma aplicação do Access Token. Configure Parcelado Comprador na conta Mercado Pago, sem subsidiar parcelas sem juros, e somente depois defina MP_CARD_ENABLED=true. PAYMENTS_ENABLED também precisa estar true. A chave pública é entregue ao navegador; Access Token e assinatura do webhook continuam privados. O SDK apresenta as opções e acréscimos antes de enviar o cartão. O texto do site não substitui a configuração de juros na conta. A liquidação e o parcelamento reais precisam ser validados com as credenciais da aplicação.

## Teste temporário de transação
O total de novas reservas está temporariamente fixado em R$ 0,50 no servidor e na tela. As tarifas de referência estão preservadas. Cobranças anteriores mantêm seu valor; restaure o cálculo normal após o teste.
