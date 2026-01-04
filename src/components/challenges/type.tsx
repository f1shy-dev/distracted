import { useState, useCallback, useRef, memo, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { IconCheck, IconKeyboard } from "@tabler/icons-react";
import type { ChallengeComponentProps } from "@/lib/challenges/ui";
import { defineChallengeUi } from "@/lib/challenges/ui";
import { typeDefinition } from "@/lib/challenges/definitions/type";

type TypeChallengeSettings = {
  mode: string;
  length?: number;
  includeUppercase?: boolean;
  includeLowercase?: boolean;
  includeNumbers?: boolean;
  includeSpecial?: boolean;
  customText?: string;
};

function generateRandomString(
  length: number,
  includeUppercase: boolean,
  includeLowercase: boolean,
  includeNumbers: boolean,
  includeSpecial: boolean,
): string {
  // Build character set based on enabled options
  let charset = "";
  if (includeUppercase) charset += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (includeLowercase) charset += "abcdefghijklmnopqrstuvwxyz";
  if (includeNumbers) charset += "0123456789";
  if (includeSpecial) charset += "!@#$%^&*()_+-=[]{}|;:,.<>?";

  // Ensure at least one character set is enabled
  if (charset.length === 0) {
    charset = "abcdefghijklmnopqrstuvwxyz0123456789";
  }

  // Generate random string
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => charset[byte % charset.length]).join("");
}

const TypeChallenge = memo(
  ({ settings, onComplete }: ChallengeComponentProps<TypeChallengeSettings>) => {
    const targetText = useMemo(() => {
      const mode = settings.mode ?? "uuid";
      switch (mode) {
        case "uuid":
          return crypto.randomUUID();
        case "random":
          return generateRandomString(
            settings.length ?? 21,
            settings.includeUppercase ?? true,
            settings.includeLowercase ?? true,
            settings.includeNumbers ?? true,
            settings.includeSpecial ?? false,
          );
        case "custom":
          return settings.customText ?? "";
        default:
          return crypto.randomUUID();
      }
    }, [settings]);

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
      [inputText, targetText, onComplete],
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
  },
);

TypeChallenge.displayName = "TypeChallenge";

export const typeChallenge = defineChallengeUi({
  ...typeDefinition,
  icon: <IconKeyboard className="size-5" />,
  render: (props) => <TypeChallenge {...props} />,
});
