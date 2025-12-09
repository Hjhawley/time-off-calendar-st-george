// Simple password-based authentication for admin access
const ADMIN_PASSWORD = "neurodev2025"; // Change this to your desired password

export function checkAdminAuth() {
  const isAuthenticated =
    sessionStorage.getItem("adminAuthenticated") === "true";
  if (!isAuthenticated) {
    window.location.href = "index.html";
  }
}

export function attemptLogin(password) {
  if (password === ADMIN_PASSWORD) {
    sessionStorage.setItem("adminAuthenticated", "true");
    return true;
  }
  return false;
}

export function logout() {
  sessionStorage.removeItem("adminAuthenticated");
  window.location.href = "index.html";
}

export function isAdmin() {
  return sessionStorage.getItem("adminAuthenticated") === "true";
}
