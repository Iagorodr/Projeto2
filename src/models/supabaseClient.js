// Cliente Supabase do app (lado do browser). As chaves vêm de variáveis de
// ambiente do Vite (ficheiro .env.local, nunca commitado — ver .env.example).
// Se não estiverem definidas, o app continua a funcionar normalmente com os
// dados de demonstração em memória (models/data.js), só sem persistência.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isSupabaseConfigured = Boolean(url && anonKey);

const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null;

export { supabase, isSupabaseConfigured };
