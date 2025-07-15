// ✅ LOAD ENVIRONMENT VARIABLES
require("dotenv").config();

// ✅ IMPORT DEPENDENCIES
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const twilio = require("twilio");

// ✅ IMPORT OTP STORE (in-memory storage for OTPs)
const otpStore = require("./otpStore");




// ----------------------------
// ✅ CONNECT TO MONGODB
// ----------------------------

const url = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.nc90jwp.mongodb.net/paygo_db?retryWrites=true&w=majority&appName=Cluster0`;
mongoose.connect(url, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});







// ----------------------------
// ✅ DEFINE USER SCHEMA
// ----------------------------

const userSchema = new mongoose.Schema({
  firstname: String,
  lastname: String,
  email: { type: String, unique: true },
  password: String,
  phone: String,
  user_role: { type: Number, default: 0 }, // 0 = regular user
  is_email_verified: { type: Boolean, default: false },
});






// ----------------------------
// ✅ BIND SCHEMA TO COLLECTION
// ----------------------------

const UserModel = mongoose.model("kepta", userSchema);






// ----------------------------
// ✅ USER CLASS
// ----------------------------

class User {

  constructor() {

    // 📩 Nodemailer for sending email verifications
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      secure: false,
      auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
      },
    });

    // 📲 Twilio client for sending OTP SMS
    this.twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
  }






  // ----------------------------
  // ✅ REGISTER USER METHOD
  // ----------------------------

  async register(firstname, lastname, email, password, phone) {
    try {
      const exists = await UserModel.findOne({ email });

      if (exists) {
        return {
          message: "User with this email exists already!",
          code: "error",
          data: null,
        };
      }

      const hashed = await bcrypt.hash(password, 5); // hash password

      const user = new UserModel({
        firstname,
        lastname,
        email,
        password: hashed,
        phone,
        is_email_verified: false,
      });

      await user.save(); // save to DB

      // 📧 Send verification email
      const email_object = await this.transporter.sendMail({
        from: '"Kepta" <no-reply@kepta.com>',
        to: email,
        subject: `Thanks for registering, ${firstname}!`,
        html: `
          <h3>Hello ${firstname} ${lastname},</h3>
          <p>Welcome to Kepta!</p>
          <p>Click the link to verify your email:</p>
          <a href="http://${process.env.APP_HOST}:${process.env.APP_PORT}/verify_registration_email?email=${email}">
            Verify Email
          </a>
        `,
      });

      if (email_object) {
        return {
          message: "User registered. Check inbox for verification email.",
          code: "success",
          data: null,
        };
      } else {
        return {
          message: "Could not send verification email.",
          code: "error",
          data: null,
        };
      }

    } catch (error) {
      console.error("Registration error:", error);

      return {
        message: "An error occurred.",
        code: "error",
        error: error.message,
        data: null,
      };
    }
  }






  // ----------------------------
  // ✅ VALIDATE REGISTRATION INPUT
  // ----------------------------

  check_registration_params(firstname, lastname, email, password) {
    let errors = [];

    if (!firstname) errors.push("Invalid firstname");
    if (!lastname) errors.push("Invalid lastname");
    if (!email) errors.push("Invalid email");
    if (!password) errors.push("Invalid password");

    if (errors.length > 0) {
      return {
        message: "Form errors",
        error: errors,
        code: "error",
        data: null,
      };
    }

    return {
      message: "All fields valid",
      code: "success",
      data: null,
      error: null,
    };
  }







  // ----------------------------
  // ✅ VERIFY EMAIL
  // ----------------------------

  async verify_registration_email(email) {
    const user = await UserModel.findOne({ email });

    if (!user) {
      return {
        message: "User not found",
        code: "error",
        data: null,
      };
    }

    if (user.is_email_verified) {
      return {
        message: "Email already verified",
        code: "invalid-details",
        data: null,
      };
    }

    user.is_email_verified = true;
    await user.save();

    return {
      message: "Email verified successfully",
      code: "success",
      data: null,
    };
  }






  // ----------------------------
  // ✅ RETRIEVE HASHED PASSWORD
  // ----------------------------

  async retrieveUserPassword(email) {
    const user = await UserModel.findOne({ email });
    return user ? user.password : null;
  }







  // ----------------------------
  // ✅ LOGIN METHOD
  // ----------------------------

  async loginUser(email, password) {
    const user = await UserModel.findOne({ email });

    if (!user) {
      return {
        message: "Account not found",
        code: "error",
        data: null,
      };
    }

    const match = await bcrypt.compare(password, user.password);

    if (match) {
      return {
        message: "Login successful",
        code: "success",
        data: user,
      };
    } else {
      return {
        message: "Email/Password incorrect",
        code: "invalid-details",
        data: null,
      };
    }
  }







  // ----------------------------
  // ✅ SEND OTP VIA TWILIO
  // ----------------------------

  async sendOTP(phone, otp) {
    try {
      const message = await this.twilioClient.messages.create({
        body: `Your Kepta OTP code is: ${otp}`,
        to: phone,
        from: process.env.TWILIO_PHONE_NUMBER,
      });

      console.log("Twilio message response:", message);

      return {
        message: "OTP sent successfully",
        code: "success",
        data: null,
      };

    } catch (err) {
      console.error("Twilio error:", err.message);

      return {
        message: "Could not send OTP",
        code: "error",
        data: null,
      };
    }
  }







  // ----------------------------
  // ✅ VERIFY OTP METHOD
  // ----------------------------

  async verifyOTP(phone, inputOtp) {
    const record = otpStore[phone];

    if (!record) {
      return {
        message: "No OTP sent to this phone",
        code: "error",
        data: null,
      };
    }

    if (Date.now() > record.expiresAt) {
      delete otpStore[phone];
      return {
        message: "OTP expired",
        code: "error",
        data: null,
      };
    }

    if (record.otp !== inputOtp) {
      return {
        message: "Invalid OTP",
        code: "invalid",
        data: null,
      };
    }

    // ✅ OTP correct – clean up
    delete otpStore[phone];

    return {
      message: "OTP verified",
      code: "success",
      data: null,
    };
  }
}



// ----------------------------
// ✅ EXPORT USER CLASS
// ----------------------------

module.exports = User;
