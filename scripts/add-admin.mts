// Grants admin access: creates the auth user if needed (sign-ups are disabled) and adds it to public.admins.
// Usage: node --env-file=.env.local scripts/add-admin.mts someone@example.com [another@example.com]
import { createClient } from "@supabase/supabase-js";

const emails = process.argv.slice(2).map((e) => e.trim().toLowerCase());
if (!emails.length) {
  console.error("Usage: node --env-file=.env.local scripts/add-admin.mts <email> [...]");
  process.exit(1);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserId(email: string) {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user) return user.id;
    if (data.users.length < 200) return null;
  }
}

for (const email of emails) {
  let userId = await findUserId(email);
  if (!userId) {
    const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
    if (error) throw error;
    userId = data.user.id;
  }
  const { error } = await db.from("admins").upsert({ user_id: userId, email });
  if (error) throw error;
  console.log(`admin: ${email}`);
}
