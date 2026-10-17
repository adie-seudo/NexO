// =========================================
// 1. INSTANT DARK MODE CHECK
// =========================================
const savedTheme = localStorage.getItem("nexo-theme");
if (savedTheme === "dark") {
  document.body.classList.add("dark-theme");
}

// =========================================
// 1.5 DISPLAY DYNAMIC USER EMAIL
// =========================================
const userEmailDisplay = document.querySelector(".user-email-display");
const pendingEmail = sessionStorage.getItem("nexo-pending-email");

if (userEmailDisplay && pendingEmail) {
  userEmailDisplay.textContent = pendingEmail;
}

// =========================================
// 2. 6-DIGIT OTP INPUT BEHAVIOR (Auto-jump & Paste)
// =========================================
const otpInputs = document.querySelectorAll(".otp-input");

otpInputs.forEach((input, index) => {
  // Handle typing a single digit
  input.addEventListener("input", (e) => {
    const value = e.target.value;
    // Keep only numbers
    e.target.value = value.replace(/[^0-9]/g, "");

    if (e.target.value && index < otpInputs.length - 1) {
      otpInputs[index + 1].focus();
    }
  });

  // Handle backspace
  input.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !input.value && index > 0) {
      otpInputs[index - 1].focus();
    }
  });

  // Handle pasting a full 6-digit code
  input.addEventListener("paste", (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").trim();
    const digits = pasteData.replace(/[^0-9]/g, "").split("");

    otpInputs.forEach((otpInput, i) => {
      if (digits[i]) {
        otpInput.value = digits[i];
      }
    });

    // Focus the last filled box or the next empty one
    const lastIndex = Math.min(digits.length, otpInputs.length) - 1;
    otpInputs[lastIndex].focus();
  });
});

// =========================================
// 3. 45-SECOND COUNTDOWN TIMER FOR RESEND
// =========================================
const resendBtn = document.getElementById("resend-btn");
const timerDisplay = document.getElementById("timer-display");
let timeLeft = 45;
let countdownTimer;

function startTimer() {
  timeLeft = 45;
  resendBtn.classList.add("disabled");
  resendBtn.setAttribute("disabled", "true");

  countdownTimer = setInterval(() => {
    timeLeft--;
    const secondsStr = String(timeLeft).padStart(2, "0");
    timerDisplay.textContent = `(00:${secondsStr})`;

    if (timeLeft <= 0) {
      clearInterval(countdownTimer);
      timerDisplay.textContent = "";
      resendBtn.classList.remove("disabled");
      resendBtn.removeAttribute("disabled");
    }
  }, 1000);
}

// Start the timer when the page loads
startTimer();

// =========================================
// 4. ON-SCREEN NOTIFICATIONS & FORM SUBMISSION
// =========================================
const notificationEl = document.getElementById("verify-notification");
const verifyForm = document.getElementById("verify-form");
const verifyStepOtp = document.getElementById("verify-step-otp");
const verifyStepSuccess = document.getElementById("verify-step-success");
const verifyExitBtn = document.getElementById("verify-exit-btn");

/**
 * @param {string} message
 * @param {string} [type="error"]
 */
function showNotification(message = "", type = "error") {
  if (!notificationEl) return;
  notificationEl.textContent = message;
  notificationEl.className = `verify-notification ${type} show`;

  // Auto-hide after 4 seconds for errors
  if (type === "error") {
    setTimeout(() => {
      if (notificationEl.classList.contains("error")) {
        notificationEl.classList.remove("show");
      }
    }, 4000);
  }
}

// Resend button click action
resendBtn.addEventListener("click", () => {
  if (!resendBtn.classList.contains("disabled")) {
    showNotification(
      "A new verification code has been sent to your email!",
      "success",
    );
    startTimer();
  }
});

// Verify form submission validation
if (verifyForm) {
  verifyForm.addEventListener("submit", (e) => {
    e.preventDefault();

    let enteredCode = "";
    otpInputs.forEach((input) => {
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
      // Stop the countdown timer
      clearInterval(countdownTimer);

      // Hide the OTP view and exit button, then reveal the animated Success View
      if (verifyStepOtp) verifyStepOtp.classList.add("hidden");
      if (verifyExitBtn) verifyExitBtn.style.display = "none";
      if (verifyStepSuccess) verifyStepSuccess.classList.remove("hidden");
    } else {
      showNotification(
        "Invalid verification code. For testing, please use 123456.",
        "error",
      );
      otpInputs.forEach((input) => (input.value = ""));
      otpInputs[0].focus();
    }
  });
}
