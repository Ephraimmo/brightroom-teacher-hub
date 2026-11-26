import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Moon, Plus, Sun, Users } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { FormField } from "@/components/design/form-field";
import { PageHeader, SectionHeader } from "@/components/design/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/design/states";
import { StatusPill } from "@/components/design/status-pill";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/design-system")({
  head: () => ({
    meta: [
      { title: "Design system | LearnBridge" },
      {
        name: "description",
        content: "Colours, type, spacing and reusable components used across LearnBridge.",
      },
      // Internal reference page: keep it out of search results.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DesignSystemPage,
});

const colourGroups: { title: string; tokens: { name: string; use: string }[] }[] = [
  {
    title: "Surfaces and text",
    tokens: [
      { name: "background", use: "Page background" },
      { name: "foreground", use: "Main text" },
      { name: "card", use: "Panels and cards" },
      { name: "muted", use: "Quiet backgrounds" },
      { name: "muted-foreground", use: "Secondary text" },
      { name: "border", use: "Lines and outlines" },
    ],
  },
  {
    title: "Brand and actions",
    tokens: [
      { name: "primary", use: "Main buttons, links, focus" },
      { name: "secondary", use: "Secondary buttons" },
      { name: "accent", use: "Hover and highlight" },
      { name: "ring", use: "Keyboard focus ring" },
      { name: "sidebar", use: "Workspace sidebar" },
      { name: "sidebar-primary", use: "Brand mark, active item" },
    ],
  },
  {
    title: "Status",
    tokens: [
      { name: "success", use: "Done, active, paid" },
      { name: "warning", use: "Due soon, pending" },
      { name: "info", use: "Neutral information" },
      { name: "destructive", use: "Errors, delete, overdue" },
      { name: "success-soft", use: "Success background" },
      { name: "coral-soft", use: "Error background" },
    ],
  },
];

const typeScale = [
  {
    sample: "Page title",
    spec: "29px · bold · h1 (PageHeader)",
    className: "text-[29px] font-bold",
  },
  {
    sample: "Section title",
    spec: "16px · semibold · h2 (SectionHeader)",
    className: "text-base font-semibold",
  },
  { sample: "Card title", spec: "14px · semibold · h3", className: "text-sm font-semibold" },
  {
    sample: "Body text for paragraphs and table cells.",
    spec: "14px · regular (text-sm)",
    className: "text-sm",
  },
  {
    sample: "Supporting text and hints.",
    spec: "13px · muted",
    className: "text-[13px] text-muted-foreground",
  },
  {
    sample: "Smallest text: captions and labels.",
    spec: "12px · minimum size for new text (text-xs)",
    className: "text-xs",
  },
];

const spacingScale = [
  { token: "1", px: 4, use: "Icon to text" },
  { token: "2", px: 8, use: "Inside small controls; gap between buttons" },
  { token: "3", px: 12, use: "Between related fields" },
  { token: "4", px: 16, use: "Card padding; between form groups" },
  { token: "6", px: 24, use: "Between sections in a panel" },
  { token: "8", px: 32, use: "Between major page sections" },
];

const breakpoints = [
  { width: "Over 1100px", device: "Desktop", behaviour: "Sidebar, four metric cards per row" },
  {
    width: "881–1100px",
    device: "Small laptop / landscape tablet",
    behaviour: "Tighter spacing and smaller metric cards",
  },
  {
    width: "701–880px",
    device: "Portrait tablet",
    behaviour: "Narrow sidebar; two metric cards per row; panels stack",
  },
  {
    width: "700px and under",
    device: "Phone",
    behaviour: "Sidebar hidden; bottom navigation (max five tabs); secondary columns hidden",
  },
];

const sampleLearners = [
  { name: "Thandiwe Mokoena", grade: "Grade 8", status: "Active", tone: "success" as const },
  {
    name: "Liam van der Merwe",
    grade: "Grade 8",
    status: "Payment pending",
    tone: "warning" as const,
  },
  {
    name: "Ayesha Patel",
    grade: "Grade 9",
    status: "Suspended by parent",
    tone: "neutral" as const,
  },
  { name: "Sipho Dlamini", grade: "Grade 9", status: "Expired", tone: "danger" as const },
];

function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 space-y-4">
      <div>
        <h2 id={`${id}-title`} className="text-lg font-semibold text-foreground">
          {title}
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{intro}</p>
      </div>
      {children}
    </section>
  );
}

function Swatch({ name, use }: { name: string; use: string }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="h-14 border-b" style={{ background: `var(--${name})` }} />
      <div className="p-3">
        <p className="font-mono text-xs font-semibold text-foreground">--{name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{use}</p>
      </div>
    </div>
  );
}

type DemoState = "loading" | "empty" | "error" | "data";

function StatesDemo() {
  const [state, setState] = useState<DemoState>("loading");
  const options: { value: DemoState; label: string }[] = [
    { value: "loading", label: "Loading" },
    { value: "empty", label: "Empty" },
    { value: "error", label: "Error" },
    { value: "data", label: "With data" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          Every data panel shows exactly one of these states
        </CardTitle>
        <div
          className="flex flex-wrap gap-2 pt-2"
          role="group"
          aria-label="Choose a state to preview"
        >
          {options.map((o) => (
            <Button
              key={o.value}
              size="sm"
              variant={state === o.value ? "default" : "outline"}
              aria-pressed={state === o.value}
              onClick={() => setState(o.value)}
            >
              {o.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {state === "loading" ? <LoadingState label="Loading learners…" /> : null}
        {state === "empty" ? (
          <EmptyState
            icon={Users}
            title="No learners in this class yet"
            description="Add learners one at a time or import a spreadsheet."
            action={
              <Button size="sm">
                <Plus aria-hidden="true" /> Add learner
              </Button>
            }
          />
        ) : null}
        {state === "error" ? (
          <ErrorState
            title="Learners didn't load"
            description="Check your connection and try again."
            onRetry={() => setState("loading")}
          />
        ) : null}
        {state === "data" ? <LearnerTable /> : null}
      </CardContent>
    </Card>
  );
}

function LearnerTable() {
  return (
    <Table>
      <TableCaption>Sample content, not real learners.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Learner</TableHead>
          <TableHead>Grade</TableHead>
          <TableHead>Access</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sampleLearners.map((l) => (
          <TableRow key={l.name}>
            <TableCell className="font-medium">{l.name}</TableCell>
            <TableCell>{l.grade}</TableCell>
            <TableCell>
              <StatusPill tone={l.tone}>{l.status}</StatusPill>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function FormDemo() {
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saved, setSaved] = useState(false);
  const nameError = submitted && name.trim() === "" ? "Enter the learner's full name." : undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setSaved(name.trim() !== "");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          Register a learner (sample form, nothing is saved)
        </CardTitle>
        <CardDescription>
          Submit it empty to see how an error is shown and announced.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit} noValidate>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField id="ds-name" label="Full name" required error={nameError}>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
              autoComplete="off"
            />
          </FormField>
          <FormField id="ds-grade" label="Grade" hint="Grades follow the CAPS phases.">
            {(controlProps) => (
              <Select defaultValue="8">
                <SelectTrigger {...controlProps}>
                  <SelectValue placeholder="Choose a grade" />
                </SelectTrigger>
                <SelectContent>
                  {["R", "1", "4", "7", "8", "9", "10", "12"].map((g) => (
                    <SelectItem key={g} value={g}>
                      Grade {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField
            id="ds-notes"
            label="Notes for teachers"
            hint="Optional. Visible to this learner's teachers only."
          >
            <Textarea rows={3} />
          </FormField>
          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-medium">Attends lessons</legend>
            <RadioGroup defaultValue="hybrid" className="grid gap-2">
              {[
                { value: "physical", label: "In the classroom" },
                { value: "online", label: "Online" },
                { value: "hybrid", label: "Both (hybrid)" },
              ].map((o) => (
                <div key={o.value} className="flex items-center gap-2">
                  <RadioGroupItem id={`ds-mode-${o.value}`} value={o.value} />
                  <Label htmlFor={`ds-mode-${o.value}`} className="font-normal">
                    {o.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </fieldset>
          <div className="flex items-center gap-2">
            <Checkbox id="ds-consent" />
            <Label htmlFor="ds-consent" className="font-normal">
              Guardian consent received
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="ds-ai" />
            <Label htmlFor="ds-ai" className="font-normal">
              Allow AI tutor
            </Label>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center gap-3">
          <Button type="submit">Save learner</Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setName("");
              setSubmitted(false);
              setSaved(false);
            }}
          >
            Reset
          </Button>
          {saved ? (
            <p className="form-message form-message--success" role="status">
              Looks good. In a real form this would now be saved.
            </p>
          ) : null}
        </CardFooter>
      </form>
    </Card>
  );
}

function DesignSystemPage() {
  const [dark, setDark] = useState(false);

  // Dark mode is applied to <html> so dialogs (rendered outside this page) follow it too.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    return () => root.classList.remove("dark");
  }, [dark]);

  const nav = [
    ["colours", "Colours"],
    ["type", "Typography"],
    ["spacing", "Spacing"],
    ["buttons", "Buttons"],
    ["forms", "Forms"],
    ["status", "Status"],
    ["cards", "Cards"],
    ["tables", "Tables and states"],
    ["dialogs", "Dialogs"],
    ["responsive", "Responsive"],
  ] as const;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-6xl space-y-12 px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="FOR DESIGNERS AND DEVELOPERS"
          title="LearnBridge design system"
          description="The colours, type, spacing and building blocks every LearnBridge screen uses. Full rules are in docs/design-system.md."
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDark((d) => !d)}
                aria-pressed={dark}
              >
                {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
                {dark ? "Light mode" : "Dark mode"}
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/">
                  <ArrowLeft aria-hidden="true" /> Back to app
                </Link>
              </Button>
            </>
          }
        />

        <nav aria-label="Design system sections" className="flex flex-wrap gap-2">
          {nav.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {label}
            </a>
          ))}
        </nav>

        <Section
          id="colours"
          title="Colours"
          intro="Always use a token (bg-primary, text-muted-foreground, var(--success)), never a raw colour. Every token has a light and a dark value, so screens work in both modes."
        >
          {colourGroups.map((group) => (
            <div key={group.title} className="space-y-2">
              <h3 className="text-sm font-semibold">{group.title}</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {group.tokens.map((t) => (
                  <Swatch key={t.name} {...t} />
                ))}
              </div>
            </div>
          ))}
        </Section>

        <Section
          id="type"
          title="Typography"
          intro="One typeface, DM Sans. Use the sizes below; new text is never smaller than 12px so it stays readable on phones and for younger learners."
        >
          <Card>
            <CardContent className="divide-y p-0">
              {typeScale.map((t) => (
                <div
                  key={t.spec}
                  className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-baseline sm:justify-between"
                >
                  <span className={t.className}>{t.sample}</span>
                  <span className="font-mono text-xs text-muted-foreground">{t.spec}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </Section>

        <Section
          id="spacing"
          title="Spacing and corners"
          intro="Spacing uses Tailwind's 4px steps. Corners use the radius tokens: rounded-md (6px) for controls, rounded-lg (8px) for cards and panels."
        >
          <Card>
            <CardContent className="space-y-3 pt-6">
              {spacingScale.map((s) => (
                <div key={s.token} className="flex items-center gap-4">
                  <span className="w-16 font-mono text-xs text-muted-foreground">
                    {s.token} · {s.px}px
                  </span>
                  <span
                    className="h-3 rounded-sm bg-primary"
                    style={{ width: s.px * 3 }}
                    aria-hidden="true"
                  />
                  <span className="text-sm text-muted-foreground">{s.use}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </Section>

        <Section
          id="buttons"
          title="Buttons"
          intro="One primary button per area, for the main action. Destructive buttons are for delete or remove, and always ask for confirmation. Icon-only buttons need an aria-label."
        >
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-wrap items-center gap-3">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
                <Button variant="destructive">Delete</Button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">Small</Button>
                <Button>Default</Button>
                <Button size="lg">Large</Button>
                <Button size="icon" aria-label="Add learner">
                  <Plus aria-hidden="true" />
                </Button>
                <Button disabled>Disabled</Button>
                <Button>
                  <Plus aria-hidden="true" /> With icon
                </Button>
              </div>
            </CardContent>
          </Card>
        </Section>

        <Section
          id="forms"
          title="Forms"
          intro="Wrap every control in FormField. It links the label, hint and error for screen readers, marks required fields, and puts the error message right under the field."
        >
          <FormDemo />
        </Section>

        <Section
          id="status"
          title="Status labels"
          intro="StatusPill shows the state of a record. The words carry the meaning and the colour backs it up, so colour-blind users lose nothing. Badge is for counts and tags."
        >
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 pt-6">
              <StatusPill tone="success">Active</StatusPill>
              <StatusPill tone="warning">Payment pending</StatusPill>
              <StatusPill tone="info">Scheduled</StatusPill>
              <StatusPill tone="danger">Overdue</StatusPill>
              <StatusPill>Draft</StatusPill>
              <span className="mx-2 h-5 w-px bg-border" aria-hidden="true" />
              <Badge>3 new</Badge>
              <Badge variant="secondary">Grade 8</Badge>
              <Badge variant="outline">Mathematics</Badge>
            </CardContent>
          </Card>
        </Section>

        <Section
          id="cards"
          title="Cards and headings"
          intro="Cards group related content. Inside a page, use SectionHeader for each panel's title so headings stay in order (h1 page, h2 section, h3 card)."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="pt-6">
                <SectionHeader
                  eyebrow="TODAY"
                  title="Next lesson"
                  action={
                    <Button variant="ghost" size="sm">
                      Full week
                    </Button>
                  }
                />
                <p className="text-sm">Grade 8 Mathematics · 09:00 · Room 4 and online</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  24 learners expected, 6 joining online.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Card with header and footer</CardTitle>
                <CardDescription>Use for forms and summaries that need an action.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm">Content goes here.</CardContent>
              <CardFooter className="gap-2">
                <Button size="sm">Save</Button>
                <Button size="sm" variant="ghost">
                  Cancel
                </Button>
              </CardFooter>
            </Card>
          </div>
        </Section>

        <Section
          id="tables"
          title="Tables and data states"
          intro="Lists use the Table component. While loading, when empty, and when something fails, show LoadingState, EmptyState or ErrorState instead of a blank area. Try each one below."
        >
          <StatesDemo />
        </Section>

        <Section
          id="dialogs"
          title="Dialogs"
          intro="Dialog is for short tasks that don't need a page. AlertDialog asks for confirmation before something serious or hard to undo, and its buttons say exactly what will happen."
        >
          <Card>
            <CardContent className="flex flex-wrap gap-3 pt-6">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Open a dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Rename class</DialogTitle>
                    <DialogDescription>
                      Learners and parents will see the new name.
                    </DialogDescription>
                  </DialogHeader>
                  <FormField id="ds-class-name" label="Class name">
                    <Input defaultValue="Grade 8A" />
                  </FormField>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="ghost">Cancel</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button>Save name</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">Suspend learner…</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Suspend Thandiwe Mokoena's access?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This learner won't be able to join lessons or open new work until you
                      reactivate their access. Their records and results are kept.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep access</AlertDialogCancel>
                    <AlertDialogAction>Suspend access</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </Section>

        <Section
          id="responsive"
          title="Responsive rules"
          intro="Design for a phone first: many families use a phone on mobile data. Touch targets are at least 36px high (buttons are 36px by default). Resize this window to see the cards above rearrange."
        >
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Screen width</TableHead>
                    <TableHead>Typical device</TableHead>
                    <TableHead>What changes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakpoints.map((b) => (
                    <TableRow key={b.width}>
                      <TableCell className="whitespace-nowrap font-medium">{b.width}</TableCell>
                      <TableCell>{b.device}</TableCell>
                      <TableCell>{b.behaviour}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Section>
      </main>
    </div>
  );
}
