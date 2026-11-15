// =========================================
// 0. INSTANT DARK MODE CHECK
// =========================================
if (localStorage.getItem("nexo-theme") === "dark") {
  document.body.classList.add("dark-theme");
}

// =========================================
// CACHED DOM ELEMENTS & STATE
// =========================================
const DOM = {};
let timeLeft = 45;
let countdownTimer;

// =========================================
// MASTER INITIALIZATION
// =========================================
document.addEventListener("DOMContentLoaded", () => {
  cacheDOM();
  prefillEmail();
  initOTPBehavior();
  initTimer();
  initFormAndNotifications();
});

function cacheDOM() {
  DOM.userEmailDisplay = document.querySelector(".user-email-display");
  DOM.otpInputs = document.querySelectorAll(".otp-input");
  DOM.resendBtn = document.getElementById("resend-btn");
  DOM.timerDisplay = document.getElementById("timer-display");
  DOM.notificationEl = document.getElementById("verify-notification");
  DOM.verifyForm = document.getElementById("verify-form");
  DOM.verifyStepOtp = document.getElementById("verify-step-otp");
  DOM.verifyStepSuccess = document.getElementById("verify-step-success");
  DOM.verifyExitBtn = document.getElementById("verify-exit-btn");
}

// =========================================
// 1. DISPLAY DYNAMIC USER EMAIL
// =========================================
function prefillEmail() {
  const pendingEmail = sessionStorage.getItem("nexo-pending-email");
  if (DOM.userEmailDisplay && pendingEmail) {
    DOM.userEmailDisplay.textContent = pendingEmail;
  }
}

// =========================================
// 2. 6-DIGIT OTP INPUT BEHAVIOR
// =========================================
function initOTPBehavior() {
  if (!DOM.otpInputs) return;

  DOM.otpInputs.forEach((input, index) => {
    // Handle typing a single digit
    input.addEventListener("input", (e) => {
      const value = e.target.value;
      e.target.value = value.replace(/[^0-9]/g, ""); // Keep only numbers

      if (e.target.value && index < DOM.otpInputs.length - 1) {
        DOM.otpInputs[index + 1].focus();
      }
    });

    // Handle backspace
    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && index > 0) {
        DOM.otpInputs[index - 1].focus();
      }
    });

    // Handle pasting a full 6-digit code
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const pasteData = e.clipboardData.getData("text").trim();
      const digits = pasteData.replace(/[^0-9]/g, "").split("");
      if (digits.length === 0) return;

      DOM.otpInputs.forEach((otpInput, i) => {
        if (digits[i]) {
          otpInput.value = digits[i];
        }
      });

      // Focus the last filled box or the next empty one
      const lastIndex = Math.min(digits.length, DOM.otpInputs.length) - 1;
      if (DOM.otpInputs[lastIndex]) DOM.otpInputs[lastIndex].focus();
    });
  });
}

// =========================================
// 3. 45-SECOND COUNTDOWN TIMER
// =========================================
function startTimer() {
  if (!DOM.resendBtn || !DOM.timerDisplay) return;

  timeLeft = 45;
  DOM.resendBtn.classList.add("disabled");
  DOM.resendBtn.setAttribute("disabled", "true");

  countdownTimer = setInterval(() => {
    timeLeft--;
    const secondsStr = String(timeLeft).padStart(2, "0");
    DOM.timerDisplay.textContent = `(00:${secondsStr})`;

    if (timeLeft <= 0) {
      clearInterval(countdownTimer);
      DOM.timerDisplay.textContent = "";
      DOM.resendBtn.classList.remove("disabled");
      DOM.resendBtn.removeAttribute("disabled");
    }
  }, 1000);
}

function initTimer() {
  startTimer(); // Start the timer when the page loads
}

// =========================================
// 4. ON-SCREEN NOTIFICATIONS HELPER
// =========================================
function showNotification(message = "", type = "error") {
  if (!DOM.notificationEl) return;
  DOM.notificationEl.textContent = message;
  DOM.notificationEl.className = `verify-notification ${type} show`;

  if (type === "error") {
    setTimeout(() => {
      if (DOM.notificationEl.classList.contains("error")) {
        DOM.notificationEl.classList.remove("show");
      }
    }, 4000);
  }
}

// =========================================
// 5. FORM SUBMISSION LOGIC
// =========================================
function initFormAndNotifications() {
  if (DOM.resendBtn) {
    DOM.resendBtn.addEventListener("click", () => {
      if (!DOM.resendBtn.classList.contains("disabled")) {
        showNotification(
          "A new verification code has been sent to your email!",
          "success",
        );
        startTimer();
      }
    });
  }

  if (DOM.verifyForm) {
    DOM.verifyForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      let enteredCode = "";
      DOM.otpInputs.forEach((input) => {
        enteredCode += input.value;
      });

      if (enteredCode.length < 6) {
        showNotification(
          "Please enter the complete 6-digit verification code.",
          "error",
        );
        return;
      }

      if (enteredCode === "123456") {
        clearInterval(countdownTimer);

        // Sync new verified student to file handling and localStorage database
        const pendingEmail = (sessionStorage.getItem("nexo-pending-email") || "").trim().toLowerCase();
        const pendingName =
          (sessionStorage.getItem("nexo-pending-name") || "Verified Student").trim();
        const pendingPassword =
          sessionStorage.getItem("nexo-pending-password") || "password123";

        if (pendingEmail) {
          const newStudentUser = {
            email: pendingEmail,
            role: "student",
            name: pendingName,
            password: pendingPassword,
            status: "active",
          };

          const apiBase =
            window.API_BASE ||
            (window.location.origin && window.location.origin.includes(":3000")
              ? ""
              : "http://localhost:3000");

          let createdUser = null;
          try {
            const res = await fetch(`${apiBase}/api/users`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(newStudentUser),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              showNotification(
                data.error || data.message || "Failed to register account.",
                "error",
              );
              return;
            }
            createdUser = data.user || newStudentUser;
          } catch (err) {
            showNotification(
              "Could not reach the NEXO server to save your account. Please make sure the server is running.",
              "error",
            );
            return;
          }

          // Clear any old cached state for this email so re-registered accounts start 100% fresh
          try {
            localStorage.removeItem(`nexo_student_settings_${pendingEmail}`);
            localStorage.removeItem("nexo_avatar_" + pendingEmail);
            localStorage.removeItem("nexo-student-avatar-" + pendingEmail);
            localStorage.removeItem("nexo_student_settings");
            localStorage.removeItem("nexo-student-avatar");
            sessionStorage.removeItem("nexo-student-avatar");
            const profs = JSON.parse(localStorage.getItem("nexo_student_profiles") || "{}");
            if (profs[pendingEmail]) {
              delete profs[pendingEmail];
              localStorage.setItem("nexo_student_profiles", JSON.stringify(profs));
            }
          } catch (_) {}

          try {
            let uList = [];
            const cached = localStorage.getItem("nexo_users");
            if (cached) uList = JSON.parse(cached);
            uList = uList.filter(
              (u) => (u.email || "").toLowerCase() !== pendingEmail,
            );
            uList.unshift(
              createdUser || {
                id: "usr_stud_" + Date.now(),
                email: pendingEmail,
                password: pendingPassword,
                role: "student",
                name: pendingName,
                status: "active",
                createdAt: new Date().toISOString(),
                formattedDate: new Date().toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }),
              },
            );
            localStorage.setItem("nexo_users", JSON.stringify(uList));
          } catch (_) {}
        }

        if (DOM.verifyStepOtp) DOM.verifyStepOtp.classList.add("hidden");
        if (DOM.verifyExitBtn) DOM.verifyExitBtn.style.display = "none";
        if (DOM.verifyStepSuccess)
          DOM.verifyStepSuccess.classList.remove("hidden");

        // Wipe memory to prevent data leaks after successful verification
        sessionStorage.removeItem("nexo-pending-email");
        sessionStorage.removeItem("nexo-pending-name");
        sessionStorage.removeItem("nexo-pending-password");
      } else {
        showNotification(
          "Invalid verification code. For testing, please use 123456.",
          "error",
        );
        DOM.otpInputs.forEach((input) => (input.value = ""));
        DOM.otpInputs[0].focus();
      }
    });
  }
}
