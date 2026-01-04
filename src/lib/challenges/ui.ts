import type React from "react";
import type {
  ChallengeDefinition,
  ChallengeOptionValues,
  InferOptionValues,
  OptionDefinitions,
} from "@/lib/challenges/options";

export type ChallengeComponentProps<Settings extends ChallengeOptionValues> = {
  settings: Settings;
  onComplete: () => void;
};

export type ChallengeUi<Options extends OptionDefinitions = OptionDefinitions> =
  ChallengeDefinition<Options> & {
    icon: React.ReactNode;
    render: (props: ChallengeComponentProps<InferOptionValues<Options>>) => React.ReactNode;
  };

export const defineChallengeUi = <Options extends OptionDefinitions>(
  challenge: ChallengeUi<Options>,
) => challenge;
