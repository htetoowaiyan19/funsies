/* eslint-disable no-unused-vars */
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Login from "../pages/Login";
import Register from "../pages/Register";
import { AnimatePresence, motion } from "framer-motion";

export default function Auth() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") || "login";
  const [mode, setMode] = useState(initialMode);

  useEffect(() => {
    setSearchParams({ mode });
  }, [mode, setSearchParams]);

  const handleSwitch = () => {
    setMode((prev) => (prev === "login" ? "register" : "login"));
  };

  const navigate = useNavigate();
  const handleSuccess = () => {
    navigate("/dashboard", { replace: true });
  };

  return (
    <AnimatePresence mode="wait">
      {mode === "login" ? (
        <motion.div
          key="login"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.4 }}
        >
          <Login onSwitch={handleSwitch} onSuccess={handleSuccess} />
        </motion.div>
      ) : (
        <motion.div
          key="register"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.4 }}
        >
          <Register onSwitch={handleSwitch} onSuccess={handleSuccess} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}