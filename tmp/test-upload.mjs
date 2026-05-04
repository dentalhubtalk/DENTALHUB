import { createClient } from "@supabase/supabase-js";

const URL = "https://kybkhnshgrlhrjqbulyq.supabase.co";
const ANON = "sb_publishable_ZxK_Bt25FywCXJBe_vYX5Q_VjP9IkG4";
const SERVICE = process.env.SB_SERVICE_ROLE_KEY;

const file = new Blob([new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])], { type: "image/png" });

console.log("=== TEST 1: anon key, path 'teste.png' (raiz) — esperado: RLS block ===");
{
  const supa = createClient(URL, ANON);
  const { data, error } = await supa.storage.from("imagens-whatsapp").upload("teste.png", file, { upsert: true });
  console.log("data:", data);
  console.log("error:", error);
}

console.log("\n=== TEST 2: service role, path 'teste-folder/teste.png' — esperado: sucesso ===");
{
  const supa = createClient(URL, SERVICE, { auth: { persistSession: false } });
  const { data, error } = await supa.storage.from("imagens-whatsapp").upload("teste-folder/teste.png", file, { upsert: true });
  console.log("data:", data);
  console.log("error:", error);

  if (data) {
    const { data: pub } = supa.storage.from("imagens-whatsapp").getPublicUrl(data.path);
    console.log("publicUrl:", pub.publicUrl);
    const head = await fetch(pub.publicUrl, { method: "HEAD" });
    console.log("HEAD status:", head.status);
    await supa.storage.from("imagens-whatsapp").remove([data.path]);
    console.log("limpeza ok");
  }
}

console.log("\n=== TEST 3: lista buckets via service role ===");
{
  const supa = createClient(URL, SERVICE, { auth: { persistSession: false } });
  const { data, error } = await supa.storage.listBuckets();
  console.log("buckets:", data?.map(b => ({ id: b.id, public: b.public })));
  console.log("error:", error);
}
