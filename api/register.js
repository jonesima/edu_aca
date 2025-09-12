import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL= 'hwedbxiiyblmpuegdofm.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY= 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3ZWRieGlpeWJsbXB1ZWdkb2ZtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzM2NTM4MiwiZXhwIjoyMDcyOTQxMzgyfQ.hki7vnRfS41mPW8dTem5d9lyB7ipK0YoNNaBVEHOI0A' // use service key, not anon
);

// Helper to generate Student/Teacher IDs
function generateStudentId() {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  const currentYear = new Date().getFullYear().toString().slice(-2);
  return `S${randomNum}${currentYear}`;
}

function generateTeacherId() {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const currentYear = new Date().getFullYear().toString().slice(-2);
  return `T${currentYear}${randomNum}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, password, role, first_name, last_name, date_of_birth, department } = req.body;

    if (!email || !password || !role || !first_name || !last_name) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Create auth user
    const { data: user, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) throw authError;

    // Generate IDs
    let student_id = null;
    let teacher_id = null;

    if (role === "student") {
      student_id = generateStudentId();
    } else if (role === "teacher") {
      teacher_id = generateTeacherId();
    }

    // Insert into profiles table
    const { error: profileError } = await supabase.from("profiles").insert({
      user_id: user.user.id,
      role,
      first_name,
      last_name,
      email,
      date_of_birth: role === "student" ? date_of_birth : null,
      department: role === "teacher" ? department : null,
      student_id,
      teacher_id
    });

    if (profileError) throw profileError;

    res.status(200).json({
      success: true,
      message: "User registered successfully",
      student_id,
      teacher_id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Server error" });
  }
}
