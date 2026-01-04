import { useState, useEffect, memo } from "react";
import { Button } from "@/components/ui/button";
import { IconClock, IconCheck } from "@tabler/icons-react";
import type { ChallengeComponentProps } from "@/lib/challenges/ui";
import { defineChallengeUi } from "@/lib/challenges/ui";
import { timerDefinition } from "@/lib/challenges/definitions/timer";

const TimerChallenge = memo(
  ({ settings, onComplete }: ChallengeComponentProps<{ duration: number }>) => {
    const { duration } = settings;
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
  },
);

TimerChallenge.displayName = "TimerChallenge";

export const timerChallenge = defineChallengeUi({
  ...timerDefinition,
  icon: <IconClock className="size-5" />,
  render: (props) => <TimerChallenge {...props} />,
  renderSummary: (settings) => {
    return `${settings.duration}s`;
  },
});
