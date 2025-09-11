AOS.init();
   feather.replace();
        
  // Role selection functionality
        document.querySelectorAll('input[name="role"]').forEach(radio => {
            radio.addEventListener('change', function() {
                const placeholderText = this.value === 'student' || this.value === 'parent' ? 
                    "Student ID or Email address" : "Email address";
                document.getElementById('email-address').placeholder = placeholderText;
            });
        });

  import { signIn, redirectByRole } from './supabase-client.js';

  document.querySelector('form').addEventListener('submit', async function (e) {
    e.preventDefault();
    try {
      const role = document.querySelector('input[name="role"]:checked').value;
      const loginInput = document.getElementById('email-address').value.trim();
      const password = document.getElementById('password').value;
      
      const { user, profile } = await signIn({ loginInput, password, role });
      // redirect
      redirectByRole(profile);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Sign in failed');
    }
  });

  const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('user_id', user.id)
  .maybeSingle();

if (!profile) {
  await supabase.from('profiles').insert({
    user_id: user.id,
    role,
    first_name,
    last_name,
    email
  });
}

// Handle confirmation redirect
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    console.log("User confirmed and logged in:", session.user);
    // Redirect based on role
    supabase.from('profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data: profile }) => {
        if (profile) {
          redirectByRole(profile);
        } else {
          window.location.href = '/register.html';
        }
      });
  }
});
