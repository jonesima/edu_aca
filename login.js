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
