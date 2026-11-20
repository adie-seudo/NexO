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
// 0.05 STORAGE QUOTA SELF-HEALING GUARD
// Automatically cleans bloated preview keys or redundant cache if localStorage is full
// ==========================================
(function checkAndHealStorageQuota() {
  try {
    const testKey = "__nexo_quota_test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
  } catch (quotaErr) {
    console.warn("Storage quota full, running self-healing storage cleanup...");
    try {
      localStorage.removeItem("provider-banner-preview");
      localStorage.removeItem("nexo-provider-banner");
      localStorage.removeItem("nexo-provider-logo");
      localStorage.removeItem("nexo_settings");
      localStorage.removeItem("nexo_provider_settings");

      // Slim down any bloated cached scholarships containing redundant base64 banners
      const rawSchols = localStorage.getItem("nexo_scholarships");
      if (rawSchols && rawSchols.includes("data:image/")) {
        try {
          const parsed = JSON.parse(rawSchols);
          const slimmed = parsed.map((s) => ({
            ...s,
            providerBanner:
              s.providerBanner && s.providerBanner.length > 50000
                ? ""
                : s.providerBanner,
          }));
          localStorage.setItem("nexo_scholarships", JSON.stringify(slimmed));
        } catch (_) {}
      }
    } catch (_) {}
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
  let currentEmail = (
    sessionStorage.getItem("nexo-student-email") ||
    localStorage.getItem("nexo-student-email") ||
    ""
  )
    .toLowerCase()
    .trim();

  const merged = {};
  const mergeCandidate = (obj) => {
    if (!obj || typeof obj !== "object") return;
    const objEmail = (obj.email || "").toLowerCase().trim();
    if (currentEmail && objEmail && objEmail !== currentEmail) return;
    if (!currentEmail && objEmail) {
      currentEmail = objEmail;
    }
    if (obj.isProfileConfirmed === true) merged.isProfileConfirmed = true;
    if ((obj.course || "").trim()) merged.course = obj.course.trim();
    if ((obj.yearLevel || "").trim()) merged.yearLevel = obj.yearLevel.trim();
    if ((obj.university || "").trim()) merged.university = obj.university.trim();
    if ((obj.studentId || "").trim()) merged.studentId = obj.studentId.trim();
    if ((obj.contactNumber || "").trim()) merged.contactNumber = obj.contactNumber.trim();
  };

  // 1. Check email-scoped settings
  if (currentEmail) {
    try {
      const rawScoped = localStorage.getItem(`nexo_student_settings_${currentEmail}`);
      if (rawScoped) mergeCandidate(JSON.parse(rawScoped));
    } catch (_) {}
  }

  // 2. Check global student settings
  try {
    const rawGlobal = localStorage.getItem("nexo_student_settings");
    if (rawGlobal) mergeCandidate(JSON.parse(rawGlobal));
  } catch (_) {}

  // 3. Check nexo_student_profiles
  try {
    const profiles = JSON.parse(localStorage.getItem("nexo_student_profiles") || "{}");
    if (currentEmail && profiles[currentEmail]) {
      mergeCandidate(profiles[currentEmail]);
    } else if (!currentEmail) {
      const keys = Object.keys(profiles);
      if (keys.length === 1) {
        mergeCandidate(profiles[keys[0]]);
      } else {
        const confirmedKey = keys.find((k) => profiles[k] && profiles[k].isProfileConfirmed === true);
        if (confirmedKey) mergeCandidate(profiles[confirmedKey]);
      }
    }
  } catch (_) {}

  // 4. Check nexo_users
  try {
    const users = JSON.parse(localStorage.getItem("nexo_users") || "[]");
    if (Array.isArray(users)) {
      const matched = currentEmail
        ? users.find((u) => (u.email || "").toLowerCase().trim() === currentEmail)
        : users.find((u) => u.role === "student" && u.isProfileConfirmed === true);
      if (matched) mergeCandidate(matched);
    }
  } catch (_) {}

  // Once profile is confirmed & locked, or has all academic details saved, it is 100% complete
  if (merged.isProfileConfirmed === true) {
    return true;
  }

  return Boolean(
    merged.course &&
    merged.yearLevel &&
    merged.university &&
    merged.studentId &&
    merged.contactNumber
  );
}

function getStudentAvatar(currentEmail) {
  const email = (currentEmail || "").toLowerCase().trim();
  if (email) {
    try {
      if (localStorage.getItem("nexo_avatar_removed_" + email) === "true") {
        return "";
      }
    } catch (_) {}
  }

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

  // 3. Global localStorage avatar (only if no email or matches active student settings email)
  if (!email) {
    try {
      pic = localStorage.getItem("nexo-student-avatar") || "";
    } catch (_) {}
    if (pic) return pic;
  }

  // 4. Email-scoped student settings in localStorage
  if (email) {
    try {
      const scopedSettings = JSON.parse(
        localStorage.getItem(`nexo_student_settings_${email}`) || "null",
      );
      if (scopedSettings && scopedSettings.profilePicture !== undefined) {
        return scopedSettings.profilePicture || "";
      }
    } catch (_) {}
  }

  // 5. Global student settings in localStorage
  try {
    const raw = localStorage.getItem("nexo_student_settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!email || (parsed.email && parsed.email.toLowerCase().trim() === email)) {
        if (parsed.profilePicture !== undefined) return parsed.profilePicture || "";
      }
    }
  } catch (_) {}

  // 6. nexo_student_profiles in localStorage
  if (email) {
    try {
      const profiles = JSON.parse(
        localStorage.getItem("nexo_student_profiles") || "{}",
      );
      if (profiles[email] && profiles[email].profilePicture !== undefined) {
        return profiles[email].profilePicture || "";
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
  ).toLowerCase().trim();

  const avatarEl = document.getElementById("student-header-avatar");
  const storedName =
    sessionStorage.getItem("nexo-student-name") ||
    localStorage.getItem("nexo-student-name") ||
    "";
  let studentSettings = null;
  if (currentEmail) {
    try {
      const rawScoped = localStorage.getItem(`nexo_student_settings_${currentEmail}`);
      if (rawScoped) {
        const parsedScoped = JSON.parse(rawScoped);
        if (!parsedScoped.email || parsedScoped.email.toLowerCase().trim() === currentEmail) {
          studentSettings = parsedScoped;
        }
      }
    } catch (_) {}
  }

  if (!studentSettings) {
    try {
      const raw = localStorage.getItem("nexo_student_settings");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!currentEmail || (parsed.email && parsed.email.toLowerCase().trim() === currentEmail)) {
          studentSettings = parsed;
        }
      }
    } catch (_) {}
  }

  let resolvedName = (studentSettings && studentSettings.fullName) || storedName;
  if (!resolvedName && currentEmail) {
    try {
      const profiles = JSON.parse(localStorage.getItem("nexo_student_profiles") || "{}");
      if (profiles[currentEmail] && profiles[currentEmail].fullName) {
        resolvedName = profiles[currentEmail].fullName;
      }
    } catch (_) {}
  }
  if (!resolvedName && currentEmail) {
    try {
      const users = JSON.parse(localStorage.getItem("nexo_users") || "[]");
      if (Array.isArray(users)) {
        const matched = users.find((u) => (u.email || "").toLowerCase().trim() === currentEmail);
        if (matched && (matched.name || matched.fullName)) {
          resolvedName = matched.name || matched.fullName;
        }
      }
    } catch (_) {}
  }

  const effectiveName = resolvedName || "";
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
      cardAvatarEl.innerHTML = `<img src="${avatarPic}" alt="${effectiveName || 'Student'}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
    } else {
      const initials = getDynamicInitials(effectiveName) || "JD";
      cardAvatarEl.innerHTML = `<span class="student-avatar-initials" style="color: #53389E; font-weight: 800; font-family: var(--font-heading); text-transform: uppercase; user-select: none; line-height: 1;">${initials}</span>`;
    }
  }

  // Profile Completeness Indicator on Side Menu Settings Link
  const isComplete = isStudentProfileComplete();
  const settingsNavLinks = document.querySelectorAll('a[href="student-settings.html"], a[href="student-settings.html"].nav-link');
  settingsNavLinks.forEach((link) => {
    const dots = link.querySelectorAll(".nav-alert-dot");
    if (!isComplete) {
      if (dots.length === 0) {
        const dot = document.createElement("span");
        dot.className = "nav-alert-dot";
        dot.title = "Profile incomplete - Please complete your profile details in Settings";
        link.appendChild(dot);
      } else {
        dots[0].style.display = "inline-block";
      }
    } else {
      dots.forEach((dot) => {
        dot.remove();
      });
    }
  });

  // If local storage did not have the student profile yet, sync from backend / data.json once
  if (!isComplete && !window._hasFetchedStudentProfileInMain) {
    const role = sessionStorage.getItem("nexo-logged-in") || localStorage.getItem("nexo-logged-in");
    const path = (window.location.pathname.split("/").pop() || "").toLowerCase();
    if (role === "student" || path.startsWith("student-")) {
      window._hasFetchedStudentProfileInMain = true;
      (async () => {
        let fetchedProfile = null;
        try {
          const queryParam = currentEmail ? `?email=${encodeURIComponent(currentEmail)}` : "";
          const res = await fetch(`${window.API_BASE}/api/student-settings${queryParam}`);
          if (res.ok) {
            const candidate = await res.json();
            if (candidate && (!currentEmail || (candidate.email && candidate.email.toLowerCase().trim() === currentEmail))) {
              fetchedProfile = candidate;
            }
          }
        } catch (_) {}

        if (!fetchedProfile || (!fetchedProfile.email && !fetchedProfile.isProfileConfirmed)) {
          try {
            const dataRes = await fetch(`${window.API_BASE}/api/data`).catch(() => fetch("data.json"));
            if (dataRes && dataRes.ok) {
              const fullData = await dataRes.json();
              if (currentEmail && fullData.studentProfiles && fullData.studentProfiles[currentEmail]) {
                fetchedProfile = fullData.studentProfiles[currentEmail];
              } else if (
                currentEmail &&
                fullData.studentSettings &&
                fullData.studentSettings.email &&
                fullData.studentSettings.email.toLowerCase().trim() === currentEmail
              ) {
                fetchedProfile = fullData.studentSettings;
              } else if (currentEmail && Array.isArray(fullData.users)) {
                const matchedU = fullData.users.find(
                  (u) => (u.email || "").toLowerCase().trim() === currentEmail
                );
                if (matchedU) {
                  fetchedProfile = {
                    email: matchedU.email,
                    fullName: matchedU.name || "",
                    university: matchedU.university || "",
                    course: matchedU.course || "",
                    yearLevel: matchedU.yearLevel || "",
                    studentId: matchedU.studentId || "",
                    contactNumber: matchedU.contactNumber || "",
                    profilePicture: matchedU.profilePicture || "",
                    isProfileConfirmed: Boolean(matchedU.isProfileConfirmed),
                  };
                }
              }
            }
          } catch (_) {}
        }

        if (fetchedProfile && (fetchedProfile.email || fetchedProfile.isProfileConfirmed !== undefined)) {
          try {
            const targetEm = (fetchedProfile.email || currentEmail || "").toLowerCase().trim();
            if (targetEm && localStorage.getItem("nexo_avatar_removed_" + targetEm) === "true") {
              fetchedProfile.profilePicture = "";
            }
            // Do not overwrite locally confirmed profile with stale unconfirmed server data
            let existingScoped = null;
            if (targetEm) {
              try {
                existingScoped = JSON.parse(localStorage.getItem(`nexo_student_settings_${targetEm}`) || "null");
              } catch (_) {}
            }
            if (existingScoped && existingScoped.isProfileConfirmed) {
              fetchedProfile = { ...fetchedProfile, ...existingScoped };
            }
            try {
              localStorage.setItem("nexo_student_settings", JSON.stringify(fetchedProfile));
              if (targetEm) {
                localStorage.setItem(`nexo_student_settings_${targetEm}`, JSON.stringify(fetchedProfile));
              }
            } catch (_) {
              const slim = { ...fetchedProfile, profilePicture: "" };
              localStorage.setItem("nexo_student_settings", JSON.stringify(slim));
              if (targetEm) {
                localStorage.setItem(`nexo_student_settings_${targetEm}`, JSON.stringify(slim));
              }
            }
            if (targetEm && !currentEmail) {
              sessionStorage.setItem("nexo-student-email", targetEm);
              localStorage.setItem("nexo-student-email", targetEm);
            }
            if (fetchedProfile.fullName) {
              sessionStorage.setItem("nexo-student-name", fetchedProfile.fullName);
              localStorage.setItem("nexo-student-name", fetchedProfile.fullName);
            }
          } catch (_) {}
          syncGlobalStudentIdentity();
        }
      })();
    }
  }
}

window.getDynamicInitials = getDynamicInitials;
window.getStudentAvatar = getStudentAvatar;
window.isStudentProfileComplete = isStudentProfileComplete;
window.syncGlobalStudentIdentity = syncGlobalStudentIdentity;

document.addEventListener("DOMContentLoaded", () => {
  syncGlobalStudentIdentity();
});
window.addEventListener("nexo:profile-updated", () => {
  syncGlobalStudentIdentity();
});
window.addEventListener("storage", (e) => {
  if (
    e.key === "nexo_student_settings" ||
    e.key === "nexo_student_profiles" ||
    e.key === "nexo-student-name" ||
    e.key === "nexo-student-avatar" ||
    (e.key && (e.key.startsWith("nexo_avatar_") || e.key.startsWith("nexo_student_settings_")))
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

      <div class="nav-spacer"></div>

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

      <a href="provider-settings.html" class="nav-link" id="nav-settings">
        <img src="assets/settings-icon.png" alt="Settings" class="nav-icon" onerror="this.style.display='none'" />
        <span class="nav-text">Settings</span>
      </a>

      <div class="nav-spacer"></div>

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

      <div class="nav-spacer"></div>

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

      <a href="student-settings.html" class="nav-link">
        <img src="assets/settings-icon.png" alt="Settings" class="nav-icon" onerror="this.style.display='none'" />
        <span class="nav-text">Settings</span>
      </a>

      <div class="nav-spacer"></div>

      <div class="nav-buttons">
        <a href="index.html" class="btn logout-btn" id="header-logout-btn" style="text-decoration: none !important;">
          <img src="assets/logout-icon.png" alt="Logout" class="nav-icon" onerror="this.style.display='none'" />
          <span class="nav-text">Log Out</span>
        </a>
      </div>
    `;
  }

  // Ensure notification bell is present in header-actions when logged in as student or provider on shared pages
  if (role === "student" || role === "provider") {
    const headerActions = document.querySelector(".header-actions");
    const navWrapper = document.getElementById("nav-wrapper") || (headerActions && headerActions.querySelector(".nav-wrapper"));
    if (headerActions && !headerActions.querySelector(".notification-btn")) {
      const bellBtn = document.createElement("button");
      bellBtn.className = "icon-btn notification-btn";
      bellBtn.type = "button";
      if (role === "student") bellBtn.id = "student-notif-btn";
      bellBtn.setAttribute("aria-label", "Notifications");
      bellBtn.setAttribute("aria-expanded", "false");
      bellBtn.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <span class="notification-dot"${role === "student" ? ' id="student-notif-dot"' : ""}></span>
      `;
      if (navWrapper) {
        headerActions.insertBefore(bellBtn, navWrapper);
      } else {
        headerActions.appendChild(bellBtn);
      }
      initSharedHeaderNotificationBell(bellBtn, role);
    }
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

  // Re-sync student identity & settings red dot after role-aware menu hydration
  if (typeof syncGlobalStudentIdentity === "function") {
    syncGlobalStudentIdentity();
  }

  // Global Drafts Badge Sync
  syncGlobalDraftBadge();
}

function initSharedHeaderNotificationBell(notifBtn, role) {
  if (!notifBtn || notifBtn.dataset.notifBound === "true") return;
  notifBtn.dataset.notifBound = "true";

  const dot = notifBtn.querySelector(".notification-dot");
  let popover = document.getElementById("header-notif-popover");
  if (!popover) {
    popover = document.createElement("div");
    popover.id = "header-notif-popover";
    popover.className = "notification-popover";
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-label", "Notifications");
    popover.innerHTML = `
      <div class="notif-popover-header">
        <div style="display:flex; align-items:center; gap:8px;">
          <h4 class="notif-popover-title">Notifications</h4>
          <span class="notif-badge-count" id="shared-notif-badge" style="display: none;">0 New</span>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <button type="button" class="notif-mark-read-btn" id="shared-mark-read" style="background:none; border:none; color:var(--purple-600, #7c3aed); font-size:11px; font-weight:600; cursor:pointer; padding:2px 6px; border-radius:4px;">Mark all read</button>
          <button type="button" class="notif-trash-btn" id="shared-clear-all-btn" title="Delete All Notifications" aria-label="Delete all notifications">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      </div>
      <div class="notif-popover-body" id="shared-notif-body">
        <div class="notif-empty-box">
          <div class="notif-empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </div>
          <p class="notif-empty-heading">No notifications yet</p>
          <p class="notif-empty-text">You're all caught up! New updates will appear here.</p>
        </div>
      </div>
    `;
    let container = notifBtn.closest(".notification-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "notification-container";
      notifBtn.parentNode.insertBefore(container, notifBtn);
      container.appendChild(notifBtn);
    }
    container.appendChild(popover);
  }

  const NOTIF_API = window.location.origin.includes(":3000")
    ? ""
    : "http://localhost:3000";

  function getSharedNotifTimestamp(n) {
    if (!n) return 0;
    if (n.timestamp) {
      const t = new Date(n.timestamp).getTime();
      if (!isNaN(t) && t > 0) return t;
      const num = Number(n.timestamp);
      if (!isNaN(num) && num > 0) return num;
    }
    if (n.id) {
      const num = Number(n.id);
      if (!isNaN(num) && num > 0) return num;
      const match = String(n.id).match(/\d{10,}/);
      if (match) {
        const parsed = Number(match[0]);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
    return 0;
  }

  function getSharedNotifs() {
    let all = [];
    try {
      all = JSON.parse(localStorage.getItem("nexo_notifications") || "[]");
    } catch (_) {}
    if (!Array.isArray(all)) all = [];
    let dismissed = [];
    try {
      dismissed = JSON.parse(localStorage.getItem("nexo_dismissed_notifs") || "[]");
    } catch (_) {}
    if (!Array.isArray(dismissed)) dismissed = [];

    const currentEmail = (
      sessionStorage.getItem("nexo-student-email") ||
      localStorage.getItem("nexo-student-email") ||
      sessionStorage.getItem("nexo-provider-email") ||
      localStorage.getItem("nexo-provider-email") ||
      ""
    ).toLowerCase().trim();

    let clearedBefore = 0;
    try {
      if (role === "student") {
        clearedBefore =
          parseInt(
            localStorage.getItem(`nexo_notifs_cleared_at_student_${currentEmail || "default"}`) ||
              localStorage.getItem("nexo_notifs_cleared_at_student") ||
              "0",
            10,
          ) || 0;
      } else if (role === "provider") {
        clearedBefore =
          parseInt(
            localStorage.getItem("nexo_notifs_cleared_at_provider") || "0",
            10,
          ) || 0;
      }
    } catch (_) {}

    const filtered = all.filter((n) => {
      if (!n) return false;
      if (dismissed.includes(String(n.id))) return false;
      const matchRole = !n.recipient || n.recipient === role || n.recipient === "all";
      if (!matchRole) return false;
      if (role === "student" && n.recipientEmail && currentEmail) {
        if (String(n.recipientEmail).toLowerCase().trim() !== currentEmail) return false;
      }
      if (clearedBefore > 0) {
        const ts = getSharedNotifTimestamp(n);
        if (!ts || ts <= clearedBefore) return false;
      }
      return true;
    });

    filtered.sort((a, b) => getSharedNotifTimestamp(b) - getSharedNotifTimestamp(a));
    return filtered;
  }

  function deleteSharedNotification(id) {
    if (!id) return;
    try {
      let cached = JSON.parse(localStorage.getItem("nexo_notifications") || "[]");
      cached = cached.filter((n) => String(n.id) !== String(id));
      localStorage.setItem("nexo_notifications", JSON.stringify(cached));

      let dismissed = JSON.parse(localStorage.getItem("nexo_dismissed_notifs") || "[]");
      if (!Array.isArray(dismissed)) dismissed = [];
      if (!dismissed.includes(String(id))) {
        dismissed.push(String(id));
        localStorage.setItem("nexo_dismissed_notifs", JSON.stringify(dismissed));
      }
    } catch (_) {}

    fetch(`${NOTIF_API}/api/notifications/${encodeURIComponent(id)}`, {
      method: "DELETE",
      keepalive: true,
    }).catch(() => {});

    renderSharedNotifs();
  }

  async function clearAllSharedNotifications() {
    const nowTs = Date.now();
    const currentEmail = (
      sessionStorage.getItem("nexo-student-email") ||
      localStorage.getItem("nexo-student-email") ||
      ""
    ).toLowerCase().trim();

    try {
      if (role === "student") {
        localStorage.setItem("nexo_notifs_cleared_at_student", String(nowTs));
        if (currentEmail) {
          localStorage.setItem(`nexo_notifs_cleared_at_student_${currentEmail}`, String(nowTs));
        }
      } else {
        localStorage.setItem("nexo_notifs_cleared_at_provider", String(nowTs));
      }
    } catch (_) {}

    const visibleNotifs = getSharedNotifs();
    const idsToDelete = visibleNotifs.map((n) => String(n.id)).filter(Boolean);

    try {
      let dismissed = JSON.parse(localStorage.getItem("nexo_dismissed_notifs") || "[]");
      if (!Array.isArray(dismissed)) dismissed = [];
      idsToDelete.forEach((id) => {
        if (!dismissed.includes(id)) dismissed.push(id);
      });
      localStorage.setItem("nexo_dismissed_notifs", JSON.stringify(dismissed));
    } catch (_) {}

    try {
      let cached = JSON.parse(localStorage.getItem("nexo_notifications") || "[]");
      cached = cached.filter((n) => {
        if (!n) return false;
        if (idsToDelete.includes(String(n.id))) return false;
        if (!n.recipient || n.recipient === role || n.recipient === "all") return false;
        return true;
      });
      localStorage.setItem("nexo_notifications", JSON.stringify(cached));
    } catch (_) {}

    renderSharedNotifs();

    try {
      await fetch(
        `${NOTIF_API}/api/notifications?recipient=${encodeURIComponent(role || "all")}${currentEmail && role === "student" ? `&email=${encodeURIComponent(currentEmail)}` : ""}`,
        { method: "DELETE", keepalive: true },
      );
    } catch (_) {}

    idsToDelete.forEach((id) => {
      fetch(`${NOTIF_API}/api/notifications/${encodeURIComponent(id)}`, {
        method: "DELETE",
        keepalive: true,
      }).catch(() => {});
    });
  }

  function renderSharedNotifs() {
    const list = getSharedNotifs();
    const unreadCount = list.filter((n) => !n.read).length;
    const badgeEl = document.getElementById("shared-notif-badge");
    const bodyEl = document.getElementById("shared-notif-body");
    if (badgeEl) {
      if (unreadCount > 0) {
        badgeEl.textContent = `${unreadCount} New`;
        badgeEl.setAttribute("data-count", String(unreadCount));
        badgeEl.style.display = "inline-flex";
      } else {
        badgeEl.textContent = "";
        badgeEl.setAttribute("data-count", "0");
        badgeEl.style.display = "none";
      }
    }
    if (dot) {
      dot.classList.toggle("active", unreadCount > 0);
      notifBtn.classList.toggle("has-unread", unreadCount > 0);
    }
    if (!bodyEl) return;
    if (list.length === 0) {
      bodyEl.innerHTML = `
        <div class="notif-empty-box">
          <div class="notif-empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </div>
          <p class="notif-empty-heading">No notifications yet</p>
          <p class="notif-empty-text">You're all caught up! New updates will appear here.</p>
        </div>
      `;
      return;
    }

    bodyEl.innerHTML = list
      .map((n) => {
        const isUnread = !n.read;
        const timeStr = n.formattedTime || "Recently";
        const resolvedScholId = n.scholarshipId || n.scholId || "";
        const resolvedAppId = n.appId || "";
        let linkUrl = n.link || (role === "provider" ? "provider-applications.html" : "student-submissions.html");
        if (role === "provider") {
          if (resolvedAppId) {
            linkUrl = `provider-applications.html?appId=${encodeURIComponent(resolvedAppId)}`;
          } else if (resolvedScholId) {
            linkUrl = `provider-posts.html?scholarshipId=${encodeURIComponent(resolvedScholId)}`;
          }
        } else {
          if (resolvedAppId) {
            linkUrl = `student-submissions.html?id=${encodeURIComponent(resolvedAppId)}`;
          } else if (resolvedScholId) {
            linkUrl = `student-browse.html?scholId=${encodeURIComponent(resolvedScholId)}`;
          }
        }

        return `
          <div class="notif-item-wrapper" style="position: relative; display: flex; align-items: stretch;">
            <a href="${linkUrl}" class="notif-item ${isUnread ? "unread" : ""}" style="flex: 1; padding-right: 34px;" data-id="${n.id}" data-app-id="${resolvedAppId}" data-schol-id="${resolvedScholId}">
              <div class="notif-item-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
              </div>
              <div class="notif-item-content">
                <h5 class="notif-item-title">${n.title || "Notification"}</h5>
                <p class="notif-item-msg">${n.message || ""}</p>
                <span class="notif-item-time">${timeStr}</span>
              </div>
            </a>
            <button type="button" class="notif-single-delete-btn" data-delete-id="${n.id}" title="Delete notification" aria-label="Delete notification" style="position: absolute; top: 10px; right: 10px; width: 22px; height: 22px; border-radius: 6px; border: none; background: transparent; color: var(--text-muted, #9ca3af); display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 2;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        `;
      })
      .join("");

    bodyEl.querySelectorAll(".notif-single-delete-btn").forEach((delBtn) => {
      delBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const delId = delBtn.dataset.deleteId;
        if (delId) deleteSharedNotification(delId);
      });
    });

    bodyEl.querySelectorAll(".notif-item").forEach((item) => {
      item.addEventListener("click", () => {
        const notifId = item.dataset.id;
        if (notifId) deleteSharedNotification(notifId);
      });
    });
  }

  renderSharedNotifs();

  function confirmClearAllSharedNotifications() {
    let modal = document.getElementById("clear-shared-notifs-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "clear-shared-notifs-modal";
      modal.className = "confirm-modal-overlay";
      modal.style.display = "none";
      modal.innerHTML = `
        <div class="confirm-modal-box" style="max-width: 400px; text-align: center;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(239, 68, 68, 0.12); color: #ef4444; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px auto;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </div>
          <h3 class="confirm-modal-title" style="margin-bottom: 8px;">Delete All Notifications?</h3>
          <p class="confirm-modal-desc" style="margin-bottom: 20px;">
            Are you sure you want to permanently clear all notifications? This action cannot be undone.
          </p>
          <div class="confirm-modal-actions">
            <button type="button" class="btn btn-secondary" id="btn-cancel-clear-shared-notifs" style="border-radius: 20px;">Cancel</button>
            <button type="button" class="btn btn-primary" id="btn-confirm-clear-shared-notifs" style="background-color: #ef4444; border-color: #ef4444; border-radius: 20px;">Delete All</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      const closeModal = () => {
        modal.classList.remove("active", "open");
        modal.style.display = "none";
      };

      modal.querySelector("#btn-cancel-clear-shared-notifs").addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
      });
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          e.preventDefault();
          e.stopPropagation();
          closeModal();
        }
      });
      modal.querySelector("#btn-confirm-clear-shared-notifs").addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
        await clearAllSharedNotifications();
      });
    }

    modal.style.display = "flex";
    requestAnimationFrame(() => {
      modal.classList.add("active", "open");
    });
  }

  const clearAllBtn = document.getElementById("shared-clear-all-btn");
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      confirmClearAllSharedNotifications();
    });
  }

  const markReadBtn = document.getElementById("shared-mark-read");
  if (markReadBtn) {
    markReadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        const cached = JSON.parse(localStorage.getItem("nexo_notifications") || "[]");
        cached.forEach((n) => {
          if (!n.recipient || n.recipient === role || n.recipient === "all") n.read = true;
        });
        localStorage.setItem("nexo_notifications", JSON.stringify(cached));
      } catch (_) {}
      renderSharedNotifs();
    });
  }

  notifBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeMobileNav();
    const willOpen = !popover.classList.contains("open");
    popover.classList.toggle("open", willOpen);
    notifBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
    if (willOpen) {
      popover.style.right = "0";
      popover.style.left = "auto";
      if (dot) dot.classList.remove("active");
      notifBtn.classList.remove("has-unread");
    }
  });

  document.addEventListener("click", (e) => {
    if (popover.classList.contains("open") && !popover.contains(e.target) && !notifBtn.contains(e.target)) {
      popover.classList.remove("open");
      notifBtn.setAttribute("aria-expanded", "false");
    }
  });
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
        const isPrimaryProvider =
          !currentProviderEmail ||
          currentProviderEmail === "admin@admin" ||
          currentProviderEmail === "provider@nexo.edu.ph";
        const myDrafts = currentProviderEmail
          ? drafts.filter(
              (d) =>
                (isPrimaryProvider && !d.providerEmail) ||
                (d.providerEmail &&
                  d.providerEmail.toLowerCase() === currentProviderEmail),
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
window.renderSkeletonCards = function (containerOrId, count = null) {
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

  const isProviderPostsFeed =
    el.id === "posts-feed" ||
    (el.classList && el.classList.contains("posts-grid"));

  const isProviderAppsFeed =
    el.id === "applications-feed" ||
    (el.classList && el.classList.contains("applications-feed"));

  const isDraftsFeed =
    el.id === "drafts-feed" ||
    (el.classList && el.classList.contains("drafts-feed"));

  const isProviderMiniCardsFeed =
    el.id === "scholarships-feed" ||
    (el.classList && el.classList.contains("provider-scholarships-cards"));

  if (count === null || count === undefined) {
    const isDesktop = window.innerWidth >= 1024;
    if (isProviderMiniCardsFeed) {
      count = 3;
    } else if ((isStudentAppFeed || isDirectoryFeed || isProviderPostsFeed || isProviderAppsFeed || isDraftsFeed) && isDesktop) {
      count = 6;
    } else {
      count = 3;
    }
  }

  let html = "";
  for (let i = 0; i < count; i++) {
    if (isProviderMiniCardsFeed) {
      html += `
        <div class="skeleton-card provider-mini-schol-card" style="padding: 13px 18px; pointer-events: none;" aria-hidden="true" data-skeleton="true">
          <div class="mini-schol-left" style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <div class="skeleton-bone" style="width: 60%; height: 16px; border-radius: 4px;"></div>
              <div class="skeleton-bone" style="width: 54px; height: 18px; border-radius: 9999px;"></div>
            </div>
            <div class="skeleton-bone" style="width: 38%; height: 12px; border-radius: 4px;"></div>
          </div>
          <div class="mini-schol-right" style="display: flex; align-items: center; gap: 14px;">
            <div class="skeleton-bone" style="width: 86px; height: 14px; border-radius: 4px;"></div>
            <div class="skeleton-bone" style="width: 70px; height: 26px; border-radius: 6px;"></div>
          </div>
        </div>
      `;
    } else if (isStudentAppFeed) {
      html += `
        <div class="skeleton-card skeleton-student-app-card" aria-hidden="true" data-skeleton="true">
          <div class="skeleton-app-header">
            <div class="skeleton-bone skeleton-avatar-circle"></div>
            <div class="skeleton-app-titles">
              <div class="skeleton-bone skeleton-title" style="width: 74%; margin-top: 0;"></div>
              <div class="skeleton-bone skeleton-line" style="width: 52%; margin-top: 6px;"></div>
            </div>
          </div>
          <div class="skeleton-bone skeleton-line" style="width: 90%; height: 13px; margin: 4px 0 2px 0; border-radius: 4px;"></div>
          <div class="skeleton-meta-row">
            <div class="skeleton-bone skeleton-chip" style="width: 92px; border-radius: 9999px;"></div>
            <div class="skeleton-bone skeleton-chip" style="width: 104px; border-radius: 9999px;"></div>
            <div class="skeleton-bone skeleton-chip" style="width: 110px; border-radius: 9999px;"></div>
          </div>
          <div class="skeleton-app-action-row" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <div class="skeleton-bone skeleton-line" style="width: 80px; height: 12px; border-radius: 4px;"></div>
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

function closeNotifications() {
  const popover = document.getElementById("header-notif-popover");
  const notifBtn = document.querySelector(".notification-btn");
  if (popover) popover.classList.remove("open");
  if (notifBtn) notifBtn.setAttribute("aria-expanded", "false");
}
window.closeNotifications = closeNotifications;

// Global Side Menu Handler (Consistent with student.js & provider.js)
window.handleMenuToggle = function (e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  closeNotifications();
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

  // --- C. Dark Mode Toggle Binding (with Circular "Nuke" Shockwave Transition) ---
  const themeToggle = document.querySelector(".theme-toggle");
  const themeContainer = document.querySelector(".theme-toggle-container");
  let isThemeTransitioning = false;

  function triggerNukeThemeTransition(isLightMode, triggerEl) {
    if (isThemeTransitioning) return;
    isThemeTransitioning = true;

    const rect = triggerEl
      ? triggerEl.getBoundingClientRect()
      : { left: window.innerWidth / 2, top: 40, width: 36, height: 36 };
    const originX = Math.round(rect.left + rect.width / 2);
    const originY = Math.round(rect.top + rect.height / 2);

    const maxDist = Math.hypot(
      Math.max(originX, window.innerWidth - originX),
      Math.max(originY, window.innerHeight - originY)
    );
    const radius = Math.ceil(maxDist * 1.05);

    const applyThemeChange = () => {
      if (isLightMode) {
        localStorage.setItem("nexo-theme", "light");
        document.body.classList.remove("dark-theme");
        document.documentElement.classList.remove("dark-theme");
      } else {
        localStorage.setItem("nexo-theme", "dark");
        document.body.classList.add("dark-theme");
        document.documentElement.classList.add("dark-theme");
      }
    };

    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Modern Native View Transitions API with circular clip-path expansion
    if (document.startViewTransition && !prefersReducedMotion) {
      let transition;
      try {
        transition = document.startViewTransition(() => {
          applyThemeChange();
        });
      } catch (_) {
        applyThemeChange();
        isThemeTransitioning = false;
        return;
      }

      transition.ready
        .then(() => {
          const keyframes = [
            { clipPath: `circle(0px at ${originX}px ${originY}px)` },
            { clipPath: `circle(${radius}px at ${originX}px ${originY}px)` }
          ];
          const anim = document.documentElement.animate(keyframes, {
            duration: 650,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            pseudoElement: "::view-transition-new(root)"
          });
          anim.finished
            .catch(() => {})
            .finally(() => {
              isThemeTransitioning = false;
            });
        })
        .catch(() => {
          applyThemeChange();
          isThemeTransitioning = false;
        });
      return;
    }

    if (prefersReducedMotion) {
      applyThemeChange();
      isThemeTransitioning = false;
      return;
    }

    // High-performance fallback: Expanding shockwave overlay element
    const ripple = document.createElement("div");
    ripple.className = `theme-nuke-ripple ${isLightMode ? "to-light" : "to-dark"}`;
    const diameter = radius * 2;
    ripple.style.width = `${diameter}px`;
    ripple.style.height = `${diameter}px`;
    ripple.style.left = `${originX}px`;
    ripple.style.top = `${originY}px`;

    document.body.appendChild(ripple);

    // Force layout flush so the scale(0) registers
    void ripple.offsetWidth;

    ripple.classList.add("expanding");

    // Change theme halfway through the blast wave
    setTimeout(() => {
      applyThemeChange();
    }, 280);

    // Fade out and clean up
    setTimeout(() => {
      ripple.classList.add("fading");
      setTimeout(() => {
        ripple.remove();
        isThemeTransitioning = false;
      }, 260);
    }, 620);
  }

  if (themeToggle) {
    // 1. Initial sync: Checkbox is TRUE (Sun) when it is NOT Dark Theme
    themeToggle.checked = !document.body.classList.contains("dark-theme");

    // 2. Toggle listener: Apply the exact theme based on the checkbox state
    themeToggle.addEventListener("change", (e) => {
      closeMobileNav();
      const isLight = Boolean(e.target.checked);
      triggerNukeThemeTransition(isLight, themeContainer || themeToggle);
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
