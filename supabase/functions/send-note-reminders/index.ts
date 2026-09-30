import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

webpush.setVapidDetails("mailto:contato@servix.example", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

function sbHeaders() {
  return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };
}

Deno.serve(async () => {
  const today = new Date().toISOString().slice(0, 10);

  const appDataRes = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.1&select=personal_notes`, {
    headers: sbHeaders(),
  });
  const rows = await appDataRes.json();
  const notes = (rows[0] && rows[0].personal_notes) || [];

  const dueNotes = notes.filter((n) => n.date === today && !n.notified);
  if (dueNotes.length === 0) return new Response("nenhum lembrete pra hoje", { status: 200 });

  const subsRes = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?select=*`, { headers: sbHeaders() });
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

  const updatedNotes = notes.map((n) => (n.date === today && !n.notified ? { ...n, notified: true } : n));
  await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.1`, {
    method: "PATCH",
    headers: { ...sbHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ personal_notes: updatedNotes }),
  });

  return new Response(`enviado para ${dueNotes.length} lembrete(s)`, { status: 200 });
});
