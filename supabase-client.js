// <!-- Add this near the bottom of pages that need it -->

  import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

  // === CONFIG ===
  // Replace these placeholders with your actual values (or generate a small env.js in CI)
  const SUPABASE_URL = 'https://hwedbxiiyblmpuegdofm.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3ZWRieGlpeWJsbXB1ZWdkb2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNjUzODIsImV4cCI6MjA3Mjk0MTM4Mn0.to0blDCawpyFIGtm_0ip2w76hxXt9beKIj5npjn3Ta4';

  export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ---------- Utilities ----------
  export async function createUserAndProfile({email, password, role, first_name, last_name, department}) {
    // 1) sign up (email + password)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password
    }, {
      // send email confirm? depends on your Supabase settings
      options: { emailRedirectTo: 'https://edu-aca.vercel.app/login.html' }
    });

    if (signUpError) throw signUpError;

    // 2) wait for user object (if immediate) or insert a profile; we'll create profile only when user exists
    const user_id = signUpData?.user?.id;
    if (!user_id) {
      // with email confirmation on, Supabase may require confirm before creating profile.
      // We'll still return signUpData and the front-end should show instructions if not created.
      return { signUpData };
    }

    // 3) if role is student, generate student id server-side via RPC
    let student_id = null;
    if (role === 'student') {
      const { data: sid, error: sidErr } = await supabase.rpc('generate_student_id');
      if (sidErr) throw sidErr;
      student_id = sid;
    }

    // 4) insert into profiles table
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .insert([{
        user_id,
        role,
        department,
        student_id,
        first_name,
        last_name,
        email
      }])
      .select()
      .single();

    if (profileErr) throw profileErr;

    return { user: signUpData.user, profile };
  }

  export async function signIn({loginInput, password, role}) {
    // loginInput could be email or student_id (students may enter student id)
    if (role === 'student' && loginInput && loginInput.toUpperCase().startsWith('S')) {
      // allow login by student_id: lookup email in profiles
      const { data: profs, error: pErr } = await supabase
        .from('profiles')
        .select('email, user_id, role, student_id, first_name, last_name')
        .eq('student_id', loginInput)
        .limit(1)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!profs || !profs.email) throw new Error('No account found with that Student ID.');
      loginInput = profs.email;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginInput,
      password
    });

    if (error) throw error;

    // After sign in, get profile
    const user_id = data.user.id;
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user_id)
      .limit(1)
      .maybeSingle();

    if (profileErr) throw profileErr;

    return { user: data.user, profile };
  }

  export async function getProfileByUserId(user_id) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user_id)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  // helper to redirect based on role
  export function redirectByRole(profile) {
    if (!profile) {
      window.location.href = '/login.html';
      return;
    }
    const role = profile.role;
    if (role === 'student') {
      // add student id as query param
      window.location.href = `/dashboard-student.html?student_id=${encodeURIComponent(profile.student_id)}&uid=${profile.user_id}`;
    } else if (role === 'teacher') {
      window.location.href = `/dashboard-teacher.html?uid=${profile.user_id}`;
    } else if (role === 'admin') {
      window.location.href = `/dashboard-admin.html?uid=${profile.user_id}`;
    } else if (role === 'parent') {
      window.location.href = `/parent-access.html?parent_id=${profile.user_id}`;
    } else {
      window.location.href = '/login.html';
    }
  }

  // expose to window for easier use in inline scripts (optional)
  window.SUPABASE = { supabase, createUserAndProfile, signIn, getProfileByUserId, redirectByRole };


import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Replace with your project values
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3ZWRieGlpeWJsbXB1ZWdkb2ZtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzM2NTM4MiwiZXhwIjoyMDcyOTQxMzgyfQ.hki7vnRfS41mPW8dTem5d9lyB7ipK0YoNNaBVEHOI0A'; // ⚠️ use service key, NOT anon key

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function createAdmin() {
  // Step 1: Create user in auth
  const { data: user, error } = await supabase.auth.admin.createUser({
    email: 'admin@example.com',
    password: 'admin123',
    email_confirm: true,  // skips the confirmation step
  });

  if (error) {
    console.error('Error creating admin user:', error);
    return;
  }

  console.log('Admin user created in auth.users:', user.user.id);

  // Step 2: Create profile entry linked to this user
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .insert([{
      user_id: user.user.id,
      role: 'admin',
      first_name: 'System',
      last_name: 'Administrator',
      email: 'admin@example.com'
    }])
    .select()
    .single();

  if (profileErr) {
    console.error('Error creating admin profile:', profileErr);
  } else {
    console.log('Admin profile created:', profile);
  }
}

createAdmin();
