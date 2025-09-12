import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL= 'hwedbxiiyblmpuegdofm.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY= 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3ZWRieGlpeWJsbXB1ZWdkb2ZtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzM2NTM4MiwiZXhwIjoyMDcyOTQxMzgyfQ.hki7vnRfS41mPW8dTem5d9lyB7ipK0YoNNaBVEHOI0A' // use service key, not anon
);


// Generate unique Student ID
async function generateUniqueStudentId() {
  let studentId;
  let exists = true;

  while (exists) {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const currentYear = new Date().getFullYear().toString().slice(-2);
    studentId = `S${randomNum}${currentYear}`;

    const { data } = await supabase
      .from("profiles")
      .select("student_id")
      .eq("student_id", studentId)
      .maybeSingle();

    exists = !!data;
  }
  return studentId;
}

// Generate unique Teacher ID
async function generateUniqueTeacherId() {
  let teacherId;
  let exists = true;

  while (exists) {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const currentYear = new Date().getFullYear().toString().slice(-2);
    teacherId = `T${currentYear}${randomNum}`;

    const { data } = await supabase
      .from("profiles")
      .select("teacher_id")
      .eq("teacher_id", teacherId)
      .maybeSingle();

    exists = !!data;
  }
  return teacherId;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, password, role, first_name, last_name, date_of_birth, department } =
      req.body;

    if (!email || !password || !role || !first_name || !last_name) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) throw authError;
    const user = authData.user;

    // Generate unique IDs
    let studentId = null;
    let teacherId = null;

    if (role === "student") {
      studentId = await generateUniqueStudentId();
    } else if (role === "teacher") {
      teacherId = await generateUniqueTeacherId();
    }

    // Insert profile
    const { error: profileError } = await supabase.from("profiles").insert({
      user_id: user.id,
      role,
      first_name,
      last_name,
      email,
      student_id: studentId,
      teacher_id: teacherId,
      date_of_birth: role === "student" ? date_of_birth : null,
      department: role === "teacher" ? department : null
    });

    if (profileError) throw profileError;

    res.status(200).json({
      success: true,
      user: { id: user.id, email: user.email },
      student_id: studentId,
      teacher_id: teacherId
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(400).json({ error: err.message || "Registration failed" });
  }
}
