import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import AccountCard from "../components/AccountCard";

export default function AppLayout({ onSignOut, user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const activeTab = (() => {
    if (location.pathname.startsWith("/timeline")) return "Timeline";
    if (location.pathname.startsWith("/games")) return "Games";
    if (location.pathname.startsWith("/letters")) return "Letters";
    return "Dashboard";
  })();

  const onTabChange = (tab) => {
    switch (tab) {
      case "Timeline":
        navigate("/timeline");
        break;
      case "Games":
        navigate("/games");
        break;
      case "Letters":
        navigate("/letters");
        break;
      default:
        navigate("/dashboard");
        break;
    }
    setMobileOpen(false);
  };

  const handleAccount = () => {
    setAccountOpen(true);
  };

  // Close mobile nav with Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [mobileOpen]);

  // Close account modal with Escape
  useEffect(() => {
    if (!accountOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") {
        setAccountOpen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [accountOpen]);


  return (
    <div className="min-h-screen w-full relative">
      <TopNav
        activeTab={activeTab}
        onTabChange={onTabChange}
        onSignOut={onSignOut}
        onAccount={handleAccount}
        onToggleMobileNav={() => setMobileOpen((s) => !s)}
      />

      {/* Mobile left drawer nav, rendered at layout level to span full screen */}
      {mobileOpen && (
        <div
          className="mobile-nav-overlay"
          role="presentation"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="mobile-nav-drawer"
            role="menu"
            aria-label="Mobile menu"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-nav-header">
              <span className="mobile-nav-title">Menu</span>
            </div>
            <nav className="mobile-nav-list">
              {["Dashboard", "Timeline", "Games", "Letters"].map((t) => (
                <button
                  key={t}
                  onClick={() => onTabChange(t)}
                  className={`mobile-nav-item ${
                    activeTab === t ? "active" : ""
                  }`}
                  role="menuitem"
                >
                  {t}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Page Content */}
      <main className="app-main">
        <Outlet />
      </main>

      {/* Account modal */}
      {accountOpen && (
        <AccountCard
          onClose={() => setAccountOpen(false)}
          onSignOut={() => { setAccountOpen(false); onSignOut(); }}
          user={user}
        />
      )}
    </div>
  );
}
