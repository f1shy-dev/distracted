import { useCallback, useEffect, useState, memo } from "react";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle, IconCheck, IconRefresh, IconServer } from "@tabler/icons-react";
import { getClaudeBlockerStatus } from "@/lib/claude-blocker";
import type { ChallengeComponentProps } from "./index";

type ClaudeBlockerSettings = {
  serverUrl: string;
};

type ClaudeBlockerStatus = "idle" | "checking" | "active" | "inactive" | "error";

export const ClaudeBlockerChallenge = memo(
  ({ settings, onComplete }: ChallengeComponentProps<ClaudeBlockerSettings>) => {
    const [status, setStatus] = useState<ClaudeBlockerStatus>("idle");
    const [message, setMessage] = useState<string | null>(null);
    const [completed, setCompleted] = useState(false);

    const checkStatus = useCallback(async () => {
      if (completed) return;

      setStatus("checking");
      setMessage(null);

      const result = await getClaudeBlockerStatus(settings.serverUrl);
      if (result.active) {
        setStatus("active");
        setCompleted(true);
        onComplete();
        return;
      }

      if (result.reason === "invalid_url") {
        setStatus("error");
        setMessage("Enter a valid server URL.");
        return;
      }

      if (result.reason === "server_error") {
        setStatus("error");
        setMessage(
          result.statusCode ? `Server responded with ${result.statusCode}.` : "Server error.",
        );
        return;
      }

      if (result.reason === "offline") {
        setStatus("error");
        setMessage("Server offline or unreachable.");
        return;
      }

      setStatus("inactive");
      setMessage("Claude Code is idle. Start a session to unlock.");
    }, [completed, onComplete, settings.serverUrl]);

    useEffect(() => {
      setCompleted(false);
      setStatus("idle");
      setMessage(null);
    }, [settings.serverUrl]);

    useEffect(() => {
      void checkStatus();
    }, [checkStatus]);

    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            <IconServer className="size-4 text-muted-foreground" />
            <span className="font-medium">Claude Blocker server</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground font-mono break-all">
            {settings.serverUrl || "Not configured"}
          </p>
        </div>

        {status === "active" && (
          <div className="flex items-center justify-center gap-2 text-green-500">
            <IconCheck className="size-5" />
            <span>Claude is working. You can continue.</span>
          </div>
        )}

        {status === "inactive" && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <IconAlertTriangle className="size-5" />
            <span>Claude is idle. Keep working to unlock.</span>
          </div>
        )}

        {status === "error" && (
          <div className="flex items-center justify-center gap-2 text-destructive">
            <IconAlertTriangle className="size-5" />
            <span>Unable to reach the server.</span>
          </div>
        )}

        <Button
          onClick={checkStatus}
          className="w-full"
          variant={completed ? "outline" : "default"}
          disabled={status === "checking" || completed}
        >
          <IconRefresh className={`size-4 ${status === "checking" ? "animate-spin" : ""}`} />
          {status === "checking"
            ? "Checking..."
            : completed
              ? "Claude Active"
              : "Check Claude Status"}
        </Button>

        {message && <p className="text-xs text-center text-muted-foreground">{message}</p>}
      </div>
    );
  },
);

ClaudeBlockerChallenge.displayName = "ClaudeBlockerChallenge";
