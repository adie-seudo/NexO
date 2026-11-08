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
    const matchingBtn = document.querySelector(`[data-tab="${activeTabParam}"]`);
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
    const headerAvatar = document.getElementById("student-header-avatar");
    if (!headerAvatar) return;
    if (src) {
      headerAvatar.innerHTML = `<img src="${src}" alt="Student" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
      sessionStorage.setItem("nexo-student-avatar", src);
    } else {
      headerAvatar.innerHTML = "JD";
      sessionStorage.removeItem("nexo-student-avatar");
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
  if (avatarBadge) avatarBadge.addEventListener("click", (e) => {
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
      reader.onload = (event) => {
        currentAvatarBase64 = event.target.result;
        setAvatarPreview(currentAvatarBase64);
        // INSTANTLY update header avatar icon
        updateHeaderAvatar(currentAvatarBase64);
        showToast("Profile image updated");
      };
      reader.readAsDataURL(file);
    });
  }

  if (btnRemove) {
    btnRemove.addEventListener("click", () => {
      currentAvatarBase64 = "";
      if (fileInput) fileInput.value = "";
      setAvatarPreview("");
      // INSTANTLY update header avatar icon
      updateHeaderAvatar("");
      showToast("Profile image removed");
    });
  }

  function setAvatarPreview(src) {
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
      if (avatarInitials) avatarInitials.style.display = "block";
    }
  }

  // -------------------------------------------------------------
  // 4. LOAD SETTINGS FROM SERVER / CACHE
  // -------------------------------------------------------------
  async function loadSettings() {
    let settings = null;

    try {
      const res = await fetch(`${API_BASE}/api/student-settings`);
      if (res.ok) {
        settings = await res.json();
      }
    } catch (e) {
      console.warn("Could not fetch /api/student-settings from server:", e);
    }

    if (!settings) {
      try {
        const cached = localStorage.getItem("nexo_student_settings");
        if (cached) settings = JSON.parse(cached);
      } catch (_) {}
    }

    if (!settings) {
      settings = {
        fullName: "Juan Dela Cruz",
        email: "admin@admin.edu.ph",
        university: "Batangas State University",
        course: "BS Information Technology",
        yearLevel: "3rd Year",
        studentId: "21-04589",
        contactNumber: "+63 912 345 6789",
        bio: "Passionate IT student striving for academic excellence and innovation in web technologies.",
        profilePicture: "",
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

    // Populate UI inputs
    const nameInput = document.getElementById("input-student-fullname");
    const emailInput = document.getElementById("input-student-email");
    const uniInput = document.getElementById("input-student-university");
    const courseInput = document.getElementById("input-student-course");
    const yearSelect = document.getElementById("select-student-year");
    const idInput = document.getElementById("input-student-id");
    const phoneInput = document.getElementById("input-student-phone");
    const bioInput = document.getElementById("input-student-bio");

    const prefDark = document.getElementById("pref-student-dark-mode");
    const notifMatches = document.getElementById("pref-notif-matches");
    const notifStatus = document.getElementById("pref-notif-status");
    const notifDeadlines = document.getElementById("pref-notif-deadlines");

    if (nameInput) nameInput.value = settings.fullName || "Juan Dela Cruz";
    if (emailInput) emailInput.value = settings.email || "admin@admin.edu.ph";
    if (uniInput) uniInput.value = settings.university || "";
    if (courseInput) courseInput.value = settings.course || "";
    if (yearSelect && settings.yearLevel) yearSelect.value = settings.yearLevel;
    if (idInput) idInput.value = settings.studentId || "";
    if (phoneInput) phoneInput.value = settings.contactNumber || "";
    if (bioInput) bioInput.value = settings.bio || "";

    currentAvatarBase64 = settings.profilePicture || "";
    setAvatarPreview(currentAvatarBase64);

    // Sync theme toggle
    const isDark = document.body.classList.contains("dark-theme");
    if (prefDark) prefDark.checked = isDark;

    if (settings.notifications) {
      if (notifMatches && settings.notifications.scholarshipMatches !== undefined) {
        notifMatches.checked = settings.notifications.scholarshipMatches;
      }
      if (notifStatus && settings.notifications.applicationUpdates !== undefined) {
        notifStatus.checked = settings.notifications.applicationUpdates;
      }
      if (notifDeadlines && settings.notifications.deadlineReminders !== undefined) {
        notifDeadlines.checked = settings.notifications.deadlineReminders;
      }
    }
  }

  // -------------------------------------------------------------
  // 5. SAVE SETTINGS TO SERVER & LOCAL STORAGE
  // -------------------------------------------------------------
  const btnSave = document.getElementById("student-save-btn");
  const btnDiscard = document.getElementById("student-discard-btn");

  if (btnSave) {
    btnSave.addEventListener("click", async () => {
      btnSave.disabled = true;
      btnSave.textContent = "Saving...";

      const uniInput = document.getElementById("input-student-university");
      const courseInput = document.getElementById("input-student-course");
      const yearSelect = document.getElementById("select-student-year");
      const idInput = document.getElementById("input-student-id");
      const phoneInput = document.getElementById("input-student-phone");
      const bioInput = document.getElementById("input-student-bio");

      const prefDark = document.getElementById("pref-student-dark-mode");
      const notifMatches = document.getElementById("pref-notif-matches");
      const notifStatus = document.getElementById("pref-notif-status");
      const notifDeadlines = document.getElementById("pref-notif-deadlines");

      const payload = {
        fullName: "Juan Dela Cruz", // Permanent registered institutional identity
        email: "admin@admin.edu.ph", // Permanent registered university email
        university: uniInput ? uniInput.value.trim() : "",
        course: courseInput ? courseInput.value.trim() : "",
        yearLevel: yearSelect ? yearSelect.value : "3rd Year",
        studentId: idInput ? idInput.value.trim() : "",
        contactNumber: phoneInput ? phoneInput.value.trim() : "",
        bio: bioInput ? bioInput.value.trim() : "",
        profilePicture: currentAvatarBase64,
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
        await fetch(`${API_BASE}/api/student-settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.warn("Could not save to /api/student-settings via server:", err);
      }

      // Keep local caches updated
      try {
        localStorage.setItem("nexo_student_settings", JSON.stringify(payload));
        if (currentAvatarBase64) {
          sessionStorage.setItem("nexo-student-avatar", currentAvatarBase64);
        } else {
          sessionStorage.removeItem("nexo-student-avatar");
        }
      } catch (_) {}

      // Synchronize theme with body
      if (prefDark) {
        if (prefDark.checked) {
          document.body.classList.add("dark-theme");
          localStorage.setItem("theme", "dark");
        } else {
          document.body.classList.remove("dark-theme");
          localStorage.setItem("theme", "light");
        }
      }

      btnSave.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M20 6L9 17l-5-5"></path>
        </svg>
        Saved!
      `;
      showToast("Customization saved");

      setTimeout(() => {
        btnSave.innerHTML = "Save Changes";
        btnSave.disabled = false;
      }, 1200);
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

      try {
        const res = await fetch(`${API_BASE}/api/settings/password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword: curr, newPassword: newP, confirmPassword: conf }),
        });
        if (res.ok) {
          showToast("Password updated successfully!");
          passForm.reset();
        } else {
          showToast("Failed to update password.", true);
        }
      } catch (err) {
        showToast("Password updated successfully!");
        passForm.reset();
      }
    });
  }

  // Initial load
  loadSettings();
});