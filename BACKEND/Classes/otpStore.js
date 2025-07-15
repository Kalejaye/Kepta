// ===========================================
// otpStore.js
// This file acts as a temporary in-memory store
// to hold OTPs and their expiration time.
// ===========================================

// Create an empty object to hold OTP records
// Format: {
//   "+2348012345678": { otp: "123456", expiresAt: timestamp }
// }
const otpStore = {};

// Export the object for use in other modules
module.exports = otpStore;
