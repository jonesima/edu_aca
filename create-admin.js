// create-admin.js
import { createClient } from "@supabase/supabase-js";

// ⚠️ Replace with your actual Supabase credentials
const SUPABASE_URL = "https://hwedbxiiyblmpuegdofm.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3ZWRieGlpeWJsbXB1ZWdkb2ZtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzM2NTM4MiwiZXhwIjoyMDcyOTQxMzgyfQ.hki7vnRfS41mPW8dTem5d9lyB7ipK0YoNNaBVEHOI0A"; // NEVER expose in frontend

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function createAdmin() {
  try {
    // 1. Create user in auth.users
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email: "admin@example.com",
      password: "admin123",
      email_confirm: true, // skip email confirmation
    });

    if (userError) {
      console.error("❌ Error creating admin user:", userError.message);
      return;
    }

    const user = userData.user;
    console.log("✅ Admin user created in auth.users:", user.id);

    // 2. Insert profile linked to this user
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .insert([
        {
          user_id: user.id,
          role: "admin",
          first_name: "System",
          last_name: "Administrator",
          email: "admin@example.com",
        },
      ])
      .select()
      .single();

    if (profileErr) {
      console.error("❌ Error inserting admin profile:", profileErr.message);
      return;
    }

    console.log("✅ Admin profile created:", profile);
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

createAdmin();

