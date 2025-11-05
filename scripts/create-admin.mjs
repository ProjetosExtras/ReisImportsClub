import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const email = 'mayconreis2030@gmail.com';
const password = 'Admin#2025!'; // senha temporária, altere após primeiro login
const fullName = 'Maycon Wender Dos Reis Borges';
const phone = '05286558178';

async function ensureUser() {
  // Tenta criar o usuário; se já existir, buscamos na lista
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone }
  });

  if (error) {
    // Se já existir, encontra na lista de usuários pelo e-mail
    const list = await admin.auth.admin.listUsers();
    if (list.error) throw list.error;
    const existing = list.data.users.find((u) => u.email === email);
    if (!existing) throw error;
    return existing;
  }

  return data.user;
}

async function upsertProfile(userId) {
  const { error } = await admin
    .from('profiles')
    .upsert(
      {
        id: userId,
        full_name: fullName,
        phone: phone,
        address: null,
        role: 'admin'
      },
      { onConflict: 'id' }
    );
  if (error) throw error;
}

async function ensureAdminRole(userId) {
  const { data, error } = await admin
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'admin');
  if (error) throw error;

  if (!data || data.length === 0) {
    const { error: insertErr } = await admin
      .from('user_roles')
      .insert({ user_id: userId, role: 'admin' });
    if (insertErr) throw insertErr;
  }
}

async function main() {
  try {
    const user = await ensureUser();
    console.log('User ensured:', user.id);
    await upsertProfile(user.id);
    await ensureAdminRole(user.id);
    console.log('Admin profile and role set for user:', user.id);
  } catch (err) {
    console.error('Failed to create/adminify user:', err);
    process.exit(1);
  }
}

main();