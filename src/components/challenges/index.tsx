import {
  IconClock,
  IconHandStop,
  IconKeyboard,
  IconMath,
} from "@tabler/icons-react";
import { TimerChallenge } from "./timer";
import { HoldChallenge } from "./hold";
import { TypeChallenge } from "./type";
import { MathChallenge } from "./math";

type ChallengeOptionValue = number | string | boolean;
type ChallengeOptions = Record<string, ChallengeOptionValue>;

export interface ChallengeComponentProps<Options extends ChallengeOptions> {
  settings: Options;
  onComplete: () => void;
}

type OptionDefinition<T extends ChallengeOptionValue> = {
  label: string;
  default: T;
  description: string;
};

type Challenge<Options extends ChallengeOptions = ChallengeOptions> = {
  label: string;
  icon: React.ReactNode;
  description: string;
  title: string;
  options: {
    [K in keyof Options]: OptionDefinition<Options[K]>;
  };
  render: (props: ChallengeComponentProps<Options>) => React.ReactNode;
};

const define = <Options extends ChallengeOptions>(
  challenge: Challenge<Options>
) => challenge;

export const CHALLENGES = {
  timer: define({
    label: "Wait Timer",
    icon: <IconClock className="size-5" />,
    description: "Wait for a countdown to finish",
    title: "Wait to Access",
    options: {
      duration: {
        label: "Duration (seconds)",
        default: 10,
        description: "The duration of the timer",
      },
    },
    render: (props) => <TimerChallenge {...props} />,
  }),
  hold: define({
    label: "Hold Button",
    icon: <IconHandStop className="size-5" />,
    description: "Hold a button continuously",
    title: "Hold to Access",
    options: {
      duration: {
        label: "Duration (seconds)",
        default: 10,
        description: "How long to hold the button for",
      },
    },
    render: (props) => <HoldChallenge {...props} />,
  }),
  type: define({
    label: "Type Text",
    icon: <IconKeyboard className="size-5" />,
    description: "Type a random UUID (no copy/paste)",
    title: "Type to Access",
    options: {},
    render: (props) => <TypeChallenge {...props} />,
  }),
  math: define({
    label: "Math Challenge",
    icon: <IconMath className="size-5" />,
    description: "Solve math problems to unlock",
    title: "Solve to Access",
    options: {
      questionCount: {
        label: "Number of Questions",
        default: 3,
        description: "How many math problems to solve (1-10)",
      },
    },
    render: (props) => <MathChallenge {...props} />,
  }),
} as const;

// Type exports for storage layer
export type UnlockMethod = keyof typeof CHALLENGES;

// Infer the settings type for each challenge from its options defaults
type InferChallengeSettings<T> = T extends { options: infer O }
  ? { [K in keyof O]: O[K] extends { default: infer D } ? D : never }
  : never;

export type ChallengeSettingsMap = {
  [K in UnlockMethod]: InferChallengeSettings<(typeof CHALLENGES)[K]>;
};

export function getDefaultChallengeSettings<M extends UnlockMethod>(
  method: M
): ChallengeSettingsMap[M] {
  const challenge = CHALLENGES[method];
  const settings: Record<string, ChallengeOptionValue> = {};
  for (const [key, opt] of Object.entries(challenge.options)) {
    settings[key] = (opt as OptionDefinition<ChallengeOptionValue>).default;
  }
  return settings as ChallengeSettingsMap[M];
}
