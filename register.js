// Initialize libraries
AOS.init();
feather.replace();

let currentStep = 1;

import { createUserAndProfile } from './supabase-client.js';

// Handle registration logic
async function registerHandler() {
  const registerBtn = document.querySelector('#step2 button:last-of-type');

  try {
    // Disable button & show spinner
    registerBtn.disabled = true;
    registerBtn.innerHTML = `
      <svg class="animate-spin h-5 w-5 mr-2 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8z"></path>
      </svg>
      Registering...
    `;

    const role = 'student'; // Based on your current flow
    const first_name = document.getElementById('firstName').value.trim();
    const last_name = document.getElementById('lastName').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const studentId = document.getElementById('studentId').value.trim();
    const dateOfBirth = document.getElementById('dateOfBirth').value;

    // Validate inputs
    if (!first_name || !last_name || !email || !password || !confirmPassword || !dateOfBirth) {
      throw new Error('Please complete all required fields.');
    }
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match.');
    }

    // Create user and profile via Supabase
    const { profile } = await createUserAndProfile({
      email,
      password,
      role,
      first_name,
      last_name,
      student_id: studentId || null,
      date_of_birth: dateOfBirth
    });

    if (!profile) {
      throw new Error('Registration successful. Please confirm your email before signing in.');
    }

    // Move to Step 3 after successful Supabase user creation
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('step3').classList.remove('hidden');
    document.getElementById('finalStudentId').textContent =
      profile.student_id || generateStudentId();

    currentStep = 3;
    updateStepIndicator();

  } catch (err) {
    console.error(err);
    alert(err.message || 'Registration failed. Please try again.');
  } finally {
    // Re-enable button & restore text
    registerBtn.disabled = false;
    registerBtn.innerHTML = 'Register';
  }
}

// Step navigation
function nextStep() {
  document.getElementById(`step${currentStep}`).classList.add('hidden');
  currentStep++;
  updateStepIndicator();
  document.getElementById(`step${currentStep}`).classList.remove('hidden');
}

function prevStep() {
  document.getElementById(`step${currentStep}`).classList.add('hidden');
  currentStep--;
  updateStepIndicator();
  document.getElementById(`step${currentStep}`).classList.remove('hidden');
}

function updateStepIndicator() {
  document.querySelectorAll('.step').forEach((step, index) => {
    if (index < currentStep) {
      step.classList.add('active');
    } else {
      step.classList.remove('active');
    }
  });
}

// Fallback student ID generator
function generateStudentId() {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  const currentYear = new Date().getFullYear().toString().slice(-2);
  return `S${randomNum}${currentYear}`;
}

// Event bindings
document.querySelector('#step1 button')
  ?.addEventListener('click', (e) => {
    e.preventDefault();
    nextStep();
  });

document.querySelector('#step2 button:last-of-type') // Register button
  ?.addEventListener('click', async (e) => {
    e.preventDefault();
    await registerHandler();
  });

document.querySelector('#step2 button:first-of-type') // Back button
  ?.addEventListener('click', (e) => {
    e.preventDefault();
    prevStep();
  });

// Role selection highlight
document.querySelectorAll('.role-option').forEach(option => {
  option.addEventListener('click', function () {
    document.querySelectorAll('.role-option').forEach(opt =>
      opt.classList.remove('border-indigo-500', 'bg-indigo-50')
    );
    this.classList.add('border-indigo-500', 'bg-indigo-50');
  });
});
