// =========================================
// STATE TRACKERS & API CONFIG
// =========================================
let totalScholarships = 0;
let ongoingScholarships = 0;
let draftCount = 0;
let currentEditingDraftCard = null; // Tracks if we are updating a draft
let currentEditingDraftId = null;

// Local Node.js / Express Server file-handling endpoint
window.API_BASE =
  window.API_BASE ||
  (window.location.origin.includes(":3000") ? "" : "http://localhost:3000");
var API_BASE = window.API_BASE;

// =========================================
// CACHED DOM ELEMENTS (Boosts Performance)
// =========================================
const DOM = {};

// =========================================
// MASTER INITIALIZATION
// =========================================
function initDashboard() {
  cacheDOM();
  initDashboardModals();
  initCustomDropdown();
  initStepNavigation();
  initCustomRequirements();
  initViewSwitching();
  initPublishAndDraft();
  initModalCancellation();
  initDraftEditing();
  initDynamicAvatar();
  loadPersistedData(); // <-- Loads data from local data.json via Node/Express!

  // Live Sync Polling every 4 seconds
  setInterval(() => {
    if (!DOM.creationModal || !DOM.creationModal.classList.contains("active")) {
      loadPersistedData();
    }
  }, 4000);
  window.addEventListener("focus", loadPersistedData);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDashboard);
} else {
  initDashboard();
}

function cacheDOM() {
  // Step 1 Validation Elements
  DOM.nameInput = document.getElementById("schol-name");
  DOM.nameError = document.getElementById("error-schol-name");
  DOM.descInput = document.getElementById("schol-desc");
  DOM.descError = document.getElementById("error-schol-desc");
  DOM.typeInput = document.getElementById("schol-type");
  DOM.typeSelected = document.getElementById("schol-type-selected");
  DOM.typeError = document.getElementById("error-schol-type");
  DOM.dateInput = document.getElementById("schol-deadline");
  DOM.dateError = document.getElementById("error-schol-deadline");
  DOM.limitInput = document.getElementById("schol-limit");
  DOM.limitError = document.getElementById("error-schol-limit");

  // Step 2 & 3 Validation Elements
  DOM.reqList = document.getElementById("requirements-list");
  DOM.step2Error = document.getElementById("error-step-2");
  DOM.confirmCheck = document.getElementById("confirm-info");
  DOM.step3Error = document.getElementById("error-step-3");

  // Navigation & Progress Elements
  DOM.stepContainers = [
    document.getElementById("step-1-container"),
    document.getElementById("step-2-container"),
    document.getElementById("step-3-container"),
  ];
  DOM.progressBarFill = document.querySelector(".progress-bar-fill");
  DOM.progressText = document.querySelector(".progress-percentage");
  DOM.stepIndicators = document.querySelectorAll(".step");
  DOM.creationModal = document.getElementById("create-scholarship-modal");
}

// =========================================
// 1. DASHBOARD MODALS (Fixed Multi-Button Listener)
// =========================================
function initDashboardModals() {
  // Select BOTH the main dashboard button (by ID) and the drafts button (by Class)
  const openBtns = document.querySelectorAll(
    "#open-create-modal, .open-create-modal-btn",
  );

  if (openBtns.length > 0 && DOM.creationModal) {
    // Loop through every matching button and attach the click event
    openBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();

        // Reset editing trackers and button text
        currentEditingDraftCard = null;
        currentEditingDraftId = null;
        const draftBtn = document.getElementById("draft-btn");
        if (draftBtn) draftBtn.textContent = "Save as Draft";

        // Reset the form so it opens fresh
        const step1Form = document.getElementById("step-1-form");
        if (step1Form) step1Form.reset();
        if (DOM.typeSelected) {
          DOM.typeSelected.querySelector("span").textContent = "Select type";
          DOM.typeSelected.classList.remove("has-value");
          if (DOM.typeInput) DOM.typeInput.value = "";
        }
        if (DOM.reqList) {
          DOM.reqList.innerHTML = `
            <div class="req-card">
              <div class="req-icon">
                <img src="assets/human-icon.png" alt="ID" width="20" height="20" style="width: 20px; height: 20px; object-fit: contain;">
              </div>
              <div class="req-text">
                <h4>Valid School ID</h4>
                <p>Upload a clear photo of your student ID. (Max 5MB)</p>
              </div>
              <button type="button" class="remove-req-btn" aria-label="Remove">&times;</button>
            </div>
            <div class="req-card">
              <div class="req-icon">
                <img src="assets/upload-icon.png" alt="Grades" width="20" height="20" style="width: 20px; height: 20px; object-fit: contain;">
              </div>
              <div class="req-text">
                <h4>Latest Grades/Transcript</h4>
                <p>Upload your latest grades or official transcript.</p>
              </div>
              <button type="button" class="remove-req-btn" aria-label="Remove">&times;</button>
            </div>
          `;
        }

        DOM.creationModal.classList.add("active");
        DOM.creationModal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        goToStep(1, false);
      });
    });
  } else {
    console.warn(
      "Dashboard Notice: Modal open buttons or 'create-scholarship-modal' not found on this page.",
    );
  }
}

// =========================================
// 2. CUSTOM DROPDOWN LOGIC
// =========================================
function initCustomDropdown() {
  const dropdown = document.getElementById("schol-type-dropdown");
  const selected = document.getElementById("schol-type-selected");
  const options = document.getElementById("schol-type-options");
  const hiddenInput = document.getElementById("schol-type");

  if (dropdown && selected && options && hiddenInput) {
    const selectedText = selected.querySelector("span");

    selected.addEventListener("click", () => {
      dropdown.classList.toggle("active");
    });

    options.querySelectorAll("li").forEach((option) => {
      option.addEventListener("click", () => {
        selectedText.textContent = option.textContent;
        hiddenInput.value = option.getAttribute("data-value");
        selected.classList.add("has-value");
        dropdown.classList.remove("active");
      });
    });

    document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove("active");
      }
    });
  }
}

// =========================================
// 3. STEP NAVIGATION & MODAL LOGIC
// =========================================
function goToStep(stepNumber = 1, isEdit = false) {
  if (!DOM.stepContainers || DOM.stepContainers.length === 0) return;

  // Populate Review Step before showing it
  if (stepNumber === 3 && !isEdit) {
    document.getElementById("review-title").textContent = DOM.nameInput
      ? DOM.nameInput.value
      : "";
    document.getElementById("review-desc-text").textContent = DOM.descInput
      ? DOM.descInput.value
      : "";
    document.getElementById("review-type").textContent = "Admin";

    const typeSelectedText = DOM.typeSelected
      ? DOM.typeSelected.querySelector("span").textContent
      : "";
    const reviewCategoryPill = document.getElementById("review-category");
    if (reviewCategoryPill) reviewCategoryPill.textContent = typeSelectedText;

    if (DOM.dateInput && DOM.dateInput.value) {
      const dateObj = new Date(DOM.dateInput.value);
      document.getElementById("review-date").textContent =
        dateObj.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
    }

    const limitVal =
      DOM.limitInput && DOM.limitInput.value
        ? parseInt(DOM.limitInput.value, 10)
        : 200;
    const reviewLimitEl = document.getElementById("review-limit");
    if (reviewLimitEl) reviewLimitEl.textContent = `${limitVal} Applicants`;

    const reviewReqList = document.querySelector(".review-req-list");
    if (reviewReqList) {
      reviewReqList.innerHTML = "";
      const currentReqs = document.querySelectorAll(
        "#requirements-list .req-card h4",
      );
      currentReqs.forEach((req) => {
        const li = document.createElement("li");
        li.textContent = req.textContent;
        reviewReqList.appendChild(li);
      });
    }
  }

  // Hide all, show target step
  DOM.stepContainers.forEach((container) => {
    if (container) container.classList.remove("active");
  });
  if (DOM.stepContainers[stepNumber - 1]) {
    DOM.stepContainers[stepNumber - 1].classList.add("active");
  }

  // Toggle Edit vs Normal Buttons
  const s1Normal = document.getElementById("step-1-normal-actions");
  const s1Edit = document.getElementById("step-1-edit-actions");
  const s2Normal = document.getElementById("step-2-normal-actions");
  const s2Edit = document.getElementById("step-2-edit-actions");

  if (isEdit) {
    if (s1Normal) s1Normal.style.display = "none";
    if (s1Edit) s1Edit.style.display = "flex";
    if (s2Normal) s2Normal.style.display = "none";
    if (s2Edit) s2Edit.style.display = "flex";
  } else {
    if (s1Normal) s1Normal.style.display = "flex";
    if (s1Edit) s1Edit.style.display = "none";
    if (s2Normal) s2Normal.style.display = "flex";
    if (s2Edit) s2Edit.style.display = "none";
  }

  // Update Progress Bar
  if (DOM.progressBarFill && DOM.progressText) {
    if (stepNumber === 3) {
      DOM.progressBarFill.style.width = "100%";
      DOM.progressBarFill.style.backgroundColor = "#10b981";
      DOM.progressText.textContent = "100%";
      DOM.progressText.style.color = "#10b981";
    } else if (stepNumber === 2) {
      DOM.progressBarFill.style.width = "66%";
      DOM.progressBarFill.style.backgroundColor = "#f59e0b";
      DOM.progressText.textContent = "66%";
      DOM.progressText.style.color = "#f59e0b";
    } else {
      DOM.progressBarFill.style.width = "33%";
      DOM.progressBarFill.style.backgroundColor = "#ef4444";
      DOM.progressText.textContent = "33%";
      DOM.progressText.style.color = "#ef4444";
    }
  }

  // Update Step Circles
  const checkmarkSVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="color:white;"><path d="M20 6L9 17l-5-5"></path></svg>`;
  if (DOM.stepIndicators) {
    DOM.stepIndicators.forEach((indicator, index) => {
      const numSpan = indicator.querySelector(".step-num");
      const stepIdx = index + 1;

      indicator.classList.remove("active", "completed", "inactive");
      numSpan.style.backgroundColor = "";

      if (stepIdx < stepNumber) {
        indicator.classList.add("completed");
        numSpan.innerHTML = checkmarkSVG;
        numSpan.style.backgroundColor = "#10b981";
      } else if (stepIdx === stepNumber) {
        indicator.classList.add("active");
        numSpan.innerHTML = stepIdx;
      } else {
        indicator.classList.add("inactive");
        numSpan.innerHTML = stepIdx;
      }
    });
  }
}

function initStepNavigation() {
  const btnGoToStep1 = document.getElementById("go-to-step-1");
  const btnGoToStep2 = document.getElementById("go-to-step-2");
  const btnGoToStep3 = document.getElementById("go-to-step-3");
  const btnBackToStep2 = document.getElementById("back-to-step-2");

  if (btnGoToStep1)
    btnGoToStep1.addEventListener("click", () => goToStep(1, false));
  if (btnGoToStep2)
    btnGoToStep2.addEventListener("click", () => {
      if (validateStep1()) goToStep(2, false);
    });
  if (btnGoToStep3)
    btnGoToStep3.addEventListener("click", () => {
      if (validateStep2()) goToStep(3, false);
    });
  if (btnBackToStep2)
    btnBackToStep2.addEventListener("click", () => goToStep(2, false));

  const editStep1 = document.getElementById("edit-step-1");
  const editStep2 = document.getElementById("edit-step-2");
  if (editStep1) editStep1.addEventListener("click", () => goToStep(1, true));
  if (editStep2) editStep2.addEventListener("click", () => goToStep(2, true));

  const doneEdit1 = document.getElementById("done-edit-1");
  const doneEdit2 = document.getElementById("done-edit-2");
  if (doneEdit1)
    doneEdit1.addEventListener("click", () => {
      if (validateStep1()) goToStep(3, false);
    });
  if (doneEdit2)
    doneEdit2.addEventListener("click", () => {
      if (validateStep2()) goToStep(3, false);
    });

  const returnToReviewBtns = [
    document.getElementById("cancel-edit-1"),
    document.getElementById("cancel-edit-2"),
  ];
  returnToReviewBtns.forEach((btn) => {
    if (btn) btn.addEventListener("click", () => goToStep(3, false));
  });
}

// =========================================
// 4. STEP VALIDATIONS (Using Cached DOM)
// =========================================
function validateStep1() {
  let isValid = true;

  if (DOM.nameInput && !DOM.nameInput.value.trim()) {
    DOM.nameError.textContent = "Please enter the scholarship name.";
    DOM.nameError.classList.add("active");
    DOM.nameInput.classList.add("input-error");
    isValid = false;
  } else if (DOM.nameInput) {
    DOM.nameError.classList.remove("active");
    DOM.nameInput.classList.remove("input-error");
  }

  if (DOM.descInput && !DOM.descInput.value.trim()) {
    DOM.descError.textContent = "Please provide a short description.";
    DOM.descError.classList.add("active");
    DOM.descInput.classList.add("input-error");
    isValid = false;
  } else if (DOM.descInput) {
    DOM.descError.classList.remove("active");
    DOM.descInput.classList.remove("input-error");
  }

  if (DOM.typeInput && !DOM.typeInput.value) {
    DOM.typeError.textContent = "Please select a scholarship type.";
    DOM.typeError.classList.add("active");
    if (DOM.typeSelected) DOM.typeSelected.classList.add("input-error");
    isValid = false;
  } else if (DOM.typeInput) {
    DOM.typeError.classList.remove("active");
    if (DOM.typeSelected) DOM.typeSelected.classList.remove("input-error");
  }

  if (DOM.dateInput && !DOM.dateInput.value) {
    DOM.dateError.textContent = "Please select a deadline.";
    DOM.dateError.classList.add("active");
    DOM.dateInput.classList.add("input-error");
    isValid = false;
  } else if (DOM.dateInput) {
    const selectedDate = new Date(DOM.dateInput.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(selectedDate.getTime())) {
      DOM.dateError.textContent = "Please enter a valid date (MM/DD/YYYY).";
      DOM.dateError.classList.add("active");
      DOM.dateInput.classList.add("input-error");
      isValid = false;
    } else if (selectedDate <= today) {
      DOM.dateError.textContent = "Deadline must be a future date.";
      DOM.dateError.classList.add("active");
      DOM.dateInput.classList.add("input-error");
      isValid = false;
    } else {
      DOM.dateError.classList.remove("active");
      DOM.dateInput.classList.remove("input-error");
    }
  }

  if (DOM.limitInput) {
    const val = parseInt(DOM.limitInput.value, 10);
    if (!val || val <= 0) {
      if (DOM.limitError) {
        DOM.limitError.textContent =
          "Please enter a valid applicant limit (at least 1).";
        DOM.limitError.classList.add("active");
      }
      DOM.limitInput.classList.add("input-error");
      isValid = false;
    } else {
      if (DOM.limitError) DOM.limitError.classList.remove("active");
      DOM.limitInput.classList.remove("input-error");
    }
  }

  return isValid;
}

function validateStep2() {
  if (!DOM.reqList || !DOM.step2Error) return true;
  const currentCards = DOM.reqList.querySelectorAll(".req-card");

  if (currentCards.length === 0) {
    DOM.step2Error.textContent = "Please add at least one requirement.";
    DOM.step2Error.classList.add("active");
    return false;
  } else {
    DOM.step2Error.classList.remove("active");
    return true;
  }
}

function validateStep3() {
  if (!DOM.confirmCheck || !DOM.step3Error) return true;

  if (!DOM.confirmCheck.checked) {
    DOM.step3Error.textContent =
      "Please confirm the information is true and correct before proceeding.";
    DOM.step3Error.classList.add("active");
    return false;
  } else {
    DOM.step3Error.classList.remove("active");
    return true;
  }
}

// =========================================
// 5. CUSTOM REQUIREMENTS LOGIC
// =========================================
function initCustomRequirements() {
  const addCustomReqBtn = document.getElementById("add-custom-req-btn");
  if (addCustomReqBtn && DOM.reqList) {
    addCustomReqBtn.addEventListener("click", () => {
      const newCard = document.createElement("div");
      newCard.className = "req-card custom-edit-mode";
      newCard.innerHTML = `
          <input type="text" class="custom-req-input custom-title" placeholder="Requirement Name (e.g. Portfolio)">
          <input type="text" class="custom-req-input custom-desc" placeholder="Short description...">
          <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px;">
            <button type="button" class="btn btn-secondary cancel-custom-btn" style="padding: 8px 16px; font-size: 13px;">Cancel</button>
            <button type="button" class="btn btn-primary save-custom-btn" style="padding: 8px 16px; font-size: 13px;">Save</button>
          </div>
        `;
      DOM.reqList.appendChild(newCard);
      newCard.querySelector(".custom-title").focus();

      newCard
        .querySelector(".cancel-custom-btn")
        .addEventListener("click", () => newCard.remove());

      newCard
        .querySelector(".save-custom-btn")
        .addEventListener("click", () => {
          const titleInput = newCard.querySelector(".custom-title");
          const descInput = newCard.querySelector(".custom-desc");
          const titleVal = titleInput.value.trim();
          const descVal = descInput.value.trim();
          let isValid = true;

          if (!titleVal) {
            titleInput.classList.add("input-error");
            isValid = false;
          } else {
            titleInput.classList.remove("input-error");
          }

          if (!descVal) {
            descInput.classList.add("input-error");
            isValid = false;
          } else {
            descInput.classList.remove("input-error");
          }

          if (!isValid) return;

          newCard.className = "req-card";
          newCard.innerHTML = `
            <div class="req-icon">
              <img src="assets/i-icon.png" alt="Custom" style="width: 20px; filter: grayscale(100%); opacity: 0.7;">
            </div>
            <div class="req-text">
              <h4>${titleVal}</h4>
              <p>${descVal}</p>
            </div>
            <button type="button" class="remove-req-btn" aria-label="Remove">&times;</button>
          `;

          if (DOM.step2Error) DOM.step2Error.classList.remove("active");
        });
    });

    DOM.reqList.addEventListener("click", (e) => {
      if (
        e.target.classList.contains("remove-req-btn") ||
        e.target.closest(".remove-req-btn")
      ) {
        const card = e.target.closest(".req-card");
        if (card) {
          card.style.transition = "opacity 0.2s, transform 0.2s";
          card.style.opacity = "0";
          card.style.transform = "scale(0.95)";
          setTimeout(() => card.remove(), 200);
        }
      }
    });
  }
}

// =========================================
// 6. VIEW SWITCHING (HOME vs DRAFTS vs ALL)
// =========================================
function initViewSwitching() {
  const navHome = document.querySelector('a[href="provider-dashboard.html"]');
  const navDrafts = document.getElementById("nav-drafts");
  const dashCoverBanner = document.getElementById("dash-cover-banner");
  const dashWelcome = document.querySelector(".dash-welcome");
  const dashStats = document.querySelector(".dash-stats-container");
  const dashRecent = document.querySelector(".dash-recent");
  const dashActions = document.querySelector(".dash-actions");
  const dashDraftsSection = document.getElementById("dash-drafts-section");

  const dashAllScholSection = document.getElementById(
    "dash-all-scholarships-section",
  );
  const viewAllBtn = document.getElementById("view-all-btn");
  const backToDashBtn = document.getElementById("back-to-dash-btn");

  function showHome() {
    if (dashCoverBanner) dashCoverBanner.style.display = "block";
    if (dashWelcome) dashWelcome.style.display = "block";
    if (dashStats) dashStats.style.display = "flex";
    if (dashRecent) dashRecent.style.display = "block";
    if (dashActions) dashActions.style.display = "block";
    if (dashDraftsSection) dashDraftsSection.style.display = "none";
    if (dashAllScholSection) dashAllScholSection.style.display = "none";

    const curNavHome = document.querySelector('a[href="provider-dashboard.html"]');
    const curNavDrafts = document.getElementById("nav-drafts");
    if (curNavHome) curNavHome.classList.add("active");
    if (curNavDrafts) curNavDrafts.classList.remove("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showDrafts() {
    if (dashCoverBanner) dashCoverBanner.style.display = "none";
    if (dashWelcome) dashWelcome.style.display = "none";
    if (dashStats) dashStats.style.display = "none";
    if (dashRecent) dashRecent.style.display = "none";
    if (dashActions) dashActions.style.display = "none";
    if (dashDraftsSection) dashDraftsSection.style.display = "block";
    if (dashAllScholSection) dashAllScholSection.style.display = "none";

    const curNavHome = document.querySelector('a[href="provider-dashboard.html"]');
    const curNavDrafts = document.getElementById("nav-drafts");
    if (curNavDrafts) curNavDrafts.classList.add("active");
    if (curNavHome) curNavHome.classList.remove("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  window.showHomeView = showHome;
  window.showDraftsView = showDrafts;

  if (navDrafts) {
    navDrafts.addEventListener("click", (e) => {
      e.preventDefault();
      showDrafts();
    });
  }

  if (navHome) {
    navHome.addEventListener("click", (e) => {
      e.preventDefault();
      showHome();
    });
  }

  // When "View All" is clicked, navigate directly to Posted Scholarships manager
  if (viewAllBtn) {
    viewAllBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "provider-posts.html";
    });
  }

  // When "Back" is clicked on the All Scholarships page
  if (backToDashBtn) {
    backToDashBtn.addEventListener("click", (e) => {
      e.preventDefault();
      showHome();
    });
  }
}

// =========================================
// 7. PERSISTENCE HELPERS & FILE HANDLING
// =========================================
function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getCollectedRequirements() {
  const reqs = [];
  if (DOM.reqList) {
    DOM.reqList.querySelectorAll(".req-card").forEach((card) => {
      const h4 = card.querySelector("h4");
      const p = card.querySelector("p");
      if (h4) {
        reqs.push({
          title: h4.textContent.trim(),
          desc: p ? p.textContent.trim() : "",
        });
      }
    });
  }
  return reqs;
}

function createCompactCard(schol, allApplications = null) {
  const card = document.createElement("div");
  card.className = "compact-post-card";
  card.dataset.id = schol.id || "";

  const limitNum =
    parseInt(schol.applicantLimit || schol.maxApplicants || 200, 10) || 200;

  // Dynamically calculate live applicant count against applications
  let count = 0;
  let apps = allApplications;
  if (!Array.isArray(apps)) {
    try {
      apps = JSON.parse(localStorage.getItem("nexo_applications") || "[]");
    } catch (_) {
      apps = [];
    }
  }

  if (Array.isArray(apps) && apps.length > 0) {
    count = apps.filter((a) => {
      if (
        a.scholarshipId &&
        schol.id &&
        String(a.scholarshipId) === String(schol.id)
      )
        return true;
      if (
        schol.title &&
        (a.scholarshipTitle === schol.title || a.title === schol.title)
      )
        return true;
      return false;
    }).length;
  } else if (schol.applicantTotal !== undefined) {
    count = parseInt(schol.applicantTotal, 10) || 0;
  }

  const applicantCountDisplay = `${count} / ${limitNum} Applicants`;

  card.innerHTML = `
    <div class="compact-post-header">
      <h3 class="compact-post-title">${escapeHtml(schol.title)}</h3>
      <span class="compact-post-type">${escapeHtml(schol.typeText || schol.type || "Scholarship")}</span>
    </div>
    <p class="compact-post-desc">${escapeHtml(schol.desc)}</p>
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
      <div class="compact-post-meta" style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
        <span style="display: inline-flex; align-items: center; gap: 4px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          Expires: ${escapeHtml(schol.formattedDate || "No Deadline")}
        </span>
        <span style="display: inline-flex; align-items: center; gap: 4px; color: #8b5cf6; font-weight: 600;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          ${escapeHtml(applicantCountDisplay)}
        </span>
      </div>
      <button type="button" class="view-details-btn">View Details</button>
    </div>
  `;

  card.querySelector(".view-details-btn").addEventListener("click", () => {
    const titleEl = document.getElementById("view-modal-title");
    const typeEl = document.getElementById("view-modal-type");
    const dateEl = document.getElementById("view-modal-date");
    const applicantsEl = document.getElementById("view-modal-applicants");
    const descEl = document.getElementById("view-modal-desc");
    const modalEl = document.getElementById("view-details-modal");
    const manageBtn = document.getElementById("view-modal-manage-btn");

    if (titleEl) titleEl.textContent = schol.title;
    if (typeEl) typeEl.textContent = schol.typeText || schol.type || "";
    if (dateEl) dateEl.textContent = schol.formattedDate || "No Deadline";
    if (applicantsEl) applicantsEl.textContent = applicantCountDisplay;
    if (descEl) descEl.textContent = schol.desc || "";
    if (manageBtn) {
      manageBtn.onclick = () => {
        window.location.href = `provider-posts.html?scholarshipId=${encodeURIComponent(schol.id || schol.title)}`;
      };
    }
    if (modalEl) modalEl.classList.add("active");
  });

  return card;
}

function createDraftCard(draft) {
  const newDraft = document.createElement("div");
  newDraft.className = "draft-card";
  newDraft.dataset.id = draft.id || "";
  newDraft.innerHTML = `
    <span class="draft-badge-tag">Draft</span>
    <h3 style="margin-top: 12px; margin-bottom: 8px;">${escapeHtml(draft.title || "Untitled Scholarship")}</h3>
    <p style="font-size: 14px; margin-bottom: 12px; opacity: 0.9;">${escapeHtml(draft.desc || "No description provided yet...")}</p>
    
    <div style="display: flex; gap: 8px; margin-top: 16px; align-items: center;">
      <button type="button" class="btn btn-primary continue-edit-btn" style="flex: 1; border-radius: 20px; padding: 10px 16px; margin: 0;">
        Continue Editing
      </button>
      <button type="button" class="delete-draft-btn" style="width: 40px; height: 40px; margin: 0; padding: 0; border: none; color: #ef4444; background: transparent; display: flex; align-items: center; justify-content: center; cursor: pointer;" aria-label="Delete Draft">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
      </button>
    </div>
  `;

  const editBtn = newDraft.querySelector(".continue-edit-btn");
  if (editBtn) {
    editBtn.dataset.id = draft.id || "";
    editBtn.dataset.title = draft.title || "";
    editBtn.dataset.desc = draft.desc || "";
    editBtn.dataset.type = draft.type || "";
    editBtn.dataset.date = draft.date || "";
    editBtn.dataset.limit = draft.applicantLimit || 200;
    if (draft.requirements) {
      editBtn.dataset.requirements = JSON.stringify(draft.requirements);
    }
  }

  return newDraft;
}

function updateStatsUI(total, ongoing, drafts, applicants = 0) {
  totalScholarships = total;
  ongoingScholarships = ongoing;
  draftCount = drafts;

  const statTotal = document.getElementById("stat-total");
  const statOngoing = document.getElementById("stat-ongoing");
  const statApplicants = document.getElementById("stat-applicants");
  const draftBadge = document.getElementById("draft-badge");

  if (statTotal) statTotal.textContent = total;
  if (statOngoing) statOngoing.textContent = ongoing;
  if (statApplicants) statApplicants.textContent = applicants;

  if (draftBadge) {
    draftBadge.textContent = drafts;
    draftBadge.style.display = drafts > 0 ? "inline-block" : "none";
  }
}

async function loadPersistedData() {
  let scholarships = [];
  let drafts = [];
  let applications = [];

  try {
    const res = await fetch(`${API_BASE}/api/data`);
    if (!res.ok) throw new Error("Status " + res.status);
    const data = await res.json();

    scholarships = Array.isArray(data.scholarships) ? data.scholarships : [];
    drafts = Array.isArray(data.drafts) ? data.drafts : [];
    applications = Array.isArray(data.applications) ? data.applications : [];

    // Cache local copy for offline/Live Server fallback
    try {
      localStorage.setItem("nexo_scholarships", JSON.stringify(scholarships));
      localStorage.setItem("nexo_drafts", JSON.stringify(drafts));
      localStorage.setItem("nexo_applications", JSON.stringify(applications));
    } catch (_) {}
  } catch (err) {
    console.warn(
      "NEXO: Backend /api/data not reached, using local storage cache:",
      err,
    );
    try {
      const cachedSchols = localStorage.getItem("nexo_scholarships");
      const cachedDrafts = localStorage.getItem("nexo_drafts");
      const cachedApps = localStorage.getItem("nexo_applications");
      if (cachedSchols) scholarships = JSON.parse(cachedSchols);
      if (cachedDrafts) drafts = JSON.parse(cachedDrafts);
      if (cachedApps) applications = JSON.parse(cachedApps);
    } catch (_) {}
  }

  const currentProviderEmail = (
    sessionStorage.getItem("nexo-provider-email") ||
    localStorage.getItem("nexo-provider-email") ||
    ""
  ).toLowerCase();

  const myDrafts = currentProviderEmail
    ? drafts.filter(
        (d) =>
          !d.providerEmail ||
          d.providerEmail.toLowerCase() === currentProviderEmail,
      )
    : drafts;

  updateStatsUI(
    scholarships.length,
    scholarships.length,
    myDrafts.length,
    applications.length,
  );

  // Synchronize local cache with accurate live counts
  if (Array.isArray(scholarships) && Array.isArray(applications)) {
    scholarships.forEach((s) => {
      const liveCount = applications.filter(
        (a) =>
          (a.scholarshipId &&
            s.id &&
            String(a.scholarshipId) === String(s.id)) ||
          (s.title && (a.scholarshipTitle === s.title || a.title === s.title)),
      ).length;
      const limit =
        parseInt(s.applicantLimit || s.maxApplicants || 200, 10) || 200;
      s.applicantTotal = liveCount;
      s.applicantLimit = limit;
      s.maxApplicants = limit;
      s.applicantCount = `${liveCount} / ${limit} Applicants`;
    });
    try {
      localStorage.setItem("nexo_scholarships", JSON.stringify(scholarships));
    } catch (_) {}
  }

  // Populate Scholarships Feed
  const feed = document.getElementById("scholarships-feed");
  const allFeed = document.getElementById("all-scholarships-feed");
  const emptyState = document.getElementById("empty-state-card");
  const viewAllBtn = document.getElementById("view-all-btn");

  if (feed) {
    const scholSig = JSON.stringify(
      scholarships.map((s) => ({
        id: s.id,
        title: s.title,
        applicants: s.applicantCount,
        status: s.status,
      }))
    );

    if (window._lastScholSig !== scholSig) {
      window._lastScholSig = scholSig;
      feed.innerHTML = "";
      if (allFeed) allFeed.innerHTML = "";

      if (scholarships.length > 0) {
        if (emptyState) emptyState.style.display = "none";
        scholarships.forEach((schol, idx) => {
          if (idx < 3) {
            feed.appendChild(createCompactCard(schol, applications));
          }
          if (allFeed) {
            allFeed.appendChild(createCompactCard(schol, applications));
          }
        });
        if (viewAllBtn) {
          viewAllBtn.style.display =
            scholarships.length > 3 ? "inline-block" : "none";
        }
      } else {
        if (emptyState) emptyState.style.display = "block";
        if (viewAllBtn) viewAllBtn.style.display = "none";
      }
    }
  }

  // Populate Drafts Feed (anti-flicker diffing)
  const draftsFeed = document.getElementById("drafts-feed");
  const emptyDraftsCard = document.getElementById("empty-drafts-card");

  if (draftsFeed) {
    const draftsSig = JSON.stringify(
      myDrafts.map((d) => ({
        id: d.id,
        title: d.title,
        desc: d.desc,
        date: d.date,
        type: d.type,
      }))
    );

    if (window._lastDraftsSig !== draftsSig) {
      window._lastDraftsSig = draftsSig;
      draftsFeed.innerHTML = "";
      if (myDrafts.length > 0) {
        if (emptyDraftsCard)
          emptyDraftsCard.setAttribute("style", "display: none !important;");
        myDrafts.forEach((draft) => {
          draftsFeed.appendChild(createDraftCard(draft));
        });
      } else {
        if (emptyDraftsCard) emptyDraftsCard.removeAttribute("style");
      }
    }
  }
}

// =========================================
// 8. PUBLISH AND DRAFT SUBMISSION LOGIC
// =========================================
function initPublishAndDraft() {
  const publishBtn = document.getElementById("publish-btn");
  const draftBtn = document.getElementById("draft-btn");

  // --- PUBLISH BUTTON LOGIC ---
  if (publishBtn) {
    publishBtn.addEventListener("click", function () {
      if (!validateStep3()) return;

      const btn = this;
      const originalText = btn.textContent;
      btn.textContent = "Publishing...";
      btn.disabled = true;
      btn.style.opacity = "0.7";
      btn.style.cursor = "not-allowed";

      setTimeout(async () => {
        const title = DOM.nameInput ? DOM.nameInput.value.trim() : "";
        const desc = DOM.descInput ? DOM.descInput.value.trim() : "";
        const typeSelectedText = DOM.typeSelected
          ? DOM.typeSelected.querySelector("span").textContent
          : "";
        const typeVal = DOM.typeInput ? DOM.typeInput.value : "";
        let formattedDate = "No Deadline";

        if (DOM.dateInput && DOM.dateInput.value) {
          const dateObj = new Date(DOM.dateInput.value);
          formattedDate = dateObj.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
        }

        const collectedRequirements = getCollectedRequirements();
        const draftIdToDelete = currentEditingDraftId;
        const providerName =
          localStorage.getItem("nexo-provider-name") || "NEXO";
        const providerLogo = localStorage.getItem("nexo-provider-logo") || "";
        const providerBanner =
          localStorage.getItem("nexo-provider-banner") ||
          "";
        const applicantLimit =
          DOM.limitInput && DOM.limitInput.value
            ? parseInt(DOM.limitInput.value, 10)
            : 200;
        const now = new Date();
        const formattedPostedDate = now.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });

        const payload = {
          title,
          desc,
          type: typeVal,
          typeText: typeSelectedText,
          deadline: DOM.dateInput ? DOM.dateInput.value : "",
          formattedDate,
          postedAt: now.toISOString(),
          formattedPostedDate,
          applicantLimit,
          maxApplicants: applicantLimit,
          applicantTotal: 0,
          applicantCount: `0 / ${applicantLimit} Applicants`,
          requirements: collectedRequirements,
          providerName,
          providerLogo,
          providerBanner,
          status: "Open",
          draftId: draftIdToDelete,
        };

        let newSchol = { id: "schol_" + Date.now(), ...payload };

        try {
          const res = await fetch(`${API_BASE}/api/scholarships`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            newSchol = await res.json();
          }
        } catch (e) {
          console.warn("Could not save to data.json directly via server:", e);
        }

        // Keep local cache in sync
        try {
          const cached = JSON.parse(
            localStorage.getItem("nexo_scholarships") || "[]",
          );
          cached.unshift(newSchol);
          localStorage.setItem("nexo_scholarships", JSON.stringify(cached));
          if (draftIdToDelete) {
            const cachedDrafts = JSON.parse(
              localStorage.getItem("nexo_drafts") || "[]",
            );
            const filteredDrafts = cachedDrafts.filter(
              (d) => String(d.id) !== String(draftIdToDelete),
            );
            localStorage.setItem("nexo_drafts", JSON.stringify(filteredDrafts));
          }
        } catch (_) {}

        // Dispatch live student notification for offline/local resilience
        try {
          const cachedNotifs = JSON.parse(
            localStorage.getItem("nexo_notifications") || "[]",
          );
          const limitDisplay =
            newSchol.applicantLimit || newSchol.maxApplicants || 200;
          cachedNotifs.unshift({
            id: "notif_" + Date.now(),
            recipient: "student",
            title: "New Scholarship Available",
            message: `"${newSchol.title}" is now open for applications. Capacity: ${limitDisplay} slots.`,
            timestamp: new Date().toISOString(),
            formattedTime: "Just now",
            read: false,
            link: "student-browse.html",
            scholId: newSchol.id,
          });
          localStorage.setItem(
            "nexo_notifications",
            JSON.stringify(cachedNotifs),
          );

          window.dispatchEvent(new CustomEvent("nexo:notification"));
        } catch (_) {}

        // If we just published a draft, remove the old draft from UI
        if (currentEditingDraftCard) {
          currentEditingDraftCard.remove();
          draftCount = Math.max(0, draftCount - 1);
          const draftBadge = document.getElementById("draft-badge");
          if (draftBadge) {
            draftBadge.textContent = draftCount;
            if (draftCount <= 0) {
              draftBadge.style.display = "none";
              const emptyDraftsCard =
                document.getElementById("empty-drafts-card");
              if (emptyDraftsCard) emptyDraftsCard.removeAttribute("style");
            }
          }
          currentEditingDraftCard = null;
          currentEditingDraftId = null;
        }

        // Hide main home feed empty state
        const emptyState = document.getElementById("empty-state-card");
        if (emptyState) emptyState.style.display = "none";

        totalScholarships++;
        ongoingScholarships++;
        const statTotal = document.getElementById("stat-total");
        const statOngoing = document.getElementById("stat-ongoing");
        if (statTotal) statTotal.textContent = totalScholarships;
        if (statOngoing) statOngoing.textContent = ongoingScholarships;

        const feed = document.getElementById("scholarships-feed");
        const allFeed = document.getElementById("all-scholarships-feed");

        if (feed) {
          feed.prepend(createCompactCard(newSchol));
          if (allFeed) allFeed.prepend(createCompactCard(newSchol));

          while (feed.children.length > 3) {
            feed.removeChild(feed.lastChild);
          }

          const viewAllBtn = document.getElementById("view-all-btn");
          if (viewAllBtn && ongoingScholarships > 3) {
            viewAllBtn.style.display = "inline-block";
          }
        }

        if (DOM.creationModal) {
          DOM.creationModal.classList.remove("active");
          DOM.creationModal.setAttribute("aria-hidden", "true");
        }
        document.body.style.overflow = "auto";

        setTimeout(() => {
          goToStep(1, false);
          const step1Form = document.getElementById("step-1-form");
          if (step1Form) step1Form.reset();

          const dropdownHidden = document.getElementById("schol-type");
          if (DOM.typeSelected && dropdownHidden) {
            DOM.typeSelected.querySelector("span").textContent = "Select type";
            DOM.typeSelected.classList.remove("has-value");
            dropdownHidden.value = "";
          }

          if (DOM.confirmCheck) DOM.confirmCheck.checked = false;

          btn.textContent = originalText;
          btn.disabled = false;
          btn.style.opacity = "1";
          btn.style.cursor = "pointer";
        }, 400);
      }, 1000);
    });
  }

  // --- SAVE AS DRAFT BUTTON LOGIC ---
  if (draftBtn) {
    draftBtn.addEventListener("click", function () {
      const btn = this;
      const originalText = btn.textContent;
      btn.textContent = "Saving...";
      btn.disabled = true;
      btn.style.opacity = "0.7";

      setTimeout(async () => {
        const titleInput = DOM.nameInput ? DOM.nameInput.value.trim() : "";
        const descInput = DOM.descInput ? DOM.descInput.value.trim() : "";
        const draftTitle = titleInput || "Untitled Scholarship";
        const draftDesc = descInput || "No description provided yet...";
        const typeVal = DOM.typeInput ? DOM.typeInput.value : "";
        const dateVal = DOM.dateInput ? DOM.dateInput.value : "";
        const collectedRequirements = getCollectedRequirements();

        const providerEmail = (
          sessionStorage.getItem("nexo-provider-email") ||
          localStorage.getItem("nexo-provider-email") ||
          ""
        ).toLowerCase();

        const draftPayload = {
          id: currentEditingDraftId || "draft_" + Date.now(),
          title: draftTitle,
          desc: draftDesc,
          type: typeVal,
          date: dateVal,
          providerEmail,
          applicantLimit: DOM.limitInput
            ? parseInt(DOM.limitInput.value, 10) || 200
            : 200,
          requirements: collectedRequirements,
        };

        let savedDraft = draftPayload;

        try {
          const res = await fetch(`${API_BASE}/api/drafts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(draftPayload),
          });
          if (res.ok) {
            savedDraft = await res.json();
          }
        } catch (e) {
          console.warn(
            "Could not save draft to data.json directly via server:",
            e,
          );
        }

        // Keep local cache in sync
        try {
          const cachedDrafts = JSON.parse(
            localStorage.getItem("nexo_drafts") || "[]",
          );
          const idx = cachedDrafts.findIndex(
            (d) => String(d.id) === String(savedDraft.id),
          );
          if (idx >= 0) cachedDrafts[idx] = savedDraft;
          else cachedDrafts.unshift(savedDraft);
          localStorage.setItem("nexo_drafts", JSON.stringify(cachedDrafts));
        } catch (_) {}

        // If updating, delete the old draft from UI first
        if (currentEditingDraftCard) {
          currentEditingDraftCard.remove();
          draftCount = Math.max(0, draftCount - 1);
          currentEditingDraftCard = null;
          currentEditingDraftId = null;
        }

        // Hide empty drafts state card
        const emptyDraftsCard = document.getElementById("empty-drafts-card");
        if (emptyDraftsCard) {
          emptyDraftsCard.setAttribute("style", "display: none !important;");
        }

        const draftsFeed = document.getElementById("drafts-feed");
        if (draftsFeed) {
          window._lastDraftsSig = null;
          draftsFeed.prepend(createDraftCard(savedDraft));
        }

        draftCount++;
        const draftBadge = document.getElementById("draft-badge");
        if (draftBadge) {
          draftBadge.textContent = draftCount;
          draftBadge.style.display = "inline-block";
        }

        // Close modal and reset
        if (DOM.creationModal) DOM.creationModal.classList.remove("active");
        document.body.style.overflow = "auto";

        setTimeout(() => {
          goToStep(1, false);
          const step1Form = document.getElementById("step-1-form");
          if (step1Form) step1Form.reset();

          btn.textContent = originalText;
          btn.disabled = false;
          btn.style.opacity = "1";
        }, 400);
      }, 800);
    });
  }
}

// =========================================
// 8. MODAL CANCELLATION & WARNING LOGIC
// =========================================
function initModalCancellation() {
  const cancelConfirmModal = document.getElementById("cancel-confirm-modal");
  const stayEditingBtn = document.getElementById("stay-editing-btn");
  const confirmDiscardBtn = document.getElementById("confirm-discard-btn");
  const step1CancelBtn = document.getElementById("cancel-creation-btn-1");
  const creationModal = document.getElementById("create-scholarship-modal");
  // Only target close buttons strictly inside create-scholarship-modal
  const xCloseBtns = creationModal
    ? creationModal.querySelectorAll(".close-modal-btn, .close-btn")
    : [];

  function triggerCancelWarning() {
    if (cancelConfirmModal) {
      cancelConfirmModal.style.display = "flex";
      setTimeout(() => (cancelConfirmModal.style.opacity = "1"), 10);
    }
  }

  if (step1CancelBtn)
    step1CancelBtn.addEventListener("click", triggerCancelWarning);
  xCloseBtns.forEach((btn) =>
    btn.addEventListener("click", triggerCancelWarning),
  );

  if (stayEditingBtn) {
    stayEditingBtn.addEventListener("click", () => {
      cancelConfirmModal.style.opacity = "0";
      setTimeout(() => (cancelConfirmModal.style.display = "none"), 200);
    });
  }

  if (confirmDiscardBtn) {
    confirmDiscardBtn.addEventListener("click", () => {
      cancelConfirmModal.style.opacity = "0";
      setTimeout(() => (cancelConfirmModal.style.display = "none"), 200);

      currentEditingDraftCard = null;

      if (DOM.creationModal) {
        DOM.creationModal.classList.remove("active");
        DOM.creationModal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "auto";
      }

      setTimeout(() => {
        goToStep(1, false);
        const step1Form = document.getElementById("step-1-form");
        if (step1Form) step1Form.reset();

        const dropdownHidden = document.getElementById("schol-type");
        if (DOM.typeSelected && dropdownHidden) {
          DOM.typeSelected.querySelector("span").textContent = "Select type";
          DOM.typeSelected.classList.remove("has-value");
          dropdownHidden.value = "";
        }

        if (DOM.confirmCheck) DOM.confirmCheck.checked = false;
      }, 400);
    });
  }
}

// =========================================
// REAL-TIME PROVIDER PROFILE & BRANDING SYNC
// =========================================
function extractInitials(name) {
  if (!name || !name.trim()) return "NX";
  const clean = name.trim();
  if (clean.toUpperCase().startsWith("NEXO")) {
    return "NX";
  }
  const parts = clean.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].length > 1
      ? parts[0].substring(0, 2).toUpperCase()
      : parts[0].toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

async function initDynamicAvatar() {
  await syncProviderProfile();

  // Real-time synchronization across browser tabs/storage
  window.addEventListener("storage", (e) => {
    if (e.key === "nexo_provider_settings" && e.newValue) {
      try {
        syncProviderProfile(JSON.parse(e.newValue));
      } catch (_) {}
    } else if (
      e.key === "nexo-provider-name" ||
      e.key === "nexo-provider-logo"
    ) {
      syncProviderProfile();
    }
  });

  // Re-sync on page navigation / back button
  window.addEventListener("pageshow", () => {
    syncProviderProfile();
  });
}

async function syncProviderProfile(incomingSettings = null) {
  let settings = incomingSettings;

  if (!settings) {
    try {
      const cached = localStorage.getItem("nexo_provider_settings");
      if (cached) settings = JSON.parse(cached);
    } catch (_) {}
  }

  if (!settings) {
    try {
      const res = await fetch(`${API_BASE}/api/settings`);
      if (res.ok) {
        settings = await res.json();
        try {
          localStorage.setItem(
            "nexo_provider_settings",
            JSON.stringify(settings),
          );
        } catch (_) {}
      }
    } catch (_) {}
  }

  const orgName =
    (settings && settings.orgName) ||
    localStorage.getItem("nexo-provider-name") ||
    "NEXO";
  const logoImage =
    (settings && settings.logoImage) ||
    localStorage.getItem("nexo-provider-logo") ||
    "";
  const bannerImage =
    (settings && settings.bannerImage) ||
    localStorage.getItem("nexo-provider-banner") ||
    "";
  const initials = extractInitials(orgName);

  // 1. Update Welcome Title
  const welcomeTitle =
    document.getElementById("dash-welcome-title") ||
    document.querySelector(".welcome-title");
  if (welcomeTitle) {
    welcomeTitle.textContent = orgName;
  }

  // 2. Update Header Avatar Circle
  const headerAvatar = document.querySelector(".logo-container .avatar-btn");
  if (headerAvatar) {
    if (logoImage) {
      headerAvatar.innerHTML = `<img src="${logoImage}" alt="Logo">`;
      headerAvatar.classList.add("has-img");
    } else {
      headerAvatar.textContent = initials;
      headerAvatar.classList.remove("has-img");
    }
  }

  // 3. Update Welcome Section Avatar
  const welcomeAvatarWrapper = document.getElementById(
    "welcome-avatar-wrapper",
  );
  const welcomeAvatarImg = document.getElementById("welcome-avatar-img");
  const welcomeAvatarInits = document.getElementById("welcome-avatar-initials");
  if (welcomeAvatarImg && welcomeAvatarInits) {
    if (logoImage) {
      welcomeAvatarImg.src = logoImage;
      welcomeAvatarImg.classList.add("has-img");
      if (welcomeAvatarWrapper) welcomeAvatarWrapper.classList.add("has-img");
      welcomeAvatarInits.style.display = "none";
    } else {
      welcomeAvatarImg.src = "";
      welcomeAvatarImg.classList.remove("has-img");
      if (welcomeAvatarWrapper)
        welcomeAvatarWrapper.classList.remove("has-img");
      welcomeAvatarInits.textContent = initials;
      welcomeAvatarInits.style.display = "block";
    }
  }

  // 4. Update Cover Photo Banner with Soft Bottom Fade
  const coverBanner = document.getElementById("dash-cover-banner");
  const coverPhoto = document.getElementById("dash-cover-photo");
  if (coverBanner && coverPhoto) {
    if (bannerImage) {
      coverPhoto.src = bannerImage;
      coverPhoto.classList.add("has-img");
      coverBanner.classList.add("active");
    } else {
      coverPhoto.src = "";
      coverPhoto.classList.remove("has-img");
      coverBanner.classList.remove("active");
    }
  }
}

// =========================================
// 9. CONTINUE EDITING & DELETE DRAFTS LOGIC
// =========================================
function initDraftEditing() {
  const draftsFeed = document.getElementById("drafts-feed");
  if (!draftsFeed) return;

  draftsFeed.addEventListener("click", (e) => {
    // --- 1. HANDLE "CONTINUE EDITING" ---
    const continueBtn = e.target.closest(".continue-edit-btn");
    if (continueBtn) {
      currentEditingDraftCard = continueBtn.closest(".draft-card");
      currentEditingDraftId =
        continueBtn.dataset.id ||
        (currentEditingDraftCard ? currentEditingDraftCard.dataset.id : null);

      const draftBtn = document.getElementById("draft-btn");
      if (draftBtn) draftBtn.textContent = "Update Draft";

      // Populate form fields with saved data
      if (DOM.nameInput) DOM.nameInput.value = continueBtn.dataset.title || "";
      if (DOM.descInput) DOM.descInput.value = continueBtn.dataset.desc || "";
      if (DOM.dateInput) DOM.dateInput.value = continueBtn.dataset.date || "";
      if (DOM.limitInput)
        DOM.limitInput.value = continueBtn.dataset.limit || 200;

      // Update custom dropdown UI
      if (DOM.typeInput && DOM.typeSelected) {
        DOM.typeInput.value = continueBtn.dataset.type || "";
        const typeSpan = DOM.typeSelected.querySelector("span");

        if (continueBtn.dataset.type) {
          const option = document.querySelector(
            `#schol-type-options li[data-value="${continueBtn.dataset.type}"]`,
          );
          if (option) {
            typeSpan.textContent = option.textContent;
            DOM.typeSelected.classList.add("has-value");
          }
        } else {
          typeSpan.textContent = "Select type";
          DOM.typeSelected.classList.remove("has-value");
        }
      }

      // Restore custom requirements if present
      if (continueBtn.dataset.requirements && DOM.reqList) {
        try {
          const reqs = JSON.parse(continueBtn.dataset.requirements);
          if (Array.isArray(reqs) && reqs.length > 0) {
            DOM.reqList.innerHTML = "";
            reqs.forEach((r) => {
              const card = document.createElement("div");
              card.className = "req-card";
              card.innerHTML = `
                <div class="req-icon">
                  <img src="assets/i-icon.png" alt="Custom" style="width: 20px; filter: grayscale(100%); opacity: 0.7;">
                </div>
                <div class="req-text">
                  <h4>${escapeHtml(r.title)}</h4>
                  <p>${escapeHtml(r.desc)}</p>
                </div>
                <button type="button" class="remove-req-btn" aria-label="Remove">&times;</button>
              `;
              DOM.reqList.appendChild(card);
            });
          }
        } catch (err) {}
      }

      // Open Modal to Step 1
      if (DOM.creationModal) {
        DOM.creationModal.classList.add("active");
        DOM.creationModal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        goToStep(1, false);
      }
    }

    // --- 2. HANDLE "DELETE DRAFT" (TRASH ICON) ---
    const deleteBtn = e.target.closest(".delete-draft-btn");
    if (deleteBtn) {
      const card = deleteBtn.closest(".draft-card");
      if (card) {
        const editBtn = card.querySelector(".continue-edit-btn");
        const draftId = (editBtn && editBtn.dataset.id) || card.dataset.id;

        if (draftId) {
          fetch(`${API_BASE}/api/drafts/${draftId}`, {
            method: "DELETE",
          }).catch(console.error);
          try {
            const cachedDrafts = JSON.parse(
              localStorage.getItem("nexo_drafts") || "[]",
            );
            const filtered = cachedDrafts.filter(
              (d) => String(d.id) !== String(draftId),
            );
            localStorage.setItem("nexo_drafts", JSON.stringify(filtered));
          } catch (_) {}
        }

        card.style.transition = "opacity 0.3s ease, transform 0.3s ease";
        card.style.opacity = "0";
        card.style.transform = "scale(0.95)";

        setTimeout(() => {
          card.remove();
          draftCount = Math.max(0, draftCount - 1);
          window._lastDraftsSig = null;

          const draftBadge = document.getElementById("draft-badge");
          if (draftBadge) {
            draftBadge.textContent = draftCount;
            if (draftCount <= 0) {
              draftBadge.style.display = "none";
              // Bring the empty state card back when there are 0 drafts
              const emptyDraftsCard =
                document.getElementById("empty-drafts-card");
              if (emptyDraftsCard) {
                emptyDraftsCard.removeAttribute("style");
              }
            }
          }
        }, 300);
      }
    }
  });
}

// ==========================================
// DASHBOARD MASTER STARTUP LOGIC
// ==========================================
function initDashboardStartup() {
  // ----------------------------------------
  // 1. URL PARAMETER NAVIGATION (AUTO-OPEN DRAFTS)
  // ----------------------------------------
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("view") === "drafts") {
    if (typeof window.showDraftsView === "function") {
      window.showDraftsView();
    } else {
      setTimeout(() => {
        if (typeof window.showDraftsView === "function") {
          window.showDraftsView();
        }
      }, 50);
    }
  }

  // ----------------------------------------
  // 2. SMART DATE INPUT MASK & VALIDATION
  // ----------------------------------------
  const dateInput = document.getElementById("schol-deadline");
  const dateError = document.getElementById("error-schol-deadline");

  if (dateInput) {
    // Real-time typing formatter
    dateInput.addEventListener("input", function (e) {
      let cleaned = e.target.value.replace(/\D/g, "");

      let month = cleaned.substring(0, 2);
      let day = cleaned.substring(2, 4);
      let year = cleaned.substring(4, 8);

      if (month.length === 2) {
        if (parseInt(month) > 12) month = "12";
        if (month === "00") month = "01";
      }
      if (month.length === 1 && parseInt(month) > 1) month = "0" + month;

      if (day.length === 2) {
        if (parseInt(day) > 31) day = "31";
        if (day === "00") day = "01";
      }
      if (day.length === 1 && parseInt(day) > 3) day = "0" + day;

      let formatted = month;
      if (cleaned.length >= 3) formatted += "/" + day;
      if (cleaned.length >= 5) formatted += "/" + year;

      e.target.value = formatted;
      if (dateError) dateError.textContent = "";
    });

    // Final check on blur (tap away)
    dateInput.addEventListener("blur", function (e) {
      let val = e.target.value;
      if (val.length > 0 && val.length < 10) {
        if (dateError)
          dateError.textContent = "Please enter a complete date (MM/DD/YYYY).";
      } else if (val.length === 10) {
        let year = parseInt(val.substring(6, 10));
        let currentYear = new Date().getFullYear();
        if (year < currentYear) {
          if (dateError)
            dateError.textContent = "The deadline year cannot be in the past.";
        }
      }
    });
  }

  // ----------------------------------------
  // 3. CALENDAR ICON SYNC LOGIC
  // ----------------------------------------
  const nativeDatePicker = document.getElementById("native-date-picker");

  // We reuse the 'dateInput' and 'dateError' variables we already found in step 2!
  if (nativeDatePicker && dateInput) {
    nativeDatePicker.addEventListener("change", function (e) {
      const selectedDate = e.target.value;

      if (selectedDate) {
        const parts = selectedDate.split("-");
        const formatted = `${parts[1]}/${parts[2]}/${parts[0]}`;

        dateInput.value = formatted;
        if (dateError) dateError.textContent = "";
      }
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDashboardStartup);
} else {
  initDashboardStartup();
}
