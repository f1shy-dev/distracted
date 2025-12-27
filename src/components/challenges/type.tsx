import { useState, useCallback, useRef, memo } from "react";
import { Input } from "@/components/ui/input";
import { IconCheck } from "@tabler/icons-react";
import type { ChallengeComponentProps } from "./index";

export const TypeChallenge = memo(
  ({ settings, onComplete }: ChallengeComponentProps<{}>) => {
    const [targetText] = useState(() => crypto.randomUUID());
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
                  className={`${
                    charStatuses[i] === "correct"
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
  }
);

TypeChallenge.displayName = "TypeChallenge";
