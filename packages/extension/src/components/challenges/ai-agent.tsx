import { useCallback, useEffect, useRef, useState, memo } from "react";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle, IconCheck, IconRefresh } from "@tabler/icons-react";
import { IconServer } from "@tabler/icons-react";
import { getUnlockGuard } from "@/lib/unlock-guards";
import type { ChallengeComponentProps } from "@/lib/challenges/ui";
import { defineChallengeUi } from "@/lib/challenges/ui";
import { aiAgentDefinition } from "@/lib/challenges/definitions/ai-agent";

type AiAgentSettings = {
  serverUrl: string;
  allowWhileWaitingForInput?: boolean;
};

type AiAgentStatus = "idle" | "checking" | "active" | "inactive" | "error";

type DebugState = {
  label: string;
  tone: "success" | "warning" | "error";
};

const guard = getUnlockGuard("claude");

const getDebugState = (state: { active: boolean; reason?: string }): DebugState => {
  if (state.active) {
    return { label: "Unblocked", tone: "success" };
  }
  if (
    state.reason === "offline" ||
    state.reason === "invalid_url" ||
    state.reason === "server_error"
  ) {
    return { label: "Disconnected", tone: "error" };
  }
  if (state.reason === "waiting") {
    return { label: "Blocked (waiting for input)", tone: "warning" };
  }
  return { label: "Blocked", tone: "warning" };
};

const AiAgentChallenge = memo(
  ({ settings, onComplete }: ChallengeComponentProps<AiAgentSettings>) => {
    const [status, setStatus] = useState<AiAgentStatus>("idle");
    const [message, setMessage] = useState<string | null>(null);
    const [completed, setCompleted] = useState(false);
    const checkingRef = useRef(false);

    const checkStatus = useCallback(
      async (mode: "auto" | "manual" = "manual") => {
        if (completed) return;
        if (checkingRef.current) return;

        checkingRef.current = true;
        if (mode === "manual") {
          setStatus("checking");
          setMessage(null);
        }

        if (!guard) {
          setStatus("error");
          setMessage("AI agent guard unavailable.");
          checkingRef.current = false;
          return;
        }

        const result = await guard.check(settings);
        if (result.active) {
          setStatus("active");
          setCompleted(true);
          onComplete();
          checkingRef.current = false;
          return;
        }

        if (result.reason === "invalid_url") {
          setStatus("error");
          setMessage("Enter a valid server URL.");
          checkingRef.current = false;
          return;
        }

        if (result.reason === "server_error") {
          setStatus("error");
          setMessage("Server error.");
          checkingRef.current = false;
          return;
        }

        if (result.reason === "offline") {
          setStatus("error");
          setMessage("Server offline or unreachable.");
          checkingRef.current = false;
          return;
        }

        setStatus("inactive");
        if (result.reason === "waiting") {
          setMessage("AI agent is waiting for your input.");
        } else if (mode === "manual") {
          setMessage(null);
        }
        checkingRef.current = false;
      },
      [completed, onComplete, settings],
    );

    useEffect(() => {
      setCompleted(false);
      setStatus("idle");
      setMessage(null);
    }, [settings.serverUrl]);

    useEffect(() => {
      void checkStatus("auto");
    }, [checkStatus]);

    useEffect(() => {
      const interval = setInterval(() => {
        void checkStatus("auto");
      }, 500);
      return () => clearInterval(interval);
    }, [checkStatus]);

    return (
      <div className="space-y-4">
        <div className="min-h-6 flex items-center justify-center gap-2">
          {status === "active" ? (
            <>
              <IconCheck className="size-5 text-green-500" />
              <span className="text-green-500">AI agent is working. You can continue.</span>
            </>
          ) : status === "error" ? (
            <>
              <IconAlertTriangle className="size-5 text-destructive" />
              <span className="text-destructive">Unable to reach the server.</span>
            </>
          ) : (
            <>
              <IconAlertTriangle className="size-5 text-muted-foreground" />
              <span className="text-muted-foreground">
                {message ?? "AI agent is idle. Start a session to unlock."}
              </span>
            </>
          )}
        </div>

        <Button
          onClick={() => void checkStatus("manual")}
          className="w-full"
          variant={completed ? "outline" : "default"}
          disabled={status === "checking" || completed}
        >
          <IconRefresh className={`size-4 ${status === "checking" ? "animate-spin" : ""}`} />
          {status === "checking"
            ? "Checking..."
            : completed
              ? "AI Agent Active"
              : "Check AI Agent Status"}
        </Button>

        <p className="min-h-4 text-xs text-center text-muted-foreground">{message ?? "\u00A0"}</p>
      </div>
    );
  },
);

AiAgentChallenge.displayName = "AiAgentChallenge";

export const AiAgentDebug = memo(({ settings }: ChallengeComponentProps<AiAgentSettings>) => {
  const [state, setState] = useState<{
    active: boolean;
    reason?: string;
  } | null>(null);

  const checkStatus = useCallback(async () => {
    if (!guard) return;
    const result = await guard.check(settings);
    setState({ active: result.active, reason: result.reason });
  }, [settings]);

  useEffect(() => {
    void checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const debug = state ? getDebugState(state) : null;

  return (
    <div className="rounded-md border border-border bg-muted/30 p-2 text-[11px]">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="font-medium">Debug</span>
        {debug ? (
          <span
            className={
              debug.tone === "success"
                ? "text-green-500"
                : debug.tone === "error"
                  ? "text-destructive"
                  : "text-yellow-600"
            }
          >
            {debug.label}
          </span>
        ) : (
          <span className="text-muted-foreground">Checking…</span>
        )}
      </div>
      <div className="mt-1 text-muted-foreground">
        <span className="font-medium">URL:</span>{" "}
        <span className="font-mono break-all">{settings.serverUrl || "Not configured"}</span>
      </div>
    </div>
  );
});

AiAgentDebug.displayName = "AiAgentDebug";

export const aiAgentChallenge = defineChallengeUi({
  ...aiAgentDefinition,
  icon: <IconServer className="size-5" />,
  render: (props) => <AiAgentChallenge {...props} />,
  renderSummary: (settings) => (
    <>
      <IconServer className="size-3 inline align-middle mr-1" />
      {settings.serverUrl
        ? settings.serverUrl.length > 25
          ? `${settings.serverUrl.slice(0, 25)}...`
          : settings.serverUrl
        : "Not configured"}
    </>
  ),
});
