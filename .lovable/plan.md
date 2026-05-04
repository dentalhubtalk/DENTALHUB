Vou ajustar em duas frentes: explicar/mostrar melhor o diagnóstico do webhook e melhorar a gestão das instâncias WhatsApp no admin e no perfil do cliente.

1. Corrigir a informação exibida do webhook usado
- Hoje há uma inconsistência visual: a server function já usa os webhooks UUID informados por você, mas a tela ainda mostra URLs antigas com `/enviar-teste`.
- Vou alinhar a tela para mostrar exatamente:
  - Teste: `https://n8n.vendavocenegocios.com.br/webhook-test/1a26f671-f9b2-4c65-b6a2-33000350a7a4`
  - Produção: `https://webhook.vendavocenegocios.com.br/webhook/1a26f671-f9b2-4c65-b6a2-33000350a7a4`
- Também vou garantir que o botão “Enviar Teste” envie explicitamente o modo selecionado na tela, para não depender apenas do valor salvo anteriormente em `config_webhook`.

2. Melhorar o diagnóstico de rede e onde aparece o resultado
- O diagnóstico atual testa, dentro da server function, estes destinos:
  - `https://www.google.com/generate_204` para confirmar saída HTTPS geral.
  - `https://1.1.1.1/` para testar saída HTTPS sem depender de DNS de domínio.
  - `https://n8n.vendavocenegocios.com.br/` para DNS + SSL + alcance do host do n8n.
  - webhook de teste do n8n.
  - webhook de produção.
- Hoje o resultado aparece principalmente no console do navegador (`console.table`) e no toast só aparece um resumo. Isso não é suficiente.
- Vou criar um painel visível na própria aba “Envio” com uma tabela de resultado contendo:
  - URL testada
  - método
  - status HTTP
  - tempo em ms
  - OK/falha
  - erro técnico, quando existir
- Assim você não dependerá do DevTools/console para interpretar o diagnóstico.

3. Tornar o fluxo “Enviar Teste” mais rastreável
- Vou adicionar um resumo visível do último envio de teste na tela, mostrando:
  - webhook usado
  - modo usado: teste ou produção
  - status retornado pelo webhook
  - erro de rede ou timeout, se houver
  - payload sanitizado enviado ao n8n: nome, telefone mascarado, nome da instância, imagem_url, user_id, tamanho da mensagem, api_url sem token
- Também vou corrigir o texto do toast/diagnóstico para não dizer genericamente “enviado” quando a server function apenas conseguiu chamar o webhook, mas ainda não há confirmação de registro em `envios_whatsapp`.

4. Reduzir pontos de travamento no envio
- A validação `HEAD` da `imagem_url` atualmente pode travar se o host da imagem demorar ou não responder.
- Vou colocar timeout explícito nessa validação e registrar o erro com clareza.
- O POST para o n8n já tem timeout de 10s; vou manter, mas retornando uma mensagem mais clara quando for `AbortError`/timeout.

5. Melhorar a tela de usuários/admin conforme o print
- Na listagem de usuários vou adicionar as colunas/dados de instância:
  - nome da instância (`instance_name`)
  - número conectado (`owner_number`) quando conhecido
- A coluna WhatsApp passará a mostrar não só “Conectado/Desconectado”, mas também o nome da instância e o número conectado, quando disponível.
- Vou adicionar botão de reload na linha do usuário para consultar a Evolution API em tempo real e atualizar status/número no banco.
- Também vou manter/atualizar o monitoramento geral já existente no Dashboard Admin, com “Atualizar todas”.

6. Botões de desconectar e reconectar a mesma instância
- Vou criar server functions administrativas protegidas por admin para:
  - desconectar/logout da instância na Evolution API sem apagar o registro do banco;
  - reconectar a mesma instância, chamando o endpoint de conexão/QR da Evolution.
- No admin, cada instância terá ações:
  - atualizar status
  - desconectar
  - reconectar/gerar QR
- A reconexão manterá o mesmo `instance_name`; não será criada outra instância.

7. Popup de QR Code no perfil do cliente
- No perfil do cliente, na aba WhatsApp, quando a instância estiver desconectada e houver QR Code disponível, o QR será exibido em popup/modal, com mensagem clara:
  - “Sua instância está desconectada. Escaneie o QR Code para reconectar.”
- Vou manter também o card atual abaixo da tela como fallback, mas o popup dará destaque ao problema.
- Se o admin acionar reconexão e o status do banco ficar como desconectado/conectando, o cliente verá a necessidade de refazer a leitura quando acessar o perfil.

8. Ajustar persistência do número conectado
- Quando a função de status detectar `ownerJid`, `owner` ou `wuid`, vou persistir `owner_number` em `whatsapp_instances`.
- Se a instância desconectar, vou limpar ou manter de forma controlada o número anterior conforme o retorno da Evolution; a tela deixará claro quando o número é “último número conhecido” se necessário.

9. Verificações após implementar
- Conferir se as URLs exibidas batem com as URLs realmente usadas pela server function.
- Conferir se o diagnóstico aparece na própria tela.
- Conferir se o painel admin mostra instância e número conectado por usuário.
- Conferir se atualizar status consulta a Evolution API e persiste `status`/`owner_number`.
- Conferir se desconectar/reconectar não cria outra instância.
- Conferir se o cliente desconectado vê o modal de QR Code.

Observação importante sobre “o que mudou”
- Pelo código atual, encontrei uma mudança relevante/inconsistência: a server function usa os webhooks UUID corretos, mas a UI ainda exibe URLs antigas `/enviar-teste`. Isso pode ter causado confusão operacional sobre qual webhook estava sendo testado.
- Também não há logs recentes disponíveis agora nos logs da server function para eu confirmar a última falha executada por você. Após a implementação do painel de diagnóstico visível, o resultado ficará auditável na própria tela.