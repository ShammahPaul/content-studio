import React, { useState, useEffect, useCallback } from "react";
import "./storage.js"; // installs window.storage (localStorage-backed) for use outside Claude artifacts
import {
  Loader2,
  Copy,
  Check,
  Settings,
  Clapperboard,
  Music2,
  History,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Circle,
  Image as ImageIcon,
  Download,
} from "lucide-react";

const DEFAULT_SYSTEM_CONTEXT = `You are the content-generation engine for a comedy/entertainment social media account posting across TikTok, Instagram Reels, YouTube Shorts, X, and Facebook.

BRAND VOICE: Comedy/entertainment, broad appeal by default, shifting toward whatever audience segment is actually engaging most.
COMPLIANCE: Never suggest content that would break platform community guidelines or law. Hashtags must be legitimate (no misuse of trademarked/protected terms, no unsubstantiated claims).
AUDIO RULE: For song-sync content, only reference songs available in each platform's built-in sound library (never suggest sourcing audio elsewhere).
DISCLOSURE: Assume AI-generated video/image content may need platform disclosure labels.`;

const PLATFORM_WINDOWS = [
  { platform: "TikTok", window: "7–9am or 6–9pm", note: "Tue–Thu strongest" },
  { platform: "Instagram Reels", window: "9–11am or 7–9pm", note: "Tue–Thu strongest" },
  { platform: "YouTube Shorts", window: "Flexible", note: "consistency beats exact timing" },
  { platform: "X", window: "~9pm", note: "Tue/Wed strongest" },
  { platform: "Facebook", window: "Evening", note: "sustained engagement" },
];

function loadPuterScript() {
  return new Promise((resolve, reject) => {
    if (window.puter) return resolve();
    const existing = document.querySelector('script[src="https://js.puter.com/v2/"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Puter.js")));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://js.puter.com/v2/";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Puter.js"));
    document.head.appendChild(s);
  });
}

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// Tier 1: Pollinations.ai (free, no key). Tier 2 on failure: Puter.js (free, needs a one-time login popup).
async function generateImageWithFallback(prompt, onStageChange) {
  try {
    onStageChange?.("Trying Pollinations.ai…");
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      prompt
    )}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;
    const res = await fetchWithTimeout(url, 25000);
    if (!res.ok) throw new Error(`Pollinations returned ${res.status}`);
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) throw new Error("Pollinations did not return an image");
    return { src: URL.createObjectURL(blob), provider: "Pollinations.ai" };
  } catch (e) {
    console.warn("Pollinations.ai failed, falling back to Puter.js:", e);
  }
  onStageChange?.("Pollinations unavailable — trying Puter.js…");
  await loadPuterScript();
  const imgEl = await window.puter.ai.txt2img(prompt);
  return { src: imgEl.src, provider: "Puter.js" };
}

function ImageGenerator({ prompt }) {
  const [status, setStatus] = useState("idle"); // idle | loading | done | failed
  const [stage, setStage] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const generate = async () => {
    setStatus("loading");
    setResult(null);
    setError("");
    try {
      const r = await generateImageWithFallback(prompt, setStage);
      setResult(r);
      setStatus("done");
    } catch (e) {
      setStatus("failed");
      setError("Both free providers failed right now — use the copy-prompt button above with the Gemini app instead.");
    }
  };

  return (
    <div className="mt-2 space-y-2">
      <button
        onClick={generate}
        disabled={status === "loading"}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 disabled:opacity-60 text-amber-300 transition-colors"
      >
        {status === "loading" ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />}
        {status === "loading" ? stage : result ? "Regenerate image" : "Generate image"}
      </button>

      {result && status === "done" && (
        <div>
          <img src={result.src} alt="" className="rounded-lg w-full max-w-[280px] border border-white/10" />
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[10px] text-stone-600">via {result.provider}</span>
            <a
              href={result.src}
              download={`segment-${Date.now()}.png`}
              className="inline-flex items-center gap-1 text-[10px] text-stone-500 hover:text-amber-400"
            >
              <Download size={11} /> Download
            </a>
          </div>
        </div>
      )}

      {status === "failed" && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function useLocalHistory() {
  const [history, setHistory] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("content-log");
        if (res && res.value) setHistory(JSON.parse(res.value));
      } catch (e) {
        // no history yet
      }
      setLoaded(true);
    })();
  }, []);

  const save = useCallback(async (next) => {
    setHistory(next);
    try {
      await window.storage.set("content-log", JSON.stringify(next));
    } catch (e) {
      console.error("Failed to save history", e);
    }
  }, []);

  return { history, save, loaded };
}

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text || "");
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-stone-300 hover:text-white transition-colors"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : label || "Copy"}
    </button>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1.5 font-semibold">
        {label}
      </span>
      {children}
      {hint && <p className="text-[11px] text-stone-600 mt-1.5 leading-relaxed">{hint}</p>}
    </label>
  );
}

const inputCls =
  "w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition";

const monoCls = "font-mono text-[13px] leading-relaxed";

export default function ContentStudio() {
  const [apiKey, setApiKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [model, setModel] = useState("gemini-2.5-flash");
  const [niche, setNiche] = useState("Comedy / entertainment");
  const [audience, setAudience] = useState("Broadest available market, shifting toward whatever segment engages most");
  const [country, setCountry] = useState("United States");
  const [batchSize, setBatchSize] = useState(5);
  const [songInput, setSongInput] = useState("");
  const [loadingStory, setLoadingStory] = useState(false);
  const [loadingSong, setLoadingSong] = useState(false);
  const [error, setError] = useState("");
  const [storyBatch, setStoryBatch] = useState(null);
  const [songPiece, setSongPiece] = useState(null);
  const [activeTab, setActiveTab] = useState("story");
  const [showHistory, setShowHistory] = useState(false);

  const { history, save: saveHistory } = useLocalHistory();

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("gemini-api-key");
        if (res && res.value) {
          setApiKey(res.value);
          setKeySaved(true);
          setShowSettings(false);
        }
      } catch (e) {
        // no key saved yet
      }
    })();
  }, []);

  const persistKey = async () => {
    if (!apiKey.trim()) return;
    try {
      await window.storage.set("gemini-api-key", apiKey.trim());
      setKeySaved(true);
    } catch (e) {
      setError("Couldn't save the key for next time, but you can still generate this session.");
    }
  };

  const clearKey = async () => {
    try {
      await window.storage.delete("gemini-api-key");
    } catch (e) {}
    setApiKey("");
    setKeySaved(false);
  };

  async function callGemini(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.9 },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  }

  async function generateStoryBatch() {
    if (!apiKey.trim()) {
      setError("Add a Gemini API key before generating.");
      setShowSettings(true);
      return;
    }
    setError("");
    setLoadingStory(true);
    setStoryBatch(null);
    try {
      const prompt = `${DEFAULT_SYSTEM_CONTEXT}

NICHE: ${niche}
TARGET AUDIENCE: ${audience}
COUNTRY: ${country}

Generate ${batchSize} distinct trending short-form comedy/entertainment post concepts for today, repurposed identically across all platforms.

Respond with ONLY a JSON array, no preamble, no markdown fences. Each item must have exactly these fields:
{
  "title": "short internal title",
  "concept": "1-2 sentence description of the bit/story",
  "caption": "the actual caption/on-screen text to post",
  "hashtags": ["array", "of", "hashtags", "without", "the", "#"],
  "video_prompt": "a detailed shot-by-shot prompt suitable for pasting into a text-to-video AI tool (Veo) or for filming manually — include setting, action, camera direction, tone",
  "platform_notes": "any platform-specific tweak worth noting even though the core content is repurposed"
}`;
      const result = await callGemini(prompt);
      setStoryBatch(result);
      const entry = {
        id: Date.now(),
        type: "story",
        date: new Date().toISOString(),
        niche,
        audience,
        country,
        items: result,
      };
      await saveHistory([entry, ...history].slice(0, 50));
    } catch (e) {
      setError(e.message || "Generation failed. Check the API key and try again.");
    } finally {
      setLoadingStory(false);
    }
  }

  async function generateSongSync() {
    if (!apiKey.trim()) {
      setError("Add a Gemini API key before generating.");
      setShowSettings(true);
      return;
    }
    if (!songInput.trim()) {
      setError("Enter a trending song first — it must be available in the platform's built-in sound library.");
      return;
    }
    setError("");
    setLoadingSong(true);
    setSongPiece(null);
    try {
      const prompt = `${DEFAULT_SYSTEM_CONTEXT}

NICHE: ${niche}
TARGET AUDIENCE: ${audience}
COUNTRY: ${country}
TRENDING SONG (from a platform's built-in sound library): ${songInput}

Break the song into its emotional beats/segments (based on general knowledge of the song's lyrics and structure) and design a matching animated/still image sequence where each segment's visual reinforces the emotion of that lyric segment.

Respond with ONLY a JSON object, no preamble, no markdown fences, with exactly these fields:
{
  "song": "song and artist as given",
  "concept": "1-2 sentence overall concept for this post",
  "caption": "the caption/on-screen text to post",
  "hashtags": ["array", "of", "hashtags", "without", "the", "#"],
  "beat_map": [
    {"segment": "e.g. intro / verse 1 / chorus", "emotion": "the emotion this segment carries", "visual_prompt": "detailed image/animation prompt for this segment, to paste into an image or video generator"}
  ],
  "platform_notes": "any platform-specific tweak worth noting"
}`;
      const result = await callGemini(prompt);
      setSongPiece(result);
      const entry = {
        id: Date.now(),
        type: "song-sync",
        date: new Date().toISOString(),
        niche,
        audience,
        country,
        song: songInput,
        items: result,
      };
      await saveHistory([entry, ...history].slice(0, 50));
    } catch (e) {
      setError(e.message || "Generation failed. Check the API key and try again.");
    } finally {
      setLoadingSong(false);
    }
  }

  const removeHistoryEntry = async (id) => {
    await saveHistory(history.filter((h) => h.id !== id));
  };

  const takeLabel = (n) => `TAKE ${String(n).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-[#141110] text-stone-200" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        .display-font { font-family: 'Big Shoulders Display', system-ui, sans-serif; }
        .mono-font { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
        .rec-dot { animation: pulse-dot 1.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .rec-dot { animation: none; }
        }
      `}</style>

      {/* Header */}
      <div className="border-b border-white/10 px-5 py-5 sticky top-0 bg-[#141110]/95 backdrop-blur z-20">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Circle size={8} className="text-amber-400 fill-amber-400 rec-dot" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">
                {keySaved ? "Ready to generate" : "Not connected"}
              </span>
            </div>
            <h1 className="display-font text-3xl font-extrabold tracking-tight text-white leading-none mt-1">
              CONTENT STUDIO
            </h1>
            <p className="text-xs text-stone-500 mt-1 tracking-wide">Draft today's batch. Review. Post it yourself.</p>
          </div>
          <button
            onClick={() => setShowSettings((s) => !s)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-stone-400 hover:text-amber-400 transition-colors"
            aria-label="Settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 pb-24">
        {/* Settings panel */}
        {showSettings && (
          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wider">
              <Settings size={13} /> Setup
            </div>

            <Field
              label="Gemini API key"
              hint="Stored only in your account's private storage for this app. It's used directly from your browser to call Gemini — don't share this artifact's link with the key filled in."
            >
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your Gemini API key"
                  className={inputCls}
                />
                {keySaved ? (
                  <button
                    onClick={clearKey}
                    className="px-3 rounded-lg bg-white/5 hover:bg-red-500/20 text-stone-400 hover:text-red-400 text-xs font-medium transition-colors whitespace-nowrap"
                  >
                    Clear
                  </button>
                ) : (
                  <button
                    onClick={persistKey}
                    className="px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-medium transition-colors whitespace-nowrap"
                  >
                    Save
                  </button>
                )}
              </div>
            </Field>

            <Field label="Gemini model">
              <input value={model} onChange={(e) => setModel(e.target.value)} className={inputCls + " " + monoCls} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Niche">
                <input value={niche} onChange={(e) => setNiche(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Country (for compliance)">
                <input value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} />
              </Field>
            </div>

            <Field label="Target audience — update as it shifts">
              <input value={audience} onChange={(e) => setAudience(e.target.value)} className={inputCls} />
            </Field>

            <Field label="Story pieces per batch">
              <input
                type="number"
                min={1}
                max={10}
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value) || 1)}
                className={inputCls + " w-24"}
              />
            </Field>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mt-6">
          <button
            onClick={() => setActiveTab("story")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === "story" ? "bg-amber-500 text-black" : "bg-white/5 text-stone-400 hover:bg-white/10"
            }`}
          >
            <Clapperboard size={15} /> Story Team
          </button>
          <button
            onClick={() => setActiveTab("song")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === "song" ? "bg-amber-500 text-black" : "bg-white/5 text-stone-400 hover:bg-white/10"
            }`}
          >
            <Music2 size={15} /> Song-Sync Team
          </button>
        </div>

        {/* Story tab */}
        {activeTab === "story" && (
          <div className="mt-5">
            <button
              onClick={generateStoryBatch}
              disabled={loadingStory}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold transition-colors"
            >
              {loadingStory ? <Loader2 size={16} className="animate-spin" /> : <Clapperboard size={16} />}
              {loadingStory ? "Generating today's batch…" : `Generate ${batchSize} for today`}
            </button>

            {!storyBatch && !loadingStory && (
              <p className="text-xs text-stone-600 text-center mt-3">
                No batch generated yet today. Hit generate to pull {batchSize} concepts.
              </p>
            )}

            {storyBatch && (
              <div className="mt-5 space-y-4">
                {storyBatch.map((item, i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="mono-font text-[11px] font-medium text-amber-400 uppercase tracking-wider">
                        {takeLabel(i + 1)}
                      </span>
                      <span className="text-sm text-stone-200 font-semibold">{item.title}</span>
                    </div>
                    <p className="text-sm text-stone-300 mb-3">{item.concept}</p>

                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-stone-500 font-semibold">CAPTION</span>
                          <CopyButton text={item.caption} />
                        </div>
                        <p className="text-sm bg-black/30 rounded-lg p-2.5 text-stone-200">{item.caption}</p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-stone-500 font-semibold">HASHTAGS</span>
                          <CopyButton text={(item.hashtags || []).map((h) => `#${h}`).join(" ")} />
                        </div>
                        <p className={"bg-black/30 rounded-lg p-2.5 text-amber-300/90 " + monoCls}>
                          {(item.hashtags || []).map((h) => `#${h}`).join(" ")}
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-stone-500 font-semibold">VIDEO PROMPT — paste into Veo, or use to film</span>
                          <CopyButton text={item.video_prompt} />
                        </div>
                        <p className={"bg-black/30 rounded-lg p-2.5 text-stone-300 " + monoCls}>{item.video_prompt}</p>
                      </div>

                      {item.platform_notes && (
                        <p className="text-xs text-stone-500 italic">{item.platform_notes}</p>
                      )}
                    </div>
                  </div>
                ))}

                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-[11px] text-stone-500 font-semibold mb-2 uppercase tracking-wider">Posting windows</p>
                  {PLATFORM_WINDOWS.map((row) => (
                    <div key={row.platform} className="flex justify-between items-baseline py-0.5">
                      <span className="text-xs text-stone-300">{row.platform}</span>
                      <span className="text-xs text-stone-500">
                        <span className="text-stone-300 mono-font">{row.window}</span> · {row.note}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Song tab */}
        {activeTab === "song" && (
          <div className="mt-5">
            <Field label="Trending song — must be in a platform's built-in sound library">
              <input
                value={songInput}
                onChange={(e) => setSongInput(e.target.value)}
                placeholder="Song title — Artist"
                className={inputCls}
              />
            </Field>
            <button
              onClick={generateSongSync}
              disabled={loadingSong}
              className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold transition-colors"
            >
              {loadingSong ? <Loader2 size={16} className="animate-spin" /> : <Music2 size={16} />}
              {loadingSong ? "Mapping emotional beats…" : "Generate song-sync piece"}
            </button>

            {!songPiece && !loadingSong && (
              <p className="text-xs text-stone-600 text-center mt-3">
                Enter a song from a platform sound library, then generate its beat map.
              </p>
            )}

            {songPiece && (
              <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="mono-font text-[11px] font-medium text-amber-400 uppercase tracking-wider mb-1">{songPiece.song}</p>
                <p className="text-sm text-stone-300 mb-3">{songPiece.concept}</p>

                <div className="space-y-3 mb-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-stone-500 font-semibold">CAPTION</span>
                      <CopyButton text={songPiece.caption} />
                    </div>
                    <p className="text-sm bg-black/30 rounded-lg p-2.5 text-stone-200">{songPiece.caption}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-stone-500 font-semibold">HASHTAGS</span>
                      <CopyButton text={(songPiece.hashtags || []).map((h) => `#${h}`).join(" ")} />
                    </div>
                    <p className={"bg-black/30 rounded-lg p-2.5 text-amber-300/90 " + monoCls}>
                      {(songPiece.hashtags || []).map((h) => `#${h}`).join(" ")}
                    </p>
                  </div>
                </div>

                <p className="text-[11px] text-stone-500 font-semibold mb-2 uppercase tracking-wider">
                  Beat map — {(songPiece.beat_map || []).length} images needed
                </p>
                <div className="space-y-2.5">
                  {(songPiece.beat_map || []).map((beat, i) => (
                    <div key={i} className="border-l-2 border-amber-500/40 pl-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-stone-300">
                          <span className="mono-font text-amber-400">{String(i + 1).padStart(2, "0")}</span> {beat.segment}{" "}
                          <span className="text-amber-400/80 font-normal">— {beat.emotion}</span>
                        </span>
                        <CopyButton text={beat.visual_prompt} label="Copy prompt" />
                      </div>
                      <p className={"text-stone-400 mt-1 " + monoCls}>{beat.visual_prompt}</p>
                      <ImageGenerator prompt={beat.visual_prompt} />
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-1.5">Next steps</p>
                  <ol className="text-xs text-stone-400 space-y-1 list-decimal list-inside">
                    <li>Tap "Generate image" on each segment above — tries Pollinations.ai first, auto-falls back to Puter.js if that's down (Puter may ask you to log in once).</li>
                    <li>If both fail, use "Copy prompt" and paste it into the Gemini app manually instead (free, ~20 images/day).</li>
                    <li>Download all {(songPiece.beat_map || []).length} images and import into CapCut (free).</li>
                    <li>Add pan/zoom (Ken Burns) effects to each, timed to that segment's part of the song.</li>
                    <li>Export and post.</li>
                  </ol>
                </div>

                {songPiece.platform_notes && (
                  <p className="text-xs text-stone-500 italic mt-3">{songPiece.platform_notes}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* History */}
        <div className="mt-8 border-t border-white/10 pt-4">
          <button
            onClick={() => setShowHistory((s) => !s)}
            className="w-full flex items-center justify-between text-xs font-semibold text-stone-500 uppercase tracking-wider"
          >
            <span className="flex items-center gap-1.5">
              <History size={13} /> History ({history.length})
            </span>
            {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showHistory && (
            <div className="mt-3 space-y-2">
              {history.length === 0 && <p className="text-xs text-stone-600">Nothing generated yet.</p>}
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between bg-white/[0.02] rounded-lg px-3 py-2 text-xs">
                  <div>
                    <span className="text-stone-300 font-medium">
                      {h.type === "story" ? `Story batch (${h.items.length})` : `Song-sync: ${h.song}`}
                    </span>
                    <span className="text-stone-600 ml-2">{new Date(h.date).toLocaleString()}</span>
                  </div>
                  <button onClick={() => removeHistoryEntry(h.id)} className="text-stone-600 hover:text-red-400" aria-label="Delete entry">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
