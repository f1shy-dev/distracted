import { useState, useEffect, useCallback, useRef, memo } from "react";
import {
  generateAnnoyingText,
  type BlockedSite,
  type UnlockMethod,
} from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  IconShieldLock,
  IconClock,
  IconHandStop,
  IconKeyboard,
  IconCheck,
  IconX,
  IconArrowRight,
} from "@tabler/icons-react";

// Message helpers to communicate with background script
async function checkBlocked(url: string): Promise<{
  blocked: boolean;
  site: BlockedSite | null;
  statsEnabled: boolean;
}> {
  return browser.runtime.sendMessage({ type: "CHECK_BLOCKED", url });
}

async function updateStats(
  siteId: string,
  update: {
    incrementVisit?: boolean;
    incrementPassed?: boolean;
    addTime?: number;
  }
): Promise<void> {
  await browser.runtime.sendMessage({ type: "UPDATE_STATS", siteId, update });
}

// Timer Challenge Component
const TimerChallenge = memo(function TimerChallenge({
  duration,
  onComplete,
}: {
  duration: number;
  onComplete: () => void;
}) {
  const [remaining, setRemaining] = useState(duration);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started) return;

    if (remaining <= 0) {
      onComplete();
      return;
    }

    const timer = setInterval(() => {
      setRemaining((r) => r - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [started, remaining, onComplete]);

  const progress = ((duration - remaining) / duration) * 100;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="relative mx-auto w-32 h-32">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-muted/20"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={264}
              strokeDashoffset={264 - (264 * progress) / 100}
              className="text-primary transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-mono font-bold">{remaining}</span>
          </div>
        </div>
      </div>

      {!started ? (
        <Button onClick={() => setStarted(true)} className="w-full" size="lg">
          <IconClock className="size-5" />
          Start {duration}s Timer
        </Button>
      ) : remaining > 0 ? (
        <p className="text-center text-muted-foreground text-sm">
          Wait for the timer to complete...
        </p>
      ) : (
        <div className="flex items-center justify-center gap-2 text-green-500">
          <IconCheck className="size-5" />
          <span>Timer complete!</span>
        </div>
      )}
    </div>
  );
});

// Hold Button Challenge Component
const HoldChallenge = memo(function HoldChallenge({
  duration,
  onComplete,
}: {
  duration: number;
  onComplete: () => void;
}) {
  const [holding, setHolding] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [completed, setCompleted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleStart = useCallback(() => {
    setHolding(true);
  }, []);

  const handleEnd = useCallback(() => {
    setHolding(false);
    if (elapsed < duration) {
      setElapsed(0);
    }
  }, [elapsed, duration]);

  useEffect(() => {
    if (holding && !completed) {
      intervalRef.current = setInterval(() => {
        setElapsed((e) => {
          const newElapsed = e + 0.1;
          if (newElapsed >= duration) {
            setCompleted(true);
            setHolding(false);
            onComplete();
            return duration;
          }
          return newElapsed;
        });
      }, 100);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [holding, completed, duration, onComplete]);

  const progress = (elapsed / duration) * 100;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="h-4 bg-muted/20 rounded-full overflow-hidden mb-4">
          <div
            className={`h-full transition-all duration-100 rounded-full ${holding
              ? "bg-primary"
              : elapsed > 0 && !completed
                ? "bg-destructive/50"
                : "bg-primary"
              }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-2xl font-mono font-bold">
          {elapsed.toFixed(1)}s / {duration}s
        </p>
      </div>

      {!completed ? (
        <>
          <Button
            onMouseDown={handleStart}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchEnd={handleEnd}
            variant={holding ? "default" : "outline"}
            className={`w-full h-20 text-lg transition-all ${holding ? "scale-95 bg-primary" : ""
              }`}
            size="lg"
          >
            <IconHandStop className="size-6" />
            {holding ? "Keep Holding..." : "Hold to Unlock"}
          </Button>
          {elapsed > 0 && !holding && (
            <p className="text-center text-destructive text-sm">
              Don't let go! Progress has been reset.
            </p>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center gap-2 text-green-500">
          <IconCheck className="size-5" />
          <span>Challenge complete!</span>
        </div>
      )}
    </div>
  );
});

// Type Challenge Component
const TypeChallenge = memo(function TypeChallenge({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [targetText] = useState(() => generateAnnoyingText());
  const [inputText, setInputText] = useState("");
  const [completed, setCompleted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      const diff = Math.abs(newValue.length - inputText.length);
      if (diff > 1 && newValue.length > inputText.length) {
        return;
      }

      setInputText(newValue);

      if (newValue === targetText) {
        setCompleted(true);
        onComplete();
      }
    },
    [inputText, targetText, onComplete]
  );

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const charStatuses = targetText.split("").map((char, i) => {
    if (i >= inputText.length) return "pending";
    return inputText[i] === char ? "correct" : "incorrect";
  });

  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <p>Type this text exactly:</p>
          <p>
            {inputText.length}/{targetText.length}
          </p>
        </div>
        <div className="p-3 bg-muted/30 rounded-lg overflow-hidden flex justify-center">
          <code className="text-sm font-mono tracking-wider whitespace-nowrap">
            {targetText.split("").map((char, i) => (
              <span
                key={i}
                className={`${charStatuses[i] === "correct"
                  ? "text-green-500"
                  : charStatuses[i] === "incorrect"
                    ? "text-destructive bg-destructive/20"
                    : "text-muted-foreground"
                  }`}
              >
                {char}
              </span>
            ))}
          </code>
        </div>
      </div>

      {!completed ? (
        <Input
          ref={inputRef}
          value={inputText}
          onChange={handleInput}
          onPaste={handlePaste}
          onDrop={handleDrop}
          placeholder="Start typing..."
          className="font-mono text-center tracking-wider"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      ) : (
        <div className="flex items-center justify-center gap-2 text-green-500">
          <IconCheck className="size-5" />
          <span>Challenge complete!</span>
        </div>
      )}
    </div>
  );
});

// Main overlay component
export default function BlockingOverlay() {
  const [blockedSite, setBlockedSite] = useState<BlockedSite | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [challengeComplete, setChallengeComplete] = useState(false);
  const [statsEnabled, setStatsEnabled] = useState(true);
  const [checking, setChecking] = useState(true);
  const [unlockedAt, setUnlockedAt] = useState<number | null>(null);
  const visitTracked = useRef(false);
  const timeTrackingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Check if current site is blocked
  useEffect(() => {
    const doCheck = async () => {
      try {
        const url = window.location.href;
        const result = await checkBlocked(url);

        if (result.blocked && result.site) {
          setBlockedSite(result.site);
          setIsBlocked(true);
          setStatsEnabled(result.statsEnabled);

          if (result.statsEnabled && !visitTracked.current) {
            visitTracked.current = true;
            await updateStats(result.site.id, { incrementVisit: true });
          }
        }
      } catch (error) {
        console.error("[distacted] Error checking block status:", error);
      }

      setChecking(false);
    };

    doCheck();
  }, []);

  // Handle auto-relock timer (tab-local)
  useEffect(() => {
    if (!unlockedAt || !blockedSite?.autoRelockAfter) return;

    const relockTime = unlockedAt + blockedSite.autoRelockAfter * 60 * 1000;
    const timeUntilRelock = relockTime - Date.now();

    if (timeUntilRelock <= 0) {
      // Already expired
      setIsBlocked(true);
      setChallengeComplete(false);
      setUnlockedAt(null);
      return;
    }

    const timer = setTimeout(() => {
      setIsBlocked(true);
      setChallengeComplete(false);
      setUnlockedAt(null);
    }, timeUntilRelock);

    return () => clearTimeout(timer);
  }, [unlockedAt, blockedSite?.autoRelockAfter]);

  const handleChallengeComplete = useCallback(() => {
    setChallengeComplete(true);
  }, []);

  const handleUnlock = useCallback(async () => {
    if (!blockedSite) return;

    // Set unlock time for auto-relock (tab-local state)
    setUnlockedAt(Date.now());

    if (statsEnabled) {
      await updateStats(blockedSite.id, { incrementPassed: true });

      startTimeRef.current = Date.now();
      timeTrackingRef.current = setInterval(async () => {
        const elapsed = Date.now() - startTimeRef.current;
        startTimeRef.current = Date.now();
        await updateStats(blockedSite.id, { addTime: elapsed });
      }, 30000);
    }

    setIsBlocked(false);
  }, [blockedSite, statsEnabled]);

  useEffect(() => {
    return () => {
      if (timeTrackingRef.current) {
        clearInterval(timeTrackingRef.current);
        if (startTimeRef.current > 0 && blockedSite) {
          const elapsed = Date.now() - startTimeRef.current;
          updateStats(blockedSite.id, { addTime: elapsed });
        }
      }
    };
  }, [blockedSite]);

  if (checking) return null;
  if (!isBlocked || !blockedSite) return null;

  const methodIcons: Record<UnlockMethod, React.ReactNode> = {
    timer: <IconClock className="size-5" />,
    hold: <IconHandStop className="size-5" />,
    type: <IconKeyboard className="size-5" />,
  };

  const methodTitles: Record<UnlockMethod, string> = {
    timer: "Wait to Access",
    hold: "Hold to Access",
    type: "Type to Access",
  };

  return (
    <div
      className="fixed inset-0 w-screen h-screen flex items-center justify-center p-4 dark"
      style={{
        zIndex: 2147483647,
        backgroundColor: "rgba(0, 0, 0, 1)",
        fontFamily:
          "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <Card className="w-full max-w-md relative bg-card/95 backdrop-blur shadow-2xl">
        <CardHeader className="text-center pb-2 flex">
          <div className="p-3 rounded-full bg-primary/10 w-fit">
            <IconShieldLock className="size-8 text-primary" />
          </div>
          <div className="flex flex-col ml-2 items-start justify-center gap-1">
            <CardTitle className="text-xl">Site Blocked</CardTitle>
            <CardDescription>
              <span className="text-sm bg-muted/50 px-2 py-0.5 rounded font-medium">
                {blockedSite.name}
              </span>
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/30">
              <div className="text-primary">
                {methodIcons[blockedSite.unlockMethod]}
              </div>
              <span className="font-medium">
                {methodTitles[blockedSite.unlockMethod]}
              </span>
            </div>

            {blockedSite.strict ? (
              <div className="text-center py-8 text-destructive">
                <IconShieldLock className="size-12 mx-auto mb-2 opacity-50" />
                <p className="font-bold">No access allowed.</p>
                <p className="text-sm opacity-80">Strict mode is enabled for this site.</p>
              </div>
            ) : (
              <>
                {blockedSite.unlockMethod === "timer" && (
                  <TimerChallenge
                    duration={blockedSite.unlockDuration}
                    onComplete={handleChallengeComplete}
                  />
                )}

                {blockedSite.unlockMethod === "hold" && (
                  <HoldChallenge
                    duration={blockedSite.unlockDuration}
                    onComplete={handleChallengeComplete}
                  />
                )}

                {blockedSite.unlockMethod === "type" && (
                  <TypeChallenge onComplete={handleChallengeComplete} />
                )}
              </>
            )}
          </div>

          {challengeComplete && (
            <Button onClick={handleUnlock} className="w-full" size="lg">
              Continue to Site
              <IconArrowRight className="size-4" />
            </Button>
          )}

          {blockedSite.autoRelockAfter && (
            <p className="text-xs text-center text-muted-foreground">
              Access will expire after {blockedSite.autoRelockAfter} minute
              {blockedSite.autoRelockAfter > 1 ? "s" : ""}
            </p>
          )}
        </CardContent>
      </Card>

      <button
        onClick={() => window.history.back()}
        className="absolute top-4 right-4 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
        title="Go back"
      >
        <IconX className="size-5" />
      </button>
    </div>
  );
}
