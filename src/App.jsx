import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

/* ─── Helpers ─────────────────────────────────────────────────────────── */
const uid     = () => Math.random().toString(36).slice(2, 11);
const genCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

function assignRoles(players) {
  const n  = players.length;
  const mc = n <= 4 ? 1 : n <= 7 ? 2 : 3;
  const arr = [...players].sort(() => Math.random() - 0.5);
  return arr.map((p, i) => ({ ...p, role: i < mc ? "mafia" : "town", alive: true }));
}

function majority(votes) {
  const t = {};
  Object.values(votes).forEach((id) => (t[id] = (t[id] || 0) + 1));
  if (!Object.keys(t).length) return null;
  return Object.entries(t).sort((a, b) => b[1] - a[1])[0][0];
}

function winCheck(players) {
  const alive = players.filter((p) => p.alive);
  const m = alive.filter((p) => p.role === "mafia").length;
  const t = alive.filter((p) => p.role === "town").length;
  if (m === 0) return "town";
  if (m >= t)  return "mafia";
  return null;
}

/* ─── Supabase storage layer ───────────────────────────────────────────
   fetchRoom: reads latest room state from DB
   pushRoom:  writes (upsert) full room state to DB
   Supabase realtime picks up the change and broadcasts to all subscribers
────────────────────────────────────────────────────────────────────── */
async function fetchRoom(code) {
  const { data, error } = await supabase
    .from("rooms")
    .select("state")
    .eq("code", code)
    .single();
  if (error) { console.error("fetchRoom error:", error.message); return null; }
  return data?.state ?? null;
}

async function pushRoom(room) {
  const { error } = await supabase
    .from("rooms")
    .upsert({ code: room.code, state: room, updated_at: new Date().toISOString() });
  if (error) console.error("pushRoom error:", error.message);
}

/* ─── Styles ────────────────────────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0a0f; color: #e2e2e8; font-family: 'DM Sans', sans-serif; }

  .game-root {
    min-height: 100vh;
    background: #0a0a0f;
    background-image:
      radial-gradient(ellipse at 20% 10%, rgba(180,20,20,0.07) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 90%, rgba(20,20,80,0.12) 0%, transparent 50%);
    color: #e2e2e8;
    font-family: 'DM Sans', sans-serif;
  }

  .card {
    background: rgba(22,22,32,0.95);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 16px;
    backdrop-filter: blur(12px);
  }
  .card-red   { background: rgba(180,20,20,0.12); border: 1px solid rgba(220,60,60,0.3); border-radius: 12px; }
  .card-night { background: rgba(30,30,80,0.3);   border: 1px solid rgba(80,80,200,0.25); border-radius: 12px; }
  .card-day   { background: rgba(100,70,10,0.2);  border: 1px solid rgba(220,160,30,0.25); border-radius: 12px; }

  .btn-primary {
    background: #c0392b; color: #fff;
    font-family: 'DM Sans', sans-serif; font-weight: 700; font-size: 15px; letter-spacing: 0.5px;
    border: none; border-radius: 10px; padding: 13px 24px; width: 100%;
    cursor: pointer; transition: background 0.15s, transform 0.1s;
  }
  .btn-primary:hover:not(:disabled) { background: #e74c3c; transform: translateY(-1px); }
  .btn-primary:disabled { background: #2a2a3a; color: #555; cursor: not-allowed; }

  .btn-secondary {
    background: rgba(255,255,255,0.07); color: #aaa;
    font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 15px;
    border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 13px 24px; width: 100%;
    cursor: pointer; transition: background 0.15s, color 0.15s;
  }
  .btn-secondary:hover { background: rgba(255,255,255,0.12); color: #fff; }

  .input-field {
    width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px; padding: 13px 16px; color: #e2e2e8;
    font-family: 'DM Sans', sans-serif; font-size: 15px; outline: none; transition: border-color 0.15s;
  }
  .input-field:focus { border-color: rgba(192,57,43,0.6); }
  .input-field::placeholder { color: rgba(255,255,255,0.25); }
  .input-code { text-align: center; letter-spacing: 8px; text-transform: uppercase; font-size: 22px; font-weight: 700; }

  .vote-btn {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 16px; width: 100%; text-align: left;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px; color: #e2e2e8;
    font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 500;
    cursor: pointer; transition: background 0.15s, border-color 0.15s, transform 0.1s;
  }
  .vote-btn:hover:not(:disabled) { background: rgba(255,255,255,0.09); transform: translateX(2px); }
  .vote-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .vote-btn.selected-red   { background: rgba(192,57,43,0.25); border-color: rgba(220,80,60,0.5); }
  .vote-btn.selected-amber { background: rgba(180,120,20,0.25); border-color: rgba(220,160,40,0.5); }

  .avatar {
    width: 36px; height: 36px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 14px; flex-shrink: 0;
  }

  .log-box {
    max-height: 220px; overflow-y: auto;
    scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent;
  }
  .log-entry {
    font-size: 12px; color: rgba(200,200,215,0.65); line-height: 1.6;
    padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.03);
  }

  .badge {
    font-size: 11px; font-weight: 600; padding: 2px 8px;
    border-radius: 20px; letter-spacing: 0.3px;
  }
  .pulse-dot {
    width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
    animation: pulse 2s infinite;
  }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

  .slide-in { animation: slideIn 0.3s ease; }
  @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

  .divider {
    display: flex; align-items: center; gap: 12px;
    color: rgba(255,255,255,0.2); font-size: 12px; margin: 16px 0;
  }
  .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.08); }

  .title-font { font-family: 'Bebas Neue', sans-serif; }
  .error-msg  { color: #e07070; font-size: 13px; text-align: center; margin-top: 10px; }
`;

/* ─── Avatar color ──────────────────────────────────────────────────── */
const AVATAR_COLORS = ["#c0392b","#2980b9","#27ae60","#8e44ad","#d35400","#16a085","#f39c12","#2c3e50"];
function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

/* ─── Sub-components ─────────────────────────────────────────────────── */
function Avatar({ name, size = 36 }) {
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: avatarColor(name) }}>
      {name[0]?.toUpperCase()}
    </div>
  );
}

function PlayerRow({ player, myId, hostId, showRole = false }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, opacity: player.alive === false ? 0.45 : 1 }}>
      <Avatar name={player.name} />
      <span style={{ fontWeight: 500, fontSize: 14, textDecoration: player.alive === false ? "line-through" : "none", color: player.alive === false ? "#666" : "#e2e2e8" }}>
        {player.name}
      </span>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
        {showRole && player.role && (
          <span className="badge" style={player.role === "mafia"
            ? { background: "rgba(192,57,43,0.2)", color: "#e07070", border: "1px solid rgba(192,57,43,0.3)" }
            : { background: "rgba(39,174,96,0.15)", color: "#6fcf97", border: "1px solid rgba(39,174,96,0.25)" }}>
            {player.role === "mafia" ? "🔪 Mafia" : "🏙️ Town"}
          </span>
        )}
        {player.id === hostId && !showRole && <span style={{ fontSize: 12, color: "#f1c40f" }}>👑</span>}
        {player.id === myId  && <span className="badge" style={{ background: "rgba(255,255,255,0.06)", color: "#888", border: "1px solid rgba(255,255,255,0.08)" }}>you</span>}
        {player.alive === false && <span style={{ fontSize: 14 }}>💀</span>}
      </div>
    </div>
  );
}

/* ─── Main App ──────────────────────────────────────────────────────── */
export default function App() {
  // Persist player ID across refreshes using localStorage
  const [myId] = useState(() => {
    const stored = localStorage.getItem("mafia_player_id");
    if (stored) return stored;
    const id = uid();
    localStorage.setItem("mafia_player_id", id);
    return id;
  });

  const [nameInput, setNameInput] = useState(() => localStorage.getItem("mafia_player_name") || "");
  const [codeInput, setCodeInput] = useState("");
  const [room,      setRoom]      = useState(null);
  const [err,       setErr]       = useState("");
  const [loading,   setLoading]   = useState(false);
  const logRef = useRef();

  const phase   = room?.phase;
  const me      = room?.players?.find((p) => p.id === myId);
  const isHost  = room?.hostId === myId;
  const isMafia = me?.role === "mafia";
  const isAlive = me?.alive ?? true;

  /* ── Supabase realtime subscription ──────────────────────────────────
     Instead of polling every 2s, we subscribe to DB changes on this room.
     Supabase pushes the new row to us the moment any player writes to it.
  ─────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!room?.code) return;

    const channel = supabase
      .channel(`room-${room.code}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `code=eq.${room.code}` },
        (payload) => {
          // payload.new is the updated row; .state is our game object
          if (payload.new?.state) setRoom(payload.new.state);
        }
      )
      .subscribe();

    // Cleanup: unsubscribe when component unmounts or room changes
    return () => { supabase.removeChannel(channel); };
  }, [room?.code]);

  // Auto-scroll game log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [room?.log?.length]);

  /* ── Actions ────────────────────────────────────────────────────── */
  const createRoom = async () => {
    if (!nameInput.trim()) return setErr("Enter your name");
    localStorage.setItem("mafia_player_name", nameInput.trim());
    setLoading(true);
    const code = genCode();
    const r = {
      code, phase: "lobby", hostId: myId,
      players: [{ id: myId, name: nameInput.trim(), role: null, alive: true }],
      nightVotes: {}, dayVotes: {},
      log: ["🎮 Room created. Share the code with friends!"],
      winner: null, round: 0,
    };
    await pushRoom(r);
    setRoom(r); setErr(""); setLoading(false);
  };

  const joinRoom = async () => {
    if (!nameInput.trim()) return setErr("Enter your name");
    const code = codeInput.trim().toUpperCase();
    if (code.length < 4) return setErr("Enter the 4-letter room code");
    localStorage.setItem("mafia_player_name", nameInput.trim());
    setLoading(true);
    const r = await fetchRoom(code);
    if (!r)                  { setErr("Room not found. Check the code!"); setLoading(false); return; }
    if (r.phase !== "lobby") { setErr("This game has already started");   setLoading(false); return; }
    // If same player ID already in room (reconnect), just re-join view
    if (r.players.find((p) => p.id === myId)) { setRoom(r); setErr(""); setLoading(false); return; }
    const upd = { ...r, players: [...r.players, { id: myId, name: nameInput.trim(), role: null, alive: true }] };
    await pushRoom(upd);
    setRoom(upd); setErr(""); setLoading(false);
  };

  const startGame = async () => {
    // Always re-fetch before mutating to avoid stale state overwriting another player's write
    const fresh = await fetchRoom(room.code);
    if (fresh.players.length < 3) return setErr("Need at least 3 players to start");
    const withRoles = assignRoles(fresh.players);
    const mc = withRoles.filter((p) => p.role === "mafia").length;
    const r = {
      ...fresh, players: withRoles, phase: "night", round: 1,
      nightVotes: {}, dayVotes: {},
      log: [
        `Game started! ${withRoles.length} players · ${mc} Mafia · ${withRoles.length - mc} Town`,
        "🌙 Night 1 — Mafia, choose your target…",
      ],
    };
    await pushRoom(r); setRoom(r); setErr("");
  };

  const voteNight = async (targetId) => {
    const fresh = await fetchRoom(room.code);
    if (!fresh || fresh.phase !== "night") return;
    const votes       = { ...fresh.nightVotes, [myId]: targetId };
    const mafiaAlive  = fresh.players.filter((p) => p.role === "mafia" && p.alive);
    const allVoted    = mafiaAlive.every((p) => votes[p.id]);
    let r = { ...fresh, nightVotes: votes };
    if (allVoted) {
      const killedId = majority(votes);
      const killed   = fresh.players.find((p) => p.id === killedId);
      const players  = fresh.players.map((p) => p.id === killedId ? { ...p, alive: false } : p);
      const winner   = winCheck(players);
      r = {
        ...r, players, phase: winner ? "ended" : "day",
        nightVotes: {}, winner,
        log: [
          ...fresh.log,
          `☀️ Day ${fresh.round} — ${killed.name} was found dead!`,
          ...(winner
            ? [`🏁 Game Over — ${winner === "town" ? "🏙️ Town wins! All mafia eliminated." : "🔪 Mafia wins! They outnumber the town."}`]
            : ["💬 Discuss who you think the Mafia is, then vote to eliminate."]),
        ],
      };
    }
    await pushRoom(r); setRoom(r);
  };

  const voteDay = async (targetId) => {
    const fresh = await fetchRoom(room.code);
    if (!fresh || fresh.phase !== "day") return;
    const votes    = { ...fresh.dayVotes, [myId]: targetId };
    const alive    = fresh.players.filter((p) => p.alive);
    const allVoted = alive.every((p) => votes[p.id]);
    let r = { ...fresh, dayVotes: votes };
    if (allVoted) {
      const elimId  = majority(votes);
      const elim    = fresh.players.find((p) => p.id === elimId);
      const players = fresh.players.map((p) => p.id === elimId ? { ...p, alive: false } : p);
      const winner  = winCheck(players);
      const nr      = fresh.round + 1;
      r = {
        ...r, players, phase: winner ? "ended" : "night",
        dayVotes: {}, nightVotes: {}, round: winner ? fresh.round : nr, winner,
        log: [
          ...fresh.log,
          `🗳️ ${elim.name} was eliminated! They were ${elim.role === "mafia" ? "🔪 Mafia" : "🏙️ Town"}.`,
          ...(winner
            ? [`🏁 Game Over — ${winner === "town" ? "🏙️ Town wins!" : "🔪 Mafia wins!"}`]
            : [`🌙 Night ${nr} — Mafia, choose your next target…`]),
        ],
      };
    }
    await pushRoom(r); setRoom(r);
  };

  const playAgain = async () => {
    const fresh = await fetchRoom(room.code);
    const r = {
      ...fresh, phase: "lobby",
      players: fresh.players.map((p) => ({ ...p, role: null, alive: true })),
      nightVotes: {}, dayVotes: {},
      log: ["🔄 New game! Host can start when everyone is ready."],
      winner: null, round: 0,
    };
    await pushRoom(r); setRoom(r);
  };

  /* ── Derived state ─────────────────────────────────────────────── */
  const alive        = room?.players?.filter((p) => p.alive) ?? [];
  const myVoteNight  = room?.nightVotes?.[myId];
  const myVoteDay    = room?.dayVotes?.[myId];
  const mafiaTeam    = room?.players?.filter((p) => p.role === "mafia" && p.id !== myId) ?? [];
  const nightVoters  = room?.players?.filter((p) => p.role === "mafia" && p.alive).length ?? 0;
  const nightVoted   = Object.keys(room?.nightVotes ?? {}).length;
  const dayVoted     = Object.keys(room?.dayVotes   ?? {}).length;

  /* ════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════ */
  return (
    <div className="game-root">
      <style>{STYLES}</style>

      {/* ── HOME ── */}
      {!room && (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="card slide-in" style={{ width: "100%", maxWidth: 380, padding: 36 }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ fontSize: 52, marginBottom: 8 }}>🔪</div>
              <h1 className="title-font" style={{ fontSize: 56, color: "#c0392b", lineHeight: 1, letterSpacing: 2 }}>MAFIA</h1>
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, marginTop: 6 }}>Social deduction · Multiplayer · Online</p>
            </div>

            <input className="input-field" placeholder="Your name" value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createRoom()}
              style={{ marginBottom: 12 }}
            />
            <button className="btn-primary" onClick={createRoom} disabled={loading}>
              {loading ? "Creating…" : "Create Room"}
            </button>

            <div className="divider">or join with code</div>

            <input className="input-field input-code" placeholder="XXXX" value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              maxLength={4} style={{ marginBottom: 12 }}
            />
            <button className="btn-secondary" onClick={joinRoom} disabled={loading}>
              {loading ? "Joining…" : "Join Room"}
            </button>

            {err && <p className="error-msg">{err}</p>}
          </div>
        </div>
      )}

      {/* ── LOBBY ── */}
      {room && phase === "lobby" && (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="card slide-in" style={{ width: "100%", maxWidth: 440, padding: 32 }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Room Code</p>
              <div className="title-font" style={{ fontSize: 56, color: "#f1c40f", letterSpacing: 10 }}>{room.code}</div>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 6 }}>Share this with friends to join</p>
            </div>

            <div style={{ marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Players</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>{room.players.length} / 8</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {room.players.map((p) => (
                <PlayerRow key={p.id} player={p} myId={myId} hostId={room.hostId} />
              ))}
            </div>

            {isHost ? (
              <>
                <button className="btn-primary" onClick={startGame} disabled={room.players.length < 3}>
                  {room.players.length < 3 ? `Waiting for ${3 - room.players.length} more player(s)…` : "🎮  Start Game"}
                </button>
                {err && <p className="error-msg">{err}</p>}
              </>
            ) : (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <div className="pulse-dot" style={{ background: "#2ecc71" }} />
                  Waiting for host to start…
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ENDED ── */}
      {room && phase === "ended" && (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="card slide-in" style={{ width: "100%", maxWidth: 460, padding: 36 }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 64, marginBottom: 12 }}>{room.winner === "town" ? "🏙️" : "🔪"}</div>
              <h2 className="title-font" style={{ fontSize: 48, color: room.winner === "town" ? "#2ecc71" : "#e74c3c", letterSpacing: 2 }}>
                {room.winner === "town" ? "TOWN WINS" : "MAFIA WINS"}
              </h2>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginTop: 8 }}>
                {room.winner === "town" ? "All Mafia eliminated — justice served." : "Mafia took control of the town."}
              </p>
            </div>

            <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>Final Roles</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
              {room.players.map((p) => (
                <PlayerRow key={p.id} player={p} myId={myId} hostId={room.hostId} showRole />
              ))}
            </div>

            {isHost
              ? <button className="btn-primary" onClick={playAgain}>🔄  Play Again</button>
              : <p style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Waiting for host to start a new game…</p>
            }
          </div>
        </div>
      )}

      {/* ── NIGHT / DAY ── */}
      {room && (phase === "night" || phase === "day") && (
        <div style={{ maxWidth: 860, margin: "0 auto", padding: 20, display: "grid", gridTemplateColumns: "1fr 260px", gap: 16, minHeight: "100vh", alignContent: "start" }}>

          {/* Left */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Phase header */}
            <div className={phase === "night" ? "card-night" : "card-day"} style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ fontSize: 36 }}>{phase === "night" ? "🌙" : "☀️"}</div>
              <div>
                <h2 className="title-font" style={{ fontSize: 32, letterSpacing: 1, color: phase === "night" ? "#8899ff" : "#f1c40f" }}>
                  {phase === "night" ? `NIGHT ${room.round}` : `DAY ${room.round}`}
                </h2>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                  {phase === "night"
                    ? (isMafia ? "Choose your target silently" : isAlive ? "The town is sleeping…" : "You are dead — watching silently")
                    : (isAlive ? "Vote to eliminate a suspect" : "You are dead — watching silently")}
                </p>
              </div>
              {phase === "night" && (
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>Mafia voted</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{nightVoted}<span style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>/{nightVoters}</span></div>
                </div>
              )}
              {phase === "day" && (
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>Votes cast</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{dayVoted}<span style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>/{alive.length}</span></div>
                </div>
              )}
            </div>

            {/* Role card */}
            <div className={isMafia ? "card-red" : "card"} style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ fontSize: 28 }}>{isMafia ? "🔪" : "🏙️"}</div>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>Your Role</div>
                <div style={{ fontWeight: 700, fontSize: 17, color: isMafia ? "#e07070" : "#6fcf97" }}>
                  {isMafia ? "Mafia" : "Townsperson"}
                </div>
              </div>
              {isMafia && mafiaTeam.length > 0 && (
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "rgba(220,80,80,0.6)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>Your team</div>
                  {mafiaTeam.map((m) => (
                    <div key={m.id} style={{ fontSize: 13, color: "#e07070", fontWeight: 600 }}>{m.name}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Night vote (mafia only) */}
            {phase === "night" && isMafia && isAlive && (
              <div className="card slide-in" style={{ padding: 20 }}>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Select a target
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {alive.filter((p) => p.role === "town").map((p) => (
                    <button key={p.id} className={`vote-btn ${myVoteNight === p.id ? "selected-red" : ""}`}
                      onClick={() => voteNight(p.id)} disabled={!!myVoteNight}>
                      <Avatar name={p.name} size={32} />
                      <span>{p.name}</span>
                      {myVoteNight === p.id && <span style={{ marginLeft: "auto", color: "#e07070", fontSize: 13 }}>✓ chosen</span>}
                    </button>
                  ))}
                </div>
                {myVoteNight && (
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: 14 }}>
                    Waiting for other Mafia… ({nightVoted}/{nightVoters})
                  </p>
                )}
              </div>
            )}

            {/* Night waiting (town) */}
            {phase === "night" && !isMafia && isAlive && (
              <div className="card" style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>😴</div>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15 }}>You are asleep. The Mafia is choosing their victim…</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16, color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
                  <div className="pulse-dot" style={{ background: "#3498db" }} />
                  Waiting for night to end…
                </div>
              </div>
            )}

            {/* Dead */}
            {!isAlive && (
              <div className="card" style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>👻</div>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 15 }}>You are dead. Watch the game unfold silently.</p>
              </div>
            )}

            {/* Day vote */}
            {phase === "day" && isAlive && (
              <div className="card slide-in" style={{ padding: 20 }}>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Vote to eliminate
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {alive.filter((p) => p.id !== myId).map((p) => (
                    <button key={p.id} className={`vote-btn ${myVoteDay === p.id ? "selected-amber" : ""}`}
                      onClick={() => voteDay(p.id)} disabled={!!myVoteDay}>
                      <Avatar name={p.name} size={32} />
                      <span>{p.name}</span>
                      {myVoteDay === p.id && <span style={{ marginLeft: "auto", color: "#f1c40f", fontSize: 13 }}>✓ voted</span>}
                    </button>
                  ))}
                </div>
                {myVoteDay && (
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: 14 }}>
                    Waiting for everyone… ({dayVoted}/{alive.length})
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="card" style={{ padding: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>Players</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {room.players.map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, opacity: p.alive ? 1 : 0.4 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: p.alive ? "#2ecc71" : "#555", flexShrink: 0 }} />
                    <Avatar name={p.name} size={26} />
                    <span style={{ fontSize: 13, fontWeight: 500, textDecoration: p.alive ? "none" : "line-through", color: p.alive ? "#ddd" : "#666" }}>{p.name}</span>
                    {p.id === myId && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginLeft: "auto" }}>you</span>}
                    {!p.alive && <span style={{ marginLeft: "auto", fontSize: 12 }}>💀</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding: 16, flex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>Game Log</p>
              <div className="log-box" ref={logRef}>
                {room.log.map((msg, i) => (
                  <p key={i} className="log-entry">{msg}</p>
                ))}
              </div>
            </div>

            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>Room: </span>
              <span className="title-font" style={{ fontSize: 18, color: "rgba(255,255,255,0.3)", letterSpacing: 4 }}>{room.code}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
