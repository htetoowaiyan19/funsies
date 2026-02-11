/* eslint-disable no-unused-vars */
import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, firestore } from "../firebase/config";
import { doc, setDoc, getDoc, Timestamp } from "firebase/firestore";
import { generateUniquePartnerID } from "../utils/partnerId";
import { motion } from "framer-motion";

export default function Register({ onSwitch, onSuccess }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const handleRegister = async () => {
  setMessage("");
  setIsError(false);

  if (!email || !password) {
    setMessage("Please enter email and password");
    setIsError(true);
    return;
  }

  if (password !== confirm) {
    setMessage("Passwords do not match");
    setIsError(true);
    return;
  }

  // 1️⃣ Create user in Firebase Auth
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // 2️⃣ Update displayName if provided
    if (name && cred.user) {
      await updateProfile(cred.user, { displayName: name });
    }
  } catch (error) {
    console.error("Registration error:", error);

    // Friendly error messages (auth errors)
    const code = error.code || "";
    let friendly = "Registration failed";
    if (code.includes("email-already-in-use")) friendly = "This email is already registered";
    else if (code.includes("invalid-email")) friendly = "Please enter a valid email";
    else if (code.includes("weak-password")) friendly = "Password should be at least 6 characters.";
    else if (code.includes("missing-password")) friendly = "Please enter password";
    else if (error.message) friendly = error.message;

    setMessage(friendly);
    setIsError(true);
    return;
  }

  // Immediately mark registration as successful and notify parent (don't block on creating Firestore doc)
  setMessage("Registration successful — signed in.");
  setIsError(false);
  if (onSuccess) onSuccess();

  // Create the user's Firestore document in the background. Failures here will not roll back auth.
  (async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const uid = user.uid;
      const userRef = doc(firestore, "users", uid);
      const existing = await getDoc(userRef);

      if (existing.exists() && existing.data()?.partnerID) {
        console.log("User document already exists — skipping creation");
        return;
      }

      const partnerID = await generateUniquePartnerID(firestore);
      const ts = Timestamp.now();
      const docData = {
        displayName: name || user.displayName || "",
        email,
        partnerID,
        connectedPartnerID: null,
        anniversaryDate: null,
        createdAt: ts,
        partnerIDLastGenerated: ts,
      };

      await setDoc(userRef, docData, { merge: false });
      console.log('User document created');
    } catch (err) {
      console.error('Failed to create user document (non-fatal):', err);
    }
  })();
};


  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="min-h-screen flex items-center justify-center"
    >
      <div className="auth-card bg-white/90 backdrop-blur-lg p-10 rounded-3xl shadow-2xl w-full max-w-md border border-pink-200">
        <h2 className="text-3xl font-bold text-center mb-8 text-pink-600 drop-shadow-md">
          ✨ Create an account
        </h2>

        <input
          type="text"
          placeholder="Name"
          className="w-full mb-4 p-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 text-gray-900 placeholder-gray-400 shadow-sm hover:shadow-md transition"
          onChange={(e) => setName(e.target.value)}
        />

        <input
          type="email"
          placeholder="Email"
          className="w-full mb-5 p-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 text-gray-900 placeholder-gray-400 shadow-sm hover:shadow-md transition"
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full mb-5 p-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 text-gray-900 placeholder-gray-400 shadow-sm hover:shadow-md transition"
          onChange={(e) => setPassword(e.target.value)}
        />

        <input
          type="password"
          placeholder="Confirm password"
          className="w-full mb-6 p-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 text-gray-900 placeholder-gray-400 shadow-sm hover:shadow-md transition"
          onChange={(e) => setConfirm(e.target.value)}
        />

        {message && (
          <div className={`mb-3 text-sm ${isError ? 'text-red-600' : 'text-green-600'}`}>
            {message}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '6px' }}>
          <button
            onClick={handleRegister}
            className="bg-pink-500 text-white py-3 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:bg-pink-600 transition-all duration-300"
          >
            Create account
          </button>
        </div>

        <p className="text-center text-gray-500 mt-4">
          Already have an account?{' '}
          <a
            href="#login"
            onClick={(e) => { e.preventDefault(); onSwitch(); }}
            className="text-pink-500 font-medium hover:underline"
          >
            Login
          </a>
        </p>
      </div>
    </motion.div>
  );
}