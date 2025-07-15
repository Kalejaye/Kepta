// =======================================================================
// register.js - Handles user registration and spinner display
// =======================================================================



// =======================================================================
// FUNCTION TO SHOW THE "PLEASE WAIT" SPINNER
// =======================================================================
function start_reg_spinner() {
    const spinnerElement = document.querySelector("#reg-spinner-id");

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



// =======================================================================
// FUNCTION TO END THE SPINNER AND OPTIONALLY SHOW A MESSAGE
// =======================================================================
function end_reg_spinner(with_message) {
    const spinnerElement = document.querySelector("#reg-spinner-id");

    if (spinnerElement) {
        spinnerElement.innerHTML = with_message || "";
    } else {
        console.error("❌ Spinner element not found.");
    }
}



// =======================================================================
// IMMEDIATELY INVOKED FUNCTION (Runs on DOM Ready)
// =======================================================================
(function () {

    // ✅ When the DOM is fully loaded
    document.addEventListener("DOMContentLoaded", () => {

        // 📄 Get the registration form from the DOM
        const registerForm = document.querySelector("#registerForm");

        // ❌ Exit if form not found
        if (!registerForm) {
            console.error("❌ Register form not found.");
            return;
        }



        // =======================================================
        // SUBMIT EVENT HANDLER FOR THE REGISTER FORM
        // =======================================================
        registerForm.addEventListener("submit", async (event) => {
            event.preventDefault();  // ❌ Stop form from refreshing the page

            console.log("📨 Register form submitted!");



            // ✅ Get and trim all input values
            let firstname    = event.target.firstname.value.trim();
            let lastname     = event.target.lastname.value.trim();
            let email        = event.target.email.value.trim();
            let password     = event.target.password.value.trim();
            let phonenumber  = event.target.phonenumber.value.trim();



            // ✅ Ensure no field is empty before sending to backend
            if (
                firstname.length > 0 &&
                lastname.length > 0 &&
                email.length > 0 &&
                password.length > 0 &&
                phonenumber.length > 0
            ) {
                try {
                    // 🔄 Start spinner while request is being processed
                    start_reg_spinner();

                    // 📡 Send data to backend registration endpoint
                    const feedback = await axios.post("http://localhost:1000/register", {
                        firstname,
                        lastname,
                        email,
                        password,
                        phonenumber
                    });

                    console.log("✅ Registering user -->", feedback);



                    // ✅ Success
                    if (feedback.data.code === "success") {
                        end_reg_spinner(`<div class='alert alert-success'>${feedback.data.message}</div>`);
                    }

                    // ❌ Backend responded with an error
                    else {
                        end_reg_spinner(`<div class='alert alert-danger'>Registration failed. ${feedback.data.message}</div>`);
                    }

                } catch (error) {
                    // ❌ Catch unexpected errors (like server down)
                    console.error("Registration error:", error);
                    end_reg_spinner(`<div class='alert alert-danger'>Registration failed. Please try again later.</div>`);
                }

            }

            // ❗ At least one input field was empty
            else {
                console.warn("⚠️ All form fields must be filled out.");
                end_reg_spinner(`<div class='alert alert-warning'>All fields must be filled.</div>`);
            }
        });

    });

})();
