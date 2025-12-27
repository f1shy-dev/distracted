import { useState, useEffect, useCallback, useMemo, memo } from "react";
import {
  getBlockedSites,
  addBlockedSite,
  updateBlockedSite,
  deleteBlockedSite,
  getStats,
  getSettings,
  saveSettings,
  clearStats,
  formatDuration,
  DEFAULT_AUTO_RELOCK,
  type BlockedSite,
  type SiteStats,
  type Settings,
  type UnlockMethod,
  type PatternRule,
  type Schedule,
} from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  IconPlus,
  IconTrash,
  IconPlayerPause,
  IconPlayerPlay,
  IconChartBar,
  IconSettings,
  IconShieldLock,
  IconArrowLeft,
  IconHandStop,
  IconClock,
  IconKeyboard,
  IconRefresh,
  IconEdit,
  IconCheck,
  IconX,
  IconWorld,
} from "@tabler/icons-react";

type View = "main" | "add" | "edit" | "stats" | "settings";

const UNLOCK_METHOD_INFO: Record<
  UnlockMethod,
  { label: string; icon: React.ReactNode; description: string }
> = {
  timer: {
    label: "Wait Timer",
    icon: <IconClock className="size-4" />,
    description: "Wait for a countdown to finish",
  },
  hold: {
    label: "Hold Button",
    icon: <IconHandStop className="size-4" />,
    description: "Hold a button continuously",
  },
  type: {
    label: "Type Text",
    icon: <IconKeyboard className="size-4" />,
    description: "Type a random UUID (no copy/paste)",
  },
};

// Pattern Rule Editor Component
const PatternRuleItem = memo(function PatternRuleItem({
  rule,
  onUpdate,
  onDelete,
  canDelete,
}: {
  rule: PatternRule;
  onUpdate: (updates: Partial<PatternRule>) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => onUpdate({ allow: !rule.allow })}
        className={
          rule.allow
            ? "text-green-500 hover:text-green-400"
            : "text-destructive hover:text-destructive/80"
        }
      >
        {rule.allow ? (
          <IconCheck className="size-4" />
        ) : (
          <IconX className="size-4" />
        )}
      </Button>
      <Input
        value={rule.pattern}
        onChange={(e) => onUpdate({ pattern: e.target.value })}
        placeholder="domain.com or path"
        className="flex-1 font-mono text-sm"
      />
      {canDelete && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive"
        >
          <IconTrash className="size-4" />
        </Button>
      )}
    </div>
  );
});

const SiteItem = memo(function SiteItem({
  site,
  onToggle,
  onEdit,
  onDelete,
}: {
  site: BlockedSite;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (site: BlockedSite) => void;
  onDelete: (id: string) => void;
}) {
  const blockRules = site.rules.filter((r) => !r.allow);
  const allowRules = site.rules.filter((r) => r.allow);

  return (
    <div
      className={`group p-3 rounded-lg transition-all ${site.enabled ? "bg-muted/40" : "bg-muted/20 opacity-60"
        }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm truncate">{site.name}</span>
          <Badge
            variant={site.enabled ? "default" : "secondary"}
            className="text-xs shrink-0"
          >
            {UNLOCK_METHOD_INFO[site.unlockMethod].label}
          </Badge>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon-sm" onClick={() => onEdit(site)}>
            <IconEdit className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onToggle(site.id, !site.enabled)}
          >
            {site.enabled ? (
              <IconPlayerPause className="size-4" />
            ) : (
              <IconPlayerPlay className="size-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDelete(site.id)}
            className="text-destructive hover:text-destructive"
          >
            <IconTrash className="size-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        {blockRules.map((rule, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <IconX className="size-3 text-destructive shrink-0" />
            <code className="text-muted-foreground truncate">
              {rule.pattern}
            </code>
          </div>
        ))}
        {allowRules.map((rule, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <IconCheck className="size-3 text-green-500 shrink-0" />
            <code className="text-muted-foreground truncate">
              {rule.pattern}
            </code>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
        <span>{site.unlockDuration}s to unlock</span>
        {site.autoRelockAfter && (
          <span className="flex items-center gap-1">
            <IconRefresh className="size-3" />
            {site.autoRelockAfter}m relock
          </span>
        )}
      </div>
    </div>
  );
});

const StatItem = memo(function StatItem({
  stat,
  site,
  maxTime,
}: {
  stat: SiteStats;
  site: BlockedSite | undefined;
  maxTime: number;
}) {
  const passRate =
    stat.visitCount > 0
      ? Math.round((stat.passedCount / stat.visitCount) * 100)
      : 0;

  const timePercent = maxTime > 0 ? (stat.timeSpentMs / maxTime) * 100 : 0;

  return (
    <div className="p-3 rounded-lg bg-muted/30">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{site?.name || "Unknown"}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-lg font-bold text-primary">
            {stat.visitCount}
          </div>
          <div className="text-xs text-muted-foreground">Visits</div>
        </div>
        <div>
          <div className="text-lg font-bold text-chart-2">{passRate}%</div>
          <div className="text-xs text-muted-foreground">Pass Rate</div>
        </div>
        <div>
          <div className="text-lg font-bold text-chart-3">
            {formatDuration(stat.timeSpentMs)}
          </div>
          <div className="text-xs text-muted-foreground">Time Wasted</div>
        </div>

        {/* Visual Bar */}
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider">
            <span>Time Wasted</span>
            <span>{timePercent.toFixed(0)}% of max</span>
          </div>
          <div className="h-2 bg-background/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary/70 rounded-full"
              style={{ width: `${timePercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>

  );
});

export default function App() {
  const [view, setView] = useState<View>("main");
  const [sites, setSites] = useState<BlockedSite[]>([]);
  const [stats, setStats] = useState<SiteStats[]>([]);
  const [settings, setSettings] = useState<Settings>({ statsEnabled: true });
  const [loading, setLoading] = useState(true);
  const [editingSite, setEditingSite] = useState<BlockedSite | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formRules, setFormRules] = useState<PatternRule[]>([
    { pattern: "", allow: false },
  ]);
  const [formMethod, setFormMethod] = useState<UnlockMethod>("timer");
  const [formDuration, setFormDuration] = useState("10");

  const [formAutoRelock, setFormAutoRelock] = useState(
    String(DEFAULT_AUTO_RELOCK)
  );
  const [formStrict, setFormStrict] = useState(false);
  const [formSchedule, setFormSchedule] = useState<Schedule>({
    enabled: false,
    days: [1, 2, 3, 4, 5],
    start: "09:00",
    end: "17:00",
  });

  const loadData = useCallback(async () => {
    try {
      const [loadedSites, loadedStats, loadedSettings] = await Promise.all([
        getBlockedSites(),
        getStats(),
        getSettings(),
      ]);
      setSites(loadedSites);
      setStats(loadedStats);
      setSettings(loadedSettings);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = useCallback(() => {
    setFormName("");
    setFormRules([{ pattern: "", allow: false }]);
    setFormMethod("timer");
    setFormDuration("10");
    setFormAutoRelock(String(DEFAULT_AUTO_RELOCK));
    setFormStrict(false);
    setFormSchedule({
      enabled: false,
      days: [1, 2, 3, 4, 5],
      start: "09:00",
      end: "17:00",
    });
    setEditingSite(null);
  }, []);

  const handleAddCurrentSite = useCallback(async () => {
    try {
      const result = await browser.runtime.sendMessage({
        type: "GET_CURRENT_TAB_URL",
      });
      if (result.domain) {
        // Update the first rule or add domain to existing rules
        setFormRules((rules) => {
          if (rules.length === 1 && !rules[0].pattern) {
            return [{ pattern: result.domain, allow: false }];
          }
          return [...rules, { pattern: result.domain, allow: false }];
        });
        if (!formName) {
          setFormName(result.domain);
        }
      }
    } catch (error) {
      console.error("Failed to get current tab URL:", error);
    }
  }, [formName]);

  const handleSaveSite = useCallback(async () => {
    const validRules = formRules.filter((r) => r.pattern.trim());
    if (!formName.trim() || validRules.length === 0) return;

    const siteData = {
      name: formName.trim(),
      rules: validRules.map((r) => ({ ...r, pattern: r.pattern.trim() })),
      unlockMethod: formMethod,
      unlockDuration: parseInt(formDuration) || 10,
      autoRelockAfter: formAutoRelock ? parseInt(formAutoRelock) : null,
      enabled: true,
      strict: formStrict,
      schedule: formSchedule,
    };

    try {
      if (editingSite) {
        await updateBlockedSite(editingSite.id, siteData);
      } else {
        await addBlockedSite(siteData);
      }

      resetForm();
      resetForm();
      setView("main");
      loadData();
    } catch (error) {
      console.error("Failed to save site:", error);
      alert("Failed to save site. Please check console for details.");
    }
  }, [
    formName,
    formRules,
    formMethod,
    formDuration,
    formAutoRelock,
    formStrict,
    formSchedule,
    editingSite,
    resetForm,
    loadData,
  ]);

  const handleEditSite = useCallback((site: BlockedSite) => {
    setEditingSite(site);
    setFormName(site.name);
    setFormRules(
      site.rules.length > 0 ? site.rules : [{ pattern: "", allow: false }]
    );
    setFormMethod(site.unlockMethod);
    setFormDuration(String(site.unlockDuration));
    setFormAutoRelock(site.autoRelockAfter ? String(site.autoRelockAfter) : "");
    setFormStrict(!!site.strict);
    setFormSchedule(
      site.schedule || {
        enabled: false,
        days: [1, 2, 3, 4, 5],
        start: "09:00",
        end: "17:00",
      }
    );
    setView("edit");
  }, []);

  const handleToggleSite = useCallback(
    async (id: string, enabled: boolean) => {
      await updateBlockedSite(id, { enabled });
      loadData();
    },
    [loadData]
  );

  const handleDeleteSite = useCallback(
    async (id: string) => {
      await deleteBlockedSite(id);
      loadData();
    },
    [loadData]
  );

  const handleToggleStats = useCallback(async () => {
    const newSettings = { ...settings, statsEnabled: !settings.statsEnabled };
    await saveSettings(newSettings);
    setSettings(newSettings);
  }, [settings]);

  const handleClearStats = useCallback(async () => {
    await clearStats();
    loadData();
  }, [loadData]);

  const handleAddRule = useCallback(() => {
    setFormRules((rules) => [...rules, { pattern: "", allow: false }]);
  }, []);

  const handleUpdateRule = useCallback(
    (index: number, updates: Partial<PatternRule>) => {
      setFormRules((rules) =>
        rules.map((r, i) => (i === index ? { ...r, ...updates } : r))
      );
    },
    []
  );

  const handleDeleteRule = useCallback((index: number) => {
    setFormRules((rules) => rules.filter((_, i) => i !== index));
  }, []);

  const handleBackToMain = useCallback(() => {
    resetForm();
    setView("main");
  }, [resetForm]);

  const siteMap = useMemo(() => {
    return new Map(sites.map((s) => [s.id, s]));
  }, [sites]);

  const isFormValid = useMemo(() => {
    return formName.trim() && formRules.some((r) => r.pattern.trim());
  }, [formName, formRules]);

  if (loading) {
    return (
      <div className="w-[400px] h-[520px] bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const isEditing = view === "add" || view === "edit";

  return (
    <div className="w-[400px] h-[520px] bg-background text-foreground flex flex-col overflow-hidden dark">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/30 bg-muted/30">
        <div className="flex items-center gap-2">
          {view !== "main" && (
            <Button variant="ghost" size="icon-sm" onClick={handleBackToMain}>
              <IconArrowLeft className="size-4" />
            </Button>
          )}
          <IconShieldLock className="size-5 text-primary" />
          <h1 className="text-lg font-bold tracking-tight">
            {view === "main" && "distacted"}
            {view === "add" && "Block Site"}
            {view === "edit" && "Edit Block"}
            {view === "stats" && "Statistics"}
            {view === "settings" && "Settings"}
          </h1>
        </div>
        {view === "main" && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                resetForm();
                setView("add");
              }}
            >
              <IconPlus className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setView("stats")}
            >
              <IconChartBar className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setView("settings")}
            >
              <IconSettings className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {view === "main" && (
          <div className="space-y-3">
            {sites.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <IconShieldLock className="size-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No blocked sites yet</p>
                <p className="text-xs mt-1 mb-4">
                  Add your first distraction to block
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    resetForm();
                    setView("add");
                  }}
                >
                  <IconPlus className="size-4 mr-2" />
                  Add Blocked Site
                </Button>
              </div>
            ) : (
              sites.map((site) => (
                <SiteItem
                  key={site.id}
                  site={site}
                  onToggle={handleToggleSite}
                  onEdit={handleEditSite}
                  onDelete={handleDeleteSite}
                />
              ))
            )}
          </div>
        )}

        {isEditing && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Social Media, News, etc."
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>URL Patterns</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={handleAddCurrentSite}
                  className="text-xs"
                >
                  <IconWorld className="size-3" />
                  Current Site
                </Button>
              </div>
              <div className="space-y-2">
                {formRules.map((rule, index) => (
                  <PatternRuleItem
                    key={index}
                    rule={rule}
                    onUpdate={(updates) => handleUpdateRule(index, updates)}
                    onDelete={() => handleDeleteRule(index)}
                    canDelete={formRules.length > 1}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddRule}
                className="w-full"
              >
                <IconPlus className="size-4" />
                Add Pattern
              </Button>
              <p className="text-xs text-muted-foreground">
                <IconX className="size-3 inline text-destructive" /> = Block,{" "}
                <IconCheck className="size-3 inline text-green-500" /> = Allow
                (whitelist). Use *.domain.com for subdomains, domain.com/path
                for specific paths.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Unlock Method</Label>
              <div className="grid gap-2">
                {(Object.keys(UNLOCK_METHOD_INFO) as UnlockMethod[]).map(
                  (method) => {
                    const info = UNLOCK_METHOD_INFO[method];
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setFormMethod(method)}
                        className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all ${formMethod === method
                          ? "bg-primary/15"
                          : "bg-muted/30 hover:bg-muted/50"
                          }`}
                      >
                        <div
                          className={`p-2 rounded-md ${formMethod === method
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/50 text-muted-foreground"
                            }`}
                        >
                          {info.icon}
                        </div>
                        <div>
                          <div className="font-medium text-sm">
                            {info.label}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {info.description}
                          </div>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="duration">
                  {formMethod === "type" ? "Text Length" : "Duration (sec)"}
                </Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  value={formDuration}
                  onChange={(e) => setFormDuration(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="relock">Auto-relock (min)</Label>
                <Input
                  id="relock"
                  type="number"
                  min="1"
                  placeholder="Never"
                  value={formAutoRelock}
                  onChange={(e) => setFormAutoRelock(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 p-3 rounded-lg border border-border/50 bg-muted/20">
              <Checkbox
                id="strict"
                checked={formStrict}
                onCheckedChange={(c) => setFormStrict(!!c)}
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="strict"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Strict Mode
                </Label>
                <p className="text-xs text-muted-foreground">
                  Hide the unlock button (no way to bypass).
                </p>
              </div>
            </div>



            <div className="space-y-3 pt-2 border-t border-border/30">
              <div className="flex items-center justify-between">
                <div className="grid gap-0.5">
                  <Label>Active Schedule</Label>
                  <p className="text-xs text-muted-foreground">
                    Only block during these times
                  </p>
                </div>
                <Checkbox
                  id="schedule"
                  checked={formSchedule.enabled}
                  onCheckedChange={(c) =>
                    setFormSchedule({ ...formSchedule, enabled: !!c })
                  }
                />
              </div>

              {formSchedule.enabled && (
                <div className="space-y-3 p-3 bg-muted/30 rounded-lg animate-in fade-in slide-in-from-top-2">
                  <div className="flex justify-between gap-1">
                    {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          const newDays = formSchedule.days.includes(i)
                            ? formSchedule.days.filter((d) => d !== i)
                            : [...formSchedule.days, i];
                          setFormSchedule({ ...formSchedule, days: newDays });
                        }}
                        className={`size-8 rounded-full text-xs font-medium transition-all ${formSchedule.days.includes(i)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Start Time</Label>
                      <Input
                        type="time"
                        value={formSchedule.start}
                        onChange={(e) =>
                          setFormSchedule({
                            ...formSchedule,
                            start: e.target.value,
                          })
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">End Time</Label>
                      <Input
                        type="time"
                        value={formSchedule.end}
                        onChange={(e) =>
                          setFormSchedule({
                            ...formSchedule,
                            end: e.target.value,
                          })
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  {formSchedule.days.length === 0 && (
                    <p className="text-xs text-destructive">
                      Please select at least one day.
                    </p>
                  )}
                </div>
              )}
            </div>

            <Button
              onClick={handleSaveSite}
              disabled={!isFormValid}
              className="w-full"
            >
              {editingSite ? (
                <>
                  <IconCheck className="size-4" />
                  Save Changes
                </>
              ) : (
                <>
                  <IconPlus className="size-4" />
                  Add Blocked Site
                </>
              )}
            </Button>
          </div>
        )}

        {view === "stats" && (
          <div className="space-y-3">
            {!settings.statsEnabled ? (
              <Card className="bg-muted/30">
                <CardContent className="pt-4">
                  <div className="text-center text-muted-foreground">
                    <IconChartBar className="size-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Statistics are disabled</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={handleToggleStats}
                    >
                      Enable Statistics
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : stats.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <IconChartBar className="size-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No statistics yet</p>
                <p className="text-xs mt-1">Visit blocked sites to see data</p>
              </div>
            ) : (
              (() => {
                const maxTime = Math.max(...stats.map((s) => s.timeSpentMs), 0);
                return stats.map((stat) => (
                  <StatItem
                    key={stat.siteId}
                    stat={stat}
                    site={siteMap.get(stat.siteId)}
                    maxTime={maxTime}
                  />
                ));
              })()
            )}
          </div>
        )}

        {view === "settings" && (
          <div className="space-y-4">
            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Privacy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">Track Statistics</div>
                    <div className="text-xs text-muted-foreground">
                      Track visits, pass rate, and time spent
                    </div>
                  </div>
                  <Button
                    variant={settings.statsEnabled ? "default" : "outline"}
                    size="sm"
                    onClick={handleToggleStats}
                  >
                    {settings.statsEnabled ? "Enabled" : "Disabled"}
                  </Button>
                </div>
                {settings.statsEnabled && stats.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleClearStats}
                    className="w-full"
                  >
                    <IconTrash className="size-4" />
                    Clear All Statistics
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  distacted helps you stay focused by blocking distracting
                  websites. All data is stored locally and never leaves your
                  device.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Footer - only on main view */}
      {
        view === "main" && (
          <div className="p-4 border-t border-border/30 bg-muted/20">
            <Button onClick={() => setView("add")} className="w-full">
              <IconPlus className="size-4" />
              Block a Website
            </Button>
          </div>
        )
      }
    </div >
  );
}
