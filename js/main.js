// ==========================================
// 0. GLOBAL ASSETS & FALLBACKS (Clean, no default test banners)
// ==========================================
window.DEFAULT_PROVIDER_BANNER = "";

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
    if (
      apps.some(
        (a) =>
          a.id === "app_1794124026321" ||
          a.id === "app_1794126664389" ||
          (a.status === "Approved" && !a.studentName),
      )
    ) {
      localStorage.removeItem("nexo_applications");
    }
    const schols = JSON.parse(
      localStorage.getItem("nexo_scholarships") || "[]",
    );
    if (
      schols.some(
        (s) =>
          s.id === "schol_nexo_tech_01" ||
          s.id === "schol_1794124026316" ||
          s.id === "schol_1794126664376" ||
          s.id === "schol_1794126637109",
      )
    ) {
      localStorage.removeItem("nexo_scholarships");
    }

    // Purge old leftover Signal Twice test banner from localStorage
    const savedProvBanner = localStorage.getItem("nexo-provider-banner");
    if (savedProvBanner && savedProvBanner.startsWith("data:image")) {
      localStorage.removeItem("nexo-provider-banner");
    }

    // Clean any cached scholarships stuck with leftover test banner
    if (Array.isArray(schols) && schols.length > 0) {
      let modified = false;
      schols.forEach((s) => {
        if (s.providerBanner && s.providerBanner.startsWith("data:image")) {
          s.providerBanner = "";
          modified = true;
        }
        if (s.bannerImage && s.bannerImage.startsWith("data:image")) {
          s.bannerImage = "";
          modified = true;
        }
        const limitNum =
          parseInt(s.applicantLimit || s.maxApplicants || 200, 10) || 200;
        s.applicantLimit = limitNum;
        s.maxApplicants = limitNum;

        const liveCount = Array.isArray(apps)
          ? apps.filter(
              (a) =>
                (a.scholarshipId &&
                  s.id &&
                  String(a.scholarshipId) === String(s.id)) ||
                (s.title &&
                  (a.scholarshipTitle === s.title || a.title === s.title)),
            ).length
          : parseInt(s.applicantTotal || 0, 10) || 0;

        s.applicantTotal = liveCount;
        s.applicantCount = `${liveCount} / ${limitNum} Applicants`;
        if (
          liveCount >= limitNum &&
          (s.status || "").toLowerCase() !== "closed"
        ) {
          s.status = "Quota Full";
        }
        modified = true;
      });
      if (modified) {
        localStorage.setItem("nexo_scholarships", JSON.stringify(schols));
      }
    }
  } catch (_) {}
})();

// ==========================================
// 1.8 DYNAMIC STUDENT INITIALS & PROFILE COMPLETION
// ==========================================
function getDynamicInitials(name) {
  if (!name || typeof name !== "string" || !name.trim()) return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function isStudentProfileComplete() {
  let settings = null;
  try {
    const raw = localStorage.getItem("nexo_student_settings");
    if (raw) settings = JSON.parse(raw);
  } catch (_) {}
  const name =
    (settings && settings.fullName) ||
    sessionStorage.getItem("nexo-student-name") ||
    "";
  const studentId = (settings && settings.studentId) || "";
  const university = (settings && settings.university) || "";
  const course = (settings && settings.course) || "";

  return Boolean(
    name.trim() &&
    studentId.trim() &&
    university.trim() &&
    course.trim()
  );
}

function syncGlobalStudentIdentity() {
  const avatarEl = document.getElementById("student-header-avatar");
  const storedName =
    sessionStorage.getItem("nexo-student-name") ||
    localStorage.getItem("nexo-student-name") ||
    "";
  let studentSettings = null;
  try {
    const raw = localStorage.getItem("nexo_student_settings");
    if (raw) studentSettings = JSON.parse(raw);
  } catch (_) {}

  const effectiveName = (studentSettings && studentSettings.fullName) || storedName;
  const avatarPic =
    sessionStorage.getItem("nexo-student-avatar") ||
    (studentSettings && studentSettings.profilePicture) ||
    "";

  if (avatarEl) {
    if (avatarPic) {
      avatarEl.innerHTML = `<img src="${avatarPic}" alt="Student" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
    } else {
      const initials = getDynamicInitials(effectiveName);
      if (initials) {
        avatarEl.textContent = initials;
      } else {
        avatarEl.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
      }
    }
  }

  // Profile Completeness Indicator on Side Menu Settings Link
  const isComplete = isStudentProfileComplete();
  const settingsNavLinks = document.querySelectorAll("a[href=\"student-settings.html\"].nav-link");
  settingsNavLinks.forEach((link) => {
    let dot = link.querySelector(".nav-alert-dot");
    if (!isComplete) {
      if (!dot) {
        dot = document.createElement("span");
        dot.className = "nav-alert-dot";
        dot.title = "Profile incomplete - Please complete your profile details in Settings";
        link.appendChild(dot);
      }
      dot.style.display = "inline-block";
    } else if (dot) {
      dot.style.display = "none";
    }
  });
}

window.getDynamicInitials = getDynamicInitials;
window.isStudentProfileComplete = isStudentProfileComplete;
window.syncGlobalStudentIdentity = syncGlobalStudentIdentity;

document.addEventListener("DOMContentLoaded", () => {
  syncGlobalStudentIdentity();
});
window.addEventListener("storage", (e) => {
  if (e.key === "nexo_student_settings" || e.key === "nexo-student-name") {
    syncGlobalStudentIdentity();
  }
});

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
// 3. SAFE HEADER INJECTION & ROLE-AWARE HYDRATION
// ==========================================
const DEFAULT_HEADER_HTML = `
<header class="global-header">
  <div class="logo-container">
    <img src="assets/logo.png" alt="NEXO Logo" class="nexo-logo" onerror="this.style.display='none'" />
    <span class="logo-text">NEXO</span>
  </div>
  <div class="header-actions">
    <label class="theme-toggle-container">
      <input id="theme-toggle" class="theme-toggle" type="checkbox" aria-label="Toggle Dark Mode" />
    </label>
    <div class="nav-wrapper" id="nav-wrapper">
      <button class="hamburger-btn" aria-label="Open Menu">
        <span class="bar"></span>
        <span class="bar"></span>
        <span class="bar"></span>
        <span class="bar"></span>
      </button>
      <nav class="nav-menu" id="nav-menu">
        <span class="nav-label">MENU</span>
        <a href="index.html" class="nav-link"><img src="assets/home-icon.png" alt="Home" class="nav-icon" onerror="this.style.display='none'" /><span class="nav-text">Home</span></a>
        <a href="about.html" class="nav-link"><img src="assets/about-icon.png" alt="About" class="nav-icon" onerror="this.style.display='none'" /><span class="nav-text">About Us</span></a>
        <a href="policy.html" class="nav-link"><img src="assets/policy-icon.png" alt="Policy" class="nav-icon" onerror="this.style.display='none'" /><span class="nav-text">Policy</span></a>
        <a href="credits.html" class="nav-link"><img src="assets/credits-icon.png" alt="Credits" class="nav-icon" onerror="this.style.display='none'" /><span class="nav-text">Credits</span></a>
        <div class="nav-buttons">
          <button class="btn btn-primary" id="header-login-btn"><img src="assets/login-icon.png" alt="Log In" class="nav-icon" onerror="this.style.display='none'" /><span class="nav-text">Log In</span></button>
          <button class="btn btn-secondary" id="header-register-btn"><img src="assets/register-icon.png" alt="Register" class="nav-icon" onerror="this.style.display='none'" /><span class="nav-text">Register</span></button>
        </div>
      </nav>
    </div>
  </div>
</header>
`;

function hydrateRoleAwareHeader() {
  const role =
    sessionStorage.getItem("nexo-logged-in") ||
    localStorage.getItem("nexo-logged-in");
  const navMenu =
    document.getElementById("nav-menu") || document.querySelector(".nav-menu");
  const logoContainer = document.querySelector(".logo-container");

  // Determine role dashboard URL
  let dashboardUrl = "index.html";
  if (role === "provider") dashboardUrl = "provider-dashboard.html";
  else if (role === "student") dashboardUrl = "student-dashboard.html";

  // 1. Update logo behavior so clicking logo leads to user dashboard
  if (logoContainer && role) {
    logoContainer.style.cursor = "pointer";
    logoContainer.onclick = () => {
      window.location.href = dashboardUrl;
    };
    const logoLink = logoContainer.closest("a");
    if (logoLink) logoLink.href = dashboardUrl;
  }

  // 2. Update doc back buttons (credits.html, privacy.html, terms.html, policy.html, about.html)
  const docBackButtons = document.querySelectorAll(
    "#credits-back-btn, #privacy-back-btn, #terms-back-btn, #policy-back-btn, .doc-back-btn",
  );
  docBackButtons.forEach((btn) => {
    btn.setAttribute("href", dashboardUrl);
    btn.onclick = (e) => {
      e.preventDefault();
      window.location.href = dashboardUrl;
    };
  });

  // 3. Hydrate side navigation menu if user is authenticated
  if (navMenu && role === "provider") {
    navMenu.innerHTML = `
      <span class="nav-label">MENU</span>

      <a href="provider-dashboard.html" class="nav-link">
        <img src="assets/home-icon.png" alt="Home" class="nav-icon" onerror="this.style.display='none'" />
        <span class="nav-text">Home</span>
      </a>

      <a href="provider-applications.html" class="nav-link">
        <img src="assets/draft-icon.png" alt="Applications" class="nav-icon" onerror="this.style.display='none'" />
        <span class="nav-text">Applications</span>
      </a>

      <a href="provider-settings.html" class="nav-link">
        <img src="assets/settings-icon.png" alt="Settings" class="nav-icon" onerror="this.style.display='none'" />
        <span class="nav-text">Settings</span>
      </a>

      <div class="nav-spacer" style="height: 1px; background: rgba(255,255,255,0.08); margin: 8px 0;"></div>

      <a href="provider-about.html" class="nav-link">
        <img src="assets/about-icon.png" alt="About" class="nav-icon" onerror="this.style.display='none'" />
        <span class="nav-text">About Us</span>
      </a>

      <a href="privacy.html" class="nav-link">
        <img src="assets/policy-icon.png" alt="Policy" class="nav-icon" onerror="this.style.display='none'" />
        <span class="nav-text">Policy</span>
      </a>

      <a href="credits.html" class="nav-link">
        <img src="assets/credits-icon.png" alt="Credits" class="nav-icon" onerror="this.style.display='none'" />
        <span class="nav-text">Credits</span>
      </a>

      <div class="nav-spacer" style="height: 1px; background: rgba(255,255,255,0.08); margin: 8px 0;"></div>

      <div class="nav-buttons">
        <a href="index.html" class="btn logout-btn" id="header-logout-btn" style="text-decoration: none !important;">
          <img src="assets/logout-icon.png" alt="Logout" class="nav-icon" onerror="this.style.display='none'" />
          <span class="nav-text">Log Out</span>
        </a>
      </div>
    `;
  } else if (navMenu && role === "student") {
    navMenu.innerHTML = `
      <span class="nav-label">MENU</span>

      <a href="student-dashboard.html" class="nav-link">
        <img src="assets/home-icon.png" alt="Home" class="nav-icon" onerror="this.style.display='none'" />
        <span class="nav-text">Home</span>
      </a>

      <a href="student-browse.html" class="nav-link">
        <img src="assets/draft-icon.png" alt="Browse" class="nav-icon" onerror="this.style.display='none'" />
        <span class="nav-text">Browse Scholarships</span>
      </a>

      <a href="student-submissions.html" class="nav-link">
        <img src="assets/policy-icon.png" alt="Submissions" class="nav-icon" onerror="this.style.display='none'" />
        <span class="nav-text">View My Submissions</span>
      </a>

      <a href="student-settings.html" class="nav-link">
        <img src="assets/settings-icon.png" alt="Settings" class="nav-icon" onerror="this.style.display='none'" />
        <span class="nav-text">Settings</span>
      </a>

      <div class="nav-spacer" style="height: 1px; background: rgba(255,255,255,0.08); margin: 8px 0;"></div>

      <a href="student-about.html" class="nav-link">
        <img src="assets/about-icon.png" alt="About" class="nav-icon" onerror="this.style.display='none'" />
        <span class="nav-text">About Us</span>
      </a>

      <a href="privacy.html" class="nav-link">
        <img src="assets/policy-icon.png" alt="Policy" class="nav-icon" onerror="this.style.display='none'" />
        <span class="nav-text">Policy</span>
      </a>

      <a href="credits.html" class="nav-link">
        <img src="assets/credits-icon.png" alt="Credits" class="nav-icon" onerror="this.style.display='none'" />
        <span class="nav-text">Credits</span>
      </a>

      <div class="nav-spacer" style="height: 1px; background: rgba(255,255,255,0.08); margin: 8px 0;"></div>

      <div class="nav-buttons">
        <a href="index.html" class="btn logout-btn" id="header-logout-btn" style="text-decoration: none !important;">
          <img src="assets/logout-icon.png" alt="Logout" class="nav-icon" onerror="this.style.display='none'" />
          <span class="nav-text">Log Out</span>
        </a>
      </div>
    `;
  }

  // Active link highlight
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  if (navMenu) {
    navMenu.querySelectorAll(".nav-link").forEach((link) => {
      if (link.getAttribute("href") === currentPage) {
        link.classList.add("active");
      }
    });
  }
}

function initHeaderInjection() {
  const headerPlaceholder = document.getElementById("header-placeholder");

  if (headerPlaceholder) {
    fetch("header.html")
      .then((response) => {
        if (!response.ok) throw new Error("Status " + response.status);
        return response.text();
      })
      .then((data) => {
        headerPlaceholder.innerHTML = data;
        initializeHeaderFunctions();
        hydrateRoleAwareHeader();
      })
      .catch((error) => {
        console.warn("Using fallback header (e.g. file:/// protocol):", error);
        headerPlaceholder.innerHTML = DEFAULT_HEADER_HTML;
        initializeHeaderFunctions();
        hydrateRoleAwareHeader();
      });
  } else {
    // Dashboard and custom pages do not have a placeholder, so initialize directly
    initializeHeaderFunctions();
    hydrateRoleAwareHeader();
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

// ==========================================
// 6. GLOBAL DELEGATED LOGOUT HANDLER
// ==========================================
document.addEventListener("click", (e) => {
  const logoutBtn = e.target.closest(
    ".logout-btn, #student-logout-btn, #header-logout-btn",
  );
  if (logoutBtn) {
    e.preventDefault();
    try {
      sessionStorage.removeItem("nexo-logged-in");
      sessionStorage.removeItem("nexo-student-name");
      sessionStorage.removeItem("nexo-student-email");
      sessionStorage.removeItem("nexo-student-intro-played");
      sessionStorage.removeItem("nexo-student-avatar");
      sessionStorage.removeItem("nexo-pending-email");
      sessionStorage.removeItem("nexo-pending-name");
      localStorage.removeItem("nexo-logged-in");
      localStorage.removeItem("nexo-student-name");
      localStorage.removeItem("nexo-student-email");
    } catch (_) {}
    window.location.href = "index.html";
  }
});
