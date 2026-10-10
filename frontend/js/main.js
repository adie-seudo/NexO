// ==========================================
// 1. INSTANT DARK MODE CHECK (Prevents white flash)
// ==========================================
const savedTheme = localStorage.getItem("nexo-theme");
if (savedTheme === "dark") {
  document.body.classList.add("dark-theme");
} else if (savedTheme === null) {
  const hours = new Date().getHours();
  // Default to dark mode before 7 AM and after 8 PM
  if (hours < 7 || hours >= 20) document.body.classList.add("dark-theme");
}

// ==========================================
// 2. FETCH AND INJECT GLOBAL HEADER
// ==========================================
fetch("header.html")
  .then((response) => response.text())
  .then((data) => {
    // Insert the HTML into the placeholder
    document.getElementById("header-placeholder").innerHTML = data;
    // Now that the HTML is on the page, activate all the buttons
    initializeHeaderFunctions();
  })
  .catch((error) => console.error("Error loading header:", error));

// ==========================================
// 3. INITIALIZE ALL HEADER LOGIC
// ==========================================
function initializeHeaderFunctions() {
  // Grab elements once so all parts of the script can use them
  const navMenu = document.querySelector(".nav-menu");
  const hamburgerBtn = document.querySelector(".hamburger-btn");
  const globalHeader = document.querySelector(".global-header");

  // --- A. Dynamic Active Link Highlight & Scroll ---
  const currentPage = window.location.pathname.split("/").pop() || "app.html";
  const navLinks = document.querySelectorAll(".nav-link");

  navLinks.forEach((link) => {
    if (link.getAttribute("href") === currentPage) {
      link.classList.add("active");
    }

    // Scroll to top if clicking active link
    link.addEventListener("click", function (e) {
      if (this.classList.contains("active")) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        if (navMenu) navMenu.classList.remove("open");
        if (hamburgerBtn) hamburgerBtn.classList.remove("open");
      }
    });
  });

  // --- B. Hamburger Menu (Click & Auto-Close) ---
  if (hamburgerBtn && navMenu) {
    hamburgerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      hamburgerBtn.classList.toggle("open");
      navMenu.classList.toggle("open");
    });

    // Close when clicking outside the menu
    document.addEventListener("click", (e) => {
      if (navMenu.classList.contains("open") && !navMenu.contains(e.target)) {
        hamburgerBtn.classList.remove("open");
        navMenu.classList.remove("open");
      }
    });
  }

  // --- C. Dark Mode Toggle Binding ---
  const themeToggle = document.querySelector(".theme-toggle");
  if (themeToggle) {
    themeToggle.checked = !document.body.classList.contains("dark-theme");

    themeToggle.addEventListener("change", (e) => {
      if (e.target.checked) {
        localStorage.setItem("nexo-theme", "light");
        document.body.classList.remove("dark-theme");
      } else {
        localStorage.setItem("nexo-theme", "dark");
        document.body.classList.add("dark-theme");
      }
    });
  }

  // --- D. UNIFIED SCROLL LISTENER (Header & Drawer) ---
  let lastScrollY = window.scrollY;

  window.addEventListener(
    "scroll",
    () => {
      // 1. Auto-close the mobile drawer
      if (navMenu && navMenu.classList.contains("open")) {
        hamburgerBtn.classList.remove("open");
        navMenu.classList.remove("open");
      }

      // 2. Smart Header
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
}
