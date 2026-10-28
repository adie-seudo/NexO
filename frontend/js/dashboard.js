// =========================================
// TEMPORARY STATE TRACKERS
// =========================================
let totalScholarships = 0;
let ongoingScholarships = 0;
let draftCount = 0;
let currentEditingDraftCard = null; // <-- ADD THIS: Tracks if we are updating a draft

// =========================================
// CACHED DOM ELEMENTS (Boosts Performance)
// =========================================
const DOM = {};

// =========================================
// MASTER INITIALIZATION
// =========================================
document.addEventListener("DOMContentLoaded", () => {
  cacheDOM();
  initDashboardModals();
  initCustomDropdown();
  initStepNavigation();
  initCustomRequirements();
  initViewSwitching();
  initPublishAndDraft();
  initModalCancellation();
  initDraftEditing(); // <-- Add this line right here
});

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

        // ADD THESE 3 LINES: Clear tracker and reset button text
        currentEditingDraftCard = null;
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

    if (selectedDate <= today) {
      DOM.dateError.textContent = "Deadline must be a future date.";
      DOM.dateError.classList.add("active");
      DOM.dateInput.classList.add("input-error");
      isValid = false;
    } else {
      DOM.dateError.classList.remove("active");
      DOM.dateInput.classList.remove("input-error");
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
    if (dashWelcome) dashWelcome.style.display = "block";
    if (dashStats) dashStats.style.display = "flex";
    if (dashRecent) dashRecent.style.display = "block";
    if (dashActions) dashActions.style.display = "block";
    if (dashDraftsSection) dashDraftsSection.style.display = "none";
    if (dashAllScholSection) dashAllScholSection.style.display = "none";

    if (navHome) navHome.classList.add("active");
    if (navDrafts) navDrafts.classList.remove("active");
  }

  if (navDrafts) {
    navDrafts.addEventListener("click", (e) => {
      e.preventDefault();
      if (dashWelcome) dashWelcome.style.display = "none";
      if (dashStats) dashStats.style.display = "none";
      if (dashRecent) dashRecent.style.display = "none";
      if (dashActions) dashActions.style.display = "none";
      if (dashDraftsSection) dashDraftsSection.style.display = "block";
      if (dashAllScholSection) dashAllScholSection.style.display = "none";

      navDrafts.classList.add("active");
      if (navHome) navHome.classList.remove("active");
    });
  }

  if (navHome) {
    navHome.addEventListener("click", (e) => {
      e.preventDefault();
      showHome();
    });
  }

  // When "View All" is clicked
  if (viewAllBtn) {
    viewAllBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (dashWelcome) dashWelcome.style.display = "none";
      if (dashStats) dashStats.style.display = "none";
      if (dashRecent) dashRecent.style.display = "none";
      if (dashActions) dashActions.style.display = "none";
      if (dashDraftsSection) dashDraftsSection.style.display = "none";
      if (dashAllScholSection) dashAllScholSection.style.display = "block";
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
// 7. PUBLISH AND DRAFT SUBMISSION LOGIC
// =========================================
function initPublishAndDraft() {
  const publishBtn = document.getElementById("publish-btn");
  const draftBtn = document.getElementById("draft-btn");

  // --- PUBLISH BUTTON LOGIC ---
  if (publishBtn) {
    publishBtn.addEventListener("click", function () {
      if (!validateStep3()) return;

      const originalText = this.textContent;
      this.textContent = "Publishing...";
      this.disabled = true;
      this.style.opacity = "0.7";
      this.style.cursor = "not-allowed";

      setTimeout(() => {
        const title = DOM.nameInput ? DOM.nameInput.value : "";
        const desc = DOM.descInput ? DOM.descInput.value : "";
        const typeSelectedText = DOM.typeSelected
          ? DOM.typeSelected.querySelector("span").textContent
          : "";
        let formattedDate = "No Deadline";

        if (DOM.dateInput && DOM.dateInput.value) {
          const dateObj = new Date(DOM.dateInput.value);
          formattedDate = dateObj.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
        }

        // If we just published a draft, remove the old draft from the feed
        if (currentEditingDraftCard) {
          currentEditingDraftCard.remove();
          draftCount--;
          const draftBadge = document.getElementById("draft-badge");
          if (draftBadge) {
            draftBadge.textContent = draftCount;
            if (draftCount <= 0) {
              draftBadge.style.display = "none";

              // THIS IS THE FIX: Bring empty drafts card back if no drafts remain
              const emptyDraftsCard =
                document.getElementById("empty-drafts-card");
              if (emptyDraftsCard) {
                emptyDraftsCard.removeAttribute("style");
              }
            }
          }
          currentEditingDraftCard = null;
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
        const allFeed = document.getElementById("all-scholarships-feed"); // Grab the new feed

        if (feed) {
          const newPost = document.createElement("div");
          newPost.className = "temp-post-card";
          newPost.innerHTML = `
              <h3>${title}</h3>
              <div class="temp-post-tags">
                <span class="review-pill" style="background-color: #8b5cf6; color: white;">Admin</span>
                <span class="review-pill" style="background-color: #f3f4f6; color: #4b5563;">${typeSelectedText}</span>
              </div>
              <p class="temp-post-desc">${desc}</p>
              <p class="temp-post-date" style="display: flex; align-items: center;">
                <img src="assets/calendar-icon.png" alt="Date" style="width: 14px; margin-right: 6px; filter: grayscale(100%);" />
                Deadline: ${formattedDate}
              </p>
            `;

          feed.prepend(newPost);

          // 1. Clone the post into the unlimited "All Scholarships" feed
          if (allFeed) {
            allFeed.prepend(newPost.cloneNode(true));
          }

          // 2. Force the main dashboard feed to NEVER exceed 3 posts
          while (feed.children.length > 3) {
            feed.removeChild(feed.lastChild);
          }

          // 3. Reveal the "View All" button if there are more than 3 posts!
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

          this.textContent = originalText;
          this.disabled = false;
          this.style.opacity = "1";
          this.style.cursor = "pointer";
        }, 400);
      }, 1500);
    });
  }

  // --- SAVE AS DRAFT BUTTON LOGIC ---
  if (draftBtn) {
    draftBtn.addEventListener("click", function () {
      const originalText = this.textContent;
      this.textContent = "Saving...";
      this.disabled = true;
      this.style.opacity = "0.7";

      setTimeout(() => {
        const titleInput = DOM.nameInput ? DOM.nameInput.value.trim() : "";
        const descInput = DOM.descInput ? DOM.descInput.value.trim() : "";
        const draftTitle = titleInput || "Untitled Scholarship";
        const draftDesc = descInput || "No description provided yet...";

        // If updating, delete the old draft first so it doesn't duplicate
        if (currentEditingDraftCard) {
          currentEditingDraftCard.remove();
          draftCount--;
          currentEditingDraftCard = null;
        }

        // 1. FORCE HIDE the empty state card (Bulletproof injection method)
        const emptyDraftsCard = document.getElementById("empty-drafts-card");
        if (emptyDraftsCard) {
          emptyDraftsCard.setAttribute("style", "display: none !important;");
        }

        // 2. Add the draft to the feed
        const draftsFeed = document.getElementById("drafts-feed");
        if (draftsFeed) {
          const typeVal = DOM.typeInput ? DOM.typeInput.value : "";
          const dateVal = DOM.dateInput ? DOM.dateInput.value : "";

          const newDraft = document.createElement("div");
          newDraft.className = "draft-card";
          newDraft.innerHTML = `
              <span class="draft-badge-tag">Draft</span>
              <h3 style="margin-top: 12px; margin-bottom: 8px;">${draftTitle}</h3>
              <p style="font-size: 14px; margin-bottom: 12px; opacity: 0.9;">${draftDesc}</p>
              
              <!-- Container with align-items: center -->
              <div style="display: flex; gap: 8px; margin-top: 16px; align-items: center;">
                <button type="button" class="btn btn-primary continue-edit-btn" style="flex: 1; border-radius: 20px; padding: 10px 16px; margin: 0;">
                  Continue Editing
                </button>
                <button type="button" class="delete-draft-btn" style="width: 40px; height: 40px; margin: 0; padding: 0; border: none; color: #ef4444; background: transparent; display: flex; align-items: center; justify-content: center; cursor: pointer;" aria-label="Delete Draft">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
              </div>
            `;

          // Attach the saved data securely to the button
          const editBtn = newDraft.querySelector(".continue-edit-btn");
          editBtn.dataset.title = titleInput;
          editBtn.dataset.desc = descInput;
          editBtn.dataset.type = typeVal;
          editBtn.dataset.date = dateVal;

          draftsFeed.prepend(newDraft);
        }

        // 3. Update the badge counter
        draftCount++;
        const draftBadge = document.getElementById("draft-badge");
        if (draftBadge) {
          draftBadge.textContent = draftCount;
          draftBadge.style.display = "inline-block";
        }

        // 4. Close modal and reset
        if (DOM.creationModal) DOM.creationModal.classList.remove("active");
        document.body.style.overflow = "auto";

        setTimeout(() => {
          goToStep(1, false);
          const step1Form = document.getElementById("step-1-form");
          if (step1Form) step1Form.reset();

          this.textContent = originalText;
          this.disabled = false;
          this.style.opacity = "1";
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
  const xCloseBtns = document.querySelectorAll(".close-modal-btn, .close-btn");

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
// DYNAMIC AVATAR INITIALS GENERATOR
// =========================================
function initDynamicAvatar() {
  // 1. Find the avatar circle in the header
  const avatarBtn = document.querySelector(".logo-container .avatar-btn");
  if (!avatarBtn) return;

  // 2. Find the user's name (reads from the welcome title on the dashboard)
  const welcomeTitle = document.querySelector(".welcome-title");
  let accountName = "User";

  if (welcomeTitle && welcomeTitle.textContent.trim()) {
    accountName = welcomeTitle.textContent.trim();
  } else if (localStorage.getItem("nexo-provider-name")) {
    // Fallback if you save the name to storage during registration
    accountName = localStorage.getItem("nexo-provider-name");
  }

  // 3. Smart Initial Extraction
  let initials = "";
  const nameParts = accountName.trim().split(/\s+/); // Splits by spaces

  if (nameParts.length === 1) {
    // If it's a single word (like "NEXO"), take the first and last letter, or first two
    const word = nameParts[0].toUpperCase();
    if (word === "NEXO") {
      initials = "NX"; // Your specific request for Nexo!
    } else {
      initials = word.length > 1 ? word.substring(0, 2) : word;
    }
  } else if (nameParts.length >= 2) {
    // If multiple words (like "Juan Dela Cruz"), take first letter of first and last word
    const firstLetter = nameParts[0][0];
    const lastLetter = nameParts[nameParts.length - 1][0];
    initials = (firstLetter + lastLetter).toUpperCase();
  }

  // 4. Inject the initials into the HTML
  avatarBtn.textContent = initials;
}

// Make sure it runs when the dashboard loads
document.addEventListener("DOMContentLoaded", () => {
  initDynamicAvatar();
});

// =========================================
// DASHBOARD HAMBURGER DROPDOWN LOGIC
// =========================================
window.handleMenuToggle = function (e) {
  e.preventDefault();
  e.stopPropagation();

  const btn = document.getElementById("avatar-menu-btn");
  const menu = document.getElementById("nav-menu");

  if (btn && menu) {
    btn.classList.toggle("open");
    menu.classList.toggle("open");
  }
};

// Safe document listener to close it when clicking elsewhere
document.addEventListener("click", function (e) {
  const btn = document.getElementById("avatar-menu-btn");
  const menu = document.getElementById("nav-menu");

  if (btn && menu && !btn.contains(e.target) && !menu.contains(e.target)) {
    btn.classList.remove("open");
    menu.classList.remove("open");
  }
});

// =========================================
// 9. CONTINUE EDITING & DELETE DRAFTS LOGIC
// =========================================
function initDraftEditing() {
  const draftsFeed = document.getElementById("drafts-feed");
  if (!draftsFeed) return;

  draftsFeed.addEventListener("click", (e) => {
    // --- 1. HANDLE "CONTINUE EDITING" ---
    if (e.target.classList.contains("continue-edit-btn")) {
      const btn = e.target;

      // ADD THESE 3 LINES: Save the card reference and change button text
      currentEditingDraftCard = btn.closest(".draft-card");
      const draftBtn = document.getElementById("draft-btn");
      if (draftBtn) draftBtn.textContent = "Update Draft";

      // Populate the form fields with the saved data

      // Populate the form fields with the saved data
      if (DOM.nameInput) DOM.nameInput.value = btn.dataset.title || "";
      if (DOM.descInput) DOM.descInput.value = btn.dataset.desc || "";
      if (DOM.dateInput) DOM.dateInput.value = btn.dataset.date || "";

      // Update the custom dropdown UI
      if (DOM.typeInput && DOM.typeSelected) {
        DOM.typeInput.value = btn.dataset.type || "";
        const typeSpan = DOM.typeSelected.querySelector("span");

        if (btn.dataset.type) {
          const option = document.querySelector(
            `#schol-type-options li[data-value="${btn.dataset.type}"]`,
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

      // We NO LONGER delete the draft here. It stays safe if they cancel!

      // Open the Modal to Step 1
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
        card.style.transition = "opacity 0.3s ease, transform 0.3s ease";
        card.style.opacity = "0";
        card.style.transform = "scale(0.95)";

        setTimeout(() => {
          card.remove();
          draftCount--;

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
        }, 300); // Waits for the fade animation before removing
      }
    }
  });
}
