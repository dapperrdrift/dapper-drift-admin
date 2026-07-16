import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export interface AdminAuthResult {
  ok: true;
  userId: string;
  serviceClient: SupabaseClient;
}

export interface AdminAuthFailure {
  ok: false;
  status: number;
  error: string;
}

// Verifies the caller holds the 'admin' role via the same has_role() RPC the
// DB policies use, then hands back a service-role client for the actual work
// — storage RLS via a forwarded user JWT is unreliable (see optimize-image).
export async function requireAdmin(req: Request): Promise<AdminAuthResult | AdminAuthFailure> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { ok: false, status: 401, error: "Missing authorization" };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return { ok: false, status: 500, error: "Supabase env not configured" };
  }

  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user) {
    return { ok: false, status: 401, error: "Invalid or expired session" };
  }

  const { data: isAdmin, error: roleError } = await callerClient.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (roleError || !isAdmin) {
    return { ok: false, status: 403, error: "Admin privileges required" };
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);
  return { ok: true, userId: userData.user.id, serviceClient };
}
