import { createClient } from "@supabase/supabase-js";

// 이 클라이언트는 반드시 서버(API Route)에서만 import 해야 합니다.
// SUPABASE_SERVICE_ROLE_KEY는 RLS를 우회하는 관리자 키이므로 브라우저 번들에 절대 포함되면 안 됩니다.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseAdmin() {
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase 환경변수가 설정되지 않았습니다. NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 를 .env.local 에 설정하세요."
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
