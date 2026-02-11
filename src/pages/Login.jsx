/* eslint-disable no-unused-vars */
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase/config";
import { motion } from "framer-motion"; // Optional for animation

export default function Login({ onSwitch, onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const handleLogin = async () => {
    setMessage("");
    setIsError(false);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setMessage("Login successful");
      setIsError(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      const code = error.code || "";
      let friendly = "Login failed";
      if (code.includes("missing-password")) {
        friendly = "Please enter Password";
      } else if (
        code.includes("wrong-password") ||
        code.includes("user-not-found") ||
        code.includes("invalid-credential")
      ) {
        friendly = "Email or Password incorrect";
      } else if (code.includes("invalid-email")) {
        friendly = "Please enter a valid email";
      } else if (code.includes("too-many-requests")) {
        friendly = "Too many attempts. Try again later.";
      } else if (error.message) {
        friendly = error.message;
      }
      setMessage(friendly);
      setIsError(true);
    }
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
          💖 Welcome Back
        </h2>

        <input
          type="email"
          placeholder="Email"
          className="w-full mb-5 p-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 text-gray-900 placeholder-gray-400 shadow-sm hover:shadow-md transition"
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full mb-6 p-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 text-gray-900 placeholder-gray-400 shadow-sm hover:shadow-md transition"
          onChange={(e) => setPassword(e.target.value)}
        />

        {message && (
          <div className={`mb-3 text-sm ${isError ? 'text-red-600' : 'text-green-600'}`}>
            {message}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '6px' }}>
          <button
            onClick={handleLogin}
            className="bg-pink-500 text-white py-3 px-6 rounded-xl font-bold shadow-lg hover:shadow-xl hover:bg-pink-600 transition-all duration-300"
          >
            Login
          </button>
        </div>

        <p className="text-center text-gray-500 mt-4">
          Don’t have an account?{' '}
          <a
            href="#register"
            onClick={(e) => {
              e.preventDefault();
              onSwitch();
            }}
            className="text-pink-500 font-medium cursor-pointer hover:underline"
          >
            Register
          </a>
        </p>
      </div>
    </motion.div>
  );
}