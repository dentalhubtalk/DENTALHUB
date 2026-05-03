const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kybkhnshgrlhrjqbulyq.supabase.co';
const SERVICE_ROLE = process.env.SB_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE) {
  console.error(JSON.stringify({ error: 'SB_SERVICE_ROLE_KEY ausente' }, null, 2));
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function compactRow(row) {
  if (!row) return row;
  const out = { ...row };
  if (out.token) out.token = '***';
  if (out.api_key) out.api_key = '***';
  if (out.access_token) out.access_token = '***';
  return out;
}

async function query(name, builder) {
  const { data, error } = await builder;
  if (error) return { name, error: error.message };
  return { name, data: Array.isArray(data) ? data.map(compactRow) : compactRow(data) };
}

async function firstSuccessful(builders) {
  const errors = [];
  for (const fn of builders) {
    const { data, error } = await fn();
    if (!error) return { data, error: null };
    errors.push(error.message);
  }
  return { data: null, error: errors.join(' | ') };
}

(async () => {
  const latestConfig = await firstSuccessful([
    () => supabase.from('config_mensagem').select('*').order('updated_at', { ascending: false }).limit(5),
    () => supabase.from('config_mensagem').select('*').limit(5),
  ]);

  const latestInstances = await firstSuccessful([
    () => supabase.from('whatsapp_instances').select('*').order('updated_at', { ascending: false }).limit(5),
    () => supabase.from('whatsapp_instances').select('*').order('created_at', { ascending: false }).limit(5),
    () => supabase.from('whatsapp_instances').select('*').limit(5),
  ]);

  const latestEnvios = await firstSuccessful([
    () => supabase.from('envios_whatsapp').select('*').order('created_at', { ascending: false }).limit(10),
    () => supabase.from('envios_whatsapp').select('*').limit(10),
  ]);

  const latestWebhookConfig = await firstSuccessful([
    () => supabase.from('config_webhook').select('*').order('updated_at', { ascending: false }).limit(10),
    () => supabase.from('config_webhook').select('*').limit(10),
  ]);

  const instanceRows = latestInstances.data || [];
  const configRows = latestConfig.data || [];
  const candidates = [];
  for (const instance of instanceRows) {
    const userId = instance.user_id;
    const config = configRows.find((c) => c.user_id === userId) || null;
    const webhookConfig = (latestWebhookConfig.data || []).find((c) => c.user_id === userId) || null;
    const imagemUrl = String(instance.imagem_url || config?.imagem_url || '').trim();
    const instanceName = String(instance.instance_name || '').trim();
    let storageList = null;
    if (userId && instanceName) {
      const { data, error } = await supabase.storage.from('imagens-whatsapp').list(`${userId}/${instanceName}`);
      storageList = error ? { error: error.message } : data;
    }
    let imageHead = null;
    if (imagemUrl) {
      try {
        const res = await fetch(imagemUrl, { method: 'HEAD' });
        imageHead = {
          status: res.status,
          ok: res.ok,
          contentType: res.headers.get('content-type'),
          contentLength: res.headers.get('content-length'),
        };
      } catch (err) {
        imageHead = { error: err instanceof Error ? err.message : String(err) };
      }
    }
    candidates.push({
      user_id: userId,
      instance_id_db: instance.id,
      instance_name: instanceName,
      instance_id: instance.instance_id ?? '',
      status: instance.status,
      whatsapp_instances_imagem_url: instance.imagem_url ?? null,
      config_mensagem_imagem_url: config?.imagem_url ?? null,
      config_mensagem_updated_at: config?.updated_at ?? null,
      config_webhook_modo: webhookConfig?.modo ?? null,
      would_payload_have_image: Boolean(imagemUrl),
      resolved_imagem_url: imagemUrl || null,
      storage_folder: userId && instanceName ? `${userId}/${instanceName}` : null,
      storage_files: storageList,
      image_head: imageHead,
    });
  }

  const output = {
    checked_at: new Date().toISOString(),
    server_env: {
      EVOLUTION_API_URL: Boolean(process.env.EVOLUTION_API_URL),
      EVOLUTION_API_KEY: Boolean(process.env.EVOLUTION_API_KEY),
      SB_SERVICE_ROLE_KEY: Boolean(process.env.SB_SERVICE_ROLE_KEY),
    },
    recent_config_mensagem: latestConfig.error ? { error: latestConfig.error } : latestConfig.data,
    recent_whatsapp_instances: latestInstances.error ? { error: latestInstances.error } : latestInstances.data,
    recent_config_webhook: latestWebhookConfig.error ? { error: latestWebhookConfig.error } : latestWebhookConfig.data,
    recent_envios_whatsapp: latestEnvios.error ? { error: latestEnvios.error } : latestEnvios.data,
    candidate_payload_sources: candidates,
  };

  console.log(JSON.stringify(output, null, 2));
})();
