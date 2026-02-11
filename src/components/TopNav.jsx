import { useState } from "react";

const tabs = ["Dashboard", "Timeline", "Games", "Letters"];

export default function TopNav({ activeTab, onTabChange, onSignOut, onAccount, onToggleMobileNav }) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className="dashboard-top">
      <div className="topnav-inner">
        {/* Tabs */}
        <nav className="dashboard-nav" role="navigation" aria-label="Main">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => { onTabChange(t); }}
              aria-current={activeTab === t ? "true" : undefined}
              className={`tab-button ${activeTab === t ? "active" : ""}`}
              style={{ background: "transparent", border: "none" }}
            >
              {t}
            </button>
          ))}
        </nav>

        {/* Mobile hamburger (shows on small screens) */}
        <button
          className="mobile-menu-button"
          aria-label="Open menu"
          onClick={onToggleMobileNav}
        >
          <span className="hamburger" aria-hidden="true"></span>
        </button>

        {/* Mobile menu is rendered at layout level as a side drawer */}

        {/* Profile */}
        <div className="profile-container" style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)" }}>
          <div className="relative">
            {/* Profile Icon */}
            <button
              onClick={() => setProfileOpen((s) => !s)}
              aria-label="Profile"
              className="profile-btn"
              style={{
                width: 48,
                height: 48,
                border: "none",
                background: "linear-gradient(135deg,#ffb6de,#cdb1ff)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5z"
                  fill="#ff6fb5"
                />
                <path
                  d="M2 22c0-3.866 3.134-7 7-7h6c3.866 0 7 3.134 7 7H2z"
                  fill="#bba6ff"
                />
              </svg>
            </button>

            {/* Dropdown */}
            {profileOpen && (
              <div className="profile-dropdown" role="menu" aria-label="Profile menu">
                {/* Account */}
                <button
                  onClick={() => { onAccount(); setProfileOpen(false); }}
                  className="dropdown-item"
                >
                  Account
                </button>

                {/* Partial divider */}
                <div className="divider"></div>

                {/* Sign Out */}
                <button
                  onClick={() => { onSignOut(); setProfileOpen(false); }}
                  className="dropdown-item sign-out"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}