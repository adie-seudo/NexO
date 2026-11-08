// =========================================
// MASTER INITIALIZATION
// =========================================
document.addEventListener("DOMContentLoaded", () => {
  initLoginFocus();
  initLoginToggleAndSubmit();
  initPasswordVisibility();
  initRegisterPage();
  initLogoTypingEffect(); // <-- ADD THIS LINE
});

// =========================================
// 1. AUTO-FOCUS LOGIN ON PAGE LOAD
// =========================================
function initLoginFocus() {
  if (window.location.hash === "#focus-login") {
    const authScreen = document.getElementById("auth-screen");
    const focusEmailInput = document.getElementById("email");

    if (authScreen && focusEmailInput) {
      authScreen.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => focusEmailInput.focus(), 500);
      history.replaceState(null, null, "index.html");
    }
  }
}

// =========================================
// 2. LOGIN PAGE: TOGGLE & FORM SUBMISSION
// =========================================
function initLoginToggleAndSubmit() {
  const loginForm = document.getElementById("login-form");

  // FIX: Grabs the buttons by class in case the IDs are missing in HTML
  const toggleBtns = document.querySelectorAll(".role-toggle .toggle-btn");
  const btnStudent = document.getElementById("btn-student") || toggleBtns[0];
  const btnProvider = document.getElementById("btn-provider") || toggleBtns[1];

  const loginEmailInput = document.getElementById("email");
  const loginPasswordInput = document.getElementById("password");
  const emailGroup = document.getElementById("email-group");
  const emailIcon = document.querySelector("#email-group .input-icon");
  const emailError = document.getElementById("email-error");

  // Hide error automatically as user types
  if (loginEmailInput && emailGroup && emailError) {
    loginEmailInput.addEventListener("input", () => {
      emailGroup.classList.remove("has-error", "input-error");
      emailError.style.display = "none";
    });
  }

  // Login Role Toggle
  if (btnStudent && btnProvider) {
    function setLoginRole(role) {
      if (role === "Student") {
        btnStudent.classList.add("active");
        btnProvider.classList.remove("active");
        if (loginEmailInput)
          loginEmailInput.placeholder = "you@university.edu.ph";
        if (emailIcon) emailIcon.src = "assets/human-icon.png";
        if (emailError) {
          emailError.textContent =
            "Access Denied: Only valid university emails (.edu.ph) are permitted for student login.";
        }
      } else {
        btnProvider.classList.add("active");
        btnStudent.classList.remove("active");
        if (loginEmailInput)
          loginEmailInput.placeholder = "contact@organization.org";
        if (emailIcon) emailIcon.src = "assets/organization-icon.png";
        if (emailError) emailError.style.display = "none";
        if (emailGroup) emailGroup.classList.remove("input-error", "has-error");
      }
    }

    btnStudent.addEventListener("click", (e) => {
      e.preventDefault();
      setLoginRole("Student");
    });

    btnProvider.addEventListener("click", (e) => {
      e.preventDefault();
      setLoginRole("Provider");
    });
  }
  // Login Form Submission (With Admin Bypass)
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const emailValue = loginEmailInput
        ? loginEmailInput.value.trim().toLowerCase()
        : "";
      const passwordValue = loginPasswordInput ? loginPasswordInput.value : "";
      const isStudent = btnStudent && btnStudent.classList.contains("active");

      // 1. PROVIDER ADMIN BYPASS
      if (emailValue === "admin@admin" && passwordValue === "admin") {
        // Give the browser a memory that we are logged in
        sessionStorage.setItem("nexo-logged-in", "provider");
        window.location.href = "provider-dashboard.html";
        return;
      }

      // 2. STUDENT ADMIN BYPASS (NEW)
      if (emailValue === "admin@admin.edu.ph" && passwordValue === "admin") {
        sessionStorage.setItem("nexo-logged-in", "student");
        window.location.href = "student-dashboard.html";
        return;
      }

      // Standard Login Validation
      if (isStudent) {
        if (!emailValue.endsWith(".edu.ph")) {
          if (emailGroup) emailGroup.classList.add("input-error", "has-error");
          if (emailError) {
            emailError.textContent =
              "Access Denied: Only valid university emails (.edu.ph) are permitted for student login.";
            emailError.style.display = "block";
          }
        } else {
          if (emailGroup)
            emailGroup.classList.remove("input-error", "has-error");
          if (emailError) emailError.style.display = "none";
        }
      } else {
        if (emailGroup) emailGroup.classList.add("input-error", "has-error");
        if (emailError) {
          emailError.textContent =
            "Invalid credentials. Try 'admin' for both fields to test.";
          emailError.style.display = "block";
        }
      }
    });
  }
}

// =========================================
// 3. LOGIN PASSWORD VISIBILITY TOGGLE
// =========================================
function initPasswordVisibility() {
  const togglePasswordBtn = document.getElementById("toggle-password");
  const loginPasswordInput = document.getElementById("password"); // Scoped locally

  if (togglePasswordBtn && loginPasswordInput) {
    togglePasswordBtn.addEventListener("click", () => {
      const isHidden = loginPasswordInput.getAttribute("type") === "password";
      loginPasswordInput.setAttribute("type", isHidden ? "text" : "password");
      togglePasswordBtn.classList.toggle("show-active");
    });
  }
}

// =========================================
// 4. REGISTER PAGE LOGIC
// =========================================
function initRegisterPage() {
  const registerRoleBadge = document.getElementById("register-role-badge");
  const registerSubtitle = document.getElementById("register-subtitle");
  const regNameLabel = document.getElementById("reg-name-label");
  const regNameInput = document.getElementById("reg-name");
  const regNameIcon = document.getElementById("reg-name-icon");
  const regEmailInput = document.getElementById("reg-email");

  if (registerRoleBadge) {
    const urlParams = new URLSearchParams(window.location.search);
    const roleParam = urlParams.get("role") || "student";

    if (roleParam === "provider") {
      registerRoleBadge.textContent = "Provider";
      registerSubtitle.textContent =
        "Join NEXO to post scholarships and connect with top students.";
      if (regNameLabel)
        regNameLabel.textContent = "Organization / Provider Name";
      if (regNameInput)
        regNameInput.placeholder = "e.g., CHED / Megaworld Foundation";
      if (regEmailInput) regEmailInput.placeholder = "contact@organization.org";
      if (regNameIcon) {
        regNameIcon.src = "assets/organization-icon.png";
        regNameIcon.alt = "Organization Name";
      }
    } else {
      registerRoleBadge.textContent = "Student";
      registerSubtitle.textContent =
        "Join NEXO and get access to scholarships and more opportunities.";
      if (regNameLabel) regNameLabel.textContent = "Full Name";
      if (regNameInput) regNameInput.placeholder = "Juan Dela Cruz";
      if (regEmailInput) regEmailInput.placeholder = "you@university.edu.ph";
      if (regNameIcon) {
        regNameIcon.src = "assets/human-icon.png";
        regNameIcon.alt = "Full Name";
      }
    }
  }

  // Register Password Toggles
  function setupRegisterPasswordToggle(toggleId, inputId) {
    const toggleBtn = document.getElementById(toggleId);
    const inputField = document.getElementById(inputId);
    if (toggleBtn && inputField) {
      toggleBtn.addEventListener("click", () => {
        const isHidden = inputField.getAttribute("type") === "password";
        inputField.setAttribute("type", isHidden ? "text" : "password");
        toggleBtn.classList.toggle("show-active");
      });
    }
  }

  setupRegisterPasswordToggle("toggle-reg-password", "reg-password");
  setupRegisterPasswordToggle("toggle-reg-confirm", "reg-confirm-password");

  // Register Form Validation
  const registerForm = document.getElementById("register-form");
  const regEmailGroup = document.getElementById("reg-email-group");
  const regEmailError = document.getElementById("reg-email-error");
  const regPasswordInput = document.getElementById("reg-password");
  const regConfirmInput = document.getElementById("reg-confirm-password");
  const regConfirmGroup = document.getElementById("reg-confirm-group");
  const regMatchError = document.getElementById("reg-match-error");

  if (registerForm) {
    registerForm.addEventListener("submit", (e) => {
      e.preventDefault();
      let isValid = true;
      const isStudent =
        registerRoleBadge && registerRoleBadge.textContent.trim() === "Student";
      const emailValue = regEmailInput
        ? regEmailInput.value.trim().toLowerCase()
        : "";

      if (isStudent && !emailValue.endsWith(".edu.ph")) {
        if (regEmailGroup) regEmailGroup.classList.add("input-error");
        if (regEmailError) regEmailError.style.display = "block";
        isValid = false;
      } else {
        if (regEmailGroup) regEmailGroup.classList.remove("input-error");
        if (regEmailError) regEmailError.style.display = "none";
      }

      if (
        regPasswordInput &&
        regConfirmInput &&
        regPasswordInput.value !== regConfirmInput.value
      ) {
        if (regConfirmGroup) regConfirmGroup.classList.add("input-error");
        if (regMatchError) regMatchError.style.display = "block";
        isValid = false;
      } else {
        if (regConfirmGroup) regConfirmGroup.classList.remove("input-error");
        if (regMatchError) regMatchError.style.display = "none";
      }

      if (isValid) {
        // Save to session storage for the next steps
        if (regEmailInput && regEmailInput.value) {
          sessionStorage.setItem(
            "nexo-pending-email",
            regEmailInput.value.trim(),
          );
        }
        const nameInput =
          document.getElementById("reg-name") ||
          document.querySelector('#register-form input[type="text"]');
        if (nameInput && nameInput.value) {
          sessionStorage.setItem("nexo-pending-name", nameInput.value.trim());
        }

        // Navigate based on role
        if (isStudent) {
          window.location.href = "verify.html";
        } else {
          window.location.href = "provider-setup.html";
        }
      }
    });
  }
}

// =========================================
// 5. LOGO TYPING GLOW EFFECT
// =========================================
function initLogoTypingEffect() {
  const authLogoContainer = document.querySelector(".auth-logo-container");
  const authLogo = document.querySelector(".auth-logo");
  const authInputs = document.querySelectorAll(".auth-container input");

  if (!authLogoContainer || !authLogo || authInputs.length === 0) return;

  let typingTimer;

  authInputs.forEach((input) => {
    input.addEventListener("input", () => {
      // Add the active typing classes
      authLogoContainer.classList.add("is-typing");
      authLogo.classList.add("typing-active-glow");

      // Clear the previous timer
      clearTimeout(typingTimer);

      // Remove the classes after user stops typing for 600ms
      typingTimer = setTimeout(() => {
        authLogoContainer.classList.remove("is-typing");
        authLogo.classList.remove("typing-active-glow");
      }, 600);
    });
  });
}
