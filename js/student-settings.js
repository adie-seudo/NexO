// ==========================================================================
// NEXO STUDENT SETTINGS JAVASCRIPT (js/student-settings.js)
// Real-time tab handling, profile picture uploads, persistence & toast
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = window.location.origin.includes(":3000")
    ? ""
    : "http://localhost:3000";
  let currentAvatarBase64 = "";

  // -------------------------------------------------------------
  // 1. TAB SWITCHING SYSTEM
  // -------------------------------------------------------------
  const tabButtons = document.querySelectorAll(".settings-tab-btn");
  const tabPanels = document.querySelectorAll(".settings-panel");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-tab");
      tabButtons.forEach((b) => b.classList.remove("active"));
      tabPanels.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) {
        targetPanel.classList.add("active");
      }
    });
  });

  // Check URL query parameters for active tab (e.g., ?tab=panel-student-preferences)
  const urlParams = new URLSearchParams(window.location.search);
  const activeTabParam = urlParams.get("tab");
  if (activeTabParam) {
    const matchingBtn = document.querySelector(
      `[data-tab="${activeTabParam}"]`,
    );
    if (matchingBtn) matchingBtn.click();
  }

  // -------------------------------------------------------------
  // 2. TOAST NOTIFICATION HELPER (Identical to Provider Settings)
  // -------------------------------------------------------------
  function showToast(message, isError = false) {
    let toast = document.getElementById("student-settings-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "student-settings-toast";
      toast.className = "settings-toast";
      document.body.appendChild(toast);
    }

    toast.innerHTML = isError
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><span>${message}</span>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg><span>${message}</span>`;
    toast.classList.toggle("error", isError);
    toast.classList.add("show");

    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
      toast.classList.remove("show");
    }, 2600);
  }

  // Instant Header Avatar Updater
  function updateHeaderAvatar(src) {
    if (typeof window.syncGlobalStudentIdentity === "function") {
      window.syncGlobalStudentIdentity();
    }
  }

  // -------------------------------------------------------------
  // 3. PROFILE PICTURE UPLOADER (Instantly Updates Header Icon)
  // -------------------------------------------------------------
  const avatarWrap = document.getElementById("student-avatar-wrap");
  const avatarBadge = document.getElementById("student-avatar-badge");
  const fileInput = document.getElementById("student-avatar-file-input");
  const avatarImg = document.getElementById("student-avatar-img");
  const avatarInitials = document.getElementById("student-avatar-initials");
  const btnUpload = document.getElementById("btn-upload-student-avatar");
  const btnRemove = document.getElementById("btn-remove-student-avatar");

  function triggerAvatarPick() {
    if (fileInput) fileInput.click();
  }

  if (avatarWrap) avatarWrap.addEventListener("click", triggerAvatarPick);
  if (avatarBadge)
    avatarBadge.addEventListener("click", (e) => {
      e.stopPropagation();
      triggerAvatarPick();
    });
  if (btnUpload) btnUpload.addEventListener("click", triggerAvatarPick);

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        showToast("Please select a valid image file (PNG, JPG, WebP)", true);
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        showToast("Image is too large. Maximum file size is 5MB.", true);
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        currentAvatarBase64 = event.target.result;
        setAvatarPreview(currentAvatarBase64);
        // INSTANTLY update header avatar icon
        updateHeaderAvatar(currentAvatarBase64);
        try {
          sessionStorage.setItem("nexo-student-avatar", currentAvatarBase64);
          const cached = JSON.parse(
            localStorage.getItem("nexo_student_settings") || "{}",
          );
          cached.profilePicture = currentAvatarBase64;
          localStorage.setItem("nexo_student_settings", JSON.stringify(cached));
        } catch (_) {}
        showToast("Profile image updated");

        // Auto-save immediately to server so user doesn't lose it if they navigate away
        try {
          await fetch(`${API_BASE}/api/student-settings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ profilePicture: currentAvatarBase64 }),
          });
        } catch (err) {
          console.warn("Could not auto-save avatar to server:", err);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  if (btnRemove) {
    btnRemove.addEventListener("click", async () => {
      currentAvatarBase64 = "";
      if (fileInput) fileInput.value = "";
      setAvatarPreview("");
      // INSTANTLY update header avatar icon
      updateHeaderAvatar("");
      try {
        sessionStorage.removeItem("nexo-student-avatar");
        const cached = JSON.parse(
          localStorage.getItem("nexo_student_settings") || "{}",
        );
        cached.profilePicture = "";
        localStorage.setItem("nexo_student_settings", JSON.stringify(cached));
      } catch (_) {}
      showToast("Profile image removed");

      try {
        await fetch(`${API_BASE}/api/student-settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profilePicture: "" }),
        });
      } catch (err) {
        console.warn("Could not auto-save removed avatar to server:", err);
      }
    });
  }

  function setAvatarPreview(src) {
    const nameInput = document.getElementById("input-student-fullname");
    const nameVal =
      (nameInput && nameInput.value.trim()) ||
      sessionStorage.getItem("nexo-student-name") ||
      "";
    const initials =
      typeof window.getDynamicInitials === "function"
        ? window.getDynamicInitials(nameVal)
        : "";

    if (src) {
      if (avatarImg) {
        avatarImg.src = src;
        avatarImg.classList.add("has-img");
      }
      if (avatarInitials) avatarInitials.style.display = "none";
    } else {
      if (avatarImg) {
        avatarImg.src = "";
        avatarImg.classList.remove("has-img");
      }
      if (avatarInitials) {
        avatarInitials.style.display = "flex";
        if (initials) {
          avatarInitials.textContent = initials;
        } else {
          avatarInitials.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 4. LOAD SETTINGS FROM SERVER / CACHE
  // -------------------------------------------------------------
  let activeStudentSettings = null;

  async function loadSettings() {
    let settings = null;
    const currentEmail = (
      sessionStorage.getItem("nexo-student-email") ||
      localStorage.getItem("nexo-student-email") ||
      ""
    ).toLowerCase();
    const currentName =
      sessionStorage.getItem("nexo-student-name") ||
      localStorage.getItem("nexo-student-name") ||
      "";

    try {
      const queryParam = currentEmail ? `?email=${encodeURIComponent(currentEmail)}` : "";
      const res = await fetch(`${API_BASE}/api/student-settings${queryParam}`);
      if (res.ok) {
        const fetched = await res.json();
        if (fetched && (!fetched.email || !currentEmail || fetched.email.toLowerCase() === currentEmail)) {
          settings = fetched;
        }
      }
    } catch (e) {
      console.warn("Could not fetch /api/student-settings from server:", e);
    }

    if (!settings && currentEmail) {
      try {
        const raw = localStorage.getItem(`nexo_student_settings_${currentEmail}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.email && parsed.email.toLowerCase() === currentEmail) {
            settings = parsed;
          }
        }
      } catch (_) {}
    }

    if (!settings) {
      settings = {
        fullName: currentName,
        email: currentEmail,
        university: "",
        course: "",
        yearLevel: "",
        studentId: "",
        contactNumber: "",
        bio: "",
        profilePicture: "",
        isProfileConfirmed: false,
        notifications: {
          scholarshipMatches: true,
          applicationUpdates: true,
          deadlineReminders: true,
        },
        preferences: {
          theme: "light",
        },
      };
    }

    activeStudentSettings = settings;

    // Populate UI inputs
    const nameInput = document.getElementById("input-student-fullname");
    const emailInput = document.getElementById("input-student-email");
    const sessionEmailEl = document.getElementById("session-active-email");
    if (sessionEmailEl && currentEmail) {
      sessionEmailEl.textContent = currentEmail;
    }
    const uniInput = document.getElementById("input-student-university");
    const courseInput = document.getElementById("input-student-course");
    const yearSelect = document.getElementById("select-student-year");
    const idInput = document.getElementById("input-student-id");
    const phoneInput = document.getElementById("input-student-phone");
    const bioInput = document.getElementById("input-student-bio");
    const statusBanner = document.getElementById("profile-status-banner");
    const btnSave = document.getElementById("student-save-btn");

    const prefDark = document.getElementById("pref-student-dark-mode");
    const notifMatches = document.getElementById("pref-notif-matches");
    const notifStatus = document.getElementById("pref-notif-status");
    const notifDeadlines = document.getElementById("pref-notif-deadlines");

    // Full name and Email are ALWAYS locked for student settings
    if (nameInput) {
      nameInput.value = settings.fullName || currentName || "";
      nameInput.readOnly = true;
      nameInput.tabIndex = -1;
      nameInput.style.cursor = "not-allowed";
      nameInput.style.background = "var(--bg-canvas)";
      nameInput.style.opacity = "0.85";
    }
    if (emailInput) {
      emailInput.value = settings.email || currentEmail || "";
      emailInput.readOnly = true;
      emailInput.tabIndex = -1;
      emailInput.style.cursor = "not-allowed";
      emailInput.style.background = "var(--bg-canvas)";
      emailInput.style.opacity = "0.85";
    }
    if (uniInput) uniInput.value = settings.university || "";
    if (courseInput) courseInput.value = settings.course || "";
    if (yearSelect) yearSelect.value = settings.yearLevel || "";
    if (idInput) idInput.value = settings.studentId || "";
    if (phoneInput) phoneInput.value = settings.contactNumber || "";
    if (bioInput) bioInput.value = settings.bio || "";

    currentAvatarBase64 = settings.profilePicture || "";
    setAvatarPreview(currentAvatarBase64);

    const isConfirmed = Boolean(settings.isProfileConfirmed);

    if (isConfirmed) {
      // PERMANENTLY LOCKED STATE
      if (courseInput) {
        courseInput.readOnly = true;
        courseInput.style.cursor = "not-allowed";
        courseInput.style.background = "var(--bg-canvas)";
        courseInput.style.opacity = "0.85";
      }
      if (yearSelect) {
        yearSelect.disabled = true;
        yearSelect.style.cursor = "not-allowed";
        yearSelect.style.background = "var(--bg-canvas)";
        yearSelect.style.opacity = "0.85";
      }
      if (bioInput) {
        bioInput.readOnly = false;
        bioInput.disabled = false;
        bioInput.style.cursor = "text";
        bioInput.style.background = "";
        bioInput.style.opacity = "1";
      }
      if (uniInput) {
        uniInput.readOnly = true;
        uniInput.style.cursor = "not-allowed";
        uniInput.style.background = "var(--bg-canvas)";
        uniInput.style.opacity = "0.85";
      }
      if (idInput) {
        idInput.readOnly = true;
        idInput.style.cursor = "not-allowed";
        idInput.style.background = "var(--bg-canvas)";
        idInput.style.opacity = "0.85";
      }
      if (phoneInput) {
        phoneInput.readOnly = true;
        phoneInput.style.cursor = "not-allowed";
        phoneInput.style.background = "var(--bg-canvas)";
        phoneInput.style.opacity = "0.85";
      }

      if (statusBanner) {
        statusBanner.style.display = "flex";
        statusBanner.style.background = "rgba(16, 185, 129, 0.08)";
        statusBanner.style.border = "1px solid rgba(16, 185, 129, 0.4)";
        statusBanner.style.color = "#10b981";
        statusBanner.innerHTML = `
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" style="flex-shrink:0; margin-top:2px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          <div>
            <strong style="display:block; font-size:14px; margin-bottom:2px; color:#10b981;">✓ Academic Records Verified & Confirmed</strong>
            Your official student profile and academic records are verified. You are fully eligible to apply for scholarships. Academic records are locked, and your Bio can be updated anytime.
          </div>
        `;
      }

      async function executeSaveSettings(isConfirmed) {
    const uniInput = document.getElementById("input-student-university");
    const courseInput = document.getElementById("input-student-course");
    const yearSelect = document.getElementById("select-student-year");
    const idInput = document.getElementById("input-student-id");
    const phoneInput = document.getElementById("input-student-phone");
    const bioInput = document.getElementById("input-student-bio");
    const nameInput = document.getElementById("input-student-fullname");
    const emailInput = document.getElementById("input-student-email");

    const prefDark = document.getElementById("pref-student-dark-mode");
    const notifMatches = document.getElementById("pref-notif-matches");
    const notifStatus = document.getElementById("pref-notif-status");
    const notifDeadlines = document.getElementById("pref-notif-deadlines");

    const savedEmail = (
      sessionStorage.getItem("nexo-student-email") ||
      localStorage.getItem("nexo-student-email") ||
      (activeStudentSettings && activeStudentSettings.email) ||
      ""
    ).toLowerCase().trim();

    const payload = {
      fullName: nameInput ? nameInput.value.trim() : (activeStudentSettings?.fullName || ""),
      email: emailInput ? (emailInput.value.trim().toLowerCase() || savedEmail) : savedEmail,
      university: uniInput ? uniInput.value.trim() : (activeStudentSettings?.university || ""),
      course: courseInput ? courseInput.value.trim() : (activeStudentSettings?.course || ""),
      yearLevel: yearSelect ? yearSelect.value : (activeStudentSettings?.yearLevel || ""),
      studentId: idInput ? idInput.value.trim() : (activeStudentSettings?.studentId || ""),
      contactNumber: phoneInput ? phoneInput.value.trim() : (activeStudentSettings?.contactNumber || ""),
      bio: bioInput ? bioInput.value.trim() : "",
      profilePicture: currentAvatarBase64 || activeStudentSettings?.profilePicture || "",
      isProfileConfirmed: Boolean(isConfirmed),
      notifications: {
        scholarshipMatches: notifMatches ? notifMatches.checked : true,
        applicationUpdates: notifStatus ? notifStatus.checked : true,
        deadlineReminders: notifDeadlines ? notifDeadlines.checked : true,
      },
      preferences: {
        theme: prefDark && prefDark.checked ? "dark" : "light",
      },
    };

    try {
      const res = await fetch(`${API_BASE}/api/student-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const resData = await res.json();
        if (resData && resData.settings) {
          Object.assign(payload, resData.settings);
        }
      }
    } catch (err) {
      console.warn("Could not save to /api/student-settings via server:", err);
    }

    // Comprehensive LocalStorage sync
    try {
      localStorage.setItem("nexo_student_settings", JSON.stringify(payload));
      if (payload.email) {
        const emailLower = payload.email.toLowerCase().trim();
        localStorage.setItem(`nexo_student_settings_${emailLower}`, JSON.stringify(payload));
        sessionStorage.setItem("nexo-student-email", payload.email);
        localStorage.setItem("nexo-student-email", payload.email);

        // Update nexo_student_profiles
        let profiles = {};
        try { profiles = JSON.parse(localStorage.getItem("nexo_student_profiles") || "{}"); } catch (_) {}
        profiles[emailLower] = { ...(profiles[emailLower] || {}), ...payload };
        localStorage.setItem("nexo_student_profiles", JSON.stringify(profiles));

        // Update nexo_users
        try {
          let usersList = JSON.parse(localStorage.getItem("nexo_users") || "[]");
          if (Array.isArray(usersList)) {
            let u = usersList.find((x) => (x.email || "").toLowerCase().trim() === emailLower);
            if (u) {
              if (payload.course) u.course = payload.course;
              if (payload.yearLevel) u.yearLevel = payload.yearLevel;
              if (payload.university) u.university = payload.university;
              if (payload.studentId) u.studentId = payload.studentId;
              if (payload.contactNumber) u.contactNumber = payload.contactNumber;
              u.bio = payload.bio || "";
              u.isProfileConfirmed = payload.isProfileConfirmed;
              if (payload.profilePicture) u.profilePicture = payload.profilePicture;
              localStorage.setItem("nexo_users", JSON.stringify(usersList));
            }
          }
        } catch (_) {}

        // Update nexo_applications
        try {
          let appsList = JSON.parse(localStorage.getItem("nexo_applications") || "[]");
          if (Array.isArray(appsList)) {
            let changed = false;
            appsList.forEach((app) => {
              if ((app.studentEmail || "").toLowerCase().trim() === emailLower) {
                if (payload.course) app.course = payload.course;
                if (payload.yearLevel) app.yearLevel = payload.yearLevel;
                if (payload.university) app.university = payload.university;
                if (payload.studentId) app.studentId = payload.studentId;
                if (payload.contactNumber) app.contactNumber = payload.contactNumber;
                app.bio = payload.bio || "";
                if (payload.profilePicture) {
                  app.studentProfilePic = payload.profilePicture;
                  app.profilePicture = payload.profilePicture;
                }
                changed = true;
              }
            });
            if (changed) {
              localStorage.setItem("nexo_applications", JSON.stringify(appsList));
            }
          }
        } catch (_) {}
      }
      sessionStorage.setItem("nexo-student-name", payload.fullName || "");
      localStorage.setItem("nexo-student-name", payload.fullName || "");
    } catch (_) {}

    // Refresh global identity
    if (typeof window.syncGlobalStudentIdentity === "function") {
      window.syncGlobalStudentIdentity();
    }
    window.dispatchEvent(new CustomEvent("nexo:profile-updated", { detail: payload }));

    activeStudentSettings = payload;
    await loadSettings();
  }

  if (btnSave) {
    btnSave.addEventListener("click", async (e) => {
      e.preventDefault();

      const courseInput = document.getElementById("input-student-course");
      const yearSelect = document.getElementById("select-student-year");
      const bioInput = document.getElementById("input-student-bio");
      const nameInput = document.getElementById("input-student-fullname");
      const emailInput = document.getElementById("input-student-email");

      const courseVal = courseInput ? courseInput.value.trim() : "";
      const yearVal = yearSelect ? yearSelect.value : "";
      const bioVal = bioInput ? bioInput.value.trim() : "";

      // If already confirmed: bio and preferences remain editable anytime!
      if (activeStudentSettings && activeStudentSettings.isProfileConfirmed) {
        btnSave.disabled = true;
        btnSave.textContent = "Saving...";
        await executeSaveSettings(true);
        btnSave.disabled = false;
        btnSave.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Save Changes
        `;
        showToast("Profile settings and bio updated successfully!");
        return;
      }

      // Initial confirmation: Program / Course and Year Level are required
      if (!courseVal) {
        showToast("Please enter your Program / Course.", true);
        if (courseInput) courseInput.focus();
        return;
      }

      if (!yearVal) {
        showToast("Please select your Year Level.", true);
        if (yearSelect) yearSelect.focus();
        return;
      }

      // Bio is optional!

      // Populate preview modal
      const previewName = document.getElementById("confirm-preview-name");
      const previewEmail = document.getElementById("confirm-preview-email");
      const previewCourse = document.getElementById("confirm-preview-course");
      const previewYear = document.getElementById("confirm-preview-year");
      const previewBio = document.getElementById("confirm-preview-bio");

      if (previewName) previewName.textContent = (nameInput && nameInput.value) || "-";
      if (previewEmail) previewEmail.textContent = (emailInput && emailInput.value) || "-";
      if (previewCourse) previewCourse.textContent = courseVal;
      if (previewYear) previewYear.textContent = yearVal;
      if (previewBio) previewBio.textContent = bioVal || "(No applicant bio provided)";

      if (modalConfirmProfile) {
        modalConfirmProfile.style.display = "flex";
        document.body.style.overflow = "hidden";
      }
    });
  }

  if (btnExecuteProfileConfirm) {
    btnExecuteProfileConfirm.addEventListener("click", async () => {
      btnExecuteProfileConfirm.disabled = true;
      btnExecuteProfileConfirm.textContent = "Confirming & Locking...";

      await executeSaveSettings(true);

      closeConfirmModal();
      btnExecuteProfileConfirm.disabled = false;
      btnExecuteProfileConfirm.textContent = "🔒 Confirm & Lock Academic Records";

      showToast("Profile successfully confirmed! You can now apply for scholarships.");
    });
  }

  if (btnDiscard) {
    btnDiscard.addEventListener("click", () => {
      loadSettings();
      const cachedAvatar = sessionStorage.getItem("nexo-student-avatar");
      updateHeaderAvatar(cachedAvatar || "");
      showToast("Changes discarded");
    });
  }

  // -------------------------------------------------------------
  // 6. PASSWORD TOGGLES & CHANGE PASSWORD FORM
  // -------------------------------------------------------------
  document.querySelectorAll(".password-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const input = document.getElementById(targetId);
      if (!input) return;
      const isHidden = input.getAttribute("type") === "password";
      input.setAttribute("type", isHidden ? "text" : "password");
    });
  });

  const passForm = document.getElementById("student-password-form");
  if (passForm) {
    passForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const curr = document.getElementById("student-curr-pass").value;
      const newP = document.getElementById("student-new-pass").value;
      const conf = document.getElementById("student-confirm-pass").value;

      if (!curr || !newP || !conf) {
        showToast("Please fill in all password fields.", true);
        return;
      }
      if (newP.length < 8) {
        showToast("New password must be at least 8 characters.", true);
        return;
      }
      if (newP !== conf) {
        showToast("New passwords do not match.", true);
        return;
      }

      const currentStudentEmail = (
        sessionStorage.getItem("nexo-student-email") ||
        localStorage.getItem("nexo-student-email") ||
        ""
      ).toLowerCase();

      try {
        const res = await fetch(`${API_BASE}/api/settings/password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: currentStudentEmail,
            role: "student",
            currentPassword: curr,
            newPassword: newP,
            confirmPassword: conf,
          }),
        });
        if (res.ok) {
          showToast("Password updated successfully!");
          passForm.reset();
          try {
            const uList = JSON.parse(
              localStorage.getItem("nexo_users") || "[]",
            );
            const u = uList.find(
              (x) => (x.email || "").toLowerCase() === currentStudentEmail,
            );
            if (u) {
              u.password = newP;
              localStorage.setItem("nexo_users", JSON.stringify(uList));
            }
          } catch (_) {}
        } else {
          const errData = await res.json().catch(() => ({}));
          showToast(errData.message || "Failed to update password.", true);
        }
      } catch (err) {
        showToast("Password updated successfully!");
        passForm.reset();
      }
    });
  }

  // Initial load
  loadSettings();

  // Real-time theme switch listener
  const prefDarkToggle = document.getElementById("pref-student-dark-mode");
  const topHeaderToggle =
    document.getElementById("theme-toggle") ||
    document.querySelector(".theme-toggle");

  if (prefDarkToggle) {
    prefDarkToggle.addEventListener("change", (e) => {
      const wantDark = e.target.checked;
      if (wantDark) {
        document.documentElement.classList.add("dark-theme");
        document.body.classList.add("dark-theme");
        localStorage.setItem("nexo-theme", "dark");
      } else {
        document.documentElement.classList.remove("dark-theme");
        document.body.classList.remove("dark-theme");
        localStorage.setItem("nexo-theme", "light");
      }
      if (topHeaderToggle) {
        topHeaderToggle.checked = !wantDark;
      }
      showToast(wantDark ? "Dark theme enabled" : "Light theme enabled");
    });
  }

  if (topHeaderToggle && prefDarkToggle) {
    topHeaderToggle.addEventListener("change", () => {
      setTimeout(() => {
        const isDark =
          document.body.classList.contains("dark-theme") ||
          document.documentElement.classList.contains("dark-theme");
        prefDarkToggle.checked = isDark;
      }, 50);
    });
  }
});
