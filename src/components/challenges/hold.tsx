import { useState, useEffect, useCallback, useRef, memo } from "react";
import { Button } from "@/components/ui/button";
import { IconHandStop, IconCheck } from "@tabler/icons-react";
import type { ChallengeComponentProps } from "@/lib/challenges/types";
import { defineChallenge } from "@/lib/challenges/types";

export const HoldChallenge = memo(
  ({ settings, onComplete }: ChallengeComponentProps<{ duration: number }>) => {
    const { duration } = settings;
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
              className={`h-full transition-all duration-100 rounded-full ${
                holding
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
              className={`w-full h-20 text-lg transition-all ${
                holding ? "scale-95 bg-primary" : ""
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
  },
);

HoldChallenge.displayName = "HoldChallenge";

export const holdChallenge = defineChallenge({
  label: "Hold Button",
  icon: <IconHandStop className="size-5" />,
  description: "Hold a button continuously",
  title: "Hold to Access",
  options: {
    duration: {
      type: "number",
      label: "Duration (seconds)",
      default: 10,
      description: "How long to hold the button for",
      min: 1,
    },
  },
  render: (props) => <HoldChallenge {...props} />,
});
