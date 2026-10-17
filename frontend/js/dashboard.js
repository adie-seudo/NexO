// Temporary State Trackers
let totalScholarships = 0;
let ongoingScholarships = 0;
let draftCount = 0;

// =========================================
// FIX: OPEN MODAL FROM MAIN DASHBOARD
// =========================================
document.addEventListener("DOMContentLoaded", () => {
  const mainCreateBtn = document.getElementById("open-create-modal");
  const creationModal = document.getElementById("create-scholarship-modal");

  if (!mainCreateBtn) {
    console.error(
      "Dashboard Error: Could not find the button with ID 'open-create-modal'",
    );
    return;
  }

  if (!creationModal) {
    console.error(
      "Dashboard Error: Could not find the modal with ID 'create-scholarship-modal'",
    );
    return;
  }

  mainCreateBtn.addEventListener("click", () => {
    creationModal.classList.add("active");
    creationModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    goToStep(1, false);
  });
});

document.addEventListener("DOMContentLoaded", () => {
  // Grab the trigger button, modal, and cancel buttons
  const openBtn = document.getElementById("open-create-modal");
  const creationModal = document.getElementById("create-scholarship-modal");

  if (openBtn && creationModal) {
    // Open Modal
    openBtn.addEventListener("click", (e) => {
      e.preventDefault();
      creationModal.classList.add("active");
      creationModal.setAttribute("aria-hidden", "false");

      // Stop the background dashboard from scrolling while creating a post
      document.body.style.overflow = "hidden";
    });

    // =========================================
    // CUSTOM DROPDOWN LOGIC
    // =========================================
    const dropdown = document.getElementById("schol-type-dropdown");
    const selected = document.getElementById("schol-type-selected");
    const options = document.getElementById("schol-type-options");
    const hiddenInput = document.getElementById("schol-type");

    if (dropdown && selected && options && hiddenInput) {
      const selectedText = selected.querySelector("span");

      // Toggle dropdown open/close
      selected.addEventListener("click", () => {
        dropdown.classList.toggle("active");
      });

      // Handle option click
      options.querySelectorAll("li").forEach((option) => {
        option.addEventListener("click", () => {
          selectedText.textContent = option.textContent; // Update text
          hiddenInput.value = option.getAttribute("data-value"); // Set hidden value
          selected.classList.add("has-value"); // Darken text color
          dropdown.classList.remove("active"); // Close menu
        });
      });

      // Close dropdown if clicking outside of it
      document.addEventListener("click", (e) => {
        if (!dropdown.contains(e.target)) {
          dropdown.classList.remove("active");
        }
      });
    }
  }
});

// =========================================
// SCHOLARSHIP CREATION MODAL LOGIC
// =========================================
const stepContainers = [
  document.getElementById("step-1-container"),
  document.getElementById("step-2-container"),
  document.getElementById("step-3-container"),
];

const progressBarFill = document.querySelector(".progress-bar-fill");
const progressText = document.querySelector(".progress-percentage");
const stepIndicators = document.querySelectorAll(".step");

/**
 * @param {number} stepNumber
 */
function goToStep(stepNumber = 1, isEdit = false) {
  // Populate Review Step before showing it
  if (stepNumber === 3 && !isEdit) {
    // 1. Populate Text Fields
    document.getElementById("review-title").textContent =
      document.getElementById("schol-name").value;
    document.getElementById("review-desc-text").textContent =
      document.getElementById("schol-desc").value;
    document.getElementById("review-type").textContent = "Admin";

    // Populate Scholarship Type Pill
    const typeSelectedText = document.querySelector(
      "#schol-type-selected span",
    ).textContent;
    const reviewCategoryPill = document.getElementById("review-category");
    if (reviewCategoryPill) reviewCategoryPill.textContent = typeSelectedText;

    // 2. Format and Populate Deadline
    const dateVal = document.getElementById("schol-deadline").value;
    if (dateVal) {
      const dateObj = new Date(dateVal);
      const options = { year: "numeric", month: "short", day: "numeric" };
      document.getElementById("review-date").textContent =
        dateObj.toLocaleDateString("en-US", options);
    }

    // 3. Populate Requirements List
    const reviewReqList = document.querySelector(".review-req-list");
    reviewReqList.innerHTML = ""; // Clear placeholders
    const currentReqs = document.querySelectorAll(
      "#requirements-list .req-card h4",
    );

    currentReqs.forEach((req) => {
      const li = document.createElement("li");
      li.textContent = req.textContent;
      reviewReqList.appendChild(li);
    });
  }

  // Hide all, show target step
  stepContainers.forEach((container) => container.classList.remove("active"));
  stepContainers[stepNumber - 1].classList.add("active");

  // Toggle Edit vs Normal Buttons based on how the user navigated
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

  // Update Progress Bar strictly based on current step
  if (stepNumber === 3) {
    progressBarFill.style.width = "100%";
    progressBarFill.style.backgroundColor = "#10b981"; // Green
    progressText.textContent = "100%";
    progressText.style.color = "#10b981";
  } else if (stepNumber === 2) {
    progressBarFill.style.width = "66%";
    progressBarFill.style.backgroundColor = "#f59e0b"; // Yellow
    progressText.textContent = "66%";
    progressText.style.color = "#f59e0b";
  } else {
    progressBarFill.style.width = "33%";
    progressBarFill.style.backgroundColor = "#ef4444"; // Red
    progressText.textContent = "33%";
    progressText.style.color = "#ef4444";
  }

  // Update Step Circles naturally
  const checkmarkSVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="color:white;"><path d="M20 6L9 17l-5-5"></path></svg>`;

  stepIndicators.forEach((indicator, index) => {
    const numSpan = indicator.querySelector(".step-num");
    const stepIdx = index + 1;

    indicator.classList.remove("active", "completed", "inactive");
    numSpan.style.backgroundColor = "";

    if (stepIdx < stepNumber) {
      indicator.classList.add("completed");
      numSpan.innerHTML = checkmarkSVG;
      numSpan.style.backgroundColor = "#10b981"; // Green check
    } else if (stepIdx === stepNumber) {
      indicator.classList.add("active");
      numSpan.innerHTML = stepIdx;
    } else {
      indicator.classList.add("inactive");
      numSpan.innerHTML = stepIdx;
    }
  });
}

// =========================================
// STEP 1 VALIDATION LOGIC
// =========================================
function validateStep1() {
  let isValid = true;

  // 1. Validate Name
  const nameInput = document.getElementById("schol-name");
  const nameError = document.getElementById("error-schol-name");
  if (nameInput && !nameInput.value.trim()) {
    nameError.textContent = "Please enter the scholarship name.";
    nameError.classList.add("active");
    nameInput.classList.add("input-error");
    isValid = false;
  } else if (nameInput) {
    nameError.classList.remove("active");
    nameInput.classList.remove("input-error");
  }

  // 2. Validate Description
  const descInput = document.getElementById("schol-desc");
  const descError = document.getElementById("error-schol-desc");
  if (descInput && !descInput.value.trim()) {
    descError.textContent = "Please provide a short description.";
    descError.classList.add("active");
    descInput.classList.add("input-error");
    isValid = false;
  } else if (descInput) {
    descError.classList.remove("active");
    descInput.classList.remove("input-error");
  }

  // 3. Validate Type
  const typeInput = document.getElementById("schol-type");
  const typeSelected = document.getElementById("schol-type-selected");
  const typeError = document.getElementById("error-schol-type");
  if (typeInput && !typeInput.value) {
    typeError.textContent = "Please select a scholarship type.";
    typeError.classList.add("active");
    if (typeSelected) typeSelected.classList.add("input-error");
    isValid = false;
  } else if (typeInput) {
    typeError.classList.remove("active");
    if (typeSelected) typeSelected.classList.remove("input-error");
  }

  // 4. Validate Deadline
  const dateInput = document.getElementById("schol-deadline");
  const dateError = document.getElementById("error-schol-deadline");
  if (dateInput && !dateInput.value) {
    dateError.textContent = "Please select a deadline.";
    dateError.classList.add("active");
    dateInput.classList.add("input-error");
    isValid = false;
  } else if (dateInput) {
    const selectedDate = new Date(dateInput.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate <= today) {
      dateError.textContent = "Deadline must be a future date.";
      dateError.classList.add("active");
      dateInput.classList.add("input-error");
      isValid = false;
    } else {
      dateError.classList.remove("active");
      dateInput.classList.remove("input-error");
    }
  }

  return isValid;
}

// =========================================
// STEP 2 VALIDATION LOGIC
// =========================================
function validateStep2() {
  const reqList = document.getElementById("requirements-list");
  const step2Error = document.getElementById("error-step-2");

  if (!reqList || !step2Error) return true; // Safety fallback

  const currentCards = reqList.querySelectorAll(".req-card");

  if (currentCards.length === 0) {
    step2Error.textContent = "Please add at least one requirement.";
    step2Error.classList.add("active");
    return false;
  } else {
    step2Error.classList.remove("active");
    return true;
  }
}

// =========================================
// CUSTOM REQUIREMENT BUTTON LOGIC
// =========================================
const addCustomReqBtn = document.getElementById("add-custom-req-btn");
if (addCustomReqBtn) {
  addCustomReqBtn.addEventListener("click", () => {
    const reqList = document.getElementById("requirements-list");
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
    reqList.appendChild(newCard);
    newCard.querySelector(".custom-title").focus();

    // Cancel Custom Requirement
    newCard
      .querySelector(".cancel-custom-btn")
      .addEventListener("click", () => {
        newCard.remove();
      });

    // Save Custom Requirement (With Validation)
    newCard.querySelector(".save-custom-btn").addEventListener("click", () => {
      const titleInput = newCard.querySelector(".custom-title");
      const descInput = newCard.querySelector(".custom-desc");
      const titleVal = titleInput.value.trim();
      const descVal = descInput.value.trim();

      let isValid = true;

      // Check if title is empty
      if (!titleVal) {
        titleInput.classList.add("input-error");
        isValid = false;
      } else {
        titleInput.classList.remove("input-error");
      }

      // Check if description is empty
      if (!descVal) {
        descInput.classList.add("input-error");
        isValid = false;
      } else {
        descInput.classList.remove("input-error");
      }

      // If either is empty, stop the save process
      if (!isValid) return;

      // If both are filled, convert into a saved requirement card
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

      // Hide the Step 2 error message if it was active
      const step2Error = document.getElementById("error-step-2");
      if (step2Error) step2Error.classList.remove("active");
    });
  });
}

// =========================================
// REQUIREMENT REMOVAL LOGIC
// =========================================
const reqListContainer = document.getElementById("requirements-list");
if (reqListContainer) {
  reqListContainer.addEventListener("click", (e) => {
    // Check if the clicked element is the remove button
    if (
      e.target.classList.contains("remove-req-btn") ||
      e.target.closest(".remove-req-btn")
    ) {
      const card = e.target.closest(".req-card");
      if (card) {
        // Add a smooth shrink/fade animation before deleting
        card.style.transition = "opacity 0.2s, transform 0.2s";
        card.style.opacity = "0";
        card.style.transform = "scale(0.95)";

        // Remove from the DOM after the animation finishes
        setTimeout(() => card.remove(), 200);
      }
    }
  });
}

// =========================================
// NAVIGATION BINDING
// =========================================
const btnGoToStep1 = document.getElementById("go-to-step-1");
const btnGoToStep2 = document.getElementById("go-to-step-2");
const btnGoToStep3 = document.getElementById("go-to-step-3");
const btnBackToStep2 = document.getElementById("back-to-step-2");

if (btnGoToStep1)
  btnGoToStep1.addEventListener("click", () => goToStep(1, false));

if (btnGoToStep2) {
  btnGoToStep2.addEventListener("click", () => {
    if (validateStep1()) goToStep(2, false);
  });
}

if (btnGoToStep3) {
  btnGoToStep3.addEventListener("click", () => {
    if (validateStep2()) goToStep(3, false);
  });
}

if (btnBackToStep2)
  btnBackToStep2.addEventListener("click", () => goToStep(2, false));

// Edit Navigation
const editStep1 = document.getElementById("edit-step-1");
const editStep2 = document.getElementById("edit-step-2");
if (editStep1) editStep1.addEventListener("click", () => goToStep(1, true));
if (editStep2) editStep2.addEventListener("click", () => goToStep(2, true));

const doneEdit1 = document.getElementById("done-edit-1");
if (doneEdit1) {
  doneEdit1.addEventListener("click", () => {
    if (validateStep1()) goToStep(3, false);
  });
}

const doneEdit2 = document.getElementById("done-edit-2");
if (doneEdit2) {
  doneEdit2.addEventListener("click", () => {
    if (validateStep2()) goToStep(3, false);
  });
}

const returnToReviewBtns = [
  document.getElementById("cancel-edit-1"),
  document.getElementById("cancel-edit-2"),
];
returnToReviewBtns.forEach((btn) => {
  if (btn) btn.addEventListener("click", () => goToStep(3, false));
});

// =========================================
// VIEW SWITCHING (HOME vs DRAFTS)
// =========================================
const navHome = document.querySelector('a[href="provider-dashboard.html"]'); // Your home link
const navDrafts = document.getElementById("nav-drafts");

const dashWelcome = document.querySelector(".dash-welcome");
const dashStats = document.querySelector(".dash-stats-container");
const dashRecent = document.querySelector(".dash-recent");
const dashActions = document.querySelector(".dash-actions");
const dashDraftsSection = document.getElementById("dash-drafts-section");

if (navDrafts) {
  navDrafts.addEventListener("click", (e) => {
    e.preventDefault(); // Stop link from refreshing page

    // Hide Dashboard elements
    if (dashWelcome) dashWelcome.style.display = "none";
    if (dashStats) dashStats.style.display = "none";
    if (dashRecent) dashRecent.style.display = "none";
    if (dashActions) dashActions.style.display = "none";

    // Show Drafts
    if (dashDraftsSection) dashDraftsSection.style.display = "block";

    // Update Active States
    navDrafts.classList.add("active");
    if (navHome) navHome.classList.remove("active");
  });
}

if (navHome) {
  navHome.addEventListener("click", (e) => {
    e.preventDefault();

    // Show Dashboard elements
    if (dashWelcome) dashWelcome.style.display = "block";
    if (dashStats) dashStats.style.display = "flex"; // Assuming flex
    if (dashRecent) dashRecent.style.display = "block";
    if (dashActions) dashActions.style.display = "block";

    // Hide Drafts
    if (dashDraftsSection) dashDraftsSection.style.display = "none";

    // Update Active States
    navHome.classList.add("active");
    if (navDrafts) navDrafts.classList.remove("active");
  });
}

// =========================================
// STEP 3 VALIDATION & SUBMISSION
// =========================================
function validateStep3() {
  const confirmCheck = document.getElementById("confirm-info");
  const step3Error = document.getElementById("error-step-3");

  if (!confirmCheck.checked) {
    step3Error.textContent =
      "Please confirm the information is true and correct before proceeding.";
    step3Error.classList.add("active");
    return false;
  } else {
    step3Error.classList.remove("active");
    return true;
  }
}

const publishBtn = document.getElementById("publish-btn");
const draftBtn = document.getElementById("draft-btn");
const creationModal = document.getElementById("create-scholarship-modal");

// Handle Publish Button
if (publishBtn) {
  publishBtn.addEventListener("click", function () {
    if (!validateStep3()) return; // Stop if checkbox is empty

    // 1. Loading State
    const originalText = this.textContent;
    this.textContent = "Publishing...";
    this.disabled = true;
    this.style.opacity = "0.7";
    this.style.cursor = "not-allowed";

    // 2. Fake Network Delay (1.5 seconds)
    setTimeout(() => {
      // Grab values for the temporary post
      const title = document.getElementById("schol-name").value;
      const desc = document.getElementById("schol-desc").value;
      const typeSelectedText = document.querySelector(
        "#schol-type-selected span",
      ).textContent;
      const dateVal = document.getElementById("schol-deadline").value;

      let formattedDate = "No Deadline";
      if (dateVal) {
        const dateObj = new Date(dateVal);
        formattedDate = dateObj.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }

      // NEW: Hide the empty state!
      const emptyState = document.getElementById("empty-state-card");
      if (emptyState) {
        emptyState.style.display = "none";
      }

      // NEW: Update Statistics
      totalScholarships++;
      ongoingScholarships++;
      document.getElementById("stat-total").textContent = totalScholarships;
      document.getElementById("stat-ongoing").textContent = ongoingScholarships;
      // stat-applicants remains 0 for now

      // Generate the HTML card and put it on the dashboard
      const feed = document.getElementById("scholarships-feed");
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
            <p class="temp-post-date">📅 Deadline: ${formattedDate}</p>
          `;
        feed.prepend(newPost);
      }

      // 3. Close Modal & Reset UI
      creationModal.classList.remove("active");
      creationModal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "auto";

      // ... (Keep the rest of your reset logic here) ...

      setTimeout(() => {
        goToStep(1, false);
        const step1Form = document.getElementById("step-1-form");
        if (step1Form) step1Form.reset();

        const dropdownSelected = document.getElementById("schol-type-selected");
        const dropdownHidden = document.getElementById("schol-type");
        if (dropdownSelected && dropdownHidden) {
          dropdownSelected.querySelector("span").textContent = "Select type";
          dropdownSelected.classList.remove("has-value");
          dropdownHidden.value = "";
        }

        const confirmInfo = document.getElementById("confirm-info");
        if (confirmInfo) confirmInfo.checked = false;

        // Restore button to normal state
        this.textContent = originalText;
        this.disabled = false;
        this.style.opacity = "1";
        this.style.cursor = "pointer";
      }, 400);
    }, 1500); // Ends the 1.5s delay
  });
}

// Handle Draft Button

if (draftBtn) {
  draftBtn.addEventListener("click", function () {
    // 1. Loading State
    const originalText = this.textContent;
    this.textContent = "Saving...";
    this.disabled = true;
    this.style.opacity = "0.7";

    setTimeout(() => {
      // 2. Grab current data (use placeholders if empty)
      const titleInput = document.getElementById("schol-name").value.trim();
      const descInput = document.getElementById("schol-desc").value.trim();

      const draftTitle = titleInput || "Untitled Scholarship";
      const draftDesc = descInput || "No description provided yet...";

      // 3. Hide Empty Drafts state
      const emptyDraftsCard = document.getElementById("empty-drafts-card");
      if (emptyDraftsCard) emptyDraftsCard.style.display = "none";

      // 4. Generate the Draft Card
      const draftsFeed = document.getElementById("drafts-feed");
      if (draftsFeed) {
        const newDraft = document.createElement("div");
        newDraft.className = "draft-card";
        newDraft.innerHTML = `
            <span class="draft-badge-tag">Draft</span>
            <h3>${draftTitle}</h3>
            <p style="font-size: 14px; margin-bottom: 0;">${draftDesc}</p>
            <button type="button" class="continue-edit-btn">Continue Editing</button>
          `;
        draftsFeed.prepend(newDraft);
      }

      // 5. Update Draft Count & Badge
      draftCount++;
      const draftBadge = document.getElementById("draft-badge");
      if (draftBadge) {
        draftBadge.textContent = draftCount;
        draftBadge.style.display = "inline-block";
      }

      // 6. Close Modal & Reset UI
      const creationModal = document.getElementById("create-scholarship-modal");
      creationModal.classList.remove("active");
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

// =========================================
// MODAL CANCELLATION & CONFIRMATION LOGIC
// =========================================
const cancelConfirmModal = document.getElementById("cancel-confirm-modal");
const stayEditingBtn = document.getElementById("stay-editing-btn");
const confirmDiscardBtn = document.getElementById("confirm-discard-btn");

// The buttons that should trigger the discard warning
const step1CancelBtn = document.getElementById("cancel-creation-btn-1");

// Select any "X" close buttons you might have (adjust class/id if needed)
const xCloseBtns = document.querySelectorAll(".close-modal-btn, .close-btn");

// 1. Function to show the warning modal
function triggerCancelWarning() {
  if (cancelConfirmModal) {
    cancelConfirmModal.style.display = "flex";
    // Small delay to allow the CSS transition (fade-in) to work
    setTimeout(() => (cancelConfirmModal.style.opacity = "1"), 10);
  }
}

// 2. Bind the Cancel and X buttons to trigger the warning
if (step1CancelBtn)
  step1CancelBtn.addEventListener("click", triggerCancelWarning);
xCloseBtns.forEach((btn) =>
  btn.addEventListener("click", triggerCancelWarning),
);

// 3. Handle "Keep Editing" (Closes just the warning)
if (stayEditingBtn) {
  stayEditingBtn.addEventListener("click", () => {
    cancelConfirmModal.style.opacity = "0";
    setTimeout(() => (cancelConfirmModal.style.display = "none"), 200);
  });
}

// 4. Handle "Discard" (Closes everything and resets data)
if (confirmDiscardBtn) {
  confirmDiscardBtn.addEventListener("click", () => {
    // Hide warning modal
    cancelConfirmModal.style.opacity = "0";
    setTimeout(() => (cancelConfirmModal.style.display = "none"), 200);

    // Hide the main creation modal
    const creationModal = document.getElementById("create-scholarship-modal");
    if (creationModal) {
      creationModal.classList.remove("active");
      creationModal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "auto";
    }

    // Reset the form in the background
    setTimeout(() => {
      goToStep(1, false);
      const step1Form = document.getElementById("step-1-form");
      if (step1Form) step1Form.reset();

      const dropdownSelected = document.getElementById("schol-type-selected");
      const dropdownHidden = document.getElementById("schol-type");
      if (dropdownSelected && dropdownHidden) {
        dropdownSelected.querySelector("span").textContent = "Select type";
        dropdownSelected.classList.remove("has-value");
        dropdownHidden.value = "";
      }

      const confirmInfo = document.getElementById("confirm-info");
      if (confirmInfo) confirmInfo.checked = false;
    }, 400);
  });
}
