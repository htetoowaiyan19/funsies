import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase/config";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import Timeline from "./pages/Timeline";
import Games from "./pages/Games";
import Letters from "./pages/Letters";
import AppLayout from "./layouts/AppLayout";

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="./login" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
  };

  if (loading) return null;

  return (
    <BrowserRouter>
      <div className="bg-blobs" />

      <Routes>
        {/* Public routes */}
        <Route
          path="/auth"
          element={!user ? <AuthPage /> : <Navigate to="/dashboard" replace />}
        />

        {/* Redirect / to login if not logged in, or to dashboard if logged in */}
        <Route
          path="/"
          element={
            user ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/auth?mode=login" replace />
            )
          }
        />

        {/* Protected routes */}
        <Route
          element={
            <ProtectedRoute user={user}>
              <AppLayout onSignOut={handleSignOut} user={user} />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/games" element={<Games />} />
          <Route path="/letters" element={<Letters />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
