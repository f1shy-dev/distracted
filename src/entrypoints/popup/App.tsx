import { useState, useEffect, useCallback, useMemo, memo } from "react";
import {
  getBlockedSites,
  updateBlockedSite,
  getStats,
  getSettings,
  saveSettings,
  type BlockedSite,
  type SiteStats,
  type Settings,
  type PatternRule,
  type Schedule,
  saveBlockedSites,
} from "@/lib/storage";
import { DEFAULT_AUTO_RELOCK, STORAGE_KEYS } from "@/lib/consts";
import {
  getDefaultChallengeSettings,
  isUnlockMethod,
  type ChallengeSettingsMap,
  type UnlockMethod,
} from "@/lib/challenges/manifest";
import { CHALLENGE_UI } from "@/components/challenges/registry";
import { ChallengeInstructionsPanel } from "@/components/challenges/instructions";
import { ClaudeBlockerDebug } from "@/components/challenges/claude-blocker";
import { isContinuousUnlockMethod } from "@/lib/unlock-guards";
import type { OptionDefinition } from "@/lib/challenges/options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconPlus,
  IconTrash,
  IconPlayerPause,
  IconPlayerPlay,
  IconChartBar,
  IconSettings,
  IconArrowLeft,
  IconRefresh,
  IconEdit,
  IconCheck,
  IconX,
  IconWorld,
  IconClockHour5Filled,
  IconLeaf,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

type View = "main" | "add" | "edit" | "stats" | "settings";
const DEFAULT_UNLOCK_METHOD: UnlockMethod = "timer";

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
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onUpdate({ allow: !rule.allow })}
        className={cn(
          "border",
          rule.allow
            ? "border-green-500/10 hover:border-green-500/20 bg-green-500/10 text-green-500 hover:bg-green-500/20! hover:text-green-500!"
            : "border-destructive/10 hover:border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20! hover:text-destructive!",
        )}
        title={rule.allow ? "Allow" : "Block"}
      >
        {rule.allow ? <IconCheck className="size-4" /> : <IconX className="size-4" />}
        <span className="sr-only">{rule.allow ? "Allow" : "Block"}</span>
      </Button>
      <Input
        value={rule.pattern}
        onChange={(e) => onUpdate({ pattern: e.target.value })}
        placeholder="domain.com or path"
        className="flex-1 font-mono text-sm"
      />
      {canDelete && (
        <Button type="button" variant="muted" size="icon" onClick={onDelete}>
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
  const resolvedMethod = isUnlockMethod(site.unlockMethod)
    ? site.unlockMethod
    : DEFAULT_UNLOCK_METHOD;
  const challenge = CHALLENGE_UI[resolvedMethod];
  const settings = useMemo(
    () => ({
      ...getDefaultChallengeSettings(resolvedMethod),
      ...(isUnlockMethod(site.unlockMethod) ? site.challengeSettings : {}),
    }),
    [resolvedMethod, site.unlockMethod, site.challengeSettings],
  );
  const blockRules = site.rules.filter((r) => !r.allow);
  const allowRules = site.rules.filter((r) => r.allow);

  const settingsSummary = useMemo(() => {
    return challenge.renderSummary(settings as never);
  }, [challenge, settings]);

  return (
    <div
      className={`group p-3 rounded-lg transition-all ${
        site.enabled ? "bg-muted/40" : "bg-muted/20 opacity-60"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm truncate">{site.name}</span>
          <Badge variant={site.enabled ? "default" : "secondary"} className="text-xs shrink-0">
            {challenge.label}
          </Badge>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon-sm" onClick={() => onEdit(site)}>
            <IconEdit className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => onToggle(site.id, !site.enabled)}>
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
            <code className="text-muted-foreground truncate">{rule.pattern}</code>
          </div>
        ))}
        {allowRules.map((rule, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <IconCheck className="size-3 text-green-500 shrink-0" />
            <code className="text-muted-foreground truncate">{rule.pattern}</code>
          </div>
        ))}
      </div>

      <div className="flex items-center mt-2 text-xs text-muted-foreground">
        {settingsSummary}
        {site.autoRelockAfter && (
          <span className="ml-3 flex items-center gap-1">
            <IconRefresh className="size-3" />
            {site.autoRelockAfter}m relock
          </span>
        )}
      </div>
    </div>
  );
});

const StatItem = memo(function StatItem({ stat, title }: { stat: SiteStats; title: string }) {
  const passRate = stat.visitCount > 0 ? Math.round((stat.passedCount / stat.visitCount) * 100) : 0;

  return (
    <div className="p-3 rounded-lg bg-muted/30">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium truncate">{title}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-lg font-bold text-primary">{stat.visitCount}</div>
          <div className="text-xs text-muted-foreground">Visits</div>
        </div>
        <div>
          <div className="text-lg font-bold text-chart-2">{passRate}%</div>
          <div className="text-xs text-muted-foreground">Pass Rate</div>
        </div>
        <div>
          <div className="text-lg font-bold text-chart-3">
            {(() => {
              const ms = stat.timeSpentMs;
              const seconds = Math.floor(ms / 1000);
              const minutes = Math.floor(seconds / 60);
              const hours = Math.floor(minutes / 60);

              if (hours > 0) {
                return `${hours}h ${minutes % 60}m`;
              }
              if (minutes > 0) {
                return `${minutes}m ${seconds % 60}s`;
              }
              return `${seconds}s`;
            })()}
          </div>
          <div className="text-xs text-muted-foreground">Time Wasted</div>
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
  const [statsView, setStatsView] = useState<"filter" | "website">("filter");

  const [formName, setFormName] = useState("");
  const [formRules, setFormRules] = useState<PatternRule[]>([{ pattern: "", allow: false }]);
  const [formMethod, setFormMethod] = useState<UnlockMethod>("timer");
  const [formChallengeSettings, setFormChallengeSettings] = useState<
    ChallengeSettingsMap[UnlockMethod]
  >(() => getDefaultChallengeSettings("timer"));
  const [formAutoRelock, setFormAutoRelock] = useState(String(DEFAULT_AUTO_RELOCK));
  const [formSchedule, setFormSchedule] = useState<Schedule>({
    enabled: false,
    days: [1, 2, 3, 4, 5],
    start: "09:00",
    end: "17:00",
  });

  const loadData = useCallback(async () => {
    const [loadedSites, loadedStats, loadedSettings] = await Promise.all([
      getBlockedSites(),
      getStats(),
      getSettings(),
    ]);
    setSites(loadedSites);
    setStats(loadedStats);
    setSettings(loadedSettings);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const resetForm = useCallback(() => {
    setFormName("");
    setFormRules([{ pattern: "", allow: false }]);
    setFormMethod("timer");
    setFormChallengeSettings(getDefaultChallengeSettings("timer"));
    setFormAutoRelock(String(DEFAULT_AUTO_RELOCK));
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
      challengeSettings: formChallengeSettings,
      autoRelockAfter: formAutoRelock ? parseInt(formAutoRelock) : null,
      enabled: true,
      schedule: formSchedule,
    };

    if (editingSite) {
      await updateBlockedSite(editingSite.id, siteData);
    } else {
      const sites = await getBlockedSites();
      const newSite = {
        ...siteData,
        id: Math.random().toString(36).substring(2, 10),
        createdAt: Date.now(),
      };
      await saveBlockedSites([...sites, newSite]);
    }

    resetForm();
    setView("main");
    void loadData();
  }, [
    formName,
    formRules,
    formMethod,
    formChallengeSettings,
    formAutoRelock,
    formSchedule,
    editingSite,
    resetForm,
    loadData,
  ]);

  const handleEditSite = useCallback((site: BlockedSite) => {
    const resolvedMethod = isUnlockMethod(site.unlockMethod)
      ? site.unlockMethod
      : DEFAULT_UNLOCK_METHOD;
    const defaultSettings = getDefaultChallengeSettings(resolvedMethod);
    const normalizedSettings = {
      ...defaultSettings,
      ...(isUnlockMethod(site.unlockMethod) ? site.challengeSettings : {}),
    };
    setEditingSite(site);
    setFormName(site.name);
    setFormRules(site.rules.length > 0 ? site.rules : [{ pattern: "", allow: false }]);
    setFormMethod(resolvedMethod);
    setFormChallengeSettings(normalizedSettings);
    setFormAutoRelock(site.autoRelockAfter ? String(site.autoRelockAfter) : "");
    setFormSchedule(
      site.schedule || {
        enabled: false,
        days: [1, 2, 3, 4, 5],
        start: "09:00",
        end: "17:00",
      },
    );
    setView("edit");
  }, []);

  const handleToggleSite = useCallback(
    async (id: string, enabled: boolean) => {
      await updateBlockedSite(id, { enabled });
      void loadData();
    },
    [loadData],
  );

  const handleDeleteSite = useCallback(
    async (id: string) => {
      const [sites, stats] = await Promise.all([getBlockedSites(), getStats()]);

      await Promise.all([
        saveBlockedSites(sites.filter((s) => s.id !== id)),
        browser.storage.local.set({
          [STORAGE_KEYS.STATS]: stats.filter(
            (stat) => stat.scope !== "site" || (stat.siteId ?? stat.key) !== id,
          ),
        }),
      ]);
      void loadData();
    },
    [loadData],
  );

  const handleToggleStats = useCallback(async () => {
    const newSettings = { ...settings, statsEnabled: !settings.statsEnabled };
    await saveSettings(newSettings);
    setSettings(newSettings);
  }, [settings]);

  const handleClearStats = useCallback(async () => {
    await browser.storage.local.set({ [STORAGE_KEYS.STATS]: [] });
    void loadData();
  }, [loadData]);

  const handleAddRule = useCallback(() => {
    setFormRules((rules) => [...rules, { pattern: "", allow: false }]);
  }, []);

  const handleUpdateRule = useCallback((index: number, updates: Partial<PatternRule>) => {
    setFormRules((rules) => rules.map((r, i) => (i === index ? { ...r, ...updates } : r)));
  }, []);

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

  const statsForView = useMemo(() => {
    return stats.filter((stat) =>
      statsView === "filter" ? stat.scope === "site" : stat.scope === "domain",
    );
  }, [stats, statsView]);

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
      <div className="flex items-center justify-between px-4 h-12 border-b border-border/30 bg-muted/30">
        <div className="flex items-center gap-2">
          {view !== "main" && (
            <Button variant="ghost" size="icon-sm" onClick={handleBackToMain}>
              <IconArrowLeft className="size-4" />
            </Button>
          )}
          <IconClockHour5Filled className="size-5 text-primary" />
          <h1 className="text-lg font-medium">
            {view === "main" && "distracted"}
            {view === "add" && "Block Site"}
            {view === "edit" && "Edit Block"}
            {view === "stats" && "Statistics"}
            {view === "settings" && "Settings"}
          </h1>
        </div>
        {view === "main" && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setView("stats")}>
              <IconChartBar />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setView("settings")}>
              <IconSettings />
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {view === "main" && (
          <div className="space-y-3">
            {sites.length === 0 ? (
              <div>
                <div className="space-y-6">
                  {[
                    {
                      icon: IconPlus,
                      title: "Add your first distraction",
                      desc: "Start by adding your first distraction",
                    },
                    {
                      icon: IconWorld,
                      title: "Configure patterns",
                      desc: "Set up websites to block with a simple challenge",
                    },
                    {
                      icon: IconLeaf,
                      title: "Enjoy your time",
                      desc: "Reduce wasted time and regain your focus and productivity",
                    },
                  ].map((step, i) => (
                    <div className="flex items-start gap-2 relative" key={i}>
                      {i != 0 && (
                        <div className="h-[70%] bg-muted-foreground/25 absolute left-[10px] translate-x-[-50%] -translate-y-9 w-px" />
                      )}
                      <step.icon className="size-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-foreground">{step.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
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
                <IconCheck className="size-3 inline text-green-500" /> = Allow (whitelist). Use
                *.domain.com for subdomains, domain.com/path for specific paths.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Unlock Method</Label>
              <div className="grid gap-1.25">
                {(Object.keys(CHALLENGE_UI) as UnlockMethod[]).map((method) => {
                  const challenge = CHALLENGE_UI[method];
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => {
                        setFormMethod(method);
                        setFormChallengeSettings(getDefaultChallengeSettings(method));
                      }}
                      className={`flex items-center gap-2 px-1.5 py-1.25 rounded-xl text-left transition-all ${
                        formMethod === method
                          ? "bg-secondary border border-secondary"
                          : "border border-border hover:bg-muted/50"
                      }`}
                    >
                      <div
                        className={`p-2 rounded-md ${
                          formMethod === method
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        {challenge.icon}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{challenge.label}</div>
                        <div className="text-xs text-muted-foreground">{challenge.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {(() => {
              const challenge = CHALLENGE_UI[formMethod];
              const optionEntries = Object.entries(challenge.options);
              if (optionEntries.length === 0) return null;

              const updateOption = (key: string, value: unknown) => {
                setFormChallengeSettings((prev: ChallengeSettingsMap[UnlockMethod]) => {
                  return {
                    ...(prev as Record<string, unknown>),
                    [key]: value,
                  } as ChallengeSettingsMap[UnlockMethod];
                });
              };

              return (
                <div className="space-y-3">
                  <Label>Challenge Options</Label>
                  <div className={`grid gap-3`}>
                    {optionEntries
                      .filter(([_key, option]) => {
                        const opt = option as OptionDefinition;
                        return !opt.when || opt.when(formChallengeSettings);
                      })
                      .map(([key, option]) => {
                        const opt = option as OptionDefinition;
                        const currentValue =
                          formChallengeSettings[key as keyof typeof formChallengeSettings] ??
                          opt.default;

                        const description = opt.description ? (
                          <p className="text-xs text-muted-foreground">{opt.description}</p>
                        ) : null;

                        if (opt.type === "checkbox") {
                          return (
                            <div key={key} className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                                <div className="flex flex-col">
                                  <Label htmlFor={`option-${key}`} className="text-sm font-normal">
                                    {opt.label}
                                  </Label>
                                  {description}
                                </div>
                                <Checkbox
                                  id={`option-${key}`}
                                  checked={Boolean(currentValue)}
                                  onCheckedChange={(checked) => updateOption(key, !!checked)}
                                />
                              </div>
                            </div>
                          );
                        }

                        if (opt.type === "select") {
                          return (
                            <div key={key} className="space-y-1">
                              <Label
                                htmlFor={`option-${key}`}
                                className="text-xs font-normal text-muted-foreground"
                              >
                                {opt.label}
                              </Label>
                              <Select
                                value={String(currentValue)}
                                onValueChange={(value) => {
                                  const selected = opt.options.find(
                                    (choice) => String(choice.value) === value,
                                  );
                                  if (selected) {
                                    updateOption(key, selected.value);
                                  }
                                }}
                              >
                                <SelectTrigger id={`option-${key}`} className="w-full">
                                  <SelectValue>
                                    {
                                      opt.options.find((choice) => choice.value === currentValue)
                                        ?.label
                                    }
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    {opt.options.map((choice) => (
                                      <SelectItem
                                        key={String(choice.value)}
                                        value={String(choice.value)}
                                      >
                                        {choice.label}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                              {description}
                            </div>
                          );
                        }

                        if (opt.type === "checkbox-group" || opt.type === "radio") {
                          const isMulti = opt.type === "checkbox-group";
                          const values = isMulti
                            ? Array.isArray(currentValue)
                              ? currentValue
                              : (opt.default ?? [])
                            : null;
                          return (
                            <div key={key} className="space-y-2">
                              <Label className="text-xs font-normal text-muted-foreground">
                                {opt.label}
                              </Label>
                              <div
                                className={cn(
                                  "grid gap-1",
                                  opt.options.every((choice) => choice.label.length < 18)
                                    ? "grid-cols-2"
                                    : "grid-cols-1",
                                )}
                              >
                                {opt.options.map((choice) => {
                                  const id = `option-${key}-${String(choice.value)}`;
                                  const isChecked = isMulti
                                    ? Array.isArray(values) &&
                                      values.some((value) => String(value) === String(choice.value))
                                    : String(currentValue) === String(choice.value);
                                  return (
                                    <label
                                      key={id}
                                      htmlFor={id}
                                      className="flex items-center gap-2 text-sm border border-border rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors cursor-pointer"
                                    >
                                      <Checkbox
                                        id={id}
                                        checked={isChecked}
                                        onCheckedChange={(checked) => {
                                          if (isMulti && Array.isArray(values)) {
                                            const next = checked
                                              ? [...values, choice.value]
                                              : values.filter(
                                                  (value) => String(value) !== String(choice.value),
                                                );
                                            updateOption(key, next);
                                          } else {
                                            if (checked) {
                                              updateOption(key, choice.value);
                                            }
                                          }
                                        }}
                                      />
                                      <span>{choice.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                              {description}
                            </div>
                          );
                        }

                        if (opt.type === "slider") {
                          const listId = opt.marks?.length ? `option-${key}-marks` : undefined;
                          return (
                            <div key={key} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <Label
                                  htmlFor={`option-${key}`}
                                  className="text-xs font-normal text-muted-foreground"
                                >
                                  {opt.label}
                                </Label>
                                <span className="text-xs text-muted-foreground">
                                  {currentValue}
                                </span>
                              </div>
                              <input
                                id={`option-${key}`}
                                type="range"
                                className="w-full accent-primary"
                                min={opt.min}
                                max={opt.max}
                                step={opt.step}
                                list={listId}
                                value={Number(currentValue)}
                                onChange={(e) => {
                                  const value = Number.parseFloat(e.target.value);
                                  updateOption(key, Number.isNaN(value) ? opt.min : value);
                                }}
                              />
                              {opt.marks?.length ? (
                                <datalist id={listId}>
                                  {opt.marks.map((mark) => (
                                    <option key={mark} value={mark} />
                                  ))}
                                </datalist>
                              ) : null}
                              {description}
                            </div>
                          );
                        }

                        if (opt.type === "number") {
                          return (
                            <div key={key} className="space-y-1">
                              <Label
                                htmlFor={`option-${key}`}
                                className="text-xs font-normal text-muted-foreground"
                              >
                                {opt.label}
                              </Label>
                              <Input
                                id={`option-${key}`}
                                type="number"
                                min={opt.min}
                                max={opt.max}
                                step={opt.step}
                                value={String(currentValue)}
                                onChange={(e) => {
                                  const value = Number.parseFloat(e.target.value);
                                  updateOption(key, Number.isNaN(value) ? (opt.min ?? 0) : value);
                                }}
                              />
                              {description}
                            </div>
                          );
                        }

                        if (opt.type === "text") {
                          return (
                            <div key={key} className="space-y-1">
                              <Label
                                htmlFor={`option-${key}`}
                                className="text-xs font-normal text-muted-foreground"
                              >
                                {opt.label}
                              </Label>
                              {opt.multiline ? (
                                <Textarea
                                  id={`option-${key}`}
                                  rows={3}
                                  value={String(currentValue)}
                                  onChange={(e) => updateOption(key, e.target.value)}
                                  className="text-sm"
                                />
                              ) : (
                                <Input
                                  id={`option-${key}`}
                                  type="text"
                                  placeholder={opt.placeholder}
                                  value={String(currentValue)}
                                  onChange={(e) => updateOption(key, e.target.value)}
                                />
                              )}
                              {description}
                            </div>
                          );
                        }
                        return null;
                      })}
                  </div>
                </div>
              );
            })()}

            {CHALLENGE_UI[formMethod].instructions && (
              <ChallengeInstructionsPanel instructions={CHALLENGE_UI[formMethod].instructions}>
                {formMethod === "claude" && (
                  <ClaudeBlockerDebug
                    settings={
                      formChallengeSettings as {
                        serverUrl: string;
                        allowWhileWaitingForInput?: boolean;
                      }
                    }
                    onComplete={() => {}}
                  />
                )}
              </ChallengeInstructionsPanel>
            )}

            {formMethod === "strict" || isContinuousUnlockMethod(formMethod) ? null : (
              <div className="space-y-2">
                <Label htmlFor="relock">Auto-relock (minutes)</Label>
                <Input
                  id="relock"
                  type="number"
                  min="1"
                  placeholder="Never"
                  value={formAutoRelock}
                  onChange={(e) => setFormAutoRelock(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  How long until the site is blocked again after unlocking
                </p>
              </div>
            )}

            <div className="space-y-3 pt-2 border-t border-border/30">
              <div className="flex items-center justify-between">
                <div className="grid gap-0.5">
                  <Label>Active Schedule</Label>
                  <p className="text-xs text-muted-foreground">Only block during these times</p>
                </div>
                <Checkbox
                  id="schedule"
                  checked={formSchedule.enabled}
                  onCheckedChange={(c: boolean | "indeterminate") =>
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
                        className={`size-8 rounded-full text-xs font-medium transition-all ${
                          formSchedule.days.includes(i)
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
                    <p className="text-xs text-destructive">Please select at least one day.</p>
                  )}
                </div>
              )}
            </div>

            <Button onClick={handleSaveSite} disabled={!isFormValid} className="w-full">
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
            {settings.statsEnabled && (
              <div className="flex items-center gap-2">
                <Button
                  variant={statsView === "filter" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatsView("filter")}
                  className="flex-1"
                >
                  Per Filter
                </Button>
                <Button
                  variant={statsView === "website" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatsView("website")}
                  className="flex-1"
                >
                  Per Website
                </Button>
              </div>
            )}
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
            ) : statsForView.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <IconChartBar className="size-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No statistics yet</p>
                <p className="text-xs mt-1">Visit blocked sites to see data</p>
              </div>
            ) : (
              (() => {
                return statsForView.map((stat) => {
                  if (stat.scope === "domain") {
                    const label = stat.domain ?? stat.key;
                    return <StatItem key={`domain-${stat.key}`} stat={stat} title={label} />;
                  }
                  const siteId = stat.siteId ?? stat.key;
                  const label = siteMap.get(siteId)?.name ?? "Unknown";
                  return <StatItem key={`site-${siteId}`} stat={stat} title={label} />;
                });
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
                  distracted helps you stay focused by blocking distracting websites. All data is
                  stored locally and never leaves your device.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {view === "main" && (
        <div className="p-3">
          <Button onClick={() => setView("add")} className="w-full">
            <IconPlus className="size-4" />
            Block a Website
          </Button>
        </div>
      )}
    </div>
  );
}
