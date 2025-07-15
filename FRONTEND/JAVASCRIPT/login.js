// ====================================================================
// login.js - Handles login form submission and OTP verification flow
// ====================================================================

// ======================================================
// FUNCTION TO SHOW THE "PLEASE WAIT" SPINNER
// ======================================================
function start_spinner() {
    const spinnerElement = document.querySelector("#spinner-id");

    if (spinnerElement) {
        spinnerElement.innerHTML = `
            <span> Please wait ... 
                <span class="spinner-border spinner-border-sm" role="status">
                    <span class="sr-only"></span>
                </span>
            </span>`;
    } else {
        console.error("❌ Spinner element not found.");
    }
}

// ======================================================
// FUNCTION TO STOP SPINNER AND OPTIONALLY SHOW A MESSAGE
// ======================================================
function end_spinner(with_message = null) {
    const spinnerElement = document.querySelector("#spinner-id");

    if (spinnerElement) {
        spinnerElement.innerHTML = with_message || "";
    } else {
        console.error("❌ Spinner element not found.");
    }
}

// ==========================================================================
// MAIN LOGIC - Runs Automatically When Page Loads (Immediately Invoked Func)
// ==========================================================================
(function () {

    // ✅ Backend base URL
    const url = "http://localhost:1000";

    // ✅ Grab login form from DOM
    const sign_in_form = document.querySelector("#signInForm");

    // 🔐 If form is not found, log and stop
    if (!sign_in_form) {
        console.error("❌ Login form not found.");
        return;
    }

    // ======================================================
    // SUBMIT EVENT FOR LOGIN FORM
    // ======================================================
    sign_in_form.addEventListener("submit", async function (event) {
        event.preventDefault();

        //  Get input values from form
        const email = this.email.value.trim();
        const password = this.password.value.trim();

        // ✅ Ensure both fields are filled
        if (email.length > 0 && password.length > 0) {
            try {
                // 🔄 Start loading spinner
                start_spinner();

                // 📡 Send login request to backend
                const feedback = await axios.post(`${url}/login-user`, { email, password });
                console.log(" Login response:", feedback.data);

                if (feedback.data.code === "success") {

                    // 🧠 Store logged-in user in localForage for OTP verification
                    await localforage.setItem("_paygo_user", feedback.data.data);
                    console.log("✅ Stored user data in localForage.");

                    // 🔀 Switch UI to OTP step
                    document.querySelector("#signInForm").style.display = "none";
                    document.querySelector("#otp-step").style.display = "block";

                    // 📞 Send OTP to user's phone
                    console.log("📞 Sending OTP to:", feedback.data.data.phone);
                    await axios.post(`${url}/send-otp`, {
                        phonenumber: feedback.data.data.phone
                    });

                    // ✅ End spinner cleanly
                    end_spinner();

                } else {
                    // ❌ Show error message from backend
                    end_spinner(`<div class='alert alert-danger'>${feedback.data.message}</div>`);
                }

            } catch (err) {
                // ❌ Unexpected error
                console.error("Login error:", err);
                end_spinner(`<div class='alert alert-danger'>An error occurred</div>`);
            }

        } else {
            // ❗ Show warning if fields are empty
            end_spinner(`<div class='alert alert-warning'>Please fill all fields</div>`);
        }
    });

    // ======================================================
    // CLICK EVENT TO VERIFY OTP
    // ======================================================
    document.querySelector("#verify-otp-btn").addEventListener("click", async () => {

        // 🧾 Get the OTP input value
        const otp = document.querySelector("#otp-input").value.trim();

        // 📦 Retrieve phone from localForage
        const storedUser = await localforage.getItem("_paygo_user");
        const phone = storedUser ? storedUser.phone : null;

        console.log("📞 Phone used for OTP verification:", phone);

        // ❌ If no phone found in localForage
        if (!phone) {
            document.querySelector("#otp-spinner-id").innerHTML =
                "<span class='text-danger'>No phone found. Please login again.</span>";
            return;
        }

        // ✅ If OTP is entered
        if (otp.length > 0) {
            document.querySelector("#otp-spinner-id").innerHTML = "Verifying...";

            try {
                // 📡 Send OTP and phone to server for verification
                const result = await axios.post(`${url}/verify-otp`, {
                    phonenumber: phone,
                    otp
                });

                console.log("✅ OTP verification response:", result.data);

                if (result.data.code === "success") {
                    // ✅ Redirect if OTP is valid
                    document.querySelector("#otp-spinner-id").innerHTML =
                        "<span class='text-success'>OTP Verified!</span>";
                    location.href = "/HTML/dashboard.html";

                } else {
                    // ❌ Invalid OTP
                    document.querySelector("#otp-spinner-id").innerHTML =
                        `<span class='text-danger'>${result.data.message}</span>`;
                }

            } catch (err) {
                console.error("OTP verify error:", err);
                document.querySelector("#otp-spinner-id").innerHTML =
                    "<span class='text-danger'>Error verifying OTP</span>";
            }

        } else {
            // ⚠️ No OTP entered
            document.querySelector("#otp-spinner-id").innerHTML =
                "<span class='text-warning'>Enter the OTP</span>";
        }
    });

})();