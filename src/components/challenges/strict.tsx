import { memo } from "react";
import { IconLock } from "@tabler/icons-react";
import type { ChallengeComponentProps } from "@/lib/challenges/ui";
import { defineChallengeUi } from "@/lib/challenges/ui";
import { strictDefinition } from "@/lib/challenges/definitions/strict";

const StrictChallenge = memo((_props: ChallengeComponentProps<{}>) => {
  return (
    <div className="space-y-3 text-center">
      <div className="flex items-center justify-center text-destructive">
        <IconLock className="size-6" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">Strict mode enabled</p>
        <p className="text-sm text-muted-foreground">There is no unlock method for this site.</p>
      </div>
    </div>
  );
});

StrictChallenge.displayName = "StrictChallenge";

export const strictChallenge = defineChallengeUi({
  ...strictDefinition,
  icon: <IconLock className="size-5" />,
  render: (props) => <StrictChallenge {...props} />,
});
