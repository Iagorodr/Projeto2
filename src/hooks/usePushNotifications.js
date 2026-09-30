import { useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "../models/supabaseClient.js";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function usePushNotifications(ownerId) {
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
  const [permission, setPermission] = useState(supported ? Notification.permission : "unsupported");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => { if (!cancelled) setSubscribed(!!sub); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [supported]);

  const subscribe = useCallback(async () => {
    if (!supported || !VAPID_PUBLIC_KEY || !isSupabaseConfigured) return false;
    setBusy(true);
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return false;

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      const json = sub.toJSON();
      const { error: dbError } = await supabase.from("push_subscriptions").upsert(
        {
          owner_id: String(ownerId),
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
        { onConflict: "endpoint" }
      );
      if (dbError) throw dbError;
      setSubscribed(true);
      return true;
    } catch (err) {
      console.error("Erro ao ativar notificações push:", err);
      setError(err);
      return false;
    } finally {
      setBusy(false);
    }
  }, [supported, ownerId]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        if (isSupabaseConfigured) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
      console.error("Erro ao desativar notificações push:", err);
      setError(err);
    } finally {
      setBusy(false);
    }
  }, [supported]);

  return { supported: supported && !!VAPID_PUBLIC_KEY, permission, subscribed, busy, error, subscribe, unsubscribe };
}

export { usePushNotifications };
