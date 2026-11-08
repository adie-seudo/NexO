// ==========================================
// 1. INSTANT DARK MODE CHECK (Prevents white flash)
// Wrapped in an IIFE to prevent global "const" crashes
// ==========================================
(function applyInitialTheme() {
  const savedTheme = localStorage.getItem("nexo-theme");
  const isDark =
    savedTheme === "dark" ||
    (savedTheme === null &&
      (new Date().getHours() < 7 || new Date().getHours() >= 18));
  if (isDark) {
    document.documentElement.classList.add("dark-theme");
    if (document.body) document.body.classList.add("dark-theme");
  } else {
    document.documentElement.classList.remove("dark-theme");
    if (document.body) document.body.classList.remove("dark-theme");
  }
})();

// ==========================================
// 1.5 CLEANUP LEGACY TEST DATA FROM LOCALSTORAGE
// ==========================================
(function cleanupOldTestData() {
  try {
    const apps = JSON.parse(localStorage.getItem("nexo_applications") || "[]");
    if (apps.some((a) => a.id === "app_1794124026321" || a.id === "app_1794126664389" || (a.status === "Approved" && !a.studentName))) {
      localStorage.removeItem("nexo_applications");
    }
    const schols = JSON.parse(localStorage.getItem("nexo_scholarships") || "[]");
    if (schols.some((s) => s.id === "schol_nexo_tech_01" || s.id === "schol_1794124026316" || s.id === "schol_1794126664376" || s.id === "schol_1794126637109")) {
      localStorage.removeItem("nexo_scholarships");
    }
  } catch (_) {}
})();

// =========================================
// MASTER INITIALIZATION
// =========================================
document.addEventListener("DOMContentLoaded", () => {
  initSplashScreen();
  initHeaderInjection();
  initAvatarMenu();
  initGetStartedScroll();
});

// Scroll smoothly to Login Section when "Get Started" is clicked
function initGetStartedScroll() {
  const getStartedBtn = document.getElementById("get-started-btn");
  if (getStartedBtn && !getStartedBtn.dataset.bound) {
    getStartedBtn.dataset.bound = "true";
    getStartedBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const authScreen = document.getElementById("auth-screen");
      const focusEmailInput = document.getElementById("email");

      if (authScreen) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        setTimeout(() => {
          if (focusEmailInput) {
            focusEmailInput.focus({ preventScroll: true });
          }
        }, 550);
      } else {
        window.location.href = "index.html#focus-login";
      }
    });
  }
}

// =========================================
// 2. INTRO SPLASH SCREEN HANDLER
// =========================================
function initSplashScreen() {
  const splashScreen = document.getElementById("splash-screen");
  const introVideo = document.getElementById("intro-eagle-video");

  if (splashScreen) {
    const isStudent = window.location.pathname.includes("student");
    const isDashboard = window.location.pathname.includes("dashboard");
    if (isStudent || isDashboard) {
      splashScreen.remove();
      return;
    }

    const storageKey = "nexo-public-intro-played";
    const hasPlayed = sessionStorage.getItem(storageKey);

    if (hasPlayed) {
      splashScreen.remove();
    } else if (introVideo) {
      const hideSplash = () => {
        splashScreen.classList.add("fade-out");
        setTimeout(() => {
          splashScreen.remove();
          sessionStorage.setItem(storageKey, "true");
        }, 400);
      };
      introVideo.addEventListener("ended", hideSplash);
      setTimeout(hideSplash, 3000);
    } else {
      splashScreen.remove();
    }
  }
}

// ==========================================
// 3. SAFE HEADER INJECTION
// ==========================================
function initHeaderInjection() {
  const headerPlaceholder = document.getElementById("header-placeholder");

  if (headerPlaceholder) {
    fetch("header.html")
      .then((response) => response.text())
      .then((data) => {
        headerPlaceholder.innerHTML = data;
        initializeHeaderFunctions();
      })
      .catch((error) => console.error("Error loading header:", error));
  } else {
    // Dashboard and About pages do not have a placeholder, so initialize directly
    initializeHeaderFunctions();
  }
}

// ==========================================
// 4. HEADER LOGIC & SCROLL EVENTS
// ==========================================
function initializeHeaderFunctions() {
  const navMenu = document.querySelector(".nav-menu");
  const hamburgerBtn = document.querySelector(".hamburger-btn");
  const globalHeader = document.querySelector(".global-header");

  // Helper to cleanly close mobile nav menu and remove backdrop overlay & blur
  function closeMobileNav() {
    if (navMenu) navMenu.classList.remove("open");
    if (hamburgerBtn) hamburgerBtn.classList.remove("open");
    const overlay = document.querySelector(".nav-overlay");
    if (overlay) overlay.classList.remove("active");
    document.body.classList.remove("menu-open");
    const popover = document.getElementById("header-notif-popover");
    const notifBtn = document.querySelector(".notification-btn");
    if (popover) popover.classList.remove("open");
    if (notifBtn) notifBtn.setAttribute("aria-expanded", "false");
  }

  // --- A. Dynamic Active Link Highlight & Scroll ---
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const navLinks = document.querySelectorAll(".nav-link");

  navLinks.forEach((link) => {
    if (link.getAttribute("href") === currentPage) {
      link.classList.add("active");
    }
    link.addEventListener("click", function (e) {
      if (this.classList.contains("active")) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        closeMobileNav();
      } else {
        closeMobileNav();
      }
    });
  });

  // Helper for backdrop overlay
  function getOrCreateNavOverlay() {
    let overlay = document.querySelector(".nav-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "nav-overlay";
      document.body.appendChild(overlay);
      overlay.addEventListener("click", () => {
        closeMobileNav();
      });
    }
    return overlay;
  }

  // --- B. Hamburger Menu (For Mobile Header / Public pages) ---
  if (hamburgerBtn && navMenu) {
    const overlay = getOrCreateNavOverlay();

    if (!hamburgerBtn.hasAttribute("onclick")) {
      hamburgerBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = !navMenu.classList.contains("open");
        hamburgerBtn.classList.toggle("open", willOpen);
        navMenu.classList.toggle("open", willOpen);
        if (overlay) overlay.classList.toggle("active", willOpen);
        document.body.classList.toggle("menu-open", willOpen);
      });
    }

    // Close menu when clicking anywhere else on the page
    document.addEventListener("click", (e) => {
      if (
        navMenu.classList.contains("open") &&
        !navMenu.contains(e.target) &&
        !hamburgerBtn.contains(e.target)
      ) {
        closeMobileNav();
      }
    });
  }

  // --- C. Dark Mode Toggle Binding ---
  const themeToggle = document.querySelector(".theme-toggle");
  const themeContainer = document.querySelector(".theme-toggle-container");
  if (themeToggle) {
    // 1. Initial sync: Checkbox is TRUE (Sun) when it is NOT Dark Theme
    themeToggle.checked = !document.body.classList.contains("dark-theme");

    // 2. Toggle listener: Apply the exact theme based on the checkbox state
    themeToggle.addEventListener("change", (e) => {
      closeMobileNav();
      if (e.target.checked) {
        // Checked = Light Mode (Sun)
        localStorage.setItem("nexo-theme", "light");
        document.body.classList.remove("dark-theme");
        document.documentElement.classList.remove("dark-theme");
      } else {
        // Unchecked = Dark Mode (Moon)
        localStorage.setItem("nexo-theme", "dark");
        document.body.classList.add("dark-theme");
        document.documentElement.classList.add("dark-theme");
      }
    });
  }
  if (themeContainer) {
    themeContainer.addEventListener("click", () => {
      closeMobileNav();
    });
  }

  // --- D. UNIFIED SCROLL LISTENER (Header & Drawer) ---
  let lastScrollY = window.scrollY;
  window.addEventListener(
    "scroll",
    () => {
      if (navMenu && navMenu.classList.contains("open")) {
        if (hamburgerBtn) hamburgerBtn.classList.remove("open");
        navMenu.classList.remove("open");
        const overlay = document.querySelector(".nav-overlay");
        if (overlay) overlay.classList.remove("active");
        document.body.classList.remove("menu-open");
      }
      if (globalHeader) {
        const currentScrollY = window.scrollY;
        if (currentScrollY > lastScrollY && currentScrollY > 72) {
          globalHeader.classList.add("scroll-down");
        } else {
          globalHeader.classList.remove("scroll-down");
        }
        lastScrollY = currentScrollY;
      }
    },
    { passive: true },
  );

  // --- E. AUTH BUTTONS & ROLE MODAL ROUTING ---
  const headerLoginBtn = document.getElementById("header-login-btn");
  const headerRegisterBtn = document.getElementById("header-register-btn");
  const roleModal = document.querySelector(".role-modal-overlay");
  const roleModalClose = document.querySelector(".role-modal-close");

  // 1. Log In Button -> Cleanly closes menu/overlay and smooth scrolls to login form
  if (headerLoginBtn) {
    headerLoginBtn.addEventListener("click", (e) => {
      e.preventDefault();
      closeMobileNav();

      const authScreen = document.getElementById("auth-screen");
      const focusEmailInput = document.getElementById("email");

      if (authScreen) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        setTimeout(() => {
          if (focusEmailInput) focusEmailInput.focus({ preventScroll: true });
        }, 500);
      } else {
        window.location.href = "index.html#focus-login";
      }
    });
  }

  // 2. Register Button -> Cleanly closes menu/overlay and opens the Role Selection Modal
  if (headerRegisterBtn) {
    headerRegisterBtn.addEventListener("click", (e) => {
      e.preventDefault();
      closeMobileNav();

      if (roleModal) {
        roleModal.classList.add("active");
      } else {
        window.location.href = "index.html";
      }
    });
  }

  // 2.5 Login Page "Register" Link -> Opens the Role Selection Modal
  const showRegisterLink = document.getElementById("show-register");

  if (showRegisterLink) {
    showRegisterLink.addEventListener("click", (e) => {
      e.preventDefault();
      if (roleModal) {
        roleModal.classList.add("active");
      }
    });
  }

  // 2.6 "Get Started" Button -> Smoothly scrolls to login form
  initGetStartedScroll();

  // 2.7 Bottom CTA "Register Now" Button -> Opens the Role Selection Modal
  const bottomRegisterBtn = document.getElementById("bottom-register-btn");

  if (bottomRegisterBtn) {
    bottomRegisterBtn.addEventListener("click", (e) => {
      e.preventDefault(); // Stops the page from jumping

      if (roleModal) {
        roleModal.classList.add("active");
      } else {
        // Fallback in case they click it from a page without the modal
        window.location.href = "index.html";
      }
    });
  }

  // 2.8 Direct "Register as Provider" Button -> Bypasses modal, goes straight to setup
  const directProviderRegBtn = document.getElementById("direct-provider-reg");

  if (directProviderRegBtn) {
    directProviderRegBtn.addEventListener("click", (e) => {
      e.preventDefault(); // Prevents default button behavior

      // Jump directly to the provider setup page
      window.location.href = "provider-setup.html";
    });
  }

  // 3. Close Role Modal (Clicking the 'X')
  if (roleModalClose && roleModal) {
    roleModalClose.addEventListener("click", () => {
      roleModal.classList.remove("active");
    });
  }

  // 4. Close Role Modal (Clicking the dark background outside the card)
  if (roleModal) {
    roleModal.addEventListener("click", (e) => {
      if (e.target === roleModal) {
        roleModal.classList.remove("active");
      }
    });
  }
}

// =========================================
// 5. AVATAR MENU TOGGLE
// =========================================
function initAvatarMenu() {
  const avatarBtn = document.getElementById("avatar-menu-btn");
  const navMenu = document.getElementById("nav-menu");

  if (avatarBtn && navMenu) {
    let overlay = document.querySelector(".nav-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "nav-overlay";
      document.body.appendChild(overlay);
      overlay.addEventListener("click", () => {
        avatarBtn.classList.remove("open");
        navMenu.classList.remove("open");
        overlay.classList.remove("active");
        document.body.classList.remove("menu-open");
      });
    }

    if (!avatarBtn.hasAttribute("onclick")) {
      avatarBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = !navMenu.classList.contains("open");
        avatarBtn.classList.toggle("open", willOpen);
        navMenu.classList.toggle("open", willOpen);
        if (overlay) overlay.classList.toggle("active", willOpen);
        document.body.classList.toggle("menu-open", willOpen);
      });
    }

    document.addEventListener("click", (e) => {
      if (
        navMenu.classList.contains("open") &&
        !navMenu.contains(e.target) &&
        !avatarBtn.contains(e.target)
      ) {
        avatarBtn.classList.remove("open");
        navMenu.classList.remove("open");
        if (overlay) overlay.classList.remove("active");
        document.body.classList.remove("menu-open");
      }
    });
  }
}

// 5. Route to specific registration pages (Event Delegation for dynamic HTML)
document.addEventListener("click", (e) => {
  // Check if the click happened on or inside the Student button
  const studentBtn = e.target.closest("#choose-student-reg");
  // Check if the click happened on or inside the Provider button
  const providerBtn = e.target.closest("#choose-provider-reg");

  if (studentBtn) {
    e.preventDefault();
    window.location.href = "register.html";
  }

  if (providerBtn) {
    e.preventDefault();
    window.location.href = "provider-setup.html";
  }
});

// ==========================================
// STUDENT REGISTRATION VALIDATION (BULLETPROOF)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("register-form");
  const submitBtn = document.getElementById("reg-submit-btn");

  if (registerForm && submitBtn) {
    // 1. Completely kill the default HTML form submission
    registerForm.onsubmit = (e) => e.preventDefault();

    // 2. Grab all inputs and error elements
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

    // Helper function to show errors
    const showError = (group, errorEl, message) => {
      group.classList.add("has-error");
      errorEl.textContent = message;
      errorEl.style.display = "block";
    };

    // Helper function to clear errors
    const clearError = (group, errorEl) => {
      group.classList.remove("has-error");
      errorEl.textContent = "";
      errorEl.style.display = "none";
    };

    // 3. Real-time UX: Clear error immediately when user starts typing
    [nameInput, emailInput, passInput, confirmInput].forEach((input) => {
      if (input) {
        input.addEventListener("input", function () {
          const group = this.closest(".input-group");
          const errorEl = group.nextElementSibling;
          if (group && errorEl) clearError(group, errorEl);
        });
      }
    });

    // 4. Hijack the button click directly
    submitBtn.onclick = function (e) {
      e.preventDefault();
      let isValid = true;

      // Validate Full Name
      if (!nameInput.value.trim()) {
        showError(groupName, errorName, "Please enter your full name.");
        isValid = false;
      }

      // Validate Email
      const emailVal = emailInput.value.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailVal) {
        showError(groupEmail, errorEmail, "Please enter your school email.");
        isValid = false;
      } else if (!emailRegex.test(emailVal)) {
        showError(
          groupEmail,
          errorEmail,
          "Please enter a valid email address.",
        );
        isValid = false;
      } else if (!emailVal.endsWith(".edu.ph")) {
        // THIS RESTORES THE STRICT EDU.PH CHECK!
        showError(
          groupEmail,
          errorEmail,
          "Access Denied: Only valid university emails (.edu.ph) are permitted.",
        );
        isValid = false;
      }

      // Validate Password
      if (!passInput.value) {
        showError(groupPass, errorPass, "Please create a password.");
        isValid = false;
      } else if (passInput.value.length < 8) {
        showError(
          groupPass,
          errorPass,
          "Password must be at least 8 characters.",
        );
        isValid = false;
      }

      // Validate Confirm Password
      if (!confirmInput.value) {
        showError(groupConfirm, errorConfirm, "Please confirm your password.");
        isValid = false;
      } else if (confirmInput.value !== passInput.value) {
        showError(groupConfirm, errorConfirm, "Passwords do not match.");
        isValid = false;
      }

      // HARD STOP: If anything failed, stop the function dead in its tracks
      if (!isValid) return;

      // If everything is perfect, proceed!
      this.textContent = "Creating Account...";
      this.style.opacity = "0.7";
      this.style.pointerEvents = "none";

      // Save the email to memory so verify.js can read it!
      sessionStorage.setItem("nexo-pending-email", emailInput.value.trim());

      setTimeout(() => {
        // Send them to the OTP verification page, NOT the dashboard
        window.location.href = "verify.html";
      }, 1500);
    };
  }
});
