import type { ChallengeInstructions } from "./index";

type ChallengeInstructionsPanelProps = {
  instructions: ChallengeInstructions;
  className?: string;
  children?: React.ReactNode;
};

export function ChallengeInstructionsPanel({
  instructions,
  className,
  children,
}: ChallengeInstructionsPanelProps) {
  const { title = "Setup instructions", summary, steps = [], commands = [], note } = instructions;

  return (
    <details
      className={`rounded-lg border border-border/40 bg-muted/20 p-3 text-xs ${className ?? ""}`}
    >
      <summary className="cursor-pointer text-sm font-medium text-foreground">{title}</summary>
      <div className="mt-3 space-y-2 text-muted-foreground">
        {summary && <p>{summary}</p>}
        {steps.length > 0 && (
          <ol className="list-decimal space-y-1 pl-4">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        )}
        {commands.length > 0 && (
          <pre className="rounded-md bg-background/60 p-2 font-mono text-[11px] whitespace-pre-wrap">
            {commands.join("\n")}
          </pre>
        )}
        {note && <p>{note}</p>}
        {children && <div className="pt-2">{children}</div>}
      </div>
    </details>
  );
}
