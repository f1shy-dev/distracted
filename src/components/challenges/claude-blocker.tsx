import { useCallback, useEffect, useRef, useState, memo } from "react";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle, IconCheck, IconRefresh } from "@tabler/icons-react";
import { IconServer } from "@tabler/icons-react";
import { getUnlockGuard } from "@/lib/unlock-guards";
import type { ChallengeComponentProps } from "@/lib/challenges/types";
import { defineChallenge } from "@/lib/challenges/types";

type ClaudeBlockerSettings = {
  serverUrl: string;
  allowWhileWaitingForInput?: boolean;
};

type ClaudeBlockerStatus = "idle" | "checking" | "active" | "inactive" | "error";

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

export const ClaudeBlockerChallenge = memo(
  ({ settings, onComplete }: ChallengeComponentProps<ClaudeBlockerSettings>) => {
    const [status, setStatus] = useState<ClaudeBlockerStatus>("idle");
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
          setMessage("Claude Code guard unavailable.");
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
          setMessage("Claude Code is waiting for your input.");
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
              <span className="text-green-500">Claude Code is working. You can continue.</span>
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
                {message ?? "Claude Code is idle. Start a session to unlock."}
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
              ? "Claude Code Active"
              : "Check Claude Code Status"}
        </Button>

        <p className="min-h-4 text-xs text-center text-muted-foreground">{message ?? "\u00A0"}</p>
      </div>
    );
  },
);

ClaudeBlockerChallenge.displayName = "ClaudeBlockerChallenge";

export const ClaudeBlockerDebug = memo(
  ({ settings }: ChallengeComponentProps<ClaudeBlockerSettings>) => {
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
      <div className="rounded-md border border-border/40 bg-muted/30 p-2 text-[11px]">
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
  },
);

ClaudeBlockerDebug.displayName = "ClaudeBlockerDebug";

export const claudeBlockerChallenge = defineChallenge({
  label: "Claude Blocker",
  icon: <IconServer className="size-5" />,
  description: "Unlock only while Claude Code is actively working",
  title: "Claude Blocker",
  instructions: {
    title: "Claude Blocker setup",
    summary: "This unlock method only succeeds while Claude Code is actively running inference.",
    steps: [
      "Install and start the local Claude Blocker server (this also installs Claude Code hooks).",
      "Keep the server running while you work in Claude Code.",
      "If you change the server port, update the Server URL below.",
    ],
    commands: ["npx claude-blocker --setup"],
    note: "If the server is offline or Claude is idle, the site stays locked.",
  },
  options: {
    serverUrl: {
      type: "text",
      label: "Claude Blocker Server URL",
      default: "http://localhost:8765",
    },
    allowWhileWaitingForInput: {
      type: "checkbox",
      label: "Allow while waiting for input",
      default: false,
      description: "Keep access open when Claude is waiting for your reply",
    },
  },
  render: (props) => <ClaudeBlockerChallenge {...props} />,
});
