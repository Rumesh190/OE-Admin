"use client";

import * as React from "react";
import {
  Bell,
  CheckCircle2,
  Eye,
  EyeOff,
  ImagePlus,
  LockKeyhole,
  Palette,
  Trash2,
  UserRound,
} from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { useAuth } from "@/components/auth/auth-provider";
import { useUiPreferences } from "@/components/preferences/ui-preferences-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldMessage } from "@/components/ui/field-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminUsers } from "@/features/five-s/administration/store";
import { LANGUAGE_OPTIONS } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/current-user";
import { useModuleEntitlements } from "@/lib/module-entitlements";
import {
  savePersonalNotifications,
  savePersonalPreferences,
  savePersonalProfile,
  usePersonalSettings,
  validateProfilePhoto,
  type PersonalNotificationPreferences,
  type PersonalProfile,
  type ProfileLandingPage,
} from "@/lib/profile-settings";
import { setThemePreference, useThemePreference, type ThemePreference } from "@/lib/theme-preference";

type ProfileTab = "profile" | "security" | "preferences" | "notifications";

const TAB_ITEMS: Array<{ id: ProfileTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "security", label: "Security", icon: LockKeyhole },
  { id: "preferences", label: "Preferences", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
];

function useUnsavedChanges(unsaved: boolean) {
  React.useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);
}

function same(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function ProfileSettingsPage({ initialTab = "profile" }: { initialTab?: ProfileTab }) {
  const [activeTab, setActiveTab] = React.useState<ProfileTab>(initialTab);
  const currentUser = useCurrentUser();
  const users = useAdminUsers(true);
  const adminUser = users.find((user) => user.id === currentUser.id);
  const personal = usePersonalSettings(currentUser.id);

  return (
    <PageContainer title="Profile Settings" description="Manage your profile, security, and personal preferences." className="max-w-6xl">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ProfileTab)}>
        <div className="overflow-x-auto border-b">
          <TabsList variant="line" className="h-11 min-w-max justify-start gap-2">
            {TAB_ITEMS.map((item) => {
              const Icon = item.icon;
              return <TabsTrigger key={item.id} value={item.id} className="min-w-28 px-3"><Icon className="size-4" />{item.label}</TabsTrigger>;
            })}
          </TabsList>
        </div>

        <TabsContent value="profile"><ProfilePanel key={currentUser.id} currentUser={currentUser} adminUser={adminUser} stored={personal.profile} /></TabsContent>
        <TabsContent value="security"><SecurityPanel /></TabsContent>
        <TabsContent value="preferences"><PreferencesPanel key={currentUser.id} userId={currentUser.id} defaultLandingPage={personal.preferences.defaultLandingPage} /></TabsContent>
        <TabsContent value="notifications"><NotificationsPanel key={currentUser.id} userId={currentUser.id} stored={personal.notifications} /></TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function ProfilePanel({ currentUser, adminUser, stored }: {
  currentUser: ReturnType<typeof useCurrentUser>;
  adminUser: ReturnType<typeof useAdminUsers>[number] | undefined;
  stored: PersonalProfile;
}) {
  const initial = React.useMemo<PersonalProfile>(() => ({
    fullName: stored.fullName || currentUser.name,
    phone: stored.phone,
    jobTitle: stored.jobTitle,
    photo: stored.photo,
  }), [currentUser.name, stored]);
  const [draft, setDraft] = React.useState(initial);
  const [feedback, setFeedback] = React.useState<{ tone: "success" | "error"; message: string } | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const dirty = !same(draft, initial);
  useUnsavedChanges(dirty);

  function choosePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const error = validateProfilePhoto(file);
    if (error) return setFeedback({ tone: "error", message: error });
    const reader = new FileReader();
    reader.onerror = () => setFeedback({ tone: "error", message: "Unable to read that photo. Try another file." });
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setDraft((current) => ({ ...current, photo: reader.result as string }));
      setFeedback(null);
    };
    reader.readAsDataURL(file);
  }

  function save() {
    setFeedback(null);
    if (!draft.fullName.trim()) return setFeedback({ tone: "error", message: "Full Name is required." });
    const result = savePersonalProfile(currentUser.id, draft);
    setFeedback(result.success
      ? { tone: "success", message: "Profile updated." }
      : { tone: "error", message: result.message });
  }

  const zone = currentUser.primaryZone || "Not assigned";
  const role = currentUser.role;
  return <div className="grid gap-6 pt-3 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.62fr)]">
    <section aria-labelledby="profile-information-heading" className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:p-5">
        <Avatar className="size-20 text-xl after:border-border" aria-label={`${draft.fullName || currentUser.name} profile photo`}>
          {draft.photo && <AvatarImage src={draft.photo} alt="" />}
          <AvatarFallback className="text-lg font-semibold">{currentUser.initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 id="profile-information-heading" className="truncate text-lg font-semibold">{draft.fullName || currentUser.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{role}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{currentUser.plant} · {zone}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={choosePhoto} aria-label="Upload profile photo" />
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}><ImagePlus className="size-4" />Change Photo</Button>
          {draft.photo && <Button type="button" variant="ghost" onClick={() => { setDraft((current) => ({ ...current, photo: undefined })); setFeedback(null); }}><Trash2 className="size-4" />Remove</Button>}
        </div>
      </div>

      <form className="grid gap-5 p-4 sm:grid-cols-2 sm:p-5" onSubmit={(event) => { event.preventDefault(); save(); }}>
        <Field id="profile-name" label="Full Name"><Input id="profile-name" value={draft.fullName} onChange={(event) => setDraft({ ...draft, fullName: event.target.value })} autoComplete="name" aria-invalid={!draft.fullName.trim()} /></Field>
        <Field id="profile-email" label="Email" help="Email is your organization-managed sign-in identity."><Input id="profile-email" value={adminUser?.email ?? "Not available"} readOnly aria-readonly="true" autoComplete="email" /></Field>
        <Field id="profile-phone" label="Phone"><Input id="profile-phone" type="tel" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} autoComplete="tel" placeholder="Add phone number" /></Field>
        <Field id="profile-title" label="Job Title"><Input id="profile-title" value={draft.jobTitle} onChange={(event) => setDraft({ ...draft, jobTitle: event.target.value })} autoComplete="organization-title" placeholder="Add job title" /></Field>
        <div className="flex flex-col gap-3 border-t pt-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
          <Feedback value={feedback} />
          <Button type="submit" disabled={!dirty}>Save Changes</Button>
        </div>
      </form>
    </section>

    <section aria-labelledby="organization-information-heading" className="self-start rounded-xl border bg-card">
      <div className="border-b p-4 sm:p-5"><h2 id="organization-information-heading" className="font-semibold">Organization information</h2><p className="mt-1 text-xs text-muted-foreground">Managed by your organization administrator.</p></div>
      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-1 xl:grid-cols-2">
        <ReadOnlyField label="Role" value={role} />
        <ReadOnlyField label="Responsibilities" value={currentUser.responsibilities.join(", ") || role} />
        <ReadOnlyField label="Plant" value={currentUser.plant} />
        <ReadOnlyField label="Zone" value={zone} />
        <ReadOnlyField label="Account Status" value={adminUser?.status ?? "Active"} status />
        {adminUser?.employeeId && <ReadOnlyField label="Employee ID" value={adminUser.employeeId} />}
      </div>
    </section>
  </div>;
}

function SecurityPanel() {
  const { changePassword } = useAuth();
  const [values, setValues] = React.useState({ current: "", next: "", confirm: "" });
  const [visible, setVisible] = React.useState({ current: false, next: false, confirm: false });
  const [feedback, setFeedback] = React.useState<{ tone: "success" | "error"; message: string } | null>(null);
  const dirty = Boolean(values.current || values.next || values.confirm);
  useUnsavedChanges(dirty);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);
    if (!values.current) return setFeedback({ tone: "error", message: "Enter your current password." });
    if (values.next.length < 8) return setFeedback({ tone: "error", message: "New password must be at least 8 characters." });
    if (values.next !== values.confirm) return setFeedback({ tone: "error", message: "New passwords do not match." });
    const result = await changePassword(values.current, values.next);
    if (!result.success) return setFeedback({ tone: "error", message: result.message ?? "Unable to update password." });
    setValues({ current: "", next: "", confirm: "" });
    setFeedback({ tone: "success", message: "Password updated for this demo account." });
  }

  return <section aria-labelledby="change-password-heading" className="mt-3 max-w-2xl rounded-xl border bg-card">
    <div className="border-b p-4 sm:p-5"><h2 id="change-password-heading" className="font-semibold">Change Password</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">This OPS environment uses local demo authentication. The updated password is stored only in this browser.</p></div>
    <form className="grid gap-5 p-4 sm:p-5" onSubmit={save}>
      <PasswordField id="current-password" label="Current Password" value={values.current} visible={visible.current} autoComplete="current-password" onChange={(current) => setValues({ ...values, current })} onToggle={() => setVisible({ ...visible, current: !visible.current })} />
      <PasswordField id="new-password" label="New Password" value={values.next} visible={visible.next} autoComplete="new-password" onChange={(next) => setValues({ ...values, next })} onToggle={() => setVisible({ ...visible, next: !visible.next })} />
      <PasswordField id="confirm-password" label="Confirm New Password" value={values.confirm} visible={visible.confirm} autoComplete="new-password" onChange={(confirm) => setValues({ ...values, confirm })} onToggle={() => setVisible({ ...visible, confirm: !visible.confirm })} />
      <p className="text-xs text-muted-foreground">Use at least 8 characters. Both new-password fields must match.</p>
      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"><Feedback value={feedback} /><Button type="submit" disabled={!dirty}>Update Password</Button></div>
    </form>
  </section>;
}

function PreferencesPanel({ userId, defaultLandingPage }: { userId: string; defaultLandingPage: ProfileLandingPage }) {
  const { language, setLanguage } = useUiPreferences();
  const currentTheme = useThemePreference();
  const access = useModuleEntitlements();
  const initial = React.useMemo(() => ({ language, theme: currentTheme, landing: defaultLandingPage }), [language, currentTheme, defaultLandingPage]);
  const [draft, setDraft] = React.useState(initial);
  const [feedback, setFeedback] = React.useState<{ tone: "success" | "error"; message: string } | null>(null);
  const dirty = !same(draft, initial);
  useUnsavedChanges(dirty);
  const landingOptions = [
    { value: "/dashboard" as const, label: "Dashboard", enabled: true },
    { value: "/actions" as const, label: "My Actions", enabled: access.actions },
    { value: "/gemba" as const, label: "Gemba", enabled: access.gemba },
    { value: "/visual-management" as const, label: "Visual Management", enabled: access.visualManagement },
  ].filter((item) => item.enabled);

  function save() {
    setFeedback(null);
    const preferenceResult = savePersonalPreferences(userId, { defaultLandingPage: draft.landing });
    if (!preferenceResult.success) return setFeedback({ tone: "error", message: preferenceResult.message });
    const themeResult = setThemePreference(draft.theme);
    if (!themeResult.success) return setFeedback({ tone: "error", message: themeResult.message });
    setLanguage(draft.language);
    setFeedback({ tone: "success", message: "Preferences saved." });
  }

  return <section aria-labelledby="personal-preferences-heading" className="mt-3 max-w-3xl rounded-xl border bg-card">
    <div className="border-b p-4 sm:p-5"><h2 id="personal-preferences-heading" className="font-semibold">Personal preferences</h2><p className="mt-1 text-xs text-muted-foreground">These settings affect only your OPS experience on this device.</p></div>
    <div className="grid gap-5 p-4 sm:grid-cols-2 sm:p-5">
      <SelectField label="Language" value={draft.language} onChange={(value) => setDraft({ ...draft, language: value as typeof language })} options={LANGUAGE_OPTIONS.map((item) => ({ value: item.code, label: item.name }))} />
      <SelectField label="Theme" value={draft.theme} onChange={(value) => setDraft({ ...draft, theme: value as ThemePreference })} options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
      <div className="sm:col-span-2"><SelectField label="Default Landing Page" value={draft.landing} onChange={(value) => setDraft({ ...draft, landing: value as ProfileLandingPage })} options={landingOptions} help="Only destinations enabled for your organization are available." /></div>
      <div className="flex flex-col gap-3 border-t pt-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between"><Feedback value={feedback} /><Button type="button" onClick={save} disabled={!dirty}>Save Changes</Button></div>
    </div>
  </section>;
}

const NOTIFICATION_OPTIONS: Array<{ key: keyof PersonalNotificationPreferences; label: string; description: string }> = [
  { key: "actionReminders", label: "Action reminders", description: "Upcoming and overdue Action due dates." },
  { key: "actionEscalations", label: "Action escalation notifications", description: "Escalations affecting Actions you own or review." },
  { key: "reviewNotifications", label: "Review notifications", description: "Work submitted for your review and review decisions." },
  { key: "auditNotifications", label: "Audit notifications", description: "Audit assignments, reminders, and completions." },
  { key: "gembaNotifications", label: "Gemba notifications", description: "Walk invitations, observations, and follow-ups." },
  { key: "continuousImprovementNotifications", label: "Continual Improvement notifications", description: "Proposal, implementation, and benefit-review updates." },
  { key: "visualManagementNotifications", label: "Visual Management meeting notifications", description: "Meeting reminders and escalated meeting topics." },
  { key: "systemAnnouncements", label: "System announcements", description: "Important OPS availability and product notices." },
];

function NotificationsPanel({ userId, stored }: { userId: string; stored: PersonalNotificationPreferences }) {
  const [draft, setDraft] = React.useState(stored);
  const [feedback, setFeedback] = React.useState<{ tone: "success" | "error"; message: string } | null>(null);
  const dirty = !same(draft, stored);
  useUnsavedChanges(dirty);
  function save() {
    const result = savePersonalNotifications(userId, draft);
    setFeedback(result.success
      ? { tone: "success", message: "Notification preferences updated." }
      : { tone: "error", message: result.message });
  }

  return <section aria-labelledby="personal-notifications-heading" className="mt-3 max-w-3xl rounded-xl border bg-card">
    <div className="border-b p-4 sm:p-5"><h2 id="personal-notifications-heading" className="font-semibold">Personal notifications</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Choose what you want to receive. Organization notification rules remain under Settings.</p></div>
    <div className="divide-y">
      {NOTIFICATION_OPTIONS.map((item) => <div key={item.key} className="flex items-center gap-4 px-4 py-3.5 sm:px-5"><div className="min-w-0 flex-1"><Label htmlFor={`notification-${item.key}`} className="font-medium">{item.label}</Label><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.description}</p></div><Switch id={`notification-${item.key}`} checked={draft[item.key]} onCheckedChange={(checked) => setDraft({ ...draft, [item.key]: checked })} aria-label={item.label} /></div>)}
    </div>
    <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><Feedback value={feedback} /><Button type="button" onClick={save} disabled={!dirty}>Save Changes</Button></div>
  </section>;
}

function Field({ id, label, help, children }: { id: string; label: string; help?: string; children: React.ReactNode }) {
  return <div className="grid content-start gap-2"><Label htmlFor={id}>{label}</Label>{children}<FieldMessage>{help}</FieldMessage></div>;
}

function ReadOnlyField({ label, value, status }: { label: string; value: string; status?: boolean }) {
  return <div><p className="text-xs font-medium text-muted-foreground">{label}</p>{status ? <Badge variant="success" className="mt-2">{value}</Badge> : <p className="mt-1.5 break-words text-sm font-medium">{value}</p>}</div>;
}

function PasswordField({ id, label, value, visible, autoComplete, onChange, onToggle }: { id: string; label: string; value: string; visible: boolean; autoComplete: string; onChange: (value: string) => void; onToggle: () => void }) {
  return <div className="grid gap-2"><Label htmlFor={id}>{label}</Label><div className="relative"><Input id={id} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} className="pr-11" /><button type="button" onClick={onToggle} className="absolute right-0 top-0 grid size-9 place-items-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}>{visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></div>;
}

function SelectField({ label, value, options, help, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; help?: string; onChange: (value: string) => void }) {
  const id = `profile-${label.toLowerCase().replaceAll(" ", "-")}`;
  return <div className="grid gap-2"><Label htmlFor={id}>{label}</Label><Select searchLabel={label} value={value} onValueChange={(next) => { if (next) onChange(next); }}><SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger><SelectContent>{options.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select><FieldMessage>{help}</FieldMessage></div>;
}

function Feedback({ value }: { value: { tone: "success" | "error"; message: string } | null }) {
  if (!value) return <span />;
  return <p role={value.tone === "error" ? "alert" : "status"} className={value.tone === "error" ? "text-sm font-medium text-destructive" : "flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400"}>{value.tone === "success" && <CheckCircle2 className="size-4" />}{value.message}</p>;
}
