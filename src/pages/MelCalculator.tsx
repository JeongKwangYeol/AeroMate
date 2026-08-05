import { useState, useMemo, useRef, useEffect } from "react";
import { CalendarIcon, AlertTriangle, Sliders, Eraser, ArrowLeft, Lightbulb, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// ─── Types ───────────────────────────────────────────────────────────────────

type MelCategory = {
  id: string;
  name: string;
  days: number | null;
  custom?: boolean;
};

type MelAMode = "calendar" | "flight-days" | "flight-hours" | "cycles";

type CalcResult =
  | { kind: "date"; dueDate: Date; statusText: string; occurrenceDate: Date }
  | { kind: "hours"; dueHours: number }
  | { kind: "cycles"; dueCycles: number };

type ActiveTab = "interval" | "torque" | "time-calc";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: MelCategory[] = [
  { id: "A",   name: "CAT A", days: null, custom: true },
  { id: "B",   name: "CAT B", days: 3 },
  { id: "C",   name: "CAT C", days: 10 },
  { id: "D",   name: "CAT D", days: 120 },
  { id: "NEF", name: "NEF",   days: 240 },
  { id: "MOI", name: "MOI",   days: 240 },
];

const MEL_A_MODES: { id: MelAMode; label: string }[] = [
  { id: "calendar",     label: "Calendar Days" },
  { id: "flight-days",  label: "Flight Days" },
  { id: "flight-hours", label: "Flight Hours" },
  { id: "cycles",       label: "Cycles" },
];

const TORQUE_UNITS: Record<string, number> = {
  "N·m":    1,
  "lbf·in": 0.112984829,
  "lbf·ft": 1.355817948,
  "kgf·cm": 0.0980665,
  "kgf·m":  9.80665,
  "daN·m":  10,
};
const TORQUE_UNIT_KEYS = Object.keys(TORQUE_UNITS);

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── UTC helpers (unchanged) ──────────────────────────────────────────────────

function todayUTCString(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseUTCDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addUTCDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

function formatUTCDate(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = MONTHS[date.getUTCMonth()].toUpperCase();
  const y = String(date.getUTCFullYear()).slice(-2);

  return `${d}${m}${y}`;
}

function diffUTCDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function parsePosInt(s: string): number | null {
  const n = parseInt(s, 10);
  return !isNaN(n) && n > 0 ? n : null;
}

// ─── Time Calculator helpers ──────────────────────────────────────────────────

function tcDigitsToDisplay(digits: string): string {
  if (!digits) return "00:00";
  const mins = digits.slice(-2).padStart(2, "0");
  const hrs  = digits.length > 2 ? digits.slice(0, -2) : "0";
  return `${hrs}:${mins}`;
}

function tcDigitsToMins(digits: string): number {
  if (!digits) return 0;
  const mins = parseInt(digits.slice(-2).padStart(2, "0"), 10);
  const hrs  = parseInt(digits.length > 2 ? digits.slice(0, -2) : "0", 10);
  return hrs * 60 + mins;
}

function tcMinsToDisplay(total: number): string {
  const sign = total < 0 ? "-" : "";
  const abs  = Math.abs(total);
  const h    = Math.floor(abs / 60);
  const m    = abs % 60;
  return `${sign}${h}:${m.toString().padStart(2, "0")}`;
}

// ─── Shared class tokens ──────────────────────────────────────────────────────

const inputCls = cn(
  "w-full h-12 sm:h-16 px-4 rounded-md border border-border bg-input",
  "text-foreground font-mono text-base sm:text-xl font-medium",
  "focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring",
  "placeholder:text-muted-foreground",
);

const sectionLabelCls =
  "text-xs sm:text-base font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 sm:gap-2";

// ─── Component ────────────────────────────────────────────────────────────────

export default function MelCalculator() {

  const [activeTab, setActiveTab] = useState<ActiveTab>("interval");

  const [dateStr,          setDateStr]          = useState(todayUTCString());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [melAMode,         setMelAMode]         = useState<MelAMode | null>(null);
  const [melADays,         setMelADays]         = useState("");
  const [currentHours,     setCurrentHours]     = useState("");
  const [additionalHours,  setAdditionalHours]  = useState("");
  const [currentCycles,    setCurrentCycles]    = useState("");
  const [additionalCycles, setAdditionalCycles] = useState("");

  const [torqueValue, setTorqueValue] = useState("");
  const [fromUnit,    setFromUnit]    = useState("lbf·ft");
  const [toUnit,      setToUnit]      = useState("lbf·in");

  // Time Calculator state
  const [tcDigits,     setTcDigits]     = useState<string>("");
  const [tcOperator,   setTcOperator]   = useState<"+" | "-" | null>(null);
  const [tcStoredMins, setTcStoredMins] = useState<number>(0);
  const [tcResultMins, setTcResultMins] = useState<number | null>(null);
  const [tcShowResult, setTcShowResult] = useState<boolean>(false);
  const [tcHistory,    setTcHistory]    = useState<Array<{ display: string; op: "+" | "-" | null }>>([]);
  const tcHistScrollRef = useRef<HTMLDivElement>(null);

  function tcDigitPress(d: string) {
    if (tcShowResult) {
      setTcShowResult(false);
      setTcResultMins(null);
      if (tcOperator === null) {
        // After final =: fresh start — clear accumulator and history
        setTcStoredMins(0);
        setTcHistory([]);
      }
      // After intermediate op: keep accumulator & operator, start entering second operand
      setTcDigits(d === "0" ? "" : d);
      return;
    }
    if (tcDigits.length >= 7) return;
    setTcDigits(prev => prev + d);
  }
  function tcBackspace() {
    if (tcShowResult) { tcClear(); return; }
    setTcDigits(prev => prev.slice(0, -1));
  }
  function tcClear() {
    setTcDigits(""); setTcOperator(null);
    setTcStoredMins(0); setTcResultMins(null); setTcShowResult(false);
    setTcHistory([]);
  }
  function tcOperatorPress(op: "+" | "-") {
    // Already showing an accumulated value (no new digits typed yet)
    if (tcShowResult && tcResultMins !== null) {
      if (tcOperator !== null) {
        // Case 3 (from intermediate): just swap pending operator — update last history op
        setTcOperator(op);
        setTcHistory(prev => prev.map((e, i) => i === prev.length - 1 ? { ...e, op } : e));
      } else {
        // After final =: continue from result — give last history entry the new op
        setTcStoredMins(tcResultMins);
        setTcOperator(op);
        setTcHistory(prev => prev.map((e, i) => i === prev.length - 1 ? { ...e, op } : e));
      }
      return;
    }
    if (tcOperator !== null && tcDigits !== "") {
      // Case 2: accumulator + pending op + new input → evaluate immediately
      const second = tcDigitsToMins(tcDigits);
      const result = tcOperator === "+" ? tcStoredMins + second : tcStoredMins - second;
      setTcStoredMins(result);
      setTcOperator(op);
      setTcResultMins(result);
      setTcShowResult(true);
      setTcDigits("");
      // Confirm current input into history, with the newly pressed operator following it
      setTcHistory(prev => [...prev, { display: tcMinsToDisplay(second), op }]);
    } else if (tcOperator !== null) {
      // Case 3: pending op but no new input → just swap operator, update last history op
      setTcOperator(op);
      setTcHistory(prev => prev.map((e, i) => i === prev.length - 1 ? { ...e, op } : e));
    } else {
      // Case 1: no accumulator yet → store current input as first history entry
      const mins = tcDigitsToMins(tcDigits);
      setTcStoredMins(mins);
      setTcOperator(op);
      setTcResultMins(mins);
      setTcShowResult(true);
      setTcDigits("");
      setTcHistory([{ display: tcDigitsToDisplay(tcDigits || "0"), op }]);
    }
  }
  function tcEquals() {
    if (tcOperator === null) return;
    const second = tcDigitsToMins(tcDigits);
    const result = tcOperator === "+" ? tcStoredMins + second : tcStoredMins - second;
    setTcResultMins(result);
    setTcShowResult(true);
    setTcOperator(null);     // hide operator badge; guard against repeated =
    setTcStoredMins(result); // keep result so user can press + / − to continue
    setTcDigits("");
    // Confirm the last operand into history (only if digits were entered)
    if (tcDigits !== "") {
      setTcHistory(prev => [...prev, { display: tcMinsToDisplay(second), op: null }]);
    }
  }

  // UTC clock — updates every minute
  const [utcTime, setUtcTime] = useState(() => {
    const now = new Date();
    return `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
  });
  useEffect(() => {
    function tick() {
      const now = new Date();
      setUtcTime(`${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`);
    }
    // align to the next full minute
    const msToNextMinute = (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds();
    const timeout = setTimeout(() => {
      tick();
      const interval = setInterval(tick, 60000);
      return () => clearInterval(interval);
    }, msToNextMinute);
    return () => clearTimeout(timeout);
  }, []);

  // Auto-scroll history row to the newest entry whenever history changes
  useEffect(() => {
    if (tcHistScrollRef.current) {
      tcHistScrollRef.current.scrollLeft = tcHistScrollRef.current.scrollWidth;
    }
  }, [tcHistory]);

  const isMelA       = selectedCategory === "A";
  const showDateInput = !isMelA || melAMode === "calendar" || melAMode === "flight-days";

  const intervalResult: CalcResult | null = useMemo(() => {
    if (!selectedCategory) return null;

    if (isMelA) {
      if (!melAMode) return null;
      if (melAMode === "calendar" || melAMode === "flight-days") {
        const days = parsePosInt(melADays);
        if (!days) return null;
        const occurrenceDate = parseUTCDate(dateStr);
        const dueDate        = addUTCDays(occurrenceDate, days);
        const todayUTC       = parseUTCDate(todayUTCString());
        const diff           = diffUTCDays(dueDate, todayUTC);
        const statusText     = diff > 0 ? `${diff} days remaining`
          : diff === 0 ? "Due Today" : `${Math.abs(diff)} days overdue`;
        return { kind: "date", dueDate, occurrenceDate, statusText };
      }
      if (melAMode === "flight-hours") {
        const cur = parsePosInt(currentHours);
        const add = parsePosInt(additionalHours);
        if (cur === null || add === null) return null;
        return { kind: "hours", dueHours: cur + add };
      }
      if (melAMode === "cycles") {
        const cur = parsePosInt(currentCycles);
        const add = parsePosInt(additionalCycles);
        if (cur === null || add === null) return null;
        return { kind: "cycles", dueCycles: cur + add };
      }
      return null;
    }

    const cat = CATEGORIES.find((c) => c.id === selectedCategory);
    if (!cat || cat.days === null) return null;
    const occurrenceDate = parseUTCDate(dateStr);
    const dueDate        = addUTCDays(occurrenceDate, cat.days);
    const todayUTC       = parseUTCDate(todayUTCString());
    const diff           = diffUTCDays(dueDate, todayUTC);
    const statusText     = diff > 0 ? `${diff} days remaining`
      : diff === 0 ? "Due Today" : `${Math.abs(diff)} days overdue`;
    return { kind: "date", dueDate, occurrenceDate, statusText };
  }, [
    selectedCategory, isMelA, melAMode, dateStr, melADays,
    currentHours, additionalHours, currentCycles, additionalCycles,
  ]);

  const torqueResult: string | null = useMemo(() => {
    const val = parseFloat(torqueValue);
    if (isNaN(val) || torqueValue.trim() === "") return null;
    const converted = (val * TORQUE_UNITS[fromUnit]) / TORQUE_UNITS[toUnit];
    return converted.toFixed(2);
  }, [torqueValue, fromUnit, toUnit]);

  const intervalResultLabel = intervalResult?.kind === "hours" ? "Due Hours"
    : intervalResult?.kind === "cycles" ? "Due Cycle"
    : "Due Date (UTC)";

  const intervalResultValue = !intervalResult ? "— — —"
    : intervalResult.kind === "date"   ? formatUTCDate(intervalResult.dueDate)
    : intervalResult.kind === "hours"  ? String(intervalResult.dueHours)
    : String(intervalResult.dueCycles);

  const hasIntervalResult = intervalResult !== null;

  return (
    <div className="space-y-2 sm:space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="pb-1 pt-2 sm:pt-3 px-3 sm:px-4">
          <CardTitle className="font-heading text-lg sm:text-[27px] text-foreground leading-snug">
            {activeTab === "interval" ? "Calculate maintenance intervals"
              : activeTab === "torque" ? "Torque Converter"
              : "Calculate time easily"}
          </CardTitle>
          <CardDescription className="text-[12px] sm:text-[15px]">
            {activeTab === "interval"
              ? "Calculate due dates, flight hours and cycles based on maintenance intervals."
              : activeTab === "torque"
              ? "Convert torque values between common aviation units."
              : "Add and subtract aircraft times quickly and accurately."}
          </CardDescription>
        </CardHeader>

        <CardContent className="px-3 sm:px-4 pb-2 sm:pb-3 space-y-2 sm:space-y-3">

          {/* ── Tab selector ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {([
              { id: "interval"  as ActiveTab, label: "Interval" },
              { id: "torque"    as ActiveTab, label: "Torque" },
              { id: "time-calc" as ActiveTab, label: "Time Calc" },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`tab-${tab.id}`}
                className={cn(
                  "h-11 sm:h-14 rounded-md border-2 text-sm sm:text-[20px] font-semibold font-heading transition-all",
                  activeTab === tab.id
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card text-foreground hover:border-primary hover:bg-secondary"
                )}
              >
                {tab.id === "time-calc" ? (
                  <span className="flex flex-col items-center leading-tight">
                    <span>Time</span>
                    <span>Calculator</span>
                  </span>
                ) : tab.label}
              </button>
            ))}
            <button
              disabled
              className="h-11 sm:h-14 rounded-md border-2 text-sm sm:text-[20px] font-semibold font-heading border-border bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
            >
              Coming Soon
            </button>
          </div>

          {/* ══════════════════════════════════════════════════════════
              INTERVAL TAB
          ══════════════════════════════════════════════════════════ */}
          {activeTab === "interval" && (
            <>
              {/* Result card */}
              <div
                className={cn(
                  "rounded-md border text-center py-2 sm:py-3 px-4 transition-all duration-300",
                  hasIntervalResult ? "bg-secondary border-primary/30" : "bg-muted/50 border-border"
                )}
                data-testid="result-due-date-card"
              >
                <p className="text-xs sm:text-base font-bold uppercase tracking-widest text-muted-foreground mb-0.5 sm:mb-1">
                  {intervalResultLabel}
                </p>
                <p className={cn(
                  "font-heading font-bold tracking-tight",
                  hasIntervalResult
                    ? "text-4xl sm:text-6xl text-foreground"
                    : "text-2xl sm:text-4xl text-muted-foreground/40"
                )}>
                  {intervalResultValue}
                </p>
              </div>

              {/* Occurrence Date */}
              {showDateInput && (
                <div className="w-full space-y-1 sm:space-y-2">
                  <div className="flex w-full items-center justify-between gap-3">
                    <label
                      htmlFor="occurrence-date"
                      className={sectionLabelCls}
                    >
                      <CalendarIcon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                      Occurrence Date (UTC)
                    </label>

                    <button
                      type="button"
                      onClick={() => setDateStr(todayUTCString())}
                      className="h-9 shrink-0 px-3 border border-border rounded-md text-[12px] sm:text-[15px] font-heading font-normal text-muted-foreground bg-white transition-colors"
                    >
                      TODAY
                    </button>
                  </div>

                  <div className="flex w-full rounded-md border border-border overflow-hidden bg-input">
                    {/* Left: date picker */}
                    <div className="relative flex-1 min-w-0">
                      <CalendarIcon className="absolute z-10 left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-primary pointer-events-none" />
                      <input
                        id="occurrence-date"
                        type="date"
                        value={dateStr}
                        onChange={(e) =>
                          e.target.value && setDateStr(e.target.value)
                        }
                        data-testid="input-occurrence-date"
                        className={cn(
                          "w-full h-11 sm:h-16 pl-9 sm:pl-12 pr-2 bg-transparent",
                          "text-foreground font-mono text-base sm:text-xl font-medium",
                          "focus:outline-none focus:ring-2 focus:ring-ring",
                          "border-0",
                        )}
                      />
                    </div>

                    {/* Divider */}
                    <div className="w-px bg-border self-stretch" />

                    {/* Right: UTC clock */}
                    <div className="flex items-center justify-center w-1/2 shrink-0 px-2">
                      <span className="whitespace-nowrap flex items-baseline gap-[0.4em]">
                        <span
                          className="font-mono font-bold text-foreground tracking-tight leading-none"
                          style={{ fontSize: "clamp(2rem, 7vw, 3.5rem)" }}
                        >
                          {utcTime}
                        </span>
                        <span
                          className="font-mono font-medium text-muted-foreground"
                          style={{ fontSize: "clamp(0.8rem, 2.2vw, 1.25rem)" }}
                        >
                          (UTC)
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Category list */}
              <div className="space-y-1 sm:space-y-2">
                <label className={sectionLabelCls}>
                  <AlertTriangle className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                  Interval Category
                </label>
                <div className="flex flex-col gap-0.5 sm:gap-1">
                  {CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setSelectedCategory(cat.id);
                          if (cat.id !== "A") setMelAMode(null);
                        }}
                        data-testid={`button-category-${cat.id}`}
                        className={cn(
                          "w-full h-10 sm:h-[52px] flex items-center justify-between px-4 sm:px-5 rounded-md border-2 transition-all",
                          "font-heading font-semibold",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border bg-card text-foreground hover:border-primary hover:bg-secondary"
                        )}
                      >
                        <span className="font-bold text-xl sm:text-[28px]">{cat.name}</span>
                        <span className={cn(
                          "text-sm sm:text-lg font-medium",
                          isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                        )}>
                          {cat.id === "A" ? "Custom" : `${cat.days} Days`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CAT A sub-selector */}
              {isMelA && (
                <div className="space-y-1 sm:space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className={sectionLabelCls}>
                    <Sliders className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                    CAT A Condition
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {MEL_A_MODES.map((mode) => {
                      const isActive = melAMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          onClick={() => setMelAMode(mode.id)}
                          data-testid={`button-mela-mode-${mode.id}`}
                          className={cn(
                            "h-11 sm:h-14 rounded-md border-2 text-base sm:text-[22px] font-semibold font-heading transition-all px-2",
                            isActive
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-border bg-card text-foreground hover:border-primary hover:bg-secondary"
                          )}
                        >
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* CAT A inputs */}
              {isMelA && melAMode === "calendar" && (
                <NumericInput id="mela-calendar-days" label="Additional Calendar Days"
                  value={melADays} onChange={setMelADays} testId="input-mela-calendar-days" />
              )}
              {isMelA && melAMode === "flight-days" && (
                <NumericInput id="mela-flight-days" label="Additional Flight Days"
                  value={melADays} onChange={setMelADays} testId="input-mela-flight-days" />
              )}
              {isMelA && melAMode === "flight-hours" && (
                <div className="space-y-2">
                  <NumericInput id="mela-current-hours" label="Current Flight Hours"
                    value={currentHours} onChange={setCurrentHours} testId="input-mela-current-hours" />
                  <NumericInput id="mela-additional-hours" label="Additional Flight Hours"
                    value={additionalHours} onChange={setAdditionalHours} testId="input-mela-additional-hours" />
                </div>
              )}
              {isMelA && melAMode === "cycles" && (
                <div className="space-y-2">
                  <NumericInput id="mela-current-cycles" label="Current Cycles"
                    value={currentCycles} onChange={setCurrentCycles} testId="input-mela-current-cycles" />
                  <NumericInput id="mela-additional-cycles" label="Additional Cycles"
                    value={additionalCycles} onChange={setAdditionalCycles} testId="input-mela-additional-cycles" />
                </div>
              )}
            </>
          )}

          {/* ══════════════════════════════════════════════════════════
              TORQUE TAB
          ══════════════════════════════════════════════════════════ */}
          {activeTab === "torque" && (
            <>
              {/* Result card */}
              <div
                className={cn(
                  "rounded-md border text-center py-2 sm:py-3 px-4 transition-all duration-300",
                  torqueResult !== null ? "bg-secondary border-primary/30" : "bg-muted/50 border-border"
                )}
                data-testid="result-torque-card"
              >
                <p className="text-xs sm:text-base font-bold uppercase tracking-widest text-muted-foreground mb-0.5 sm:mb-1">
                  Converted Torque
                </p>
                <p className={cn(
                  "font-heading font-bold tracking-tight",
                  torqueResult !== null
                    ? "text-4xl sm:text-6xl text-foreground"
                    : "text-2xl sm:text-4xl text-muted-foreground/40"
                )}>
                  {torqueResult !== null ? `${torqueResult} ${toUnit}` : "—  —  —"}
                </p>
              </div>

              {/* Input Value */}
              <div className="space-y-1 sm:space-y-2">
                <label
                  htmlFor="torque-value"
                  className={sectionLabelCls}
                >
                  Input Value
                </label>
                <input
                  id="torque-value"
                  type="number"
                  value={torqueValue}
                  onChange={(e) => setTorqueValue(e.target.value)}
                  placeholder="Enter torque value"
                  data-testid="input-torque-value"
                  className={inputCls}
                />
              </div>

              {/* From / To unit selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 sm:space-y-2">
                  <label className={sectionLabelCls}>From Unit</label>
                  <UnitSelect
                    value={fromUnit}
                    options={TORQUE_UNIT_KEYS}
                    onChange={setFromUnit}
                    testId="select-torque-from"
                    dropdownSide="left"
                  />
                </div>
                <div className="space-y-1 sm:space-y-2">
                  <label className={sectionLabelCls}>To Unit</label>
                  <UnitSelect
                    value={toUnit}
                    options={TORQUE_UNIT_KEYS}
                    onChange={setToUnit}
                    testId="select-torque-to"
                    dropdownSide="right"
                  />
                </div>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════
              TIME CALCULATOR TAB
          ══════════════════════════════════════════════════════════ */}
          {activeTab === "time-calc" && (() => {
            const tcNumBtn = cn(
              "rounded-md border-2 border-border bg-card text-foreground",
              "font-heading text-2xl sm:text-3xl font-semibold transition-all",
              "hover:border-primary hover:bg-secondary active:scale-95",
              "flex items-center justify-center h-14 sm:h-16",
            );
            const tcCtrlBtn = cn(
              "rounded-md border-2 border-border bg-muted/60 text-foreground",
              "font-heading font-semibold transition-all",
              "hover:border-primary hover:bg-secondary active:scale-95",
              "flex items-center justify-center h-12 sm:h-14",
            );
            const tcDisplay = tcShowResult && tcResultMins !== null
              ? tcMinsToDisplay(tcResultMins)
              : tcDigitsToDisplay(tcDigits);

            return (
              <>
                {/* Display */}
                <div className="rounded-md border bg-muted/50 border-border flex items-center justify-center py-4 sm:py-6 px-4 overflow-hidden">
                  <div className="flex items-baseline gap-2 sm:gap-3 whitespace-nowrap">
                    <span
                      className="font-heading font-bold text-foreground tracking-tight leading-none"
                      style={{ fontSize: "clamp(2.8rem, 11vw, 4.5rem)" }}
                    >
                      {tcDisplay}
                    </span>
                    {tcOperator !== null && (
                      <span
                        className="font-heading font-bold text-primary leading-none"
                        style={{ fontSize: "clamp(1.4rem, 5vw, 2.2rem)" }}
                      >
                        {tcOperator === "+" ? "+" : "−"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Calculation History Panel */}
                {(() => {
                  const tcTotal = tcShowResult && tcResultMins !== null
                    ? tcMinsToDisplay(tcResultMins)
                    : tcMinsToDisplay(tcStoredMins);
                  return (
                    <div className="rounded-md border border-border bg-card">
                      {/* Header row */}
                      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                          Calculation History
                        </span>
                        <button
                          onClick={tcClear}
                          className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors"
                          aria-label="Clear history"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Clear</span>
                        </button>
                      </div>

                      {/* Scrollable history row */}
                      <div
                        ref={tcHistScrollRef}
                        className="overflow-x-auto px-3 pb-2"
                        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
                      >
                        <div className="flex items-center gap-1.5 whitespace-nowrap min-h-[1.625rem]">
                          {tcHistory.length === 0 ? (
                            <span className="text-xs text-muted-foreground/40 font-mono select-none">—</span>
                          ) : (
                            tcHistory.map((entry, i) => (
                              <span key={i} className="flex items-center gap-1.5 flex-shrink-0">
                                <span className="text-[13px] sm:text-sm font-mono font-semibold text-foreground">
                                  {entry.display}
                                </span>
                                {entry.op !== null && (
                                  <span className="text-[13px] sm:text-sm font-semibold text-primary">
                                    {entry.op === "+" ? "+" : "−"}
                                  </span>
                                )}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Divider + Total row */}
                      <div className="border-t border-border" />
                      <div className="flex items-center justify-between px-3 py-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Total
                        </span>
                        <span className="text-[13px] sm:text-sm font-mono font-bold text-foreground">
                          {tcHistory.length > 0 ? tcTotal : "—"}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Top control row: Eraser · Backspace · Minus */}
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={tcClear} className={tcCtrlBtn} aria-label="Clear">
                    <Eraser className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                  <button onClick={tcBackspace} className={tcCtrlBtn} aria-label="Backspace">
                    <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                  <button
                    onClick={() => tcOperatorPress("-")}
                    aria-label="Minus"
                    className={cn(tcCtrlBtn,
                      tcOperator === "-" && !tcShowResult
                        ? "border-primary bg-primary/10 text-primary"
                        : ""
                    )}
                  >
                    <span className="text-2xl sm:text-3xl font-bold leading-none">−</span>
                  </button>
                </div>

                {/* Main keypad — 4-col grid; + spans all 3 number rows */}
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                  {["7","8","9"].map(d => (
                    <button key={d} onClick={() => tcDigitPress(d)} className={tcNumBtn}>{d}</button>
                  ))}
                  <button
                    onClick={() => tcOperatorPress("+")}
                    aria-label="Plus"
                    className={cn(
                      tcNumBtn,
                      "row-span-3 !h-auto text-3xl sm:text-4xl text-primary border-primary/40",
                      tcOperator === "+" && !tcShowResult ? "bg-primary/10 border-primary" : ""
                    )}
                  >
                    +
                  </button>
                  {["4","5","6"].map(d => (
                    <button key={d} onClick={() => tcDigitPress(d)} className={tcNumBtn}>{d}</button>
                  ))}
                  {["1","2","3"].map(d => (
                    <button key={d} onClick={() => tcDigitPress(d)} className={tcNumBtn}>{d}</button>
                  ))}
                </div>

                {/* Bottom row — separate grid so + stays flush with row 3 */}
                <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 3fr" }}>
                  <button onClick={() => tcDigitPress("0")} className={tcNumBtn}>0</button>
                  <button
                    onClick={tcEquals}
                    aria-label="Equals"
                    className={cn(
                      tcNumBtn,
                      "bg-primary text-primary-foreground border-primary hover:bg-primary/90",
                    )}
                  >
                    =
                  </button>
                </div>

                {/* Info cards — compact */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  {/* HOW TO USE */}
                  <div className="rounded-md border border-border bg-card p-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">How to Use</p>
                    {["Enter Time","Press + or −","Enter Time","Press ="].map((step, i) => (
                      <div key={i} className="flex items-center gap-1.5 mb-0.5 last:mb-0">
                        <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-[11px] sm:text-xs text-foreground">{step}</span>
                      </div>
                    ))}
                  </div>

                  {/* EXAMPLES */}
                  <div className="rounded-md border border-border bg-card p-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">Examples</p>
                    <p className="text-[11px] sm:text-xs text-foreground font-mono mb-1">03:45 + 01:30 = 05:15</p>
                    <p className="text-[11px] sm:text-xs text-foreground font-mono">05:20 − 01:45 = 03:35</p>
                  </div>

                  {/* TIP */}
                  <div className="rounded-md border border-border bg-card p-2">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                        <Lightbulb className="w-2.5 h-2.5" />
                      </span>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Tip</p>
                    </div>
                    <p className="text-[11px] sm:text-xs text-foreground">Enter digits only. Time is formatted automatically.</p>
                  </div>
                </div>
              </>
            );
          })()}

        </CardContent>
      </Card>
    </div>
  );
}

// ─── Custom unit select component ────────────────────────────────────────────

function UnitSelect({
  value,
  options,
  onChange,
  testId,
  dropdownSide,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  testId: string;
  dropdownSide: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        data-testid={testId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full h-12 sm:h-16 px-3 sm:px-4 rounded-md border-2 bg-input flex items-center justify-between",
          "font-heading text-lg sm:text-[22px] font-semibold text-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring",
          open ? "border-primary" : "border-border"
        )}
      >
        <span>{value}</span>
        <svg
          className={cn("w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground transition-transform", open && "rotate-180")}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <ul
          className={cn(
            "absolute z-50 mt-1 w-full min-w-max rounded-md border border-border bg-card shadow-lg overflow-hidden",
            dropdownSide === "right" ? "right-0" : "left-0"
          )}
          role="listbox"
        >
          {options.map((opt) => (
            <li
              key={opt}
              role="option"
              aria-selected={opt === value}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={cn(
                "px-4 py-2 sm:py-3 cursor-pointer font-heading text-lg sm:text-[22px] font-semibold transition-colors",
                opt === value
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-secondary"
              )}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Shared numeric input sub-component ──────────────────────────────────────

function NumericInput({
  id, label, value, onChange, testId,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId: string;
}) {
  return (
    <div className="space-y-1 sm:space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
      <label
        htmlFor={id}
        className={sectionLabelCls}
      >
        {label}
      </label>
      <input
        id={id}
        type="number"
        min="1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter value"
        data-testid={testId}
        className={inputCls}
      />
    </div>
  );
}
