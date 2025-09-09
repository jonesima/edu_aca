AOS.init();
 feather.replace();
        
let currentStep = 1;
        

  import { createUserAndProfile } from './supabase-client.js';

  async function registerHandler() {
    try {
      // gather values from the registration form
      const role = 'student'; // as your register flow focuses on students
      const first_name = document.getElementById('firstName').value.trim();
      const last_name = document.getElementById('lastName').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const department = document.getElementById('department') ? document.getElementById('department').value : null;

      if (!email || !password) throw new Error('Please complete the form.');

      // create user and profile
      const { user, profile, signUpData } = await createUserAndProfile({
        email,
        password,
        role,
        first_name,
        last_name,
        department
      });

      // if profile was created immediately:
      if (profile) {
        // show success UI (step3) and display student_id
        document.getElementById('generatedStudentId').textContent = profile.student_id || '—';
        document.getElementById('finalStudentId').textContent = profile.student_id || '—';
        // show step3 content (your existing step UI)
        // ensure step3 is visible
        document.getElementById('step2').classList.add('hidden');
        document.getElementById('step3').classList.remove('hidden');
      } else {
        // email confirmation flow: instruct user to check email
        alert('Registered. Please check your email to confirm your account before signing in.');
      }

    } catch (err) {
      console.error(err);
      alert(err.message || 'Registration failed');
    }
  }

  // wire the register button
  document.querySelectorAll('button[onclick="nextStep()"]').forEach(btn => {
    // replace or add a handler on the final Register button (ensure this is actually final)
  });
  // If you have a specific Register button ID, wire it:
  const registerBtn = document.querySelector('button[onclick="nextStep()"]'); // update selector if needed
  if (registerBtn) {
    registerBtn.addEventListener('click', async (ev) => {
      // if step2 visible, run register
      if (!document.getElementById('step2').classList.contains('hidden')) {
        ev.preventDefault();
        await registerHandler();
      } else {
        // go to next step (role selection -> details)
        // keep your existing nextStep() behavior too
        function nextStep() {
            document.getElementById(`step${currentStep}`).classList.add('hidden');
            currentStep++;
            
            // Update step indicator
            document.querySelectorAll('.step').forEach((step, index) => {
                if (index < currentStep - 1) {
                    step.classList.add('active');
                } else {
                    step.classList.remove('active');
                }
            });
            
            // Generate student ID when moving to step 3
            if (currentStep === 3) {
                generateStudentId();
            }
            
            document.getElementById(`step${currentStep}`).classList.remove('hidden');
        }
        
        function generateStudentId() {
            // Generate a unique student ID (S + random 5-digit number + current year)
            const randomNum = Math.floor(10000 + Math.random() * 90000);
            const currentYear = new Date().getFullYear().toString().slice(-2);
            const studentId = `S${randomNum}${currentYear}`;
            
            // Display the generated ID
            document.getElementById('generatedStudentId').textContent = studentId;
            document.getElementById('finalStudentId').textContent = studentId;
            document.getElementById('generatedIdContainer').classList.remove('hidden');
        }
        
        function prevStep() {
            document.getElementById(`step${currentStep}`).classList.add('hidden');
            currentStep--;
            
            // Update step indicator
            document.querySelectorAll('.step').forEach((step, index) => {
                if (index < currentStep - 1) {
                    step.classList.add('active');
                } else {
                    step.classList.remove('active');
                }
            });
            
            document.getElementById(`step${currentStep}`).classList.remove('hidden');
        }
        
        // Role selection
        document.querySelectorAll('.role-option').forEach(option => {
            option.addEventListener('click', function() {
                document.querySelectorAll('.role-option').forEach(opt => {
                    opt.classList.remove('border-indigo-500', 'bg-indigo-50');
                });
                this.classList.add('border-indigo-500', 'bg-indigo-50');
            });
        });
      }
    });
  }
