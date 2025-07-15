// ✅ REQUIRE DEPENDENCIES
const express = require("express");
const cors = require("cors");
const https = require("https");
const dotenv = require("dotenv").config();

// ✅ CREATE EXPRESS SERVER INSTANCE
const Server = express();

// ✅ USE MIDDLEWARES
Server.use(express.json());  // Parses incoming JSON requests
Server.use(cors());          // Enables Cross-Origin Resource Sharing

// ✅ IMPORT CUSTOM USER CLASS
const UserClass = require("./Classes/user");
const user = new UserClass(); // Create instance of the class

// ✅ BRING IN ENVIRONMENT VARIABLES
const port = process.env.APP_PORT;
const host = process.env.APP_HOST;




// ===============================================================
// 🔐 REGISTER ENDPOINT
// ===============================================================
Server.post('/register', async (request, response) => {
    // Extract user details from request body
    let firstname = request.body.firstname;
    let lastname = request.body.lastname;
    let email = request.body.email;
    let password = request.body.password;
    let phone = request.body.phonenumber;

    // Validate registration inputs
    const feedback = user.check_registration_params(firstname, lastname, email, password);

    // If validation fails, return error feedback
    if (feedback.code === "error") {
        return response.send(feedback);
    }

    // If valid, attempt to register user and return feedback
    const result = await user.register(firstname, lastname, email, password, phone);
    response.send(result);
});




// ===============================================================
// 🔓 LOGIN ENDPOINT
// ===============================================================
Server.post('/login-user', async (request, response) => {
    // Get login credentials
    let email = request.body.email;
    let password = request.body.password;

    // Run login method from class
    const feedback = await user.loginUser(email, password);

    // Send back login response
    response.send({
        message: feedback.message,
        code: feedback.code,
        data: feedback.data
    });
});



// ===============================================================
// 📩 EMAIL VERIFICATION ENDPOINT
// ===============================================================
Server.get('/verify_registration_email', async (request, response) => {
    let query = request.query;
    let user_email = query.email;

    // Only process if email is provided
    if (user_email.trim().length !== 0) {
        const feedback = await user.verify_registration_email(user_email);
        response.send(feedback);
    }
});

// ✅ IMPORT OTP STORE OBJECT TO TRACK OTP STATE
const otpStore = require("./Classes/otpStore");



// ===============================================================
// 📤 SEND OTP ENDPOINT
// ===============================================================
Server.post('/send-otp', async (req, res) => {
    console.log("✅ /send-otp route hit");

    const phone = req.body.phonenumber;
    console.log("📞 Phone received:", phone);

    // Validate phone number
    if (!phone || phone.trim().length === 0) {
        console.log("❌ No phone number provided");
        return res.send({
            message: "Phone number is required",
            code: "error",
            data: null,
        });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("🔢 OTP generated:", otp);

    // Store OTP with 5-minute expiration
    otpStore[phone] = {
        otp,
        expiresAt: Date.now() + 5 * 60 * 1000,
    };
    console.log("📦 OTP stored:", otpStore[phone]);

    // Send OTP using Twilio via user class method
    const feedback = await user.sendOTP(phone.trim(), otp);
    console.log("📤 Feedback from sendOTP:", feedback);

    // Respond with feedback
    res.send(feedback);
});



// ===============================================================
// ✅ VERIFY OTP ENDPOINT
// ===============================================================
Server.post('/verify-otp', async (req, res) => {
    const phone = req.body.phonenumber;
    const otp = req.body.otp;

    // Check for missing values
    if (!phone || !otp) {
        return res.send({
            message: "Phone number and OTP are required",
            code: "error",
            data: null,
        });
    }

    // Validate OTP using class method
    const feedback = await user.verifyOTP(phone.trim(), otp.trim());
    res.send(feedback);
});



// ===============================================================
// 💳 CREATE PAYMENT PAGE ENDPOINT
// ===============================================================
Server.post('/create-payment', async (request, response) => {
    // Extract payment details from request body
    const { name, description, amount, email, callback_url } = request.body;

    // Validate required fields
    if (!name || !amount || !email) {
        return response.send({
            message: "Name, amount, and email are required",
            code: "error",
            data: null
        });
    }

    // Prepare payment parameters for Paystack
    const params = JSON.stringify({
        name: name,
        description: description || "Payment for order",
        amount: amount * 100, // Convert to kobo (Paystack expects amount in kobo)
        callback_url: callback_url || `http://${host}:3000/payment-success`
    });
    

    // Paystack API options
    const options = {
        hostname: 'api.paystack.co',
        port: 443,
        path: '/page',
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
        }
    };

    // Create HTTPS request to Paystack
    const req = https.request(options, res => {
        let data = '';
        

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            try {
                const paystackResponse = JSON.parse(data);
                
                if (paystackResponse.status) {
                    // Payment page created successfully
                    // For payment pages, the URL is constructed using the slug
                    const slug = paystackResponse.data?.slug;
                    
                    if (!slug) {
                        return response.send({
                            message: "No slug received from Paystack",
                            code: "error",
                            data: { raw_response: paystackResponse.data }
                        });
                    }
                    
                    const paymentUrl = `https://paystack.com/pay/${slug}`;
                    const reference = paystackResponse.data?.id || paystackResponse.data?.reference;
                    
                    const responseData = {
                        message: "Payment page created successfully",
                        code: "success",
                        data: {
                            payment_url: paymentUrl,
                            reference: reference,
                            slug: slug,
                            page_id: paystackResponse.data?.id
                        }
                    };
                    
                    response.send(responseData);
                } else {
                    // Error from Paystack
                    response.send({
                        message: paystackResponse.message || "Failed to create payment page",
                        code: "error",
                        data: null
                    });
                }
            } catch (error) {
                console.error('Error parsing Paystack response:', error);
                
                // Return the raw response for debugging
                response.send({
                    message: "Error processing payment request",
                    code: "error",
                    data: {
                        raw_response: data,
                        status_code: res.statusCode,
                        error: error.message
                    }
                });
            }
        });
    }).on('error', error => {
        console.error('Payment request error:', error);
        response.send({
            message: "Payment service unavailable",
            code: "error", 
            data: null
        });
    });

    // Send the request
    req.write(params);
    req.end();
});



// ===============================================================
// 🚀 START SERVER
// ===============================================================
Server.listen(port, () => {
    console.log(`🚀 Server running on http://${host}:${port}`);
});
