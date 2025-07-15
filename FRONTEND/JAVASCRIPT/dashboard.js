// Wait for the DOM to load
window.addEventListener("DOMContentLoaded", async function () {
  const user_info_id = document.querySelector("#userInfo");
  const user_info_id2 = document.querySelector("#userInfo2");
  const logoutBtn = document.getElementById("logoutBtn");

  // Show loading message
  if (user_info_id) {
    user_info_id.innerHTML = "<small>Loading user info...</small>";
  }

  try {
    // Wait a moment to ensure localForage is ready
    await new Promise(resolve => setTimeout(resolve, 300));

    // Get user data from localForage
    const result = await localforage.getItem("_paygo_user");

    if (result) {
      const { firstname, lastname } = result;

      // Display user info
      user_info_id.innerHTML = lastname;
      user_info_id2.innerHTML = firstname;

    }

  } catch (error) {
    console.error("Error loading user info:", error);
    location.href = "home.html";
  }

  // Attach logout handler
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logOutUser);
  }
});

// Logout function
async function logOutUser(event) {
  event.preventDefault();

  try {
    await localforage.removeItem("_paygo_user");
    location.href = "home.html";
  } catch (error) {
    console.error("Logout failed:", error);
  }
}