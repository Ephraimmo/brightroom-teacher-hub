import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  FileText,
  Search,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  teacherSampleAssignments,
  teacherSampleAttendance,
  teacherSampleClasses,
  teacherSampleLessons,
  teacherSampleResources,
} from "@/domain/teacher-sample-data";
import { TeacherWorkspace, type WorkspaceSection } from "@/components/teacher/teacher-workspace";

const statCards = [
  { label: "Learners across classes", value: "113", detail: "+6 this week", icon: Users, tone: "green" },
  { label: "Average attendance", value: "94%", detail: "+2.4 pts this term", icon: CheckCircle2, tone: "blue" },
  { label: "Submissions to mark", value: "12", detail: "Across 3 assignments", icon: ClipboardCheck, tone: "amber" },
  { label: "Lessons today", value: "4", detail: "Next starts at 09:30", icon: CalendarClock, tone: "coral" },
] as const;

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

function SearchField({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return (
    <label className="search-field">
      <Search aria-hidden="true" />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={label}
        aria-label={label}
      />
    </label>
  );
}

function StatCard({ label, value, detail, icon: Icon, tone }: (typeof statCards)[number]) {
  return (
    <article className="metric-card">
      <div className={`metric-icon metric-icon--${tone}`}><Icon aria-hidden="true" /></div>
      <p className="metric-label">{label}</p>
      <div className="metric-value-row"><strong>{value}</strong><span>{detail}</span></div>
    </article>
  );
}

function LessonRows({ query = "", day }: { query?: string; day?: string }) {
  const lessons = teacherSampleLessons.filter((lesson) => {
    const matchesQuery = `${lesson.grade} ${lesson.subject} ${lesson.topic} ${lesson.room}`
      .toLowerCase()
      .includes(query.toLowerCase());
    return matchesQuery && (!day || lesson.day === day);
  });

  if (lessons.length === 0) {
    return <p className="empty-state">No lessons match this search.</p>;
  }

  return (
    <div className="lesson-list">
      {lessons.map((lesson) => (
        <article className="lesson-row" key={lesson.id}>
          <div className="lesson-time"><strong>{lesson.time}</strong><span>{lesson.endTime}</span></div>
          <div className="lesson-marker" aria-hidden="true" />
          <div className="lesson-details">
            <div className="lesson-title-row"><strong>{lesson.subject}</strong><span className={`lesson-state${lesson.status === "completed" ? " is-complete" : ""}`}>{lesson.status === "completed" ? "Completed" : lesson.day}</span></div>
            <p>{lesson.grade} <span aria-hidden="true">·</span> {lesson.topic}</p>
            <span className="lesson-room">{lesson.room}</span>
          </div>
          <Clock3 className="lesson-clock" aria-hidden="true" />
        </article>
      ))}
    </div>
  );
}

function AssignmentRows({ query = "", filter = "all" }: { query?: string; filter?: "all" | "marking" | "due" }) {
  const assignments = teacherSampleAssignments.filter((assignment) => {
    const matchesQuery = `${assignment.title} ${assignment.grade}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all" || (filter === "marking" && assignment.state === "Needs marking") || (filter === "due" && assignment.due !== "Due Friday");
    return matchesQuery && matchesFilter;
  });

  if (assignments.length === 0) return <p className="empty-state">No assignments match this view.</p>;

  return (
    <div className="assignment-list">
      {assignments.map((assignment) => {
        const completion = Math.round((assignment.submitted / assignment.total) * 100);
        return (
          <article className="assignment-row" key={assignment.id}>
            <div className="assignment-icon"><FileText aria-hidden="true" /></div>
            <div className="assignment-main">
              <div className="assignment-title-row"><strong>{assignment.title}</strong><span className={assignment.due === "Due today" ? "status-pill status-pill--warning" : "status-pill"}>{assignment.due}</span></div>
              <p>{assignment.grade}</p>
              <div className="assignment-progress"><Progress value={completion} aria-label={`${completion}% submitted`} /><span>{assignment.submitted} of {assignment.total} submitted</span></div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function AttendanceChart() {
  return (
    <div className="attendance-chart" role="img" aria-label="Weekly attendance sample: Monday 94%, Tuesday 88%, Wednesday 96%, Thursday 91%, Friday 97%">
      {teacherSampleAttendance.map((item) => (
        <div className="attendance-day" key={item.day}>
          <div className="attendance-track"><span className="attendance-bar" style={{ height: `${item.value}%` }} /></div>
          <span className="attendance-value">{item.value}%</span>
          <span className="attendance-day-label">{item.day}</span>
        </div>
      ))}
    </div>
  );
}

export function TeacherOverview() {
  const [search, setSearch] = useState("");
  return (
    <TeacherWorkspace
      active="overview"
      title="Your teaching day"
      description="A clear view of classes, learner progress, and work that needs your attention."
      actions={<Button variant="outline" asChild><Link to="/timetable">Open timetable <ArrowRight aria-hidden="true" /></Link></Button>}
    >
      <section className="metrics-grid" aria-label="Teaching summary">
        {statCards.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </section>

      <div className="overview-grid">
        <section className="workspace-panel">
          <div className="section-heading">
            <div><p className="section-eyebrow">MONDAY · 23 NOVEMBER</p><h2>Today’s lessons</h2></div>
            <Button variant="ghost" size="sm" asChild><Link to="/timetable">Full week <ArrowRight aria-hidden="true" /></Link></Button>
          </div>
          <SearchField value={search} onChange={setSearch} label="Search lessons" />
          <LessonRows query={search} day="Mon" />
        </section>

        <section className="workspace-panel attention-panel">
          <div className="section-heading">
            <div><p className="section-eyebrow">STUDENT WORK</p><h2>Needs your attention</h2></div>
            <span className="count-badge">12</span>
          </div>
          <p className="panel-intro">A few quick reviews will keep your classes moving.</p>
          <AssignmentRows filter="marking" />
          <Button variant="outline" className="panel-footer-action" asChild><Link to="/homework">Review homework <ArrowRight aria-hidden="true" /></Link></Button>
        </section>

        <section className="workspace-panel attendance-panel">
          <div className="section-heading">
            <div><p className="section-eyebrow">THIS WEEK</p><h2>Class attendance</h2></div>
            <span className="trend-label"><ArrowUpRight aria-hidden="true" /> 2.4%</span>
          </div>
          <div className="attendance-summary"><strong>94%</strong><span>average across your classes</span></div>
          <AttendanceChart />
        </section>

        <section className="workspace-panel classes-panel">
          <div className="section-heading">
            <div><p className="section-eyebrow">YOUR GROUPS</p><h2>Class overview</h2></div>
            <Button variant="ghost" size="sm" asChild><Link to="/classes">All classes <ArrowRight aria-hidden="true" /></Link></Button>
          </div>
          <div className="compact-class-list">
            {teacherSampleClasses.slice(0, 3).map((group) => (
              <div className="compact-class-row" key={group.id}>
                <span className={`subject-mark subject-mark--${group.accent}`}><BookOpen aria-hidden="true" /></span>
                <span className="compact-class-copy"><strong>{group.grade} · {group.subject}</strong><small>{group.learners} learners · {group.room}</small></span>
                <span className="compact-attendance">{group.attendance}%</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </TeacherWorkspace>
  );
}

export function TeacherClassesPage() {
  const [search, setSearch] = useState("");
  const visibleClasses = useMemo(
    () => teacherSampleClasses.filter((group) => `${group.grade} ${group.subject} ${group.room}`.toLowerCase().includes(search.toLowerCase())),
    [search],
  );

  return (
    <TeacherWorkspace
      active="classes"
      title="My classes"
      description="Your groups, subjects, and learner attendance at a glance."
      actions={<Button variant="outline" asChild><Link to="/timetable">View timetable <CalendarClock aria-hidden="true" /></Link></Button>}
    >
      <section className="workspace-panel full-panel">
        <div className="section-heading">
          <div><p className="section-eyebrow">4 ACTIVE GROUPS</p><h2>Teaching groups</h2></div>
          <span className="subtle-count">113 learners</span>
        </div>
        <SearchField value={search} onChange={setSearch} label="Search classes or subjects" />
        <div className="class-table" role="table" aria-label="Teaching groups">
          <div className="class-table-heading" role="row"><span role="columnheader">Class</span><span role="columnheader">Learners</span><span role="columnheader">Attendance</span><span role="columnheader">Room</span></div>
          {visibleClasses.map((group) => (
            <div className="class-table-row" role="row" key={group.id}>
              <span className="class-table-name" role="cell"><span className={`subject-mark subject-mark--${group.accent}`}><BookOpen aria-hidden="true" /></span><span><strong>{group.grade}</strong><small>{group.subject}</small></span></span>
              <span className="class-table-learners" role="cell">{group.learners}</span>
              <span className="class-table-attendance" role="cell"><span>{group.attendance}%</span><Progress value={group.attendance} aria-label={`${group.attendance}% attendance`} /></span>
              <span className="class-table-room" role="cell">{group.room}</span>
            </div>
          ))}
          {visibleClasses.length === 0 ? <p className="empty-state">No classes match this search.</p> : null}
        </div>
      </section>
    </TeacherWorkspace>
  );
}

export function TeacherTimetablePage() {
  const [view, setView] = useState<"week" | "day">("week");
  const [selectedDay, setSelectedDay] = useState<(typeof weekdays)[number]>("Mon");

  return (
    <TeacherWorkspace active="timetable" title="Timetable" description="Plan your teaching week and see each lesson’s time and location.">
      <section className="workspace-panel full-panel">
        <div className="section-heading timetable-controls">
          <div><p className="section-eyebrow">TERM 4 · SAMPLE WEEK</p><h2>23–27 November 2026</h2></div>
          <div className="segmented-control" role="group" aria-label="Timetable view">
            <Button variant={view === "week" ? "secondary" : "ghost"} size="sm" type="button" aria-pressed={view === "week"} onClick={() => setView("week")}>Week</Button>
            <Button variant={view === "day" ? "secondary" : "ghost"} size="sm" type="button" aria-pressed={view === "day"} onClick={() => setView("day")}>Day</Button>
          </div>
        </div>
        {view === "day" ? (
          <div className="day-picker" role="group" aria-label="Choose a day">
            {weekdays.map((day) => <Button key={day} variant={selectedDay === day ? "default" : "outline"} size="sm" type="button" aria-pressed={selectedDay === day} onClick={() => setSelectedDay(day)}>{day}</Button>)}
          </div>
        ) : null}
        <LessonRows day={view === "day" ? selectedDay : undefined} />
      </section>
    </TeacherWorkspace>
  );
}

export function TeacherResourcesPage() {
  const [search, setSearch] = useState("");
  const resources = teacherSampleResources.filter((resource) => `${resource.title} ${resource.grade} ${resource.kind}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <TeacherWorkspace active="resources" title="Learning resources" description="A sample library of notes and revision material organized by class.">
      <section className="workspace-panel full-panel">
        <div className="section-heading">
          <div><p className="section-eyebrow">4 SAMPLE ITEMS</p><h2>Recently updated</h2></div>
          <span className="subtle-count">Shared with your classes</span>
        </div>
        <SearchField value={search} onChange={setSearch} label="Search learning resources" />
        <div className="resource-list">
          {resources.map((resource) => (
            <article className="resource-row" key={resource.id}>
              <span className="resource-icon"><FileText aria-hidden="true" /></span>
              <div className="resource-copy"><strong>{resource.title}</strong><span>{resource.grade}</span></div>
              <span className="resource-kind">{resource.kind}</span>
              <span className="resource-updated">{resource.updated}</span>
            </article>
          ))}
          {resources.length === 0 ? <p className="empty-state">No resources match this search.</p> : null}
        </div>
        <p className="resource-note">Files are not connected in this sample workspace.</p>
      </section>
    </TeacherWorkspace>
  );
}

export function TeacherHomeworkPage() {
  const [filter, setFilter] = useState<"all" | "marking" | "due">("all");
  const [search, setSearch] = useState("");
  const filterOptions = [
    { id: "all", label: "All work" },
    { id: "marking", label: "Needs marking" },
    { id: "due", label: "Due soon" },
  ] as const;

  return (
    <TeacherWorkspace active="homework" title="Homework & tests" description="Keep track of upcoming work and submissions from your classes.">
      <section className="workspace-panel full-panel">
        <div className="section-heading">
          <div><p className="section-eyebrow">12 SUBMISSIONS NEED REVIEW</p><h2>Assignment tracker</h2></div>
          <span className="subtle-count">3 sample assignments</span>
        </div>
        <div className="homework-tools">
          <div className="segmented-control" role="group" aria-label="Filter assignments">
            {filterOptions.map((option) => <Button key={option.id} variant={filter === option.id ? "secondary" : "ghost"} size="sm" type="button" aria-pressed={filter === option.id} onClick={() => setFilter(option.id)}>{option.label}</Button>)}
          </div>
          <SearchField value={search} onChange={setSearch} label="Search assignments" />
        </div>
        <AssignmentRows filter={filter} query={search} />
        <div className="homework-summary"><ArrowDownRight aria-hidden="true" /><span>Late work and returned assignments will appear here when learner records are connected.</span></div>
      </section>
    </TeacherWorkspace>
  );
}