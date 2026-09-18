import type { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

// Vercel llama a esta ruta cada 3 días (ver vercel.json) para que el
// proyecto gratis de Supabase no se pause por inactividad.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { error } = await supabase.from("players").select("id").limit(1);
  if (error) {
    return Response.json({ ok: false, error: error.message.slice(0, 200) }, { status: 500 });
  }
  return Response.json({ ok: true, checkedAt: new Date().toISOString() });
}
