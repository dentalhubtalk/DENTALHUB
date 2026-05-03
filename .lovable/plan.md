## Objetivo

Alinhar o fluxo "Enviar Teste" do módulo Aniversários ao contrato exato definido na requisição: payload completo com `user_id`, `instancia_id`, `api_url`, `token`, e schema da `envios_whatsapp` ajustado (status restrito a `enviado|erro|pendente`). Manter arquitetura atual (TanStack `createServerFn` + Supabase externo + n8n responsável por chamar Evolution e gravar log).

## Diagnóstico do estado atual

Já existe e funciona conforme spec:
- Tabela `envios_whatsapp` (migration), com RLS por `user_id`, índices, publicada em `supabase_realtime`.
- Server function `triggerN8nTestWebhook` em `src/utils/n8n-webhook.functions.ts` com URLs corretas, autenticação via `accessToken`, normalização BR de telefone, render de `{nome}`, sanitização de imagem, leitura de `config_webhook.modo`.
- `EnvioTab.tsx` com Realtime (INSERT+UPDATE filtrado por `user_id`), reload com retry, toggle teste/produção, envio que chama `triggerN8nTestWebhookFn`.
- `MensagemTab.tsx` espelhando `imagem_url` em `whatsapp_instances` e `config_mensagem`.

Divergências em relação à spec a corrigir:

1. **Schema de `envios_whatsapp`**: o CHECK atual aceita `('pendente','enviado','falha_envio','erro')`. A spec exige somente `('enviado','erro','pendente')`. Há também uma policy de UPDATE para o usuário comum, que a spec proíbe (apenas SELECT/INSERT).
2. **REPLICA IDENTITY FULL**: não está garantido na migration (spec exige).
3. **Payload enviado ao n8n**: hoje só inclui `{ telefone, nome, nome_instancia, mensagem, imagem_url }`. A spec exige adicionar `user_id`, `instancia_id` (do `whatsapp_instances.instance_id`), `api_url` (de `EVOLUTION_API_URL`, sem barra final e sem sufixo `/manager`), e `token` (de `EVOLUTION_API_KEY`).
4. **Validação Zod**: hoje vários campos são opcionais. A spec exige `nome`, `telefone`, `mensagem` como obrigatórios; `nomeInstancia`/`imagemUrl`/`modo` deixam de ser parte do contrato (servidor resolve via Supabase). Manter compatibilidade de chamadas atuais sem quebrar a UI.
5. **Seleção da instância**: o select hoje pega só `id, instance_name, imagem_url`. Precisa incluir `instance_id` para popular `instancia_id` no payload.

## Mudanças

### A. Migration nova: `supabase-migration-envios-whatsapp-v2.sql`

Idempotente, aplicada por cima da existente:

- `ALTER TABLE public.envios_whatsapp DROP CONSTRAINT IF EXISTS envios_whatsapp_status_check;`
- Atualizar dados legados: `UPDATE envios_whatsapp SET status='erro' WHERE status='falha_envio';`
- `ALTER TABLE ... ADD CONSTRAINT envios_whatsapp_status_check CHECK (status IN ('enviado','erro','pendente'));`
- `DROP POLICY IF EXISTS "envios_whatsapp_update_own" ON public.envios_whatsapp;` (remover update do usuário; service role do n8n bypassa RLS).
- `ALTER TABLE public.envios_whatsapp REPLICA IDENTITY FULL;`
- Reafirmar `ALTER PUBLICATION supabase_realtime ADD TABLE public.envios_whatsapp;` dentro de bloco `DO` que ignora erro se já estiver publicada.

### B. `src/utils/n8n-webhook.functions.ts`

- Tornar `nome`, `telefone`, `mensagem` **obrigatórios** no schema Zod; manter `accessToken` obrigatório. Manter `nomeInstancia`/`imagemUrl`/`modo` como opcionais ignorados (compatibilidade retro com chamadas existentes — servidor resolve tudo via Supabase mesmo).
- No `select` de `whatsapp_instances`, incluir `instance_id`.
- Ler env vars no handler:
  ```ts
  const apiUrlRaw = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  if (!apiUrlRaw || !apiKey) throw new Error("EVOLUTION_API_URL/EVOLUTION_API_KEY ausentes");
  const apiUrl = apiUrlRaw.replace(/\/+$/, "").replace(/\/manager$/, "");
  ```
- Montar o payload final exatamente:
  ```ts
  const payload = {
    nome,
    telefone,
    mensagem,
    nome_instancia: nomeInstancia,
    user_id: user.id,
    imagem_url: imagemUrl ?? "",
    instancia_id: instance.instance_id ?? "",
    api_url: apiUrl,
    token: apiKey,
  };
  ```
- Atualizar `debugPayload` para refletir os novos campos sem expor `token` completo (mascarar: `token: "***"`).
- Logs server (`console.info`) continuam, sem logar telefone completo nem `token`.

### C. `src/components/aniversarios/EnvioTab.tsx`

- Apenas ajustar a chamada a `triggerN8nTestWebhookFn` para enviar somente `{ accessToken, nome, telefone, mensagem }` (parar de mandar `nomeInstancia`, `imagemUrl`, `modo` — servidor resolve). A UI continua mostrando o toggle de modo, mas o envio passa pelo `config_webhook` salvo (que já é o que a UI persiste via "Salvar" do modo). Ajustar texto auxiliar na UI removendo "usará esta URL selecionada agora" para refletir comportamento real (servidor lê do banco).
- Nenhuma mudança na lógica de Realtime, retry de reload, toasts.

### D. Não alterar

- `MensagemTab.tsx` (já espelha imagem corretamente).
- `client.ts`, `auth-middleware`, demais rotas.

## Riscos e mitigação

- **Linhas legadas com status `falha_envio`**: convertidas para `erro` pelo UPDATE pré-CHECK na migration.
- **Token Evolution exposto no payload do webhook**: aceitável porque o n8n é o consumidor confiável e a URL do webhook é privada; o servidor TanStack é quem envia (não o cliente). O `debugPayload` retornado ao frontend mascara o token.
- **Compatibilidade retro**: o schema Zod aceita os campos antigos como opcionais para não quebrar nada em cache durante deploy.

## Como vou validar após implementar

1. Rodar a migration manualmente no Supabase (instruir usuário).
2. Usar `stack_modern--invoke-server-function` para simular o clique e inspecionar `debugPayload` retornado (vai conter `instancia_id`, `api_url`, `imagem_url`, modo).
3. Pedir ao usuário para clicar em "Enviar Teste" e confirmar se o n8n agora recebe o payload completo.
