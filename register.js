// register.js
AOS.init();
feather.replace();

let currentStep = 1;
let selectedRole = null;

/* -----------------------------
   Step Navigation
--------------------------------*/
function nextStep() {
  if (currentStep === 1) {
    if (!selectedRole) {
      alert("Please select a role before continuing.");
      return;
    }

    const title = document.getElementById("formTitle");

    if (selectedRole === "student") {
      title.textContent = "Student Registration";
      document.getElementById("studentFields").classList.remove("hidden");
      document.getElementById("teacherFields").classList.add("hidden");
    } else if (selectedRole === "teacher") {
      title.textContent = "Teacher Registration";
      document.getElementById("studentFields").classList.add("hidden");
      document.getElementById("teacherFields").classList.remove("hidden");
      document.getElementById("teacherId").value = generateTeacherId();
    }
  }

  document.getElementById(`step${currentStep}`).classList.add("hidden");
  currentStep++;
  updateStepIndicator();
  document.getElementById(`step${currentStep}`).classList.remove("hidden");
}

function prevStep() {
  document.getElementById(`step${currentStep}`).classList.add("hidden");
  currentStep--;
  updateStepIndicator();
  document.getElementById(`step${currentStep}`).classList.remove("hidden");
}

function updateStepIndicator() {
  document.querySelectorAll(".step").forEach((step, index) => {
    if (index < currentStep) {
      step.classList.add("active");
    } else {
      step.classList.remove("active");
    }
  });
}

/* -----------------------------
   Role Selection
--------------------------------*/
document.querySelectorAll(".role-option").forEach(option => {
  option.addEventListener("click", function () {
    document.querySelectorAll(".role-option").forEach(opt =>
      opt.classList.remove("border-indigo-500", "bg-indigo-50")
    );
    this.classList.add("border-indigo-500", "bg-indigo-50");
    selectedRole = this.querySelector("span").innerText.toLowerCase(); // "student" or "teacher"
  });
});

/* -----------------------------
   ID Generators
--------------------------------*/
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

/* -----------------------------
   Registration Handler
--------------------------------*/
async function registerHandler() {
  try {
    const role = selectedRole;
    const first_name = document.getElementById("firstName").value.trim();
    const last_name = document.getElementById("lastName").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (!first_name || !last_name || !email || !password || !confirmPassword) {
      throw new Error("Please complete all required fields.");
    }
    if (password !== confirmPassword) {
      throw new Error("Passwords do not match.");
    }

    let payload = { role, first_name, last_name, email, password };

    if (role === "student") {
      payload.date_of_birth = document.getElementById("dateOfBirth").value;
    } else if (role === "teacher") {
      payload.teacher_id = document.getElementById("teacherId").value;
      payload.department = document.getElementById("department").value.trim();
    }

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Registration failed");

    // Success → Step 3
    document.getElementById("step2").classList.add("hidden");
    document.getElementById("step3").classList.remove("hidden");

    const successMessage = document.getElementById("successMessage");
    if (role === "student") {
      successMessage.textContent =
        "Your account has been created successfully. Your unique Student ID has been generated.";
      document.getElementById("finalStudentId").textContent =
        data.student_id || generateStudentId();
    } else {
      successMessage.textContent =
        "Your account has been created successfully. Your unique Teacher ID has been generated.";
      document.getElementById("finalStudentId").textContent =
        data.teacher_id || generateTeacherId();
    }
  } catch (err) {
    console.error("Registration error:", err);
    alert(err.message || "Registration failed. Please try again.");
  }
}

/* -----------------------------
   Button Wiring
--------------------------------*/
document
  .querySelector("#step2 #registerBtn")
  ?.addEventListener("click", async e => {
    e.preventDefault();
    await registerHandler();
  });

document
  .querySelector("#step2 button:first-of-type")
  ?.addEventListener("click", e => {
    e.preventDefault();
    prevStep();
  });

// Expose functions for inline HTML
window.nextStep = nextStep;
window.prevStep = prevStep;
