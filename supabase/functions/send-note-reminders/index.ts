import webpush from "npm:web-push@3.6.7";

// Lembretes de notas pessoais (push). Chamada todos os dias pelo agendador do
// banco (pg_cron, ver supabase/cron_secret.sql), que envia o cabeçalho
// `x-cron-secret`. Sem ele (ou com outro valor) a função recusa: o endereço
// desta função não é segredo e ela corre com a chave de serviço.
//
// Multi-empresa: percorre as empresas cuja assinatura permite usar o app
// (função SQL reminder_companies: ativas ou em tolerância; vencidas e
// suspensas ficam de fora), e para cada uma usa o "hoje" do fuso dela, só as
// notas e os dispositivos dessa empresa. Requer multi_empresa.sql e
// multi_empresa_funcoes.sql aplicados.

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Fuso de reserva, se uma empresa não tiver o seu. Pode ser mudado com o segredo REMINDER_TZ.
const REMINDER_TZ = Deno.env.get("REMINDER_TZ") || "Europe/Brussels";

webpush.setVapidDetails("mailto:contato@servix.example", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

function sbHeaders() {
  return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };
}

// "YYYY-MM-DD" do dia de hoje no fuso dado.
function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

async function readCronSecret(): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/cron_secret?id=eq.1&select=value`, { headers: sbHeaders() });
    if (!res.ok) return null;
    const rows = await res.json();
    return (rows && rows[0] && rows[0].value) || null;
  } catch {
    return null;
  }
}

// Comparação em tempo constante.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Envia os lembretes de UMA empresa; devolve quantas notas notificou.
async function remindCompany(companyId: number, tz: string): Promise<number> {
  const today = todayInTz(tz);

  const appDataRes = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${companyId}&select=personal_notes`, {
    headers: sbHeaders(),
  });
  const rows = await appDataRes.json();
  const notes = (rows[0] && rows[0].personal_notes) || [];

  const dueNotes = notes.filter((n) => n.date === today && !n.notified);
  if (dueNotes.length === 0) return 0;

  const subsRes = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?company_id=eq.${companyId}&select=*`, {
    headers: sbHeaders(),
  });
  const subs = await subsRes.json();

  for (const note of dueNotes) {
    const ownerSubs = subs.filter((s) => s.owner_id === String(note.ownerId));
    for (const s of ownerSubs) {
      const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
      try {
        await webpush.sendNotification(subscription, JSON.stringify({ title: "Lembrete Servix", body: note.text }));
      } catch (err) {
        console.error("push falhou", s.endpoint, err);
        if (err.statusCode === 404 || err.statusCode === 410) {
          await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, {
            method: "DELETE",
            headers: sbHeaders(),
          });
        }
      }
    }
  }

  // Marca como enviadas SÓ estas notas (RPC atómica, na empresa certa), em vez
  // de reescrever a lista inteira — uma nota criada/apagada enquanto os envios
  // decorriam não se perde.
  const notified = dueNotes.map((n) => ({ ...n, notified: true }));
  const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/patch_app_list`, {
    method: "POST",
    headers: { ...sbHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ slice: "personal_notes", upserts: notified, removed: [], prepend: false, p_company: companyId }),
  });
  if (!rpcRes.ok) {
    console.error("patch_app_list falhou para a empresa", companyId, await rpcRes.text());
  }
  return dueNotes.length;
}

Deno.serve(async (req) => {
  const given = req.headers.get("x-cron-secret") || "";
  const expected = await readCronSecret();
  if (!expected || !safeEqual(given, expected)) return new Response("unauthorized", { status: 401 });

  // Empresas com assinatura em dia (ativa ou em tolerância), cada uma com o seu fuso.
  const compRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/reminder_companies`, {
    method: "POST",
    headers: { ...sbHeaders(), "Content-Type": "application/json" },
    body: "{}",
  });
  if (!compRes.ok) {
    console.error("reminder_companies falhou", await compRes.text());
    return new Response("erro ao listar empresas", { status: 500 });
  }
  const companies: { id: number; timezone: string | null }[] = await compRes.json();

  let total = 0;
  for (const c of companies) {
    try {
      total += await remindCompany(c.id, c.timezone || REMINDER_TZ);
    } catch (err) {
      // Uma empresa com problema não impede as outras.
      console.error("lembretes falharam para a empresa", c.id, err);
    }
  }

  if (total === 0) return new Response("nenhum lembrete pra hoje", { status: 200 });
  return new Response(`enviado para ${total} lembrete(s)`, { status: 200 });
});
