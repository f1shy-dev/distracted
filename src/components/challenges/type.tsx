import { useState, useCallback, useRef, memo, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { IconCheck, IconKeyboard, IconHash, IconFileText } from "@tabler/icons-react";
import type { ChallengeComponentProps } from "@/lib/challenges/ui";
import { defineChallengeUi } from "@/lib/challenges/ui";
import { typeDefinition } from "@/lib/challenges/definitions/type";

type TypeChallengeSettings = {
  mode: string;
  length?: number;
  randomModeInclude?: string[];
  customText?: string;
};

function generateRandomString(length: number, include: string[]): string {
  // Build character set based on enabled options
  let charset = "";
  if (include.includes("uppercase")) charset += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (include.includes("lowercase")) charset += "abcdefghijklmnopqrstuvwxyz";
  if (include.includes("numbers")) charset += "0123456789";
  if (include.includes("special")) charset += "!@#$%^&*()_+-=[]{}|;:,.<>?";

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
            settings.randomModeInclude ?? ["uppercase", "lowercase", "numbers"],
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
          <div className="p-3 bg-muted/30 rounded-lg overflow-x-auto">
            <code className="text-sm font-mono tracking-wider whitespace-pre-wrap break-words block w-fit max-w-full mx-auto">
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
  renderSummary: (settings) => {
    const mode = settings.mode ?? "uuid";
    switch (mode) {
      case "uuid":
        return (
          <>
            <IconHash className="size-3 inline align-middle mr-1" />
            UUID
          </>
        );
      case "random": {
        const length = settings.length ?? 21;
        const include = settings.randomModeInclude ?? ["uppercase", "lowercase", "numbers"];
        const parts: string[] = [];
        if (include.includes("uppercase")) parts.push("A-Z");
        if (include.includes("lowercase")) parts.push("a-z");
        if (include.includes("numbers")) parts.push("0-9");
        if (include.includes("special")) parts.push("special");
        return `${length} chars (${parts.join(", ")})`;
      }
      case "custom": {
        const text = settings.customText ?? "";
        const preview = text.length > 20 ? `${text.slice(0, 20)}...` : text;
        if (!preview) return null;
        return (
          <>
            <IconFileText className="size-3 inline align-middle mr-1" />"{preview}"
          </>
        );
      }
      default:
        return null;
    }
  },
});
