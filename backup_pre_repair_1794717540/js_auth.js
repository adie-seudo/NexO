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
  const authScreen = document.getElementById("auth-screen");

  // Grab mobile role toggle buttons
  const toggleBtns = document.querySelectorAll(".role-toggle .toggle-btn");
  const btnStudent =
    document.getElementById("btn-role-student") ||
    document.getElementById("btn-student") ||
    toggleBtns[0];
  const btnProvider =
    document.getElementById("btn-role-provider") ||
    document.getElementById("btn-provider") ||
    toggleBtns[1];

  // Grab desktop split-panel role switch controls & header elements
  const desktopSwitchToProviderBtn = document.getElementById(
    "desktop-switch-to-provider",
  );
  const desktopSwitchToStudentBtn = document.getElementById(
    "desktop-switch-to-student",
  );
  const switchContentStudent = document.getElementById(
    "auth-switch-content-student",
  );
  const switchContentProvider = document.getElementById(
    "auth-switch-content-provider",
  );
  const desktopRoleBadgeText = document.getElementById(
    "auth-desktop-role-badge-text",
  );
  const desktopRoleIcon = document.getElementById("auth-desktop-role-icon");
  const desktopTitle = document.getElementById("auth-desktop-title");
  const desktopSubtitle = document.getElementById("auth-desktop-subtitle");

  const loginEmailInput = document.getElementById("email");
  const loginEmailLabel = document.getElementById("login-email-label");
  const loginPasswordInput = document.getElementById("password");
  const emailGroup = document.getElementById("email-group");
  const emailIcon = document.querySelector("#email-group .input-icon");
  const emailError = document.getElementById("email-error");
  const togglePasswordBtn = document.getElementById("toggle-password");

  // Store per-role input drafts so switching roles never transfers credentials between contexts
  const roleDrafts = {
    Student: { email: "", password: "" },
    Provider: { email: "", password: "" },
  };
  let currentActiveRole = "Student";
  let switchingTimer = null;

  // Hide error automatically as user types
  if (loginEmailInput && emailGroup && emailError) {
    loginEmailInput.addEventListener("input", () => {
      emailGroup.classList.remove("has-error", "input-error");
      emailError.style.display = "none";
    });
  }

  // Unified Role Switcher (synchronizes both Mobile Toggle & Desktop Split Panel)
  if (btnStudent && btnProvider) {
    function setLoginRole(role, options = {}) {
      const normalizedRole = role === "Provider" ? "Provider" : "Student";
      const isRoleChange = normalizedRole !== currentActiveRole;

      // Save current role's draft and restore target role's draft so credentials don't bleed across roles
      if (isRoleChange) {
        if (loginEmailInput) {
          roleDrafts[currentActiveRole].email = loginEmailInput.value;
        }
        if (loginPasswordInput) {
          roleDrafts[currentActiveRole].password = loginPasswordInput.value;
        }
      }

      currentActiveRole = normalizedRole;

      // Clear any validation error state from the previous role context
      if (emailGroup) emailGroup.classList.remove("input-error", "has-error");
      if (emailError) emailError.style.display = "none";
      const passwordGroup = loginPasswordInput
        ? loginPasswordInput.closest(".input-group")
        : null;
      if (passwordGroup) {
        passwordGroup.classList.remove("input-error", "has-error");
      }

      // Reset password visibility mask when switching roles
      if (isRoleChange && loginPasswordInput && togglePasswordBtn) {
        loginPasswordInput.setAttribute("type", "password");
        togglePasswordBtn.classList.remove("show-active");
      }

      // Trigger desktop sliding-panel stretch & form morph animation class
      if (authScreen && options.animateDesktop && isRoleChange) {
        authScreen.classList.add("is-switching");
        if (switchingTimer) clearTimeout(switchingTimer);
        switchingTimer = setTimeout(() => {
          authScreen.classList.remove("is-switching");
        }, 780);
      }

      if (normalizedRole === "Student") {
        btnStudent.classList.add("active");
        btnStudent.setAttribute("aria-selected", "true");
        btnProvider.classList.remove("active");
        btnProvider.setAttribute("aria-selected", "false");

        if (authScreen) {
          authScreen.classList.remove("is-provider-mode");
          authScreen.setAttribute("data-active-role", "Student");
        }

        if (switchContentStudent) {
          switchContentStudent.classList.add("is-active");
          switchContentStudent.classList.remove("is-hidden");
          switchContentStudent.setAttribute("aria-hidden", "false");
          if (desktopSwitchToProviderBtn) {
            desktopSwitchToProviderBtn.tabIndex = 0;
          }
        }
        if (switchContentProvider) {
          switchContentProvider.classList.add("is-hidden");
          switchContentProvider.classList.remove("is-active");
          switchContentProvider.setAttribute("aria-hidden", "true");
          if (desktopSwitchToStudentBtn) {
            desktopSwitchToStudentBtn.tabIndex = -1;
          }
        }

        if (desktopRoleBadgeText) {
          desktopRoleBadgeText.textContent = "Student Portal";
        }
        if (desktopRoleIcon) {
          desktopRoleIcon.src = "assets/human-icon.png";
        }
        if (desktopTitle) {
          desktopTitle.textContent = "Student Sign In";
        }
        if (desktopSubtitle) {
          desktopSubtitle.textContent =
            "Use your verified university email (.edu.ph) to access your account.";
        }
        if (loginEmailLabel) {
          loginEmailLabel.textContent = "Email";
        }
        if (loginEmailInput) {
          loginEmailInput.placeholder = "you@university.edu.ph";
          if (isRoleChange) {
            loginEmailInput.value = roleDrafts.Student.email;
          }
        }
        if (loginPasswordInput && isRoleChange) {
          loginPasswordInput.value = roleDrafts.Student.password;
        }
        if (emailIcon) emailIcon.src = "assets/human-icon.png";
        if (emailError) {
          emailError.textContent =
            "Access Denied: Only valid university emails (.edu.ph) are permitted for student login.";
        }
      } else {
        btnProvider.classList.add("active");
        btnProvider.setAttribute("aria-selected", "true");
        btnStudent.classList.remove("active");
        btnStudent.setAttribute("aria-selected", "false");

        if (authScreen) {
          authScreen.classList.add("is-provider-mode");
          authScreen.setAttribute("data-active-role", "Provider");
        }

        if (switchContentProvider) {
          switchContentProvider.classList.add("is-active");
          switchContentProvider.classList.remove("is-hidden");
          switchContentProvider.setAttribute("aria-hidden", "false");
          if (desktopSwitchToStudentBtn) {
            desktopSwitchToStudentBtn.tabIndex = 0;
          }
        }
        if (switchContentStudent) {
          switchContentStudent.classList.add("is-hidden");
          switchContentStudent.classList.remove("is-active");
          switchContentStudent.setAttribute("aria-hidden", "true");
          if (desktopSwitchToProviderBtn) {
            desktopSwitchToProviderBtn.tabIndex = -1;
          }
        }

        if (desktopRoleBadgeText) {
          desktopRoleBadgeText.textContent = "Scholarship Provider";
        }
        if (desktopRoleIcon) {
          desktopRoleIcon.src = "assets/organization-icon.png";
        }
        if (desktopTitle) {
          desktopTitle.textContent = "Provider Sign In";
        }
        if (desktopSubtitle) {
          desktopSubtitle.textContent =
            "Sign in with your organization credentials to manage scholarship programs.";
        }
        if (loginEmailLabel) {
          loginEmailLabel.textContent = "Email";
        }
        if (loginEmailInput) {
          loginEmailInput.placeholder = "contact@organization.org";
          if (isRoleChange) {
            loginEmailInput.value = roleDrafts.Provider.email;
          }
        }
        if (loginPasswordInput && isRoleChange) {
          loginPasswordInput.value = roleDrafts.Provider.password;
        }
        if (emailIcon) emailIcon.src = "assets/organization-icon.png";
      }

      if (options.focusEmail && loginEmailInput) {
        setTimeout(() => {
          loginEmailInput.focus({ preventScroll: true });
        }, 420);
      }
    }

    // Mobile role toggle listeners
    btnStudent.addEventListener("click", (e) => {
      e.preventDefault();
      setLoginRole("Student", { animateDesktop: true });
    });

    btnProvider.addEventListener("click", (e) => {
      e.preventDefault();
      setLoginRole("Provider", { animateDesktop: true });
    });

    // Desktop sliding panel button listeners
    if (desktopSwitchToProviderBtn) {
      desktopSwitchToProviderBtn.addEventListener("click", (e) => {
        e.preventDefault();
        setLoginRole("Provider", { animateDesktop: true, focusEmail: true });
      });
    }

    if (desktopSwitchToStudentBtn) {
      desktopSwitchToStudentBtn.addEventListener("click", (e) => {
        e.preventDefault();
        setLoginRole("Student", { animateDesktop: true, focusEmail: true });
      });
    }

    // Keep state clean when resizing across the 1024px desktop/mobile breakpoint
    window.addEventListener(
      "resize",
      () => {
        if (authScreen && authScreen.classList.contains("is-switching")) {
          authScreen.classList.remove("is-switching");
        }
      },
      { passive: true },
    );
  }
  // Login Form Submission (With Admin Bypass & Dynamic User Accounts)
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const emailValue = loginEmailInput
        ? loginEmailInput.value.trim().toLowerCase()
        : "";
      const passwordValue = loginPasswordInput ? loginPasswordInput.value : "";
      const isStudent =
        (btnStudent && btnStudent.classList.contains("active")) ||
        currentActiveRole === "Student";

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

      const API_BASE =
        window.location.origin && window.location.origin.includes(":3000")
          ? ""
          : "http://localhost:3000";

      let fetchedFromApi = false;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`${API_BASE}/api/users`, {
          cache: "no-store",
          signal: controller.signal,
        }).catch(() => null);
        clearTimeout(timeoutId);
        if (res && res.ok) {
          userList = await res.json();
          fetchedFromApi = true;
          try {
            localStorage.setItem("nexo_users", JSON.stringify(userList));
          } catch (_) {}
        }
      } catch (_) {}

      // Fallback to local data.json when running on Live Server or static host without Node backend
      if (!fetchedFromApi) {
        try {
          const fallbackRes = await fetch("data.json", {
            cache: "no-store",
          }).catch(() => null);
          if (fallbackRes && fallbackRes.ok) {
            const fullData = await fallbackRes.json();
            if (fullData && Array.isArray(fullData.users)) {
              // Merge any locally registered accounts in userList with data.json users
              const byEmail = new Map();
              fullData.users.forEach((u) => {
                if (u && u.email) byEmail.set(u.email.toLowerCase(), u);
              });
              if (Array.isArray(userList)) {
                userList.forEach((u) => {
                  if (u && u.email && !byEmail.has(u.email.toLowerCase())) {
                    byEmail.set(u.email.toLowerCase(), u);
                  }
                });
              }
              userList = Array.from(byEmail.values());
              try {
                localStorage.setItem("nexo_users", JSON.stringify(userList));
              } catch (_) {}
            }
          }
        } catch (_) {}
      }

      const matchedUser = Array.isArray(userList)
        ? userList.find((u) => (u.email || "").toLowerCase() === emailValue)
        : null;

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
      if (matchedUser.role === "provider") {
        try {
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
        } catch (_) {}
        window.location.href = "provider-dashboard.html";
        return;
      } else {
        const emailLower = (matchedUser.email || "").toLowerCase().trim();
        try {
          const lastStudentEmail = localStorage.getItem("nexo-student-email");
          if (lastStudentEmail && lastStudentEmail.toLowerCase() !== emailLower) {
            // Different student account logging in - clear stale cached settings & avatar
            localStorage.removeItem("nexo_student_settings");
            localStorage.removeItem("nexo-student-avatar");
            sessionStorage.removeItem("nexo-student-avatar");
          }
        } catch (_) {}

        // Set essential auth flags FIRST before storing large avatar strings so quota errors never block login
        try {
          sessionStorage.setItem("nexo-logged-in", "student");
          sessionStorage.setItem("nexo-student-name", matchedUser.name || "");
          sessionStorage.setItem("nexo-student-email", matchedUser.email);
          sessionStorage.setItem("nexo-student-intro-played", "true");
        } catch (_) {}
        try {
          localStorage.setItem("nexo-logged-in", "student");
          localStorage.setItem("nexo-student-name", matchedUser.name || "");
          localStorage.setItem("nexo-student-email", matchedUser.email);
        } catch (_) {}

        // Restore avatar if this student has one
        let userAvatar = matchedUser.profilePicture || "";
        if (!userAvatar && emailLower) {
          try {
            userAvatar =
              localStorage.getItem("nexo_avatar_" + emailLower) ||
              localStorage.getItem("nexo-student-avatar-" + emailLower) ||
              "";
          } catch (_) {}
        }
        if (!userAvatar && emailLower) {
          try {
            const profs = JSON.parse(localStorage.getItem("nexo_student_profiles") || "{}");
            if (profs[emailLower] && profs[emailLower].profilePicture) {
              userAvatar = profs[emailLower].profilePicture;
            }
          } catch (_) {}
        }
        if (!userAvatar && emailLower) {
          try {
            const scoped = JSON.parse(localStorage.getItem(`nexo_student_settings_${emailLower}`) || "{}");
            if (scoped && scoped.profilePicture) {
              userAvatar = scoped.profilePicture;
            }
          } catch (_) {}
        }
        if (userAvatar) {
          try {
            sessionStorage.setItem("nexo-student-avatar", userAvatar);
          } catch (_) {}
          try {
            localStorage.setItem("nexo-student-avatar", userAvatar);
          } catch (_) {}
          if (emailLower) {
            try {
              localStorage.setItem("nexo_avatar_" + emailLower, userAvatar);
              localStorage.setItem("nexo-student-avatar-" + emailLower, userAvatar);
            } catch (_) {}
          }
        }

        // Restore scoped settings if available
        if (emailLower) {
          try {
            const scopedSettings = localStorage.getItem(`nexo_student_settings_${emailLower}`);
            if (scopedSettings) {
              localStorage.setItem("nexo_student_settings", scopedSettings);
            }
          } catch (_) {}
        }

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
