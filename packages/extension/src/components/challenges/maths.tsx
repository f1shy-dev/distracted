import { useState, useCallback, useMemo, memo, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IconCheck, IconX, IconCalculator } from "@tabler/icons-react";
import type { ChallengeComponentProps } from "@/lib/challenges/ui";
import { defineChallengeUi } from "@/lib/challenges/ui";
import { mathsDefinition } from "@/lib/challenges/definitions/maths";

type MathsChallengeSettings = {
  questionCount: number;
  operations: string[];
  instantSubmit?: boolean;
  difficulty?: string;
};

type Operation =
  | "addition"
  | "subtraction"
  | "multiplication"
  | "division"
  | "exponentiation"
  | "squareRoot"
  | "modulo";

type Question = {
  operation: Operation;
  question: string;
  answer: number;
  meta:
    | { kind: "binary"; a: number; b: number }
    | { kind: "division"; dividend: number; divisor: number; quotient: number }
    | { kind: "exponentiation"; base: number; exponent: number }
    | { kind: "squareRoot"; radicand: number };
};

type Difficulty = "easy" | "medium" | "hard" | "annoying";

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function toDifficulty(value: unknown): Difficulty {
  switch (value) {
    case "easy":
    case "medium":
    case "hard":
    case "annoying":
      return value;
    default:
      return "medium";
  }
}

function isQuestionTooEasyMedium(question: Question): boolean {
  const { operation, answer, meta } = question;

  switch (operation) {
    case "addition": {
      if (meta.kind !== "binary") return false;
      const { a, b } = meta;
      if (a === b && a <= 10) return true;
      if (a === 1 || b === 1 || a === 10 || b === 10) return true;
      if (answer % 10 === 0 && answer <= 50) return true;
      return false;
    }

    case "subtraction": {
      if (meta.kind !== "binary") return false;
      const { a, b } = meta;
      if (a === b || answer === 0) return true;
      if (answer === 5 || answer === 10) return true;
      if (a % 10 === 0 && b % 10 === 0) return true;
      if (b === 5 || b === 10) return true;
      return false;
    }

    case "multiplication": {
      if (meta.kind !== "binary") return false;
      const { a, b } = meta;
      if (a === 1 || b === 1 || a === 2 || b === 2 || a === 5 || b === 5 || a === 10 || b === 10)
        return true;
      if (a === b && a <= 5) return true;
      return false;
    }

    case "division": {
      if (meta.kind !== "division") return false;
      const { dividend, divisor, quotient } = meta;
      if (dividend % 10 === 0) return true;
      if (quotient === 2 || quotient === 5 || quotient === 10) return true;
      if (divisor === 5 || divisor === 10) return true;
      return false;
    }

    case "exponentiation": {
      if (meta.kind !== "exponentiation") return false;
      const { base, exponent } = meta;
      if (base === 2 && (exponent === 2 || exponent === 3)) return true;
      if (base === 3 && exponent === 2) return true;
      return false;
    }

    case "squareRoot": {
      if (meta.kind !== "squareRoot") return false;
      const { radicand } = meta;
      if (radicand === 100 || radicand === 64 || radicand === 81 || radicand === 25) return true;
      return false;
    }

    case "modulo": {
      if (meta.kind !== "binary") return false;
      const { a: dividend, b: divisor } = meta;
      if (answer === 0 || answer === 1) return true;
      if (dividend % divisor === 0) return true;
      return false;
    }
  }
}

function isQuestionTooEasyHard(question: Question): boolean {
  if (isQuestionTooEasyMedium(question)) return true;

  const { operation, meta, answer } = question;
  switch (operation) {
    case "addition": {
      if (meta.kind !== "binary") return false;
      const { a, b } = meta;
      // Avoid “nice” multiples of 5 and small operands
      if (a % 5 === 0 || b % 5 === 0) return true;
      if (a <= 10 || b <= 10) return true;
      return false;
    }
    case "subtraction": {
      if (meta.kind !== "binary") return false;
      const { b } = meta;
      if (b % 5 === 0) return true;
      if (answer <= 5) return true;
      return false;
    }
    case "multiplication": {
      if (meta.kind !== "binary") return false;
      const { a, b } = meta;
      if (a <= 6 || b <= 6) return true;
      if (a % 5 === 0 || b % 5 === 0) return true;
      return false;
    }
    case "division": {
      if (meta.kind !== "division") return false;
      const { dividend, divisor, quotient } = meta;
      if (dividend % 5 === 0) return true;
      if (divisor <= 4 || quotient <= 4) return true;
      return false;
    }
    case "exponentiation": {
      if (meta.kind !== "exponentiation") return false;
      // Prefer bigger results than the very common small squares
      if (answer <= 25) return true;
      return false;
    }
    case "squareRoot": {
      if (meta.kind !== "squareRoot") return false;
      const { radicand } = meta;
      // Avoid the smallest perfect squares
      if (radicand === 1 || radicand === 4 || radicand === 9 || radicand === 16) return true;
      return false;
    }
    case "modulo": {
      if (meta.kind !== "binary") return false;
      const { a: dividend } = meta;
      if (dividend < 20) return true;
      if (answer <= 2) return true;
      return false;
    }
  }
}

function isQuestionTooEasyAnnoying(question: Question): boolean {
  if (isQuestionTooEasyHard(question)) return true;

  const { operation, meta } = question;
  switch (operation) {
    case "addition": {
      if (meta.kind !== "binary") return false;
      const { a, b } = meta;
      // Force a carry (annoying mental arithmetic)
      if ((a % 10) + (b % 10) < 10) return true;
      return false;
    }
    case "subtraction": {
      if (meta.kind !== "binary") return false;
      const { a, b } = meta;
      // Force a borrow (annoying mental arithmetic)
      if (a % 10 >= b % 10) return true;
      return false;
    }
    case "division": {
      if (meta.kind !== "division") return false;
      const { dividend } = meta;
      // Bias towards larger dividends
      if (dividend < 60) return true;
      return false;
    }
    default:
      return false;
  }
}

function generateQuestion(operation: Operation, difficulty: Difficulty): Question {
  const maxAttempts = 100;
  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    let q: Question;

    switch (operation) {
      case "addition": {
        const min = difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 11;
        const a = randInt(min, 50);
        const b = randInt(min, 50);
        q = {
          operation,
          question: `${a} + ${b} = ?`,
          answer: a + b,
          meta: { kind: "binary", a, b },
        };
        break;
      }

      case "subtraction": {
        let a = randInt(1, 50);
        let b = randInt(1, 50);
        if (a < b) [a, b] = [b, a];
        if (difficulty !== "easy" && a === b) continue;
        q = {
          operation,
          question: `${a} - ${b} = ?`,
          answer: a - b,
          meta: { kind: "binary", a, b },
        };
        break;
      }

      case "multiplication": {
        const pool =
          difficulty === "easy"
            ? null
            : difficulty === "medium"
              ? ([
                  3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 26, 27,
                  28, 29, 31, 32, 33, 34, 35, 36, 37, 38, 39, 41, 42, 43, 44, 45, 46, 47, 48, 49,
                  50,
                ] as const)
              : ([7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19] as const);
        const a = pool ? pickOne(pool) : randInt(1, 50);
        const b = pool ? pickOne(pool) : randInt(1, 50);
        q = {
          operation,
          question: `${a} × ${b} = ?`,
          answer: a * b,
          meta: { kind: "binary", a, b },
        };
        break;
      }

      case "division": {
        // whole numbers: divisor and quotient 2-12 (as spec)
        const divisorPool =
          difficulty === "easy"
            ? ([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const)
            : difficulty === "medium"
              ? ([2, 3, 4, 6, 7, 8, 9, 11, 12] as const)
              : ([7, 8, 9, 11, 12] as const);
        const quotientPool =
          difficulty === "easy"
            ? ([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const)
            : difficulty === "medium"
              ? ([3, 4, 6, 7, 8, 9, 11, 12] as const)
              : ([7, 8, 9, 11, 12] as const);
        const divisor = pickOne(divisorPool);
        const quotient = pickOne(quotientPool);
        const dividend = divisor * quotient;
        if (difficulty !== "easy" && dividend % 10 === 0) continue;
        q = {
          operation,
          question: `${dividend} ÷ ${divisor} = ?`,
          answer: quotient,
          meta: { kind: "division", dividend, divisor, quotient },
        };
        break;
      }

      case "exponentiation": {
        const [base, exponent] =
          difficulty === "annoying"
            ? pickOne([
                [4, 3],
                [5, 3],
              ] as const)
            : difficulty === "hard"
              ? pickOne([
                  [3, 3],
                  [4, 3],
                  [5, 3],
                  [4, 2],
                  [5, 2],
                ] as const)
              : randInt(2, 5) <= 3
                ? ([randInt(2, 5), 2] as const)
                : ([randInt(2, 5), 3] as const);
        q = {
          operation,
          question: `${base}^${exponent} = ?`,
          answer: Math.pow(base, exponent),
          meta: { kind: "exponentiation", base, exponent },
        };
        break;
      }

      case "squareRoot": {
        const squares =
          difficulty === "easy"
            ? ([1, 4, 9, 16, 25, 36, 49, 64, 81, 100] as const)
            : difficulty === "medium"
              ? ([1, 4, 9, 16, 36, 49, 64, 81] as const)
              : ([36, 49, 64] as const);
        const radicand = pickOne(squares);
        q = {
          operation,
          question: `√${radicand} = ?`,
          answer: Math.sqrt(radicand),
          meta: { kind: "squareRoot", radicand },
        };
        break;
      }

      case "modulo": {
        const divisorPool =
          difficulty === "easy"
            ? ([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const)
            : difficulty === "annoying"
              ? ([7, 9, 11, 12] as const)
              : ([3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const);
        const divisor = pickOne(divisorPool);
        const dividend = difficulty === "annoying" ? randInt(20, 50) : randInt(1, 50);
        const answer = dividend % divisor;
        q = {
          operation,
          question: `${dividend} % ${divisor} = ?`,
          answer,
          meta: { kind: "binary", a: dividend, b: divisor },
        };
        break;
      }
    }

    if (difficulty === "easy") return q;
    if (difficulty === "medium" && isQuestionTooEasyMedium(q)) continue;
    if (difficulty === "hard" && isQuestionTooEasyHard(q)) continue;
    if (difficulty === "annoying" && isQuestionTooEasyAnnoying(q)) continue;
    return q;
  }

  // Fallback: return a valid question even if we failed to avoid “easy”
  return generateQuestion(operation, "easy");
}

function generateQuestions(
  operations: string[],
  count: number,
  difficulty: Difficulty,
): Question[] {
  const availableOps = operations.filter((op): op is Operation =>
    [
      "addition",
      "subtraction",
      "multiplication",
      "division",
      "exponentiation",
      "squareRoot",
      "modulo",
    ].includes(op),
  );

  if (availableOps.length === 0) {
    // Fallback to addition if no operations selected
    availableOps.push("addition");
  }

  // Spread ops across questions for variety (cycle shuffled ops)
  const opSequence: Operation[] = [];
  while (opSequence.length < count) {
    opSequence.push(...shuffle(availableOps));
  }

  const questions: Question[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    const op = opSequence[i]!;
    let q = generateQuestion(op, difficulty);
    // Avoid duplicates (best-effort)
    for (let attempts = 0; attempts < 25 && seen.has(q.question); attempts++) {
      q = generateQuestion(op, difficulty);
    }
    seen.add(q.question);
    questions.push(q);
  }
  return questions;
}

const MathsChallenge = memo(
  ({ settings, onComplete }: ChallengeComponentProps<MathsChallengeSettings>) => {
    const difficulty = useMemo(() => toDifficulty(settings.difficulty), [settings.difficulty]);
    const questions = useMemo(
      () => generateQuestions(settings.operations ?? [], settings.questionCount ?? 3, difficulty),
      [settings.operations, settings.questionCount, difficulty],
    );

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<number, number | null>>({});
    const [feedback, setFeedback] = useState<Record<number, "correct" | "incorrect" | null>>({});
    const [completed, setCompleted] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const currentQuestion = questions[currentQuestionIndex];
    const currentAnswer = answers[currentQuestionIndex] ?? null;
    const currentFeedback = feedback[currentQuestionIndex] ?? null;

    const instantSubmit = settings.instantSubmit ?? true;

    const advanceQuestion = useCallback(() => {
      if (currentQuestionIndex === questions.length - 1) {
        // Last question answered correctly
        setCompleted(true);
        setTimeout(() => {
          onComplete();
        }, 500);
      } else {
        // Move to next question after a brief delay
        setTimeout(() => {
          setCurrentQuestionIndex((prev) => prev + 1);
        }, 500);
      }
    }, [currentQuestionIndex, questions.length, onComplete]);

    const handleAnswerChange = useCallback(
      (value: string) => {
        const numValue = value === "" ? null : Number(value);
        if (numValue !== null && (isNaN(numValue) || !isFinite(numValue))) {
          return;
        }
        setAnswers((prev) => ({ ...prev, [currentQuestionIndex]: numValue }));
        setFeedback((prev) => ({ ...prev, [currentQuestionIndex]: null }));

        // Instant submit: check if answer is correct and auto-advance
        if (instantSubmit && numValue !== null && numValue === currentQuestion.answer) {
          setFeedback((prev) => ({ ...prev, [currentQuestionIndex]: "correct" }));
          advanceQuestion();
        }
      },
      [currentQuestionIndex, currentQuestion, instantSubmit, advanceQuestion],
    );

    const handleSubmit = useCallback(() => {
      if (currentAnswer === null) return;

      const isCorrect = currentAnswer === currentQuestion.answer;
      setFeedback((prev) => ({
        ...prev,
        [currentQuestionIndex]: isCorrect ? "correct" : "incorrect",
      }));

      if (isCorrect) {
        advanceQuestion();
      }
    }, [currentAnswer, currentQuestion, currentQuestionIndex, advanceQuestion]);

    const handleKeyPress = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
          handleSubmit();
        }
      },
      [handleSubmit],
    );

    useEffect(() => {
      if (completed) return;
      // Focus the input when the question changes (without using autoFocus attr)
      inputRef.current?.focus({ preventScroll: true });
    }, [currentQuestionIndex, completed]);

    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="text-sm text-muted-foreground mb-2">
            Question {currentQuestionIndex + 1} of {questions.length}
          </div>
          <div className="text-2xl font-bold mb-4">{currentQuestion.question}</div>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Input
              ref={inputRef}
              type="number"
              value={currentAnswer === null ? "" : currentAnswer}
              onChange={(e) => handleAnswerChange(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter your answer"
              className={`text-center text-lg font-mono [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] ${
                currentFeedback === "correct"
                  ? "border-green-500 focus-visible:ring-green-500"
                  : currentFeedback === "incorrect"
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
              }`}
              disabled={completed}
            />
            {currentFeedback && (
              <div
                className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                  currentFeedback === "correct" ? "text-green-500" : "text-destructive"
                }`}
              >
                {currentFeedback === "correct" ? (
                  <IconCheck className="size-5" />
                ) : (
                  <IconX className="size-5" />
                )}
              </div>
            )}
          </div>
        </div>

        {!completed && !instantSubmit && (
          <Button
            onClick={handleSubmit}
            className="w-full"
            disabled={currentAnswer === null || currentFeedback === "correct"}
          >
            {currentFeedback === "correct" ? "Next Question..." : "Submit Answer"}
          </Button>
        )}

        {completed && (
          <div className="flex items-center justify-center gap-2 text-green-500">
            <IconCheck className="size-5" />
            <span>Challenge complete!</span>
          </div>
        )}
      </div>
    );
  },
);

MathsChallenge.displayName = "MathsChallenge";

export const mathsChallenge = defineChallengeUi({
  ...mathsDefinition,
  icon: <IconCalculator className="size-5" />,
  render: (props) => <MathsChallenge {...props} />,
  renderSummary: (settings) => {
    const count = settings.questionCount ?? 3;
    const ops = settings.operations ?? [];
    const opCount = ops.length;
    const difficulty = toDifficulty(settings.difficulty);
    return `${count} questions (${opCount} ops, ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)})`;
  },
});
