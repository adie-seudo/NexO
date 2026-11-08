// =========================================
// STUDENT DASHBOARD INITIALIZATION
// =========================================
document.addEventListener("DOMContentLoaded", () => {
  console.log("Student Dashboard successfully loaded!");
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
