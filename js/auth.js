// =========================================
// MASTER INITIALIZATION
// =========================================
document.addEventListener("DOMContentLoaded", () => {
  initLoginFocus();
  initLoginToggleAndSubmit();
  initPasswordVisibility();
  initRegisterPage();
  initLogoTypingEffect();
  initGetStartedButton();
});

function initGetStartedButton() {
  const getStartedBtn = document.getElementById("get-started-btn");
  if (getStartedBtn && !getStartedBtn.dataset.boundAuth) {
    getStartedBtn.dataset.boundAuth = "true";
    getStartedBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const authScreen = document.getElementById("auth-screen");
      const focusEmailInput = document.getElementById("email");
      if (authScreen) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        setTimeout(() => {
          if (focusEmailInput) focusEmailInput.focus({ preventScroll: true });
        }, 550);
      }
    });
  }
}

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
  // Login Form Submission (With Admin Bypass & Dynamic User Accounts)
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const emailValue = loginEmailInput
        ? loginEmailInput.value.trim().toLowerCase()
        : "";
      const passwordValue = loginPasswordInput ? loginPasswordInput.value : "";
      const isStudent = btnStudent && btnStudent.classList.contains("active");

      // Clear previous error states
      if (emailGroup) emailGroup.classList.remove("input-error", "has-error");
      if (emailError) emailError.style.display = "none";
      const passwordGroup = loginPasswordInput ? loginPasswordInput.closest(".input-group") : null;
      if (passwordGroup) passwordGroup.classList.remove("input-error", "has-error");

      // 0. Load dynamic registered & admin-created accounts
      let userList = [];
      try {
        const cached = localStorage.getItem("nexo_users");
        if (cached) userList = JSON.parse(cached);
      } catch (_) {}

      try {
        let res = await fetch("/api/users", { cache: "no-store" }).catch(() => null);
        if (!res || !res.ok) {
          res = await fetch("http://localhost:3000/api/users", {
            cache: "no-store",
          }).catch(() => null);
        }
        if (res && res.ok) {
          userList = await res.json();
          localStorage.setItem("nexo_users", JSON.stringify(userList));
        }
      } catch (_) {}

      // Fallback baseline accounts if none loaded
      if (!userList || userList.length === 0) {
        userList = [
          {
            id: "usr_prov_nexo",
            email: "admin@admin",
            password: "admin",
            role: "provider",
            name: "NEXO",
            orgName: "NEXO",
            status: "active",
          },
          {
            id: "usr_stud_adrian",
            email: "adrian@batstate-u.edu.ph",
            password: "password123",
            role: "student",
            name: "Adrian Del Mundo",
            status: "active",
          },
          {
            id: "usr_stud_2402924",
            email: "24-02924@g.batstate-u.edu.ph",
            password: "password123",
            role: "student",
            name: "",
            status: "active",
          },
        ];
        localStorage.setItem("nexo_users", JSON.stringify(userList));
      }

      const matchedUser = userList.find(
        (u) => (u.email || "").toLowerCase() === emailValue,
      );

      // 1. Account existence validation
      if (!matchedUser) {
        if (emailGroup) emailGroup.classList.add("input-error", "has-error");
        if (emailError) {
          emailError.textContent =
            "Access Denied: Account not found. Only registered and admin-created accounts can log in.";
          emailError.style.display = "block";
        }
        return;
      }

      // 2. Check if user is banned
      if (matchedUser.status === "banned") {
        if (emailGroup) emailGroup.classList.add("input-error", "has-error");
        if (emailError) {
          emailError.textContent =
            "Access Denied: This account has been banned by the administrator.";
          emailError.style.display = "block";
        }
        return;
      }

      // 3. Check role selection match
      if (isStudent && matchedUser.role !== "student" && matchedUser.role !== "admin") {
        if (emailGroup) emailGroup.classList.add("input-error", "has-error");
        if (emailError) {
          emailError.textContent =
            "Account Mismatch: This account is a Provider/Admin. Please select the Provider tab to log in.";
          emailError.style.display = "block";
        }
        return;
      }

      if (!isStudent && matchedUser.role !== "provider" && matchedUser.role !== "admin") {
        if (emailGroup) emailGroup.classList.add("input-error", "has-error");
        if (emailError) {
          emailError.textContent =
            "Account Mismatch: This account is a Student. Please select the Student tab to log in.";
          emailError.style.display = "block";
        }
        return;
      }

      // 4. Password validation
      const expectedPassword =
        matchedUser.password ||
        (matchedUser.role === "student" ? "password123" : "admin");

      if (passwordValue !== expectedPassword) {
        if (passwordGroup) passwordGroup.classList.add("input-error", "has-error");
        if (emailError) {
          emailError.textContent =
            "Incorrect password. Please verify your credentials or check the Admin Panel.";
          emailError.style.display = "block";
        }
        return;
      }

      // 5. Successful Login Execution
      if (matchedUser.role === "admin") {
        sessionStorage.setItem("nexo-logged-in", "admin");
        sessionStorage.setItem(
          "nexo-provider-name",
          matchedUser.name || "NEXO Admin",
        );
        sessionStorage.setItem("nexo-provider-email", matchedUser.email);
        localStorage.setItem("nexo-logged-in", "admin");
        localStorage.setItem(
          "nexo-provider-name",
          matchedUser.name || "NEXO Admin",
        );
        localStorage.setItem("nexo-provider-email", matchedUser.email);
        window.location.href = "admin.html";
        return;
      }

      if (matchedUser.role === "provider") {
        localStorage.removeItem("nexo-provider-banner");
        localStorage.removeItem("provider-banner-preview");
        sessionStorage.setItem("nexo-logged-in", "provider");
        sessionStorage.setItem(
          "nexo-provider-name",
          matchedUser.name || matchedUser.orgName || "NEXO",
        );
        sessionStorage.setItem("nexo-provider-email", matchedUser.email);
        localStorage.setItem("nexo-logged-in", "provider");
        localStorage.setItem(
          "nexo-provider-name",
          matchedUser.name || matchedUser.orgName || "NEXO",
        );
        localStorage.setItem("nexo-provider-email", matchedUser.email);
        window.location.href = "provider-dashboard.html";
        return;
      } else {
        const lastStudentEmail = localStorage.getItem("nexo-student-email");
        if (lastStudentEmail && lastStudentEmail.toLowerCase() !== matchedUser.email.toLowerCase()) {
          // Different student account logging in - clear stale cached settings & avatar
          localStorage.removeItem("nexo_student_settings");
          localStorage.removeItem("nexo-student-avatar");
          sessionStorage.removeItem("nexo-student-avatar");
        }
        sessionStorage.setItem("nexo-logged-in", "student");
        sessionStorage.setItem(
          "nexo-student-name",
          matchedUser.name || "",
        );
        sessionStorage.setItem("nexo-student-email", matchedUser.email);
        sessionStorage.setItem("nexo-student-intro-played", "true");
        localStorage.setItem("nexo-logged-in", "student");
        localStorage.setItem(
          "nexo-student-name",
          matchedUser.name || "",
        );
        localStorage.setItem("nexo-student-email", matchedUser.email);
        window.location.href = "student-dashboard.html";
        return;
      }
    });
  }
}

// =========================================
// 3. LOGIN PASSWORD VISIBILITY TOGGLE
// =========================================
function initPasswordVisibility() {
  const togglePasswordBtn = document.getElementById("toggle-password");
  const loginPasswordInput = document.getElementById("password");

  if (togglePasswordBtn && loginPasswordInput) {
    togglePasswordBtn.addEventListener("click", () => {
      const isHidden = loginPasswordInput.getAttribute("type") === "password";
      loginPasswordInput.setAttribute("type", isHidden ? "text" : "password");
      togglePasswordBtn.classList.toggle("show-active");
    });
  }
}

// =========================================
// 4. REGISTER PAGE LOGIC (Synchronized with register.html)
// =========================================
function initRegisterPage() {
  const registerForm = document.getElementById("register-form");
  const submitBtn = document.getElementById("reg-submit-btn");
  if (!registerForm && !submitBtn) return;

  const registerRoleBadge = document.getElementById("register-role-badge");
  const registerSubtitle = document.getElementById("register-subtitle");

  const nameInput = document.getElementById("reg-name");
  const emailInput = document.getElementById("reg-email");
  const passInput = document.getElementById("reg-pass");
  const confirmInput = document.getElementById("reg-confirm");

  const groupName = document.getElementById("group-name");
  const groupEmail = document.getElementById("group-email");
  const groupPass = document.getElementById("group-pass");
  const groupConfirm = document.getElementById("group-confirm");

  const errorName = document.getElementById("error-name");
  const errorEmail = document.getElementById("error-email");
  const errorPass = document.getElementById("error-pass");
  const errorConfirm = document.getElementById("error-confirm");

  const showError = (group, errorEl, message) => {
    if (group) group.classList.add("has-error", "input-error");
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = "block";
    }
  };

  const clearError = (group, errorEl) => {
    if (group) group.classList.remove("has-error", "input-error");
    if (errorEl) {
      errorEl.textContent = "";
      errorEl.style.display = "none";
    }
  };

  // Real-time input listener: auto-clear error states
  [nameInput, emailInput, passInput, confirmInput].forEach((input) => {
    if (input) {
      input.addEventListener("input", function () {
        const group = this.closest(".input-group");
        const errorEl = group ? group.nextElementSibling : null;
        if (group && errorEl && errorEl.classList.contains("error-text")) {
          clearError(group, errorEl);
        }
      });
    }
  });

  if (registerRoleBadge) {
    const urlParams = new URLSearchParams(window.location.search);
    const roleParam = urlParams.get("role") || "student";
    if (roleParam === "provider") {
      registerRoleBadge.textContent = "Provider";
      if (registerSubtitle) {
        registerSubtitle.textContent =
          "Join NEXO to post scholarships and connect with top students.";
      }
      if (emailInput) emailInput.placeholder = "contact@organization.org";
    } else {
      registerRoleBadge.textContent = "Student";
      if (registerSubtitle) {
        registerSubtitle.textContent =
          "Join NEXO and get access to scholarships and more opportunities.";
      }
      if (emailInput) emailInput.placeholder = "student@university.edu.ph";
    }
  }

  // Handle Form Submission
  const handleRegisterSubmit = (e) => {
    if (e) e.preventDefault();
    let isValid = true;

    // 1. Validate Full Name
    if (!nameInput || !nameInput.value.trim()) {
      showError(groupName, errorName, "Please enter your full name.");
      isValid = false;
    }

    // 2. Validate Email
    const emailVal = emailInput ? emailInput.value.trim().toLowerCase() : "";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailVal) {
      showError(groupEmail, errorEmail, "Please enter your school email.");
      isValid = false;
    } else if (!emailRegex.test(emailVal)) {
      showError(groupEmail, errorEmail, "Please enter a valid email address.");
      isValid = false;
    } else if (!emailVal.endsWith(".edu.ph")) {
      showError(
        groupEmail,
        errorEmail,
        "Access Denied: Only valid university emails (.edu.ph) are permitted.",
      );
      isValid = false;
    }

    // 3. Validate Password
    const passVal = passInput ? passInput.value : "";
    if (!passVal) {
      showError(groupPass, errorPass, "Please create a password.");
      isValid = false;
    } else if (passVal.length < 8) {
      showError(groupPass, errorPass, "Password must be at least 8 characters.");
      isValid = false;
    }

    // 4. Validate Confirm Password
    const confirmVal = confirmInput ? confirmInput.value : "";
    if (!confirmVal) {
      showError(groupConfirm, errorConfirm, "Please confirm your password.");
      isValid = false;
    } else if (confirmVal !== passVal) {
      showError(groupConfirm, errorConfirm, "Passwords do not match.");
      isValid = false;
    }

    if (!isValid) return;

    if (submitBtn) {
      submitBtn.textContent = "Creating Account...";
      submitBtn.style.opacity = "0.7";
      submitBtn.style.pointerEvents = "none";
    }

    // Persist pending credentials into sessionStorage so verify.js can register user
    sessionStorage.setItem("nexo-pending-name", nameInput.value.trim());
    sessionStorage.setItem("nexo-pending-email", emailVal);
    sessionStorage.setItem("nexo-pending-password", passVal);

    setTimeout(() => {
      window.location.href = "verify.html";
    }, 900);
  };

  if (registerForm) registerForm.onsubmit = handleRegisterSubmit;
  if (submitBtn) submitBtn.onclick = handleRegisterSubmit;
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
