// Initialize libraries
AOS.init();
feather.replace();

let currentStep = 1;

import { createUserAndProfile } from './supabase-client.js';

// Handle registration logic
async function registerHandler() {
  try {
    const role = 'student'; // Based on your current flow
    const first_name = document.getElementById('firstName').value.trim();
    const last_name = document.getElementById('lastName').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const studentId = document.getElementById('studentId').value.trim();
    const dateOfBirth = document.getElementById('dateOfBirth').value;


// Validation
    if (!first_name || !last_name || !email || !password || !confirmPassword || !dateOfBirth) {
      throw new Error('Please complete all required fields.');
    }
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match.');
    }

    // Create user + profile
    const { user, profile } = await createUserAndProfile({
      email,
      password,
      role,
      first_name,
      last_name,
      student_id: studentId || null,
      date_of_birth: dateOfBirth
    });

    // Success → go to step 3
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('step3').classList.remove('hidden');

    // Show Student ID (use DB one or fallback generator)
    document.getElementById('finalStudentId').textContent =
      (profile && profile.student_id) || generateStudentId();

  } catch (err) {
    console.error("Registration error:", err);
    alert(err.message || 'Registration failed. Please try again.');
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

// Generate fallback Student ID
function generateStudentId() {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  const currentYear = new Date().getFullYear().toString().slice(-2);
  return `S${randomNum}${currentYear}`;
}

// Wire up buttons
document.getElementById('step1')
  ?.querySelector('button')
  ?.addEventListener('click', (e) => {
    e.preventDefault();
    nextStep();
  });

document.querySelector('#step2 button:last-of-type')
  ?.addEventListener('click', async (e) => {
    e.preventDefault();
    await registerHandler();
  });

document.querySelector('#step2 button:first-of-type')
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
