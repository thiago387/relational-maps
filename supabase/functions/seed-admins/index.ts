import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const admins = [
      { email: "thiago@hiddenlaier.com", password: "Thiago2026*" },
      { email: "alex@hiddenlaier.com", password: "Alex2026*" },
    ];

    const results = [];

    for (const admin of admins) {
      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((u) => u.email === admin.email);

      if (existing) {
        // Ensure role exists
        await supabaseAdmin.from("user_roles").upsert(
          { user_id: existing.id, role: "admin" },
          { onConflict: "user_id,role" }
        );
        results.push({ email: admin.email, status: "already_exists", id: existing.id });
        continue;
      }

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: admin.email,
        password: admin.password,
        email_confirm: true,
      });

      if (createError) {
        results.push({ email: admin.email, status: "error", error: createError.message });
        continue;
      }

      await supabaseAdmin.from("user_roles").insert({
        user_id: newUser.user.id,
        role: "admin",
      });

      results.push({ email: admin.email, status: "created", id: newUser.user.id });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
