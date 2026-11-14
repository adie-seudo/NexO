// ==========================================
// 0. STRICT ROLE ROUTE GUARD
// ==========================================
(function enforceRoleGuard() {
  const path = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  const role = sessionStorage.getItem("nexo-logged-in") || localStorage.getItem("nexo-logged-in");
  const email = (
    sessionStorage.getItem("nexo-student-email") ||
    localStorage.getItem("nexo-student-email") ||
    sessionStorage.getItem("nexo-provider-email") ||
    localStorage.getItem("nexo-provider-email") || ""
  ).toLowerCase();

  // Developer & System Administration console is directly accessible to manage accounts
  if (path === "admin.html") {
    return;
  }

  if (path.startsWith("student-")) {
    if (role !== "student" && role !== "admin") {
      window.location.replace(role === "provider" ? "provider-dashboard.html" : "index.html");
    }
  } else if (path.startsWith("provider-") && path !== "provider-setup.html") {
    if (role !== "provider" && role !== "admin") {
      window.location.replace(role === "student" ? "student-dashboard.html" : "index.html");
    }
  }
})();

// ==========================================
// 0.1 GLOBAL ASSETS & FALLBACKS (Clean, no default test banners)
// ==========================================
window.DEFAULT_PROVIDER_BANNER = "";
window.API_BASE =
  (window.location.origin && window.location.origin.includes(":3000"))
    ? ""
    : "http://localhost:3000";

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
    const FAKE_SCHOL_IDS = new Set([
      "schol_nexo_stem",
      "schol_nexo_academic",
      "schol_nexo_tech",
      "schol_nexo_tech_01",
      "schol_1794124026316",
      "schol_1794126664376",
      "schol_1794126637109",
    ]);

    let schols = JSON.parse(
      localStorage.getItem("nexo_scholarships") || "[]",
    );
    if (Array.isArray(schols) && schols.some((s) => s && FAKE_SCHOL_IDS.has(s.id))) {
      schols = schols.filter((s) => s && !FAKE_SCHOL_IDS.has(s.id));
      localStorage.setItem("nexo_scholarships", JSON.stringify(schols));
    }

    // Purge old leftover provider test banner from localStorage
    localStorage.removeItem("nexo-provider-banner");
    localStorage.removeItem("provider-banner-preview");
    try {
      const pSet = JSON.parse(localStorage.getItem("nexo-provider-settings") || "{}");
      if (pSet && (pSet.bannerImage || pSet.banner)) {
        pSet.bannerImage = "";
        pSet.banner = "";
        localStorage.setItem("nexo-provider-settings", JSON.stringify(pSet));
      }
    } catch (_) {}

    // Standardize applicant count calculation across cached scholarships
    if (Array.isArray(schols) && schols.length > 0) {
      let modified = false;
      schols.forEach((s) => {
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

    // Purge ANY legacy "Juan Dela Cruz" or "admin@admin.edu.ph" residuals from memory
    if (localStorage.getItem("nexo-student-name") === "Juan Dela Cruz") {
      localStorage.removeItem("nexo-student-name");
    }
    if (sessionStorage.getItem("nexo-student-name") === "Juan Dela Cruz") {
      sessionStorage.removeItem("nexo-student-name");
    }
    if (localStorage.getItem("nexo-student-email") === "admin@admin.edu.ph") {
      localStorage.removeItem("nexo-student-email");
    }
    if (sessionStorage.getItem("nexo-student-email") === "admin@admin.edu.ph") {
      sessionStorage.removeItem("nexo-student-email");
    }

    const rawSettings = localStorage.getItem("nexo_student_settings");
    if (rawSettings) {
      const s = JSON.parse(rawSettings);
      if (s.fullName === "Juan Dela Cruz" || s.email === "admin@admin.edu.ph") {
        localStorage.removeItem("nexo_student_settings");
      }
    }

    const rawUsers = localStorage.getItem("nexo_users");
    if (rawUsers) {
      let uList = JSON.parse(rawUsers);
      if (Array.isArray(uList)) {
        const cleanUsers = uList.filter(
          (u) =>
            u.email !== "admin@admin.edu.ph" &&
            u.name !== "Juan Dela Cruz" &&
            u.fullName !== "Juan Dela Cruz",
        );
        if (cleanUsers.length !== uList.length) {
          localStorage.setItem("nexo_users", JSON.stringify(cleanUsers));
        }
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
  const currentEmail = (
    sessionStorage.getItem("nexo-student-email") ||
    localStorage.getItem("nexo-student-email") ||
    ""
  ).toLowerCase();

  let settings = null;
  try {
    const raw =
      localStorage.getItem(`nexo_student_settings_${currentEmail}`) ||
      localStorage.getItem("nexo_student_settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.email || !currentEmail || parsed.email.toLowerCase() === currentEmail) {
        settings = parsed;
      }
    }
  } catch (_) {}

  // Profile must be confirmed and have Course, Year Level, and Bio completed
  return Boolean(
    settings &&
    settings.isProfileConfirmed === true &&
    (settings.course || "").trim() &&
    (settings.yearLevel || "").trim() &&
    (settings.bio || "").trim()
  );
}

function getStudentAvatar(currentEmail) {
  const email = (currentEmail || "").toLowerCase().trim();
  // 1. Session storage (for immediate changes in current tab)
  let pic = "";
  try {
    pic = sessionStorage.getItem("nexo-student-avatar") || "";
  } catch (_) {}
  if (pic) return pic;

  // 2. Email-scoped localStorage keys
  if (email) {
    try {
      pic =
        localStorage.getItem("nexo_avatar_" + email) ||
        localStorage.getItem("nexo-student-avatar-" + email) ||
        "";
    } catch (_) {}
    if (pic) return pic;
  }

  // 3. Global localStorage avatar
  try {
    pic = localStorage.getItem("nexo-student-avatar") || "";
  } catch (_) {}
  if (pic) return pic;

  // 4. Email-scoped student settings in localStorage
  if (email) {
    try {
      const scopedSettings = JSON.parse(
        localStorage.getItem(`nexo_student_settings_${email}`) || "null",
      );
      if (scopedSettings && scopedSettings.profilePicture) {
        return scopedSettings.profilePicture;
      }
    } catch (_) {}
  }

  // 5. Global student settings in localStorage
  try {
    const raw = localStorage.getItem("nexo_student_settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.email || !email || parsed.email.toLowerCase() === email) {
        if (parsed.profilePicture) return parsed.profilePicture;
      }
    }
  } catch (_) {}

  // 6. nexo_student_profiles in localStorage
  if (email) {
    try {
      const profiles = JSON.parse(
        localStorage.getItem("nexo_student_profiles") || "{}",
      );
      if (profiles[email] && profiles[email].profilePicture) {
        return profiles[email].profilePicture;
      }
    } catch (_) {}
  }

  // 7. nexo_users in localStorage
  if (email) {
    try {
      const users = JSON.parse(localStorage.getItem("nexo_users") || "[]");
      if (Array.isArray(users)) {
        const matched = users.find(
          (u) => (u.email || "").toLowerCase().trim() === email,
        );
        if (matched && matched.profilePicture) {
          return matched.profilePicture;
        }
      }
    } catch (_) {}
  }

  return "";
}

function syncGlobalStudentIdentity() {
  const currentEmail = (
    sessionStorage.getItem("nexo-student-email") ||
    localStorage.getItem("nexo-student-email") ||
    ""
  ).toLowerCase();

  const avatarEl = document.getElementById("student-header-avatar");
  const storedName =
    sessionStorage.getItem("nexo-student-name") ||
    localStorage.getItem("nexo-student-name") ||
    "";
  let studentSettings = null;
  try {
    const raw = localStorage.getItem("nexo_student_settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.email || !currentEmail || parsed.email.toLowerCase() === currentEmail) {
        studentSettings = parsed;
      }
    }
  } catch (_) {}

  if (!studentSettings && currentEmail) {
    try {
      const rawScoped = localStorage.getItem(`nexo_student_settings_${currentEmail}`);
      if (rawScoped) {
        studentSettings = JSON.parse(rawScoped);
      }
    } catch (_) {}
  }

  const effectiveName = (studentSettings && studentSettings.fullName) || storedName;
  const avatarPic = getStudentAvatar(currentEmail);

  if (avatarPic) {
    try {
      if (!sessionStorage.getItem("nexo-student-avatar")) {
        sessionStorage.setItem("nexo-student-avatar", avatarPic);
      }
      if (!localStorage.getItem("nexo-student-avatar")) {
        localStorage.setItem("nexo-student-avatar", avatarPic);
      }
      if (currentEmail && !localStorage.getItem("nexo_avatar_" + currentEmail)) {
        localStorage.setItem("nexo_avatar_" + currentEmail, avatarPic);
      }
    } catch (_) {}
  }

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

  const cardAvatarEl = document.getElementById("student-card-avatar");
  if (cardAvatarEl) {
    if (avatarPic) {
      cardAvatarEl.innerHTML = `<img src="${avatarPic}" alt="${effectiveName || 'Student'}" style="width: 100%; height: 100%; border-radius: 14px; object-fit: cover;">`;
    } else {
      const initials = getDynamicInitials(effectiveName);
      if (initials) {
        cardAvatarEl.textContent = initials;
      } else {
        cardAvatarEl.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
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
window.getStudentAvatar = getStudentAvatar;
window.isStudentProfileComplete = isStudentProfileComplete;
window.syncGlobalStudentIdentity = syncGlobalStudentIdentity;

document.addEventListener("DOMContentLoaded", () => {
  syncGlobalStudentIdentity();
});
window.addEventListener("storage", (e) => {
  if (
    e.key === "nexo_student_settings" ||
    e.key === "nexo-student-name" ||
    e.key === "nexo-student-avatar" ||
    (e.key && e.key.startsWith("nexo_avatar_"))
  ) {
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

  if (!splashScreen) return;

  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const isPublicLanding = currentPage === "index.html" || currentPage === "";

  if (!isPublicLanding) {
    splashScreen.remove();
    return;
  }

  const storageKey = "nexo-public-intro-played";
  const hasPlayed = sessionStorage.getItem(storageKey);

  if (hasPlayed === "true") {
    splashScreen.remove();
    return;
  }

  // Mark as played immediately so refreshing the page will never replay the intro
  sessionStorage.setItem(storageKey, "true");

  if (introVideo) {
    let isHidden = false;
    const hideSplash = () => {
      if (isHidden) return;
      isHidden = true;
      splashScreen.classList.add("fade-out");
      setTimeout(() => {
        splashScreen.remove();
      }, 600);
    };

    introVideo.addEventListener("ended", hideSplash);
    introVideo.addEventListener("error", hideSplash);

    const playPromise = introVideo.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        // Fallback if autoplay is blocked by browser policy
        setTimeout(hideSplash, 2600);
      });
    }

    setTimeout(hideSplash, 5000);
  } else {
    splashScreen.remove();
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
      <button
        class="hamburger-btn"
        id="avatar-menu-btn"
        type="button"
        aria-label="Open Menu"
        onclick="handleMenuToggle(event)"
      >
        <span class="bar"></span>
        <span class="bar"></span>
        <span class="bar"></span>
        <span class="bar"></span>
      </button>
      <nav class="nav-menu" id="nav-menu">
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
  const rawPage = window.location.pathname.split("/").pop() || "index.html";
  const currentPage = rawPage === "" ? "index.html" : rawPage;
  const isLoginLanding =
    currentPage === "index.html" ||
    currentPage === "register.html" ||
    currentPage === "verify.html" ||
    currentPage === "provider-setup.html" ||
    Boolean(document.getElementById("auth-screen"));

  // Security & Auth Guard: Opening the login/registration screen starts in a clean unauthenticated state
  if (isLoginLanding) {
    try {
      sessionStorage.removeItem("nexo-logged-in");
      localStorage.removeItem("nexo-logged-in");
    } catch (_) {}
  }

  const role = isLoginLanding
    ? null
    : sessionStorage.getItem("nexo-logged-in") ||
      localStorage.getItem("nexo-logged-in");
  const navMenu =
    document.getElementById("nav-menu") || document.querySelector(".nav-menu");
  const logoContainer = document.querySelector(".logo-container");

  // Determine role dashboard URL
  let dashboardUrl = "index.html";
  if (role === "provider") dashboardUrl = "provider-dashboard.html";
  else if (role === "student") dashboardUrl = "student-dashboard.html";

  // 1. Update logo behavior so clicking logo leads to user dashboard (or index.html when logged out)
  if (logoContainer) {
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

  // 3. Hydrate side navigation menu if user is authenticated (never on login/landing page)
  if (navMenu && role === "provider") {
    navMenu.innerHTML = `
      <a href="provider-dashboard.html" class="nav-link" id="nav-home">
        <img src="assets/home-icon.png" alt="Home" class="nav-icon" onerror="this.style.display='none'" />
        <span class="nav-text">Home</span>
      </a>

      <a href="provider-posts.html" class="nav-link" id="nav-posts">
        <img src="assets/application-icon.png" alt="Posted Scholarships" class="nav-icon" onerror="this.style.display='none'" />
        <span class="nav-text">Posted Scholarships</span>
      </a>

      <a href="provider-applications.html" class="nav-link" id="nav-applications">
        <img src="assets/human-icon.png" alt="Applications" class="nav-icon" onerror="this.style.display='none'" />
        <span class="nav-text">Applications</span>
      </a>

      <a href="provider-dashboard.html?view=drafts" class="nav-link" id="nav-drafts">
        <img src="assets/draft-icon.png" alt="Drafts" class="nav-icon" onerror="this.style.display='none'" />
        <span class="nav-text">Drafts</span>
        <span id="draft-badge" style="display:none;background-color:#8b5cf6;color:white;font-size:12px;font-weight:700;padding:2px 8px;border-radius:99px;margin-left:auto;">0</span>
      </a>

      <a href="provider-settings.html" class="nav-link" id="nav-settings">
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
  if (navMenu) {
    navMenu.querySelectorAll(".nav-link").forEach((link) => {
      const href = link.getAttribute("href");
      if (
        href === currentPage ||
        (currentPage === "index.html" && (href === "index.html" || href === "./index.html" || href === "/"))
      ) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  // Sync tooltips for desktop rail
  if (typeof syncMenuTooltips === "function") {
    syncMenuTooltips();
  }

  // Global Drafts Badge Sync
  syncGlobalDraftBadge();
}

function syncGlobalDraftBadge() {
  const draftBadges = document.querySelectorAll("#draft-badge");
  if (!draftBadges || draftBadges.length === 0) return;

  const currentProviderEmail = (
    sessionStorage.getItem("nexo-provider-email") ||
    localStorage.getItem("nexo-provider-email") ||
    ""
  ).toLowerCase();

  let count = 0;
  try {
    const raw = localStorage.getItem("nexo_drafts");
    if (raw) {
      const drafts = JSON.parse(raw);
      if (Array.isArray(drafts)) {
        const myDrafts = currentProviderEmail
          ? drafts.filter(
              (d) =>
                !d.providerEmail ||
                d.providerEmail.toLowerCase() === currentProviderEmail,
            )
          : drafts;
        count = myDrafts.length;
      }
    }
  } catch (_) {
    count = 0;
  }

  draftBadges.forEach((badge) => {
    badge.textContent = count;
    badge.style.display = count > 0 ? "inline-block" : "none";
  });
}
window.syncGlobalDraftBadge = syncGlobalDraftBadge;

window.addEventListener("DOMContentLoaded", syncGlobalDraftBadge);
window.addEventListener("nexo_drafts_updated", syncGlobalDraftBadge);
window.addEventListener("storage", (e) => {
  if (e.key === "nexo_drafts") {
    syncGlobalDraftBadge();
  }
});

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

// Global Skeleton Screen Loader for Data Fetching
window.renderSkeletonCards = function (containerOrId, count = 3) {
  const el =
    typeof containerOrId === "string"
      ? document.getElementById(containerOrId)
      : containerOrId;
  if (!el) return;

  const isStudentAppFeed =
    el.id === "student-apps-feed" ||
    (el.classList && el.classList.contains("student-apps-feed"));

  const isDirectoryFeed =
    el.id === "browse-scholarships-feed" ||
    (el.classList && el.classList.contains("browse-feed"));

  let html = "";
  for (let i = 0; i < count; i++) {
    if (isStudentAppFeed) {
      html += `
        <div class="skeleton-card skeleton-student-app-card" aria-hidden="true" data-skeleton="true">
          <div class="skeleton-app-header">
            <div class="skeleton-bone skeleton-avatar-circle"></div>
            <div class="skeleton-app-titles">
              <div class="skeleton-bone skeleton-title" style="width: 74%; margin-top: 0;"></div>
              <div class="skeleton-bone skeleton-line" style="width: 52%; margin-top: 6px;"></div>
            </div>
          </div>
          <div class="skeleton-meta-row">
            <div class="skeleton-bone skeleton-chip" style="width: 98px; border-radius: 9999px;"></div>
            <div class="skeleton-bone skeleton-chip" style="width: 112px; border-radius: 9999px;"></div>
            <div class="skeleton-bone skeleton-chip" style="width: 118px; border-radius: 9999px;"></div>
          </div>
          <div class="skeleton-app-action-row">
            <div class="skeleton-bone skeleton-btn-action"></div>
          </div>
        </div>
      `;
    } else if (isDirectoryFeed) {
      html += `
        <div class="skeleton-card skeleton-directory-card" aria-hidden="true" data-skeleton="true">
          <div class="skeleton-app-header" style="align-items: flex-start;">
            <div class="skeleton-bone skeleton-avatar-circle"></div>
            <div class="skeleton-app-titles">
              <div class="skeleton-bone skeleton-title" style="width: 82%; margin-top: 0;"></div>
              <div class="skeleton-bone skeleton-line" style="width: 48%; margin-top: 6px;"></div>
              <div style="display: flex; gap: 6px; margin-top: 8px;">
                <div class="skeleton-bone skeleton-chip" style="width: 78px; height: 22px; border-radius: 9999px;"></div>
                <div class="skeleton-bone skeleton-chip" style="width: 56px; height: 22px; border-radius: 9999px;"></div>
              </div>
            </div>
          </div>
          <div class="skeleton-directory-meta">
            <div class="skeleton-bone skeleton-line" style="width: 44%; height: 14px;"></div>
            <div class="skeleton-bone skeleton-line" style="width: 72%; height: 13px; margin-top: 6px;"></div>
          </div>
          <div class="skeleton-directory-desc">
            <div class="skeleton-bone skeleton-line" style="width: 96%;"></div>
            <div class="skeleton-bone skeleton-line" style="width: 74%; margin-top: 6px;"></div>
          </div>
          <div class="skeleton-directory-footer">
            <div class="skeleton-bone skeleton-btn-pill"></div>
            <div class="skeleton-bone skeleton-btn-pill"></div>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="skeleton-card" aria-hidden="true" data-skeleton="true">
          <div class="skeleton-header-row">
            <div class="skeleton-bone skeleton-pill"></div>
            <div class="skeleton-bone skeleton-badge"></div>
          </div>
          <div class="skeleton-bone skeleton-title"></div>
          <div class="skeleton-bone skeleton-line" style="width: 88%;"></div>
          <div class="skeleton-bone skeleton-line" style="width: 60%;"></div>
          <div class="skeleton-meta-row">
            <div class="skeleton-bone skeleton-chip" style="width: 105px;"></div>
            <div class="skeleton-bone skeleton-chip" style="width: 80px;"></div>
            <div class="skeleton-bone skeleton-chip" style="width: 90px;"></div>
          </div>
          <div class="skeleton-bone skeleton-btn"></div>
        </div>
      `;
    }
  }
  el.innerHTML = html;
  el.style.display = "";
};

window.clearSkeleton = function (containerOrId) {
  const el =
    typeof containerOrId === "string"
      ? document.getElementById(containerOrId)
      : containerOrId;
  if (!el) return;
  const items = el.querySelectorAll('[data-skeleton="true"], .skeleton-card');
  items.forEach((item) => item.remove());
};

function syncMenuTooltips() {
  document
    .querySelectorAll(".nav-menu .nav-link, .nav-menu .nav-buttons .btn")
    .forEach((el) => {
      const textEl = el.querySelector(".nav-text");
      if (textEl && textEl.textContent.trim()) {
        const txt = textEl.textContent.trim();
        el.setAttribute("data-tooltip", txt);
        if (!el.getAttribute("title")) el.setAttribute("title", txt);
      }
    });
}
window.syncMenuTooltips = syncMenuTooltips;

// Global Clean Nav Closer (Closes expanded menu on both mobile & desktop; on desktop reverts to pre-open icon rail)
function closeMobileNav() {
  const navMenu =
    document.getElementById("nav-menu") || document.querySelector(".nav-menu");
  const hamburgerBtn =
    document.getElementById("avatar-menu-btn") ||
    document.querySelector(".hamburger-btn");
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
window.closeMobileNav = closeMobileNav;

// Global Side Menu Handler (Consistent with student.js & provider.js)
window.handleMenuToggle = function (e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const btn =
    document.getElementById("avatar-menu-btn") ||
    document.querySelector(".hamburger-btn");
  const menu =
    document.getElementById("nav-menu") || document.querySelector(".nav-menu");
  const overlay = getOrCreateNavOverlay();

  if (btn && menu) {
    const willOpen = !menu.classList.contains("open");
    btn.classList.toggle("open", willOpen);
    menu.classList.toggle("open", willOpen);
    const isDesktop = window.innerWidth >= 1024;
    if (overlay && !isDesktop) overlay.classList.toggle("active", willOpen);
    if (!isDesktop) document.body.classList.toggle("menu-open", willOpen);
  }
};

function initializeHeaderFunctions() {
  const navMenu =
    document.getElementById("nav-menu") || document.querySelector(".nav-menu");
  const hamburgerBtn =
    document.getElementById("avatar-menu-btn") ||
    document.querySelector(".hamburger-btn");
  const globalHeader = document.querySelector(".global-header");

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

  // --- B. Hamburger Menu (For Mobile Header / Public pages) ---
  const overlay = getOrCreateNavOverlay();

  if (hamburgerBtn) {
    if (!hamburgerBtn.id) hamburgerBtn.id = "avatar-menu-btn";
    if (!hamburgerBtn.hasAttribute("type")) hamburgerBtn.type = "button";
    if (!hamburgerBtn.hasAttribute("onclick")) {
      hamburgerBtn.onclick = function (e) {
        window.handleMenuToggle(e);
      };
    }
  }

  // Delegated click handler on navMenu for links to cleanly close drawer on navigation
  if (navMenu) {
    navMenu.addEventListener("click", (e) => {
      const link = e.target.closest("a, .btn");
      if (
        link &&
        !link.classList.contains("theme-toggle") &&
        !link.closest(".theme-toggle-container")
      ) {
        closeMobileNav();
      }
    });
  }

  // Close menu when clicking anywhere else on the page (both mobile and desktop)
  document.addEventListener("click", (e) => {
    if (
      navMenu &&
      navMenu.classList.contains("open") &&
      !navMenu.contains(e.target) &&
      (!hamburgerBtn || !hamburgerBtn.contains(e.target)) &&
      (!e.target.closest || !e.target.closest("#avatar-menu-btn, .hamburger-btn"))
    ) {
      closeMobileNav();
    }
  });

  // Sync tooltips for desktop rail
  syncMenuTooltips();

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

  // --- D. UNIFIED SCROLL LISTENER (Header Bar & Auto-Close Expanded Side Menu) ---
  window.addEventListener(
    "scroll",
    () => {
      if (globalHeader) {
        // Sticky glass top bar stays permanently visible on all pages even when scrolling
        globalHeader.classList.remove("scroll-down");
      }
      if (navMenu && navMenu.classList.contains("open")) {
        closeMobileNav();
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
    getOrCreateNavOverlay();

    if (!avatarBtn.hasAttribute("onclick")) {
      avatarBtn.onclick = function (e) {
        window.handleMenuToggle(e);
      };
    }
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
// 6. GLOBAL DELEGATED LOGOUT HANDLER
// ==========================================
document.addEventListener("click", (e) => {
  const logoutBtn = e.target.closest(
    ".logout-btn, #student-logout-btn, #header-logout-btn",
  );
  if (logoutBtn) {
    e.preventDefault();
    try {
      // Clear Student Credentials
      sessionStorage.removeItem("nexo-logged-in");
      sessionStorage.removeItem("nexo-student-name");
      sessionStorage.removeItem("nexo-student-email");
      sessionStorage.removeItem("nexo-student-intro-played");
      sessionStorage.removeItem("nexo-student-avatar");
      localStorage.removeItem("nexo-logged-in");
      localStorage.removeItem("nexo-student-name");
      localStorage.removeItem("nexo-student-email");
      localStorage.removeItem("nexo-student-avatar");
      localStorage.removeItem("nexo_student_settings");

      // Clear Provider Credentials
      sessionStorage.removeItem("nexo-provider-name");
      sessionStorage.removeItem("nexo-provider-email");
      localStorage.removeItem("nexo-provider-name");
      localStorage.removeItem("nexo-provider-email");
      localStorage.removeItem("nexo-provider-banner");
      localStorage.removeItem("provider-banner-preview");
      localStorage.removeItem("nexo-provider-logo");

      // Clear Pending Registration & Auth State
      sessionStorage.removeItem("nexo-pending-email");
      sessionStorage.removeItem("nexo-pending-name");
      sessionStorage.removeItem("nexo-pending-password");
    } catch (_) {}
    window.location.href = "index.html";
  }
});
