import { useState, useRef, useEffect } from "react";
import { firestore, auth } from "../firebase/config";
import {
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
  getDoc,
  updateDoc,
  getDocs,
  where,
  addDoc,
  Timestamp,
  runTransaction,
  deleteDoc,
} from "firebase/firestore";
import { generateUniquePartnerID } from "../utils/partnerId";
import { updateProfile, updateEmail, sendPasswordResetEmail, deleteUser } from "firebase/auth";

export default function AccountCard({ user, onClose, onSignOut }) {
  const [partnerCode, setPartnerCode] = useState("");
  const [anniversary, setAnniversary] = useState("");
  const [userDoc, setUserDoc] = useState(null);
  const [requests, setRequests] = useState(null); // null = not loaded yet, [] = loaded no requests
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingError, setLoadingError] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [connectedPartnerName, setConnectedPartnerName] = useState("");

  const canRegenerate = (() => {
    if (!userDoc) return false;
    try {
      const now = new Date();
      const createdAt = userDoc.createdAt ? (userDoc.createdAt.toDate ? userDoc.createdAt.toDate() : new Date(userDoc.createdAt)) : null;
      const lastGen = userDoc.partnerIDLastGenerated ? (userDoc.partnerIDLastGenerated.toDate ? userDoc.partnerIDLastGenerated.toDate() : new Date(userDoc.partnerIDLastGenerated)) : null;
      const daysSinceCreated = createdAt ? (now - createdAt) / (1000 * 60 * 60 * 24) : Infinity;
      const daysSinceLast = lastGen ? (now - lastGen) / (1000 * 60 * 60 * 24) : Infinity;
      return daysSinceCreated >= 90 || daysSinceLast >= 90;
    } catch (e) {
      console.log(e);
      return false;
    }
  })();

  const cardRef = useRef(null);
  const headerRef = useRef(null);

  const today = new Date();
  const currentYear = today.getFullYear();

  const minDate = `${currentYear - 100}-01-01`;
  const maxDate = `${currentYear}-12-31`;

  const displayName = user?.displayName || "Account Name";

  // Timer options persisted to localStorage. Keys match the Dashboard segment keys.
  const DEFAULT_TIMER_OPTIONS = {
    years: true,
    months: true,
    days: true,
    hours: true,
    minutes: true,
    seconds: true,
    ms: false,
  };

  const [timerOptions, setTimerOptions] = useState(() => {
    try {
      const raw = localStorage.getItem("timerOptions");
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.log(e);
    }
    return DEFAULT_TIMER_OPTIONS;
  });

  const saveTimerOptions = (opts) => {
    try {
      localStorage.setItem("timerOptions", JSON.stringify(opts));
      // notify other listeners in the same window
      window.dispatchEvent(new Event("timerOptionsChanged"));
    } catch (e) {
      console.log(e);
    }
  };

  const toggleTimerOption = (key) => {
    setTimerOptions((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveTimerOptions(next);
      return next;
    });
  };

  const maskedEmail = (() => {
    if (!user?.email) return "email@hidden.com";
    const [local, domain] = user.email.split("@");
    if (!domain) return user.email;
    return `${local.slice(0, 2)}*****@${domain}`;
  })();

  const handlePartnerCode = (v) =>
    setPartnerCode(v.toUpperCase().replace(/[^A-Z0-9]/g, ""));

  const handleSaveDate = async () => {
    if (!auth.currentUser) return;
    if (!anniversary) return;

    // only allow saving if connected
    if (!userDoc?.connectedPartnerID) {
      setActionMsg("Connect to a partner before setting anniversary.");
      setTimeout(() => setActionMsg(''), 3000);
      return;
    }

    try {
      const uid = auth.currentUser.uid;
      const userRef = doc(firestore, 'users', uid);

      // find partner uid by partnerID
      const q = query(collection(firestore, 'users'), where('partnerID', '==', userDoc.connectedPartnerID));
      const snap = await getDocs(q);
      const partnerUid = snap.empty ? null : snap.docs[0].id;

      // update both docs in a transaction
      await runTransaction(firestore, async (tx) => {
        tx.update(userRef, { anniversaryDate: anniversary });
        if (partnerUid) {
          const partnerRef = doc(firestore, 'users', partnerUid);
          tx.update(partnerRef, { anniversaryDate: anniversary });
        }
      });

      setActionMsg("Anniversary saved for both accounts.");
      setTimeout(() => setActionMsg(''), 3000);
      onClose();
    } catch (e) {
      console.log(e);
      setActionMsg("Failed to save anniversary.");
      setTimeout(() => setActionMsg(''), 3000);
    }
  };

  // End partnership helper (clears connection on both users)
  const handleEndPartnership = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Not signed in');
      const connectedID = userDoc?.connectedPartnerID;
      if (!connectedID) { setActionMsg('No partner connected'); setTimeout(() => setActionMsg(''), 3000); return; }

      // find partner uid
      const q = query(collection(firestore, 'users'), where('partnerID', '==', connectedID));
      const snap = await getDocs(q);
      const partnerUid = snap.empty ? null : snap.docs[0].id;

      await runTransaction(firestore, async (tx) => {
        const meRef = doc(firestore, 'users', uid);
        tx.update(meRef, { connectedPartnerID: null });
        if (partnerUid) tx.update(doc(firestore, 'users', partnerUid), { connectedPartnerID: null });
      });

      // Reset timer options to defaults for this user and persist (Dashboard listens for storage changes)
      setTimerOptions(DEFAULT_TIMER_OPTIONS);
      saveTimerOptions(DEFAULT_TIMER_OPTIONS);

      setActionMsg('Partnership ended — timer reset'); setTimeout(() => setActionMsg(''), 3000);
    } catch (e) { console.error(e); setActionMsg(e?.message || 'Failed to end partnership'); setTimeout(() => setActionMsg(''), 3000); }
  };

  // Position the fixed header to match the account card's top/width/left.
  useEffect(() => {
    if (!cardRef.current || !headerRef.current) return;

    const origPadTop = parseFloat(getComputedStyle(cardRef.current).paddingTop) || 0;

    const update = () => {
      const cardRect = cardRef.current.getBoundingClientRect();
      const computed = getComputedStyle(cardRef.current);

      // position header to visually match the card top/width
      headerRef.current.style.position = "fixed";
      headerRef.current.style.left = `${cardRect.left}px`;
      headerRef.current.style.top = `${cardRect.top}px`;
      headerRef.current.style.width = `${cardRect.width}px`;
      headerRef.current.style.borderTopLeftRadius = computed.borderTopLeftRadius;
      headerRef.current.style.borderTopRightRadius = computed.borderTopRightRadius;
      headerRef.current.style.zIndex = 95;

      // ensure card content is pushed down so it doesn't sit under the fixed header
      const headerH = Math.ceil(headerRef.current.offsetHeight || 56);
      cardRef.current.style.paddingTop = `${origPadTop + headerH}px`;
    };

    update();
    window.addEventListener("resize", update);

    // listen to current user's user doc and incoming partner requests
    let unsubUser = null;
    let unsubReq = null;

    try {
      const uid = user?.uid || (auth.currentUser && auth.currentUser.uid);
      if (uid) {
        const uRef = doc(firestore, "users", uid);
        setLoadingUser(true);
        setLoadingError(false);
        const userTimeout = setTimeout(() => {
          setLoadingError(true);
          setLoadingUser(false);
        }, 30000); // 30s timeout

        unsubUser = onSnapshot(uRef, (snap) => {
          setLoadingUser(false);
          clearTimeout(userTimeout);
          setUserDoc(snap.exists() ? snap.data() : null);
          // reflect anniversary in local state so input reflects current value
          if (snap.exists()) {
            const d = snap.data();
            setAnniversary(d.anniversaryDate || "");
          }

          // fetch connected partner name for display
          (async () => {
            try {
              const connectedID = snap.exists() ? snap.data().connectedPartnerID : null;
              if (connectedID) {
                const q = query(collection(firestore, 'users'), where('partnerID', '==', connectedID));
                const partnerSnap = await getDocs(q);
                if (!partnerSnap.empty) {
                  const p = partnerSnap.docs[0].data();
                  setConnectedPartnerName(p.displayName || 'Partner');
                } else {
                  setConnectedPartnerName('Unknown');
                }
              } else {
                setConnectedPartnerName('');
              }
            } catch (e) {
              console.log('Failed to fetch partner name', e);
            }
          })();
        });

        const reqsRef = collection(firestore, "users", uid, "partnerRequests");
        const q = query(reqsRef, orderBy("createdAt", "desc"));
        setLoadingRequests(true);
        unsubReq = onSnapshot(q, (snap) => {
          setLoadingRequests(false);
          // if snapshot empty -> set to [] (loaded but no data); otherwise map documents
          setRequests(snap.empty ? [] : snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
      }
    } catch (e) {
      console.log(e);
    }

    // keep header in sync if the card size changes
    let ro = null;
    try {
      ro = new ResizeObserver(update);
      ro.observe(cardRef.current);
    } catch (e) {
      console.log(e);
    }

    return () => {
      window.removeEventListener("resize", update);
      if (ro) ro.disconnect();
      if (unsubUser) unsubUser();
      if (unsubReq) unsubReq();
    };
  }, []);

  return (
    <div
      className="account-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      {/* Fixed header rendered as a separate element so scrolling the card doesn't affect it */}
      <div
        ref={headerRef}
        className="account-header-bar account-header-fixed"
        onClick={(e) => e.stopPropagation()}
        role="banner"
      >
        <span className="account-header-title">Account</span>
        <button
          className="account-close"
          aria-label="Close"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
        >
          ×
        </button>
      </div>

      <div
        ref={cardRef}
        className="auth-card account-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="account-header">
          <h2>{displayName}</h2>
          <p className="account-email">{maskedEmail}</p>
          {userDoc?.connectedPartnerID && (
            <div style={{ marginTop: 6, fontSize: 13, color: '#555' }}>
              Connected to: <strong>{connectedPartnerName || userDoc.connectedPartnerID}</strong>
            </div>
          )}
        </div>

        <hr className="account-divider" />

        {(((loadingUser && userDoc === null) || (loadingRequests && requests === null))) && !loadingError && (
          <div className="account-loading">
            <div className="spinner" aria-hidden="true"></div>
            <div>Loading account data…</div>
          </div>
        )}

        {loadingError && (
          <div className="account-loading" style={{ color: '#c63' }}>
            <div className="spinner" aria-hidden="true"></div>
            <div>Data is taking longer than expected. Please check your network or try again later.</div>
          </div>
        )}

        <section className="account-section">
          <h4>Connect to Partner</h4>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <p className="account-help">
                Share a 6-letter code with your partner to link dashboards.
              </p>
              <input
                type="text"
                value={partnerCode}
                maxLength={6}
                onChange={(e) => handlePartnerCode(e.target.value)}
                placeholder="ABC123"
                className="account-input"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                className="account-date-btn"
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!partnerCode) return;
                  try {
                    const uid = auth.currentUser?.uid;
                    if (!uid) throw new Error('Not signed in');

                    // Find the target user by partnerID
                    const q = query(collection(firestore, 'users'), where('partnerID', '==', partnerCode));
                    const snap = await getDocs(q);
                    if (snap.empty) throw new Error('Partner ID not found');

                    const targetDoc = snap.docs[0];
                    const targetUid = targetDoc.id;
                    if (targetUid === uid) throw new Error('Cannot send request to yourself');

                    const requesterSnap = await getDoc(doc(firestore, 'users', uid));
                    const requesterData = requesterSnap.data() || {};
                    const targetData = targetDoc.data() || {};

                    if (requesterData.connectedPartnerID) throw new Error('Already connected');
                    if (targetData.connectedPartnerID) throw new Error('Target already connected');

                    // Check duplicate pending request
                    const reqsRef = collection(firestore, 'users', targetUid, 'partnerRequests');
                    const dupQ = query(reqsRef, where('requesterUid', '==', uid), where('status', '==', 'pending'));
                    const dupSnap = await getDocs(dupQ);
                    if (!dupSnap.empty) throw new Error('Pending request already exists');

                    await addDoc(reqsRef, {
                      requesterUid: uid,
                      requesterPartnerID: requesterData.partnerID || null,
                      requesterDisplayName: requesterData.displayName || '',
                      createdAt: Timestamp.now(),
                      status: 'pending',
                    });

                    setActionMsg('Request sent');
                    setTimeout(() => setActionMsg(''), 2500);
                  } catch (err) {
                    console.error(err);
                    setActionMsg(err?.message || 'Failed to send request');
                    setTimeout(() => setActionMsg(''), 3000);
                  }
                }}
              >
                Connect
              </button>

              <button
                className="account-action-btn"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const uid = auth.currentUser?.uid;
                    if (!uid) throw new Error('Not signed in');
                    if (!canRegenerate) throw new Error('Cannot regenerate yet');

                    const newID = await generateUniquePartnerID(firestore);
                    await updateDoc(doc(firestore, 'users', uid), { partnerID: newID, partnerIDLastGenerated: Timestamp.now() });

                    setActionMsg(`New ID: ${newID}`);
                    setTimeout(() => setActionMsg(''), 4000);
                  } catch (err) {
                    console.error(err);
                    setActionMsg(err?.message || 'Cannot regenerate yet');
                    setTimeout(() => setActionMsg(''), 4000);
                  }
                }}
                disabled={!canRegenerate}
                style={!canRegenerate ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
              >
                Regenerate ID
              </button>

              <button className="account-action-btn" onClick={(e) => { e.stopPropagation(); handleEndPartnership(); }}>End partnership</button>
            </div>
          </div>

          {/* Display partner ids */}
          <div style={{ marginTop: 12 }}>
            <div><strong>User Partner ID:</strong> {userDoc?.partnerID || '—'}</div>
            {userDoc?.connectedPartnerID && (
              <div><strong>Connected Partner:</strong> {connectedPartnerName ? `${connectedPartnerName} (${userDoc.connectedPartnerID})` : userDoc.connectedPartnerID}</div>
            )}
          </div>

          {/* Incoming requests */}
          {requests && requests.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <h4>Partner Requests</h4>
              {requests.slice(0, 3).map((r) => (
                <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{r.requesterDisplayName || r.requesterPartnerID || 'Unknown'}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>ID: {r.requesterPartnerID}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="account-action-btn" onClick={async () => {
                      try {
                          const uid = auth.currentUser?.uid;
                          if (!uid) throw new Error('Not signed in');

                          const reqRef = doc(firestore, 'users', uid, 'partnerRequests', r.id);

                          await runTransaction(firestore, async (tx) => {
                            const reqSnap = await tx.get(reqRef);
                            if (!reqSnap.exists()) throw new Error('Request not found');
                            if (reqSnap.data().status !== 'pending') throw new Error('Request already handled');

                            const requesterUid = reqSnap.data().requesterUid;
                            const requesterRef = doc(firestore, 'users', requesterUid);
                            const targetRef = doc(firestore, 'users', uid);

                            const requesterSnap = await tx.get(requesterRef);
                            const targetSnap = await tx.get(targetRef);

                            if (!requesterSnap.exists() || !targetSnap.exists()) throw new Error('User not found');

                            const requesterData = requesterSnap.data();
                            const targetData = targetSnap.data();

                            if (requesterData.connectedPartnerID || targetData.connectedPartnerID) {
                              await tx.update(reqRef, { status: 'failed', respondedAt: Timestamp.now() });
                              throw new Error('Either user already connected');
                            }

                            const anniversaryDate = requesterData.anniversaryDate || targetData.anniversaryDate || '2005-07-19';

                            tx.update(requesterRef, { connectedPartnerID: targetData.partnerID, anniversaryDate });
                            tx.update(targetRef, { connectedPartnerID: requesterData.partnerID, anniversaryDate });
                            // delete the request document as it's handled
                            tx.delete(reqRef);
                          });

                        // remove from local state immediately
                        setRequests((prev) => (prev ? prev.filter((req) => req.id !== r.id) : []));
                        setActionMsg('Request accepted');
                        setTimeout(() => setActionMsg(''), 3000);
                      } catch (err) { console.error(err); setActionMsg(err?.message || 'Failed'); setTimeout(() => setActionMsg(''), 3000);}            
                    }}>Accept</button>
                    <button className="account-action-btn" onClick={async () => {
                      try {
                          const uid = auth.currentUser?.uid;
                          if (!uid) throw new Error('Not signed in');

                          const reqRef = doc(firestore, 'users', uid, 'partnerRequests', r.id);
                          // delete the request document to keep DB clean
                          await deleteDoc(reqRef);

                        setRequests((prev) => (prev ? prev.filter((req) => req.id !== r.id) : []));
                        setActionMsg('Request denied');
                        setTimeout(() => setActionMsg(''), 3000);
                      } catch (err) { console.error(err); setActionMsg(err?.message || 'Failed'); setTimeout(() => setActionMsg(''), 3000);}            
                    }}>Deny</button>
                  </div>
                </div>
              ))}
              {requests.length > 3 && <div style={{ fontSize: 12, color: '#666' }}>+ {requests.length - 3} more</div>}
            </div>
          )}

          {actionMsg && <div style={{ marginTop: 8 }} className="account-help">{actionMsg}</div>}
        </section>

        <hr className="account-divider" />

        {/* 🎉 CLEAN DATE PICKER */}
        <section className="account-section">
          <h4>Partnership Settings</h4>
          <h3>Anniversary Date</h3>
          <p className="account-help">
            Select your anniversary date.
          </p>

          <div style={{ filter: userDoc?.connectedPartnerID ? 'none' : 'blur(4px) grayscale(0.08)', pointerEvents: userDoc?.connectedPartnerID ? 'auto' : 'none' }}>
            <div className="account-date-row">
              <input
                type="date"
                value={anniversary}
                min={minDate}
                max={maxDate}
                onChange={(e) => setAnniversary(e.target.value)}
                className="account-date-picker"
                placeholder={userDoc?.connectedPartnerID || userDoc?.anniversaryDate ? undefined : '2005-07-19'}
              />

              <button
                type="button"
                className="account-date-btn"
                disabled={!anniversary}
                onClick={handleSaveDate}
              >
                Save
              </button>
            </div>
            <h3>Timer Options</h3>
            <p className="account-help">
              Select which time components should displayed at the dashboard timer. (This setting do not affect your partner.)
            </p>

            <div className="timer-options">
              {Object.entries(timerOptions).map(([key, value]) => (
                <label key={key} className="timer-option">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={() => toggleTimerOption(key)}
                  />
                  <span className="timer-label">
                    {(
                      {
                        years: "Years",
                        months: "Months",
                        days: "Days",
                        hours: "Hours",
                        minutes: "Minutes",
                        seconds: "Seconds",
                        ms: "Milliseconds",
                      }[key] || key
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </section>

        <hr className="account-divider" />

        <section className="account-section account-grid">
          <button className="account-action-btn" onClick={async () => {
            const newName = prompt('Enter new display name', userDoc?.displayName || displayName || '');
            if (!newName) return;
            try {
              const u = auth.currentUser;
              if (!u) throw new Error('Not signed in');
              await updateProfile(u, { displayName: newName });
              await updateDoc(doc(firestore, 'users', u.uid), { displayName: newName });
              setActionMsg('Display name updated'); setTimeout(() => setActionMsg(''), 3000);
            } catch (e) { console.error(e); setActionMsg('Failed to update name'); setTimeout(() => setActionMsg(''), 3000); }
          }}>Change username</button>

          <button className="account-action-btn" onClick={async () => {
            const newEmail = prompt('Enter new email', userDoc?.email || '');
            if (!newEmail) return;
            try {
              const u = auth.currentUser;
              if (!u) throw new Error('Not signed in');
              await updateEmail(u, newEmail);
              await updateDoc(doc(firestore, 'users', u.uid), { email: newEmail });
              setActionMsg('Email updated'); setTimeout(() => setActionMsg(''), 3000);
            } catch (e) { console.error(e); setActionMsg(e?.message || 'Failed to update email'); setTimeout(() => setActionMsg(''), 4000); }
          }}>Change email</button>

          <button className="account-action-btn" onClick={async () => {
            try {
              const u = auth.currentUser;
              if (!u || !u.email) throw new Error('No email to reset');
              await sendPasswordResetEmail(auth, u.email);
              setActionMsg('Password reset email sent'); setTimeout(() => setActionMsg(''), 3000);
            } catch (e) { console.error(e); setActionMsg(e?.message || 'Failed to send reset'); setTimeout(() => setActionMsg(''), 3000); }
          }}>Reset password</button>
        </section>

        <section className="account-section account-footer">
          <button className="account-signout" onClick={onSignOut}>
            Sign out
          </button>

          <button className="account-danger" onClick={async () => {
            // Delete account flow
            if (!confirm('Delete your account? This cannot be undone.')) return;
            try {
              const u = auth.currentUser;
              if (!u) throw new Error('Not signed in');
              const uid = u.uid;
              // delete user doc
              await deleteDoc(doc(firestore, 'users', uid));
              // try to delete auth
              try {
                await deleteUser(u);
                onSignOut();
              } catch (e) {
                console.error('Failed to delete auth user:', e);
                setActionMsg('Account deleted from DB, but auth required re-login to delete'); setTimeout(() => setActionMsg(''), 5000);
              }
            } catch (e) { console.error(e); setActionMsg('Failed to delete account'); setTimeout(() => setActionMsg(''), 3000); }
          }}>Delete account</button>
        </section>
      </div>
    </div>
  );
}