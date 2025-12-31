import { useCallback } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { IconKeyboard } from "@tabler/icons-react";
import { TypeChallenge } from "@/components/challenges/type";

interface ChallengeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  title: string;
  description?: string;
}

export function ChallengeDialog({
  open,
  onOpenChange,
  onComplete,
  title,
  description,
}: ChallengeDialogProps) {
  const handleChallengeComplete = useCallback(() => {
    onComplete();
    onOpenChange(false);
  }, [onComplete, onOpenChange]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-primary/10 text-primary">
            <IconKeyboard />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <TypeChallenge settings={{}} onComplete={handleChallengeComplete} />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
