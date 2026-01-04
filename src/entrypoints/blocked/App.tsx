import { useState, useEffect, useCallback, useRef } from "react";
import { type BlockedSite } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  IconClockHour5Filled,
  IconX,
  IconArrowRight,
  IconArrowLeft,
  IconLockOpen,
} from "@tabler/icons-react";
import { CHALLENGES } from "@/components/challenges";
import { ChallengeInstructionsPanel } from "@/components/challenges/instructions";
import { getUnlockGuard, isContinuousUnlockMethod } from "@/lib/unlock-guards";
import { ClaudeBlockerDebug } from "@/components/challenges/claude-blocker";

export default function BlockedPage() {
  const [blockedSite, setBlockedSite] = useState<BlockedSite | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [challengeComplete, setChallengeComplete] = useState(false);
  const [alreadyUnlocked, setAlreadyUnlocked] = useState(false);
  const [statsEnabled, setStatsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const visitTracked = useRef(false);
  const siteIdRef = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get("url");
    const siteId = params.get("siteId");

    if (!url) {
      setError("No URL provided");
      setLoading(false);
      return;
    }

    setOriginalUrl(url);
    siteIdRef.current = siteId;

    void (async () => {
      try {
        const result = await browser.runtime.sendMessage({
          type: "GET_SITE_INFO",
          siteId,
          url,
        });

        if (result.error) {
          setError(result.error);
        } else if (result.site) {
          setBlockedSite(result.site);
          setStatsEnabled(result.statsEnabled);
          siteIdRef.current = result.site.id;

          if (result.alreadyUnlocked) {
            setAlreadyUnlocked(true);
            setChallengeComplete(true);
          }

          if (result.statsEnabled && !visitTracked.current && !result.alreadyUnlocked) {
            visitTracked.current = true;
            await browser.runtime.sendMessage({
              type: "UPDATE_STATS",
              siteId: result.site.id,
              update: { incrementVisit: true },
            });
          }
        } else {
          window.location.href = url;
        }
      } catch (err) {
        console.error("[distracted] Error getting site info:", err);
        setError("Failed to load blocking info");
      }

      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const handleMessage = (message: {
      type: string;
      siteId?: string;
      expiresAt?: number | null;
    }) => {
      if (!siteIdRef.current) return;

      if (message.type === "SITE_UNLOCKED" && message.siteId === siteIdRef.current) {
        setAlreadyUnlocked(true);
        setChallengeComplete(true);
      }

      if (message.type === "SITE_RELOCKED" && message.siteId === siteIdRef.current) {
        window.location.reload();
      }
    };

    browser.runtime.onMessage.addListener(handleMessage);
    return () => {
      browser.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  const handleChallengeComplete = useCallback(() => {
    setChallengeComplete(true);
  }, []);

  const handleUnlock = useCallback(async () => {
    if (!blockedSite || !originalUrl) return;

    setUnlocking(true);

    try {
      if (alreadyUnlocked) {
        window.location.href = originalUrl;
        return;
      }

      if (isContinuousUnlockMethod(blockedSite.unlockMethod)) {
        const guard = getUnlockGuard(blockedSite.unlockMethod);
        if (guard) {
          const state = await guard.check(blockedSite.challengeSettings);
          if (!state.active) {
            setError(state.message ?? "Unlock condition not met.");
            setUnlocking(false);
            return;
          }
        }
      }

      const result = await browser.runtime.sendMessage({
        type: "UNLOCK_SITE",
        siteId: blockedSite.id,
        durationMinutes: blockedSite.autoRelockAfter,
      });

      if (result.success) {
        if (statsEnabled) {
          await browser.runtime.sendMessage({
            type: "UPDATE_STATS",
            siteId: blockedSite.id,
            update: { incrementPassed: true },
          });
        }

        window.location.href = originalUrl;
      } else {
        setError(result.error || "Failed to unlock");
        setUnlocking(false);
      }
    } catch (err) {
      console.error("[distracted] Error unlocking:", err);
      setError("Failed to unlock site");
      setUnlocking(false);
    }
  }, [blockedSite, originalUrl, statsEnabled, alreadyUnlocked]);

  const handleKeypress = useCallback(
    async (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.code === "Enter") && challengeComplete) {
        void handleUnlock();
      }
    },
    [challengeComplete, handleUnlock],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeypress);
    return () => window.removeEventListener("keydown", handleKeypress);
  }, [handleKeypress]);

  const handleGoBack = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.close();
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <IconX className="size-12 mx-auto text-destructive mb-4" />
            <p className="text-lg font-medium mb-2">Error</p>
            <p className="text-muted-foreground text-sm mb-4">{error}</p>
            <Button onClick={handleGoBack} variant="outline">
              <IconArrowLeft className="size-4" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!blockedSite) {
    return null;
  }

  const challenge = CHALLENGES[blockedSite.unlockMethod];
  const challengeSettings = blockedSite.challengeSettings as typeof challenge extends {
    render: (props: infer P extends { settings: any }) => any;
  }
    ? P["settings"]
    : never;

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 dark bg-background"
      style={{
        fontFamily:
          "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <Card className="w-full max-w-md relative bg-card/95 backdrop-blur shadow-2xl">
        <CardHeader className="text-center flex flex-col gap-2">
          <div className="flex gap-2 items-center">
            <IconClockHour5Filled className="size-6 text-primary" />
            <CardTitle className="text-xl">Site Blocked</CardTitle>
          </div>
          <div className="flex gap-2 text-xs items-center max-w-full">
            <span className="bg-muted/50 px-2 py-0.5 rounded font-medium">{blockedSite.name}</span>
            {originalUrl && (
              <div className="text-muted-foreground font-mono truncate bg-muted/50 px-2 py-0.5 rounded">
                {originalUrl
                  .replace(/^https?:\/\//, "")
                  .split("/")
                  .filter(Boolean)
                  .join("/")}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {alreadyUnlocked ? (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-3 text-green-500">
                <IconLockOpen className="size-6" />
                <div>
                  <p className="font-medium">Already Unlocked</p>
                  <p className="text-sm text-green-500/80">Challenge completed in another tab</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/30">
                <div className="text-primary">{challenge.icon}</div>
                <span className="font-medium">{challenge.label}</span>
              </div>

              {challenge.render({
                settings: challengeSettings,
                onComplete: handleChallengeComplete,
              })}
            </div>
          )}

          {!alreadyUnlocked && challenge.instructions && (
            <ChallengeInstructionsPanel instructions={challenge.instructions}>
              {blockedSite.unlockMethod === "claude" && (
                <ClaudeBlockerDebug
                  settings={
                    challengeSettings as { serverUrl: string; allowWhileWaitingForInput?: boolean }
                  }
                  onComplete={() => {}}
                />
              )}
            </ChallengeInstructionsPanel>
          )}

          {challengeComplete && (
            <Button onClick={handleUnlock} className="w-full" size="lg" disabled={unlocking}>
              {unlocking ? (
                "Unlocking..."
              ) : (
                <>
                  Continue to Site
                  <IconArrowRight className="size-4" />
                </>
              )}
            </Button>
          )}

          {blockedSite.autoRelockAfter &&
            !alreadyUnlocked &&
            !isContinuousUnlockMethod(blockedSite.unlockMethod) && (
              <p className="text-xs text-center text-muted-foreground">
                Access will expire after {blockedSite.autoRelockAfter} minute
                {blockedSite.autoRelockAfter > 1 ? "s" : ""}
              </p>
            )}
        </CardContent>
      </Card>

      <button
        onClick={handleGoBack}
        className="fixed top-4 right-4 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
        title="Go back"
      >
        <IconX className="size-5" />
      </button>
    </div>
  );
}
