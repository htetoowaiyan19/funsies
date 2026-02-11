import React, { useEffect, useState, useRef } from "react";
import { firestore, auth } from "../firebase/config";
import { doc, onSnapshot, query, where, getDocs, collection } from "firebase/firestore";
// import { ref as dbRef, onValue } from "firebase/database";
// import { db } from "../firebase/config";

function pad(num, size = 2) {
  let s = String(num);
  while (s.length < size) s = "0" + s;
  return s;
}

export default function Dashboard() {
  // Anniversary start date (UTC). Default is 2005-07-19 when no partner and no stored anniversary exists.
  const DEFAULT_ANNIVERSARY_ISO = "2005-07-19T00:00:00Z";
  const anniversary = useRef(new Date(DEFAULT_ANNIVERSARY_ISO).getTime());

  // Keep anniversary in sync with Firestore user doc (or connected partner) when logged in
  useEffect(() => {
    let unsub = null;
    let partnerUnsub = null;

    const uid = auth.currentUser?.uid;
    if (!uid) {
      // not signed in: keep default
      anniversary.current = new Date(DEFAULT_ANNIVERSARY_ISO).getTime();
      return;
    }

    try {
      const uRef = doc(firestore, "users", uid);
      unsub = onSnapshot(uRef, async (snap) => {
        if (!snap.exists()) {
          anniversary.current = new Date(DEFAULT_ANNIVERSARY_ISO).getTime();
          return;
        }

        const data = snap.data();

        if (data.anniversaryDate) {
          // stored anniversary on user's doc -> use it
          anniversary.current = new Date(data.anniversaryDate).getTime();
          return;
        }

        // no anniversary on user's doc; if connected to partner, try fetching partner's doc
        if (data.connectedPartnerID) {
          try {
            const q = query(collection(firestore, "users"), where("partnerID", "==", data.connectedPartnerID));
            const snaps = await getDocs(q);
            if (!snaps.empty) {
              const partnerData = snaps.docs[0].data();
              if (partnerData.anniversaryDate) {
                anniversary.current = new Date(partnerData.anniversaryDate).getTime();
                return;
              }
            }
          } catch (err) {
            console.log(err);
          }
        }

        // fallback: default anniversary
        anniversary.current = new Date(DEFAULT_ANNIVERSARY_ISO).getTime();
      });
    } catch (e) {
      console.log(e);
      anniversary.current = new Date(DEFAULT_ANNIVERSARY_ISO).getTime();
    }

    return () => {
      if (unsub) unsub();
      if (partnerUnsub) partnerUnsub();
    };
  }, []);
  const [time, setTime] = useState({});
  const [hovered, setHovered] = useState(null);
  const [popoutPos, setPopoutPos] = useState(null);
  const segmentRefs = useRef({});
  const timerGridRef = useRef(null);
  const [serverOffset] = useState(0);

  useEffect(() => {
    const tick = () => {
      const now = Date.now() + (serverOffset || 0);
      const diff = now - anniversary.current;

      const totalMs = diff;
      const totalSeconds = Math.floor(totalMs / 1000);
      const totalMinutes = Math.floor(totalMs / (1000 * 60));
      const totalHours = Math.floor(totalMs / (1000 * 60 * 60));
      const totalDays = Math.floor(totalMs / (1000 * 60 * 60 * 24));
      const totalMonths = Math.floor(totalDays / 30);
      const totalYears = Math.floor(totalDays / 365);

      const ms = totalMs % 1000;
      const seconds = totalSeconds % 60;
      const minutes = totalMinutes % 60;
      const hours = totalHours % 24;

      const start = new Date(anniversary.current);
      const nowDate = new Date(now);

      let years = nowDate.getUTCFullYear() - start.getUTCFullYear();
      let months = nowDate.getUTCMonth() - start.getUTCMonth();
      let days = nowDate.getUTCDate() - start.getUTCDate();

      if (days < 0) {
        months--;
        const prevMonth = new Date(
          nowDate.getUTCFullYear(),
          nowDate.getUTCMonth(),
          0,
        );
        days += prevMonth.getUTCDate();
      }

      if (months < 0) {
        years--;
        months += 12;
      }

      setTime({
        // calendar-correct
        years,
        months,
        days,

        // clock
        hours,
        minutes,
        seconds,
        ms,

        // absolute totals (for hover popout)
        totalMs,
        totalSeconds,
        totalMinutes,
        totalHours,
        totalDays,
        totalMonths,
        totalYears,
      });
    };

    tick();
    const id = setInterval(tick, 16);
    return () => clearInterval(id);
  }, [serverOffset]);

  useEffect(() => {
    if (!hovered) {
      return;
    }

    const el = segmentRefs.current[hovered];
    const grid = timerGridRef.current;
    if (!el || !grid) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const gridRect = grid.getBoundingClientRect();

      setPopoutPos({
        left: rect.left - gridRect.left + rect.width / 2,
        top: rect.top - gridRect.top,
        width: rect.width,
      });
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [hovered]);

  function formatNumber(n) {
    try {
      return new Intl.NumberFormat().format(n);
    } catch (e) {
      console.log(e);
      return String(n);
    }
  }

  function getConvertedText(key, t) {
    if (!t) return "";
    switch (key) {
      case "years":
        return `${formatNumber(t.totalYears ?? 0)}`;
      case "months":
        return `${formatNumber(t.totalMonths ?? 0)}`;
      case "days":
        return `${formatNumber(t.totalDays ?? 0)}`;
      case "hours":
        return `${formatNumber(t.totalHours ?? 0)}`;
      case "minutes":
        return `${formatNumber(t.totalMinutes ?? 0)}`;
      case "seconds":
        return `${formatNumber(t.totalSeconds ?? 0)}`;
      case "ms":
        return `${formatNumber(t.totalMs ?? 0)}`;
      default:
        return "";
    }
  }

  // Prepare display values and compute a uniform min-width (in ch) so boxes expand together.
  // Also set a maximum box expansion (`BOX_MAX_CH`) and scale font-size for long numbers.
  const BOX_MAX_CH = 28;
  // Timer segments (full set); visibility controlled by timerOptions persisted in localStorage
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
      /* ignore */
    }
    return DEFAULT_TIMER_OPTIONS;
  });

  useEffect(() => {
    const reload = () => {
      try {
        const raw = localStorage.getItem("timerOptions");
        if (raw) setTimerOptions(JSON.parse(raw));
        else setTimerOptions(DEFAULT_TIMER_OPTIONS);
      } catch (e) {
        console.log(e);
        setTimerOptions(DEFAULT_TIMER_OPTIONS);
      }
    };

    // custom event dispatched by AccountCard when options change
    window.addEventListener("timerOptionsChanged", reload);
    // also listen to storage events from other tabs
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener("timerOptionsChanged", reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  const _segments = React.useMemo(() => {
    if (!time) return [];
    const all = [
      { key: "years", label: "Years", value: pad(time.years, 2) },
      { key: "months", label: "Months", value: pad(time.months) },
      { key: "days", label: "Days", value: pad(time.days) },
      { key: "hours", label: "Hours", value: pad(time.hours) },
      { key: "minutes", label: "Minutes", value: pad(time.minutes) },
      { key: "seconds", label: "Seconds", value: pad(time.seconds) },
      { key: "ms", label: "ms", value: String(time.ms).padStart(3, "0") },
    ];

    // filter based on timerOptions; preserve order
    return all.filter((s) => !!timerOptions[s.key]);
  }, [time, timerOptions]);

  // Always show the short-form value in the timer segments; the popout shows the converted/full value.
  const _displays = _segments.map((s) => s.value);

  // base (unhovered) widths are computed from the short-form values so the main timer stays the same size
  const _baseDisplays = _segments.map((s) => s.value);
  const _baseMaxLen = Math.max(
    ..._baseDisplays.map((d) => (d ? d.length : 0)),
    2,
  );
  // hovered length (only used for hovered box)
  const _hoverLens = _displays.map((d) => (d ? d.length : 0));

  return (
    <div className="min-h-screen w-full relative text-gray-900">
      {/* Main content */}
      <div className="dashboard-content flex flex-col items-center justify-center px-8">
        <div className="w-full max-w-5xl">
          <div className="mb-8 text-center">
            <h1
              className="
                gradient-text
                font-extrabold
                bg-clip-text
                bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500
                drop-shadow-lg
                tracking-tight
                leading-tight
                text-center
              "
              style={{
                fontSize: "clamp(2.8rem, 7vw, 4.8rem)",
              }}
            >
              Happy Anniversary
            </h1>

            <p
              className="mt-3 text-gray-600 font-medium"
              style={{ fontSize: "clamp(0.9rem, 2.5vw, 1.1rem)" }}
            >
              Celebrating your love, moments, and memories
            </p>
          </div>
        </div>

        {/* Large full-width timer (stretches across viewport) */}
        <div className="full-width-timer mb-8">
          <div className="dashboard-timer fancy-timer timer-wrapper">
            <div
              className="timer-grid"
              ref={timerGridRef}
              style={{
                position: "relative",
                display: "flex",
                justifyContent: "center",
                gap: "1rem",
                alignItems: "center",
                padding: "1rem 0",
                boxSizing: "border-box",
                maxWidth: "85%",
                margin: "0 auto",
                overflow: "visible",
              }}
            >
              {_segments.map((seg, i) => (
                <div
                  className="timer-segment"
                  key={seg.key}
                  style={{
                    animationDelay: `${i * 40}ms`,
                    minWidth: `${Math.min(_baseMaxLen + 1, BOX_MAX_CH)}ch`,
                    // width stays fixed; popout will show expanded text
                    transition: "width 220ms ease",
                    padding: "1.2rem 0.9rem",
                    borderRadius: "12px",
                    background: "rgba(255,255,255,0.06)",
                    boxShadow: "0 6px 18px rgba(0,0,0,0.04)",
                    zIndex: hovered === seg.key ? 50 : 1,
                  }}
                  ref={(el) => {
                    segmentRefs.current[seg.key] = el;
                  }}
                  onMouseEnter={() => setHovered(seg.key)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div
                    className="seg-value"
                    style={{
                      fontSize: "4rem",
                      whiteSpace: "nowrap",
                      lineHeight: 1,
                    }}
                  >
                    {_displays[i]}
                  </div>
                  <div className="seg-label">{seg.label}</div>
                </div>
              ))}
              {/* Popout overlay showing converted/full value */}
              {hovered && popoutPos && (
                <div
                  className="timer-popout"
                  onMouseEnter={() => setHovered(hovered)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    position: "absolute",
                    left: popoutPos.left,
                    top: Math.max(0, popoutPos.top - 64),
                    transform: "translateX(-50%)",
                    background: "white",
                    color: "#111827",
                    padding: "8px 12px",
                    borderRadius: 10,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                    zIndex: 120,
                    minWidth: 120,
                    maxWidth: 320,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "1rem", fontWeight: 600 }}>
                    {getConvertedText(hovered, time)}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                    {_segments.find((s) => s.key === hovered)?.label || ""}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-full max-w-5xl">
          {/* Some detail cards to fill space */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="text-center mb-6">
              <div
                className="tracking-widest text-gray-500 font-semibold"
                style={{ fontSize: "clamp(1.90rem, 2vw, 0.95rem)" }}
              >
                <h3>Together For</h3>
              </div>

              <div
                className="
                  gradient-text
                  mt-2 font-extrabold
                  bg-clip-text
                  bg-gradient-to-r from-pink-500 to-purple-500
                "
                style={{ fontSize: "clamp(2.2rem, 6vw, 3.5rem)" }}
              >
                <b>
                  <span className="together-value">{time.years ?? "--"}</span>{" "}
                  Years &{" "}
                  <span className="together-value">{time.months ?? "--"}</span>{" "}
                  Months
                </b>
              </div>
            </div>
            <div className="p-8 rounded-2xl bg-white/8 backdrop-blur-md dashboard-card">
              <h3 className="text-2xl font-semibold">Memories</h3>
              <p className="mt-3 text-sm text-gray-600">
                A place to store favorite moments.
              </p>
              <div className="mt-4 flex gap-3">
                <div className="w-16 h-16 rounded-lg bg-pink-50 shadow-sm" />
                <div className="w-16 h-16 rounded-lg bg-purple-50 shadow-sm" />
                <div className="w-16 h-16 rounded-lg bg-blue-50 shadow-sm" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
