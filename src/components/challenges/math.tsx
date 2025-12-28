import { useState, useCallback, useEffect, useRef, memo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IconCheck } from "@tabler/icons-react";
import type { ChallengeComponentProps } from "./index";

type MathQuestion = {
  num1: number;
  num2: number;
  operation: "+" | "-" | "*" | "/";
  answer: number;
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateMathQuestion(): MathQuestion {
  const operations: Array<"+" | "-" | "*" | "/"> = ["+", "-", "*", "/"];
  const operation = operations[Math.floor(Math.random() * 4)];

  let num1: number, num2: number, answer: number;

  switch (operation) {
    case "+":
      num1 = randomInt(1, 50);
      num2 = randomInt(1, 50);
      answer = num1 + num2;
      break;

    case "-":
      // Ensure non-negative result
      num1 = randomInt(1, 50);
      num2 = randomInt(1, num1); // num2 <= num1
      answer = num1 - num2;
      break;

    case "*":
      num1 = randomInt(1, 50);
      num2 = randomInt(1, 50);
      answer = num1 * num2;
      break;

    case "/":
      // Generate backwards to ensure whole number result
      // Use smaller numbers (like times tables) for mental math
      const divisor = randomInt(2, 12);
      const quotient = randomInt(2, 12);
      num1 = divisor * quotient; // dividend
      num2 = divisor;
      answer = quotient;
      break;
  }

  return { num1, num2, operation, answer };
}

function generateQuestions(count: number): MathQuestion[] {
  return Array.from({ length: count }, () => generateMathQuestion());
}

function getOperatorSymbol(operation: string): string {
  switch (operation) {
    case "+":
      return "+";
    case "-":
      return "−";
    case "*":
      return "×";
    case "/":
      return "÷";
    default:
      return operation;
  }
}

export const MathChallenge = memo(
  ({
    settings,
    onComplete,
  }: ChallengeComponentProps<{ questionCount: number }>) => {
    const [questions] = useState(() =>
      generateQuestions(settings.questionCount)
    );
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState("");
    const [completed, setCompleted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input on mount and when moving to next question
    useEffect(() => {
      if (!completed) {
        inputRef.current?.focus();
      }
    }, [currentIndex, completed]);

    const handleInput = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;

        // Only allow digits (no decimals, since all answers are whole numbers)
        if (newValue === "" || /^\d+$/.test(newValue)) {
          setUserAnswer(newValue);
          // Clear error when user starts typing
          if (error) {
            setError(null);
          }
        }
      },
      [error]
    );

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
      e.preventDefault(); // Prevent cheating via paste
    }, []);

    const handleSubmit = useCallback(() => {
      if (!userAnswer) return;

      const currentQuestion = questions[currentIndex];
      const numericAnswer = parseInt(userAnswer, 10);

      if (numericAnswer === currentQuestion.answer) {
        // Correct answer
        setError(null);
        setUserAnswer("");

        if (currentIndex < questions.length - 1) {
          // Move to next question
          setCurrentIndex((prev) => prev + 1);
        } else {
          // All questions completed
          setCompleted(true);
          onComplete();
        }
      } else {
        // Incorrect answer - show error and allow retry
        setError("Incorrect answer. Try again!");
        setUserAnswer("");
        inputRef.current?.focus();
      }
    }, [userAnswer, currentIndex, questions, onComplete]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
          handleSubmit();
        }
      },
      [handleSubmit]
    );

    const currentQuestion = questions[currentIndex];

    return (
      <div className="space-y-4">
        {!completed ? (
          <>
            <div className="text-center text-sm text-muted-foreground">
              Question {currentIndex + 1} of {questions.length}
            </div>

            <div className="text-center">
              <code className="text-2xl font-mono font-bold">
                {currentQuestion.num1}{" "}
                {getOperatorSymbol(currentQuestion.operation)}{" "}
                {currentQuestion.num2} = ?
              </code>
            </div>

            <Input
              ref={inputRef}
              value={userAnswer}
              onChange={handleInput}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              placeholder="Enter answer"
              className="font-mono text-center text-lg"
              type="text"
              inputMode="numeric"
              autoComplete="off"
            />

            <Button
              onClick={handleSubmit}
              className="w-full"
              disabled={!userAnswer}
            >
              {currentIndex < questions.length - 1
                ? "Submit"
                : "Submit Final Answer"}
            </Button>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
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
  }
);

MathChallenge.displayName = "MathChallenge";
