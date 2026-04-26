# Deploy na Vercel — dentalhub.com.br

Este projeto foi configurado para deploy SSR na Vercel, replicando o padrão usado no godflix.com.br.

## Fluxo

```
Lovable (edição) → GitHub (push automático) → Vercel (build + deploy) → dentalhub.com.br
```

> ⚠️ **Atenção:** ao adotar este setup, o **preview da Lovable deixa de funcionar**, pois removemos o preset `@lovable.dev/vite-tanstack-config` (que depende do plugin Cloudflare). Use o preview da Vercel para validar mudanças.

## Arquitetura

- **`vite.config.ts`** — TanStack Start com `target: "node-server"`. Gera:
  - `dist/client/` — assets estáticos servidos pelo CDN da Vercel
  - `dist/server/server.js` — bundle SSR Node
- **`api/index.js`** — Vercel Serverless Function (Node 20). Adapta `req`/`res` Node para `Request`/`Response` Web Fetch e chama o handler SSR.
- **`vercel.json`** — buildCommand, outputDirectory e rewrites:
  - Tudo que **não** começa com `/_build/`, `/assets/`, `favicon.ico`, `robots.txt`, `sitemap.xml` → reescrito para `/api/index` (handler SSR).

## Variáveis de ambiente (Vercel → Settings → Environment Variables)

### Públicas (build-time, vão para o cliente)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (ou `VITE_SUPABASE_PUBLISHABLE_KEY`)
- `VITE_APP_URL` — `https://dentalhub.com.br`
- `VITE_API_URL` — `https://dentalhub.com.br`

### Secretas (runtime, só no server)
- `SB_SERVICE_ROLE_KEY` — service role do Supabase
- `EVOLUTION_API_URL`
- `EVOLUTION_API_KEY`
- `ASAAS_API_KEY`
- `ASAAS_WEBHOOK_TOKEN`
- `ASAAS_ENV` — `sandbox` ou `production`

Configure as três environments: **Production**, **Preview** e **Development**.

## Domínio personalizado

1. Vercel → Project → Settings → Domains → Add `dentalhub.com.br` e `www.dentalhub.com.br`.
2. No registrador DNS:
   - `A` `@` → `76.76.21.21` (IP da Vercel)
   - `CNAME` `www` → `cname.vercel-dns.com`
3. Aguarde propagação + emissão automática de SSL (Let's Encrypt).

## Problemas conhecidos e soluções

### 404 em todas as rotas em produção
Causa: rewrite ausente ou outputDirectory errado. Verifique `vercel.json` — `outputDirectory` deve ser `dist/client` e o rewrite catch-all deve apontar para `/api/index`.

### "React is not defined" no console em produção
Já mitigado em `src/router.tsx` com shim `globalThis.React = React`. Se reaparecer, confirme que o shim não foi removido em refactors.

### Loader de página fica girando para sempre
Geralmente erro de chunk antigo após deploy. O `src/router.tsx` já contém auto-reload via `vite:preloadError` + flag em `sessionStorage`. Se travar mesmo assim, force refresh (Ctrl+Shift+R).

### Webhook Asaas não recebe callbacks
- Confirme que o endpoint configurado no Asaas é `https://dentalhub.com.br/api/public/asaas-webhook`.
- O rewrite catch-all do `vercel.json` direciona essa rota ao SSR handler — o TanStack roteia internamente para `api.public.asaas-webhook.ts`.
- Verifique `ASAAS_WEBHOOK_TOKEN` configurado nos env vars da Vercel.

### Server function falha com módulo não encontrado
O bundle SSR Node não tem os mesmos polyfills do Workers. Se aparecer erro de import, verifique se a dependência tem build Node compatível. Pacotes que dependem de APIs específicas do Cloudflare Workers precisam ser substituídos.

### Build falha com "SSR handler not found"
O nome do arquivo emitido por `tanstackStart` pode variar entre versões. O `api/index.js` tenta múltiplos caminhos (`dist/server/server.js`, `dist/server/index.js`, `.output/server/index.mjs`). Se nenhum funcionar, faça `npm run build` localmente, inspecione `dist/server/` e ajuste o array `candidates` em `api/index.js`.

### Preview da Lovable quebrado
Esperado. A Lovable usa o preset `@lovable.dev/vite-tanstack-config` que injeta o plugin Cloudflare; removemos para o build Node funcionar. Use **`vercel --prod`** ou pushes na branch principal para validar.

## Comandos úteis

```bash
# Build local (mesmo comando da Vercel)
npm run build

# Preview local do build
npm run preview

# Deploy manual
vercel --prod
```
