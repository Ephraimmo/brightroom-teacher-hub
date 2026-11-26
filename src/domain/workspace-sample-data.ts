export type WorkspaceRole = "school" | "learner" | "parent" | "platform";
export type MetricTone = "green" | "blue" | "amber" | "coral";

export interface WorkspaceMetric {
  label: string;
  value: string;
  detail: string;
  tone: MetricTone;
}

export interface WorkspaceRow {
  id: string;
  title: string;
  detail: string;
  status: string;
  metadata: string;
}

export interface WorkspacePageData {
  eyebrow: string;
  title: string;
  description: string;
  metrics: WorkspaceMetric[];
  rows: WorkspaceRow[];
  searchLabel: string;
  actionLabel?: string;
  actionMode?: "add" | "export" | "acknowledge";
}

function row(id: string, title: string, detail: string, status: string, metadata: string): WorkspaceRow {
  return { id, title, detail, status, metadata };
}

function page(
  eyebrow: string,
  title: string,
  description: string,
  metrics: WorkspaceMetric[],
  rows: WorkspaceRow[],
  searchLabel: string,
  actionLabel?: string,
  actionMode?: WorkspacePageData["actionMode"],
): WorkspacePageData {
  return {
    eyebrow,
    title,
    description,
    metrics,
    rows,
    searchLabel,
    ...(actionLabel ? { actionLabel } : {}),
    ...(actionMode ? { actionMode } : {}),
  };
}

export const workspaceContent: Record<WorkspaceRole, Record<string, WorkspacePageData>> = {
  school: {
    overview: page("SCHOOL ADMINISTRATION", "School overview", "A clear view of learning, attendance, and the work ahead at Greenridge.", [
      { label: "Enrolled learners", value: "842", detail: "+18 this term", tone: "green" },
      { label: "Teaching staff", value: "46", detail: "4 subject teams", tone: "blue" },
      { label: "Attendance today", value: "94%", detail: "Across 24 classes", tone: "amber" },
      { label: "Items to review", value: "7", detail: "2 need attention", tone: "coral" },
    ], [
      row("school-overview-1", "Grade 8 Mathematics", "Room 04 · Ms A. Dlamini · 32 learners", "In progress", "08:00–08:45"),
      row("school-overview-2", "Grade 9 Natural Sciences", "Lab 02 · Mr T. Mokoena · 28 learners", "Starting soon", "09:00–09:45"),
      row("school-overview-3", "Attendance follow-up", "Three learners need an attendance check-in", "Needs review", "Pastoral team"),
    ], "Search school activity"),
    learners: page("LEARNER RECORDS", "Learners", "Review enrolment, class placement, and learning mode across the school.", [
      { label: "Active learners", value: "842", detail: "Across Grades 1–12", tone: "green" },
      { label: "New this term", value: "18", detail: "5 awaiting review", tone: "blue" },
      { label: "Hybrid learners", value: "126", detail: "Online and in-person", tone: "amber" },
    ], [
      row("s-learner-1", "Lerato Molefe", "Grade 8 · Mathematics, English, Natural Sciences", "Active", "Hybrid · 94% attendance"),
      row("s-learner-2", "Thabo Nkosi", "Grade 10 · Mathematics, Physical Sciences", "Active", "In person · 91% attendance"),
      row("s-learner-3", "Amara Jacobs", "Grade 6 · English, Life Skills, Mathematics", "Review needed", "Online · profile incomplete"),
    ], "Search learners", "Add learner", "add"),
    staff: page("STAFF DIRECTORY", "Staff", "Keep teaching teams, subjects, and assigned groups in one place.", [
      { label: "Teaching staff", value: "46", detail: "41 active this week", tone: "blue" },
      { label: "Subject teams", value: "8", detail: "2 cross-grade teams", tone: "green" },
      { label: "Invitations", value: "3", detail: "Awaiting response", tone: "amber" },
    ], [
      row("s-staff-1", "Amina Dlamini", "Mathematics · Grades 8–10", "Active", "4 classes · 113 learners"),
      row("s-staff-2", "Thabo Mokoena", "Natural Sciences · Grades 7–9", "Active", "3 classes · 86 learners"),
      row("s-staff-3", "Nandi Petersen", "English · Grades 10–12", "Invitation sent", "Sent 24 Nov"),
    ], "Search staff", "Invite staff", "add"),
    classes: page("CLASS ORGANISATION", "Classes", "Review class groups, teacher assignments, and capacity.", [
      { label: "Active classes", value: "24", detail: "Across 12 grades", tone: "green" },
      { label: "Average group size", value: "31", detail: "Learners per class", tone: "blue" },
      { label: "Needs a teacher", value: "2", detail: "Term 4 allocation", tone: "amber" },
    ], [
      row("s-class-1", "Grade 8A Mathematics", "Amina Dlamini · Room 04", "Active", "32 learners"),
      row("s-class-2", "Grade 9B Natural Sciences", "Thabo Mokoena · Lab 02", "Active", "28 learners"),
      row("s-class-3", "Grade 11C English", "Teacher assignment pending", "Needs review", "29 learners"),
    ], "Search classes", "Create class", "add"),
    subjects: page("CURRICULUM", "Subjects", "Coordinate subject offerings and the teachers responsible for each group.", [
      { label: "Subjects offered", value: "18", detail: "Grades 1–12", tone: "green" },
      { label: "Subject groups", value: "67", detail: "Across all grades", tone: "blue" },
      { label: "Allocation gaps", value: "2", detail: "Review this week", tone: "coral" },
    ], [
      row("s-subject-1", "Mathematics", "Grades 1–12 · 18 teaching groups", "Assigned", "A. Dlamini · 6 teachers"),
      row("s-subject-2", "Natural Sciences", "Grades 7–9 · 9 teaching groups", "Assigned", "T. Mokoena · 4 teachers"),
      row("s-subject-3", "Information Technology", "Grades 10–12 · 3 teaching groups", "Review needed", "1 group without allocation"),
    ], "Search subjects", "Add subject", "add"),
    timetable: page("SCHOOL SCHEDULE", "Timetable", "Review lessons, rooms, and online sessions for the school week.", [
      { label: "Lessons today", value: "58", detail: "Across 24 classes", tone: "blue" },
      { label: "Room conflicts", value: "1", detail: "Needs a new room", tone: "coral" },
      { label: "Online sessions", value: "12", detail: "Hybrid schedule", tone: "green" },
    ], [
      row("s-time-1", "Grade 8A Mathematics", "Room 04 · Amina Dlamini", "Scheduled", "08:00–08:45"),
      row("s-time-2", "Grade 10B Mathematics", "Room 12 · Amina Dlamini", "Conflict", "09:30–10:15"),
      row("s-time-3", "Matric Rewrite Revision", "Online room · Jabu Khumalo", "Scheduled", "13:15–14:00"),
    ], "Search timetable", "Add lesson", "add"),
    attendance: page("DAILY ATTENDANCE", "Attendance", "Follow participation patterns and check in on learners who were absent.", [
      { label: "Present today", value: "94%", detail: "792 of 842 learners", tone: "green" },
      { label: "Absent", value: "38", detail: "11 not yet confirmed", tone: "amber" },
      { label: "Hybrid check-ins", value: "122", detail: "Online attendance", tone: "blue" },
    ], [
      row("s-att-1", "Grade 8A Mathematics", "29 present · 2 absent · 1 online", "Recorded", "08:00 lesson"),
      row("s-att-2", "Grade 9B Natural Sciences", "25 present · 2 absent · 1 online", "Recorded", "09:00 lesson"),
      row("s-att-3", "Learner follow-up", "Three unexplained absences this week", "Needs review", "Pastoral team"),
    ], "Search attendance", "Take attendance", "acknowledge"),
    assessments: page("ASSESSMENT OVERSIGHT", "Assessments", "Track upcoming tests, marking progress, and results awaiting publication.", [
      { label: "Upcoming", value: "9", detail: "Next 14 days", tone: "blue" },
      { label: "Marking in progress", value: "6", detail: "Across 4 grades", tone: "amber" },
      { label: "Results to publish", value: "2", detail: "Awaiting review", tone: "coral" },
    ], [
      row("s-assess-1", "Grade 10 Mathematics test", "Quadratic functions · 35 learners", "Scheduled", "27 Nov · 45 min"),
      row("s-assess-2", "Grade 9 Natural Sciences quiz", "Energy transfer · 28 learners", "Marking", "24 of 28 marked"),
      row("s-assess-3", "Grade 8 English reading", "Comprehension · 32 learners", "Ready to publish", "Moderation complete"),
    ], "Search assessments", "Create assessment", "add"),
    subscriptions: page("SCHOOL SUBSCRIPTIONS", "Subscriptions", "Review learner access and upcoming renewals without changing academic records.", [
      { label: "Active access", value: "796", detail: "Learner profiles", tone: "green" },
      { label: "Renewals due", value: "26", detail: "Within 14 days", tone: "amber" },
      { label: "Needs follow-up", value: "8", detail: "Payment review", tone: "coral" },
    ], [
      row("s-sub-1", "Grade 8 cohort", "Term plan · 32 learner accounts", "Active", "Renews 01 Dec"),
      row("s-sub-2", "Grade 10 cohort", "Annual plan · 35 learner accounts", "Renewal due", "26 Nov"),
      row("s-sub-3", "Learner account · L. Jacobs", "Term plan · record retained", "Payment review", "Access unchanged"),
    ], "Search subscriptions", "Review renewals", "acknowledge"),
    reports: page("SCHOOL REPORTS", "Reports", "Prepare school-level summaries for attendance, learning, and assessment periods.", [
      { label: "Ready to export", value: "4", detail: "Term 4 summaries", tone: "green" },
      { label: "Data updated", value: "Today", detail: "08:15 sample refresh", tone: "blue" },
      { label: "Filters", value: "12", detail: "Grades and subjects", tone: "amber" },
    ], [
      row("s-report-1", "Attendance summary", "Grades 1–12 · 17–26 Nov", "Ready", "PDF preview"),
      row("s-report-2", "Assessment outcomes", "Term 4 · Mathematics and English", "Ready", "Spreadsheet preview"),
      row("s-report-3", "Learner support list", "Attendance and results indicators", "Draft", "Review before sharing"),
    ], "Search reports", "Export report", "export"),
  },
  learner: {
    overview: page("MY LEARNING", "Good morning, Zola", "Your lessons, tasks, and progress for the week ahead.", [
      { label: "Subjects", value: "6", detail: "This academic year", tone: "green" },
      { label: "Attendance", value: "96%", detail: "This term", tone: "blue" },
      { label: "Work due", value: "2", detail: "Next due tomorrow", tone: "amber" },
      { label: "Average mark", value: "78%", detail: "+4 points this term", tone: "coral" },
    ], [
      row("l-over-1", "Quadratic functions practice", "Mathematics · Ms Dlamini", "In progress", "Due tomorrow · 8 questions"),
      row("l-over-2", "Energy transfer lesson", "Natural Sciences · Lab 02", "Next lesson", "Today · 11:00"),
      row("l-over-3", "Revision notes: linear equations", "Mathematics · 4 pages", "New resource", "Added yesterday"),
    ], "Search my learning"),
    timetable: page("MY SCHEDULE", "My timetable", "See your lessons and upcoming school activities at a glance.", [
      { label: "Lessons today", value: "4", detail: "Next at 09:30", tone: "blue" },
      { label: "Online lessons", value: "2", detail: "This week", tone: "green" },
      { label: "Upcoming tests", value: "1", detail: "Mathematics · Friday", tone: "amber" },
    ], [
      row("l-time-1", "Mathematics", "Quadratic functions · Room 12", "Next lesson", "09:30–10:15"),
      row("l-time-2", "Natural Sciences", "Energy transfer · Lab 02", "Scheduled", "11:00–11:45"),
      row("l-time-3", "English revision", "Online classroom · Ms Petersen", "Scheduled", "13:15–14:00"),
    ], "Search timetable"),
    classroom: page("CLASSROOM ACCESS", "My classroom", "Your next lesson and classroom resources are shown here.", [
      { label: "Next class", value: "09:30", detail: "Mathematics", tone: "blue" },
      { label: "Room", value: "Room 12", detail: "Greenridge Centre", tone: "green" },
      { label: "Materials ready", value: "3", detail: "Lesson notes and practice", tone: "amber" },
    ], [
      row("l-room-1", "Quadratic functions", "Amina Dlamini · Grade 10 Mathematics", "Preview only", "Starts at 09:30"),
      row("l-room-2", "Lesson notes", "Quadratic functions · PDF notes", "Available", "4 pages"),
      row("l-room-3", "Class discussion", "Questions from the previous lesson", "2 updates", "Yesterday"),
    ], "Search classroom"),
    subjects: page("MY SUBJECTS", "Subjects & resources", "Find the learning materials shared with your enrolled subjects.", [
      { label: "Enrolled subjects", value: "6", detail: "2 hybrid groups", tone: "green" },
      { label: "New materials", value: "3", detail: "Added this week", tone: "blue" },
      { label: "Revision guides", value: "8", detail: "Available resources", tone: "amber" },
    ], [
      row("l-subj-1", "Mathematics", "Quadratic functions · lesson notes", "New", "PDF notes · 4 pages"),
      row("l-subj-2", "Natural Sciences", "Energy transfer practical worksheet", "Available", "Worksheet · 2 pages"),
      row("l-subj-3", "English", "Term 4 comprehension guide", "Available", "Study guide · updated 21 Nov"),
    ], "Search subjects and resources"),
    homework: page("MY WORK", "Homework", "Check what is in progress, submitted, or coming up next.", [
      { label: "In progress", value: "1", detail: "Mathematics practice", tone: "amber" },
      { label: "Submitted", value: "4", detail: "This term", tone: "green" },
      { label: "Teacher feedback", value: "1", detail: "Ready to review", tone: "blue" },
    ], [
      row("l-work-1", "Quadratic functions practice", "Mathematics · 8 questions", "In progress", "Due tomorrow"),
      row("l-work-2", "Energy transfer questions", "Natural Sciences · 10 marks", "Submitted", "Sent 25 Nov"),
      row("l-work-3", "Linear equations exit ticket", "Mathematics · Ms Dlamini", "Feedback ready", "Marked 24 Nov"),
    ], "Search homework"),
    assessments: page("TESTS & EXAMS", "Assessments", "Prepare for scheduled tests and check the feedback on completed work.", [
      { label: "Upcoming", value: "1", detail: "This week", tone: "amber" },
      { label: "Completed", value: "5", detail: "This term", tone: "green" },
      { label: "Results to review", value: "1", detail: "Teacher feedback", tone: "blue" },
    ], [
      row("l-test-1", "Quadratic functions test", "Mathematics · 45 minutes", "Scheduled", "Friday · 09:30"),
      row("l-test-2", "Energy transfer quiz", "Natural Sciences · 20 marks", "Completed", "Score 16 / 20"),
      row("l-test-3", "Comprehension assessment", "English · Ms Petersen", "Feedback ready", "Score 82%"),
    ], "Search assessments"),
    results: page("MY RESULTS", "Results", "Review marks and teacher feedback across your subjects.", [
      { label: "Term average", value: "78%", detail: "+4 points", tone: "green" },
      { label: "Strongest subject", value: "English", detail: "84% average", tone: "blue" },
      { label: "Recent result", value: "82%", detail: "English · 24 Nov", tone: "amber" },
    ], [
      row("l-result-1", "English comprehension", "Reading and inference · 25 marks", "82%", "Teacher feedback available"),
      row("l-result-2", "Natural Sciences quiz", "Energy transfer · 20 marks", "80%", "16 / 20 marks"),
      row("l-result-3", "Mathematics practice", "Linear equations · 30 marks", "73%", "Review worked examples"),
    ], "Search results"),
    progress: page("MY PROGRESS", "My progress", "See where your effort is paying off and what to practise next.", [
      { label: "Attendance", value: "96%", detail: "This term", tone: "green" },
      { label: "Homework on time", value: "91%", detail: "+6 points", tone: "blue" },
      { label: "Subjects improving", value: "4 / 6", detail: "Since last term", tone: "amber" },
    ], [
      row("l-progress-1", "English", "Reading comprehension · strong improvement", "On track", "84% term average"),
      row("l-progress-2", "Mathematics", "Quadratic functions · practise next", "Keep practising", "73% term average"),
      row("l-progress-3", "Natural Sciences", "Energy transfer · consistent work", "On track", "80% term average"),
    ], "Search progress"),
  },
  parent: {
    overview: page("FAMILY VIEW", "Your family’s learning week", "A simple view of each child’s schedule, progress, and next steps.", [
      { label: "Children linked", value: "2", detail: "Each has own access", tone: "blue" },
      { label: "Lessons attended", value: "96%", detail: "This term", tone: "green" },
      { label: "Homework due", value: "2", detail: "Across both children", tone: "amber" },
      { label: "Payments due", value: "1", detail: "Review by 01 Dec", tone: "coral" },
    ], [
      row("p-over-1", "Zola · Mathematics practice", "Grade 10 · due tomorrow", "In progress", "Amina Dlamini"),
      row("p-over-2", "Ayo · Reading response", "Grade 6 · due Friday", "Not started", "Nandi Petersen"),
      row("p-over-3", "Term plan renewal", "Zola’s learner access", "Due soon", "01 Dec · Ayo unaffected"),
    ], "Search family updates"),
    attendance: page("ATTENDANCE", "Attendance", "Follow each child’s attendance and see when a check-in may help.", [
      { label: "Zola this term", value: "96%", detail: "Grade 10", tone: "green" },
      { label: "Ayo this term", value: "94%", detail: "Grade 6", tone: "blue" },
      { label: "Follow-up needed", value: "1", detail: "Ayo · 24 Nov", tone: "amber" },
    ], [
      row("p-att-1", "Zola Dlamini", "Mathematics · present online", "Present", "25 Nov · 09:30"),
      row("p-att-2", "Ayo Dlamini", "Grade 6 English · absence reported", "Excused", "24 Nov · 10:00"),
      row("p-att-3", "Zola Dlamini", "Natural Sciences · Lab 02", "Present", "24 Nov · 11:00"),
    ], "Search attendance"),
    homework: page("HOMEWORK TRACKER", "Homework", "See each child’s due dates, submissions, and feedback.", [
      { label: "Due this week", value: "2", detail: "One per child", tone: "amber" },
      { label: "Completed", value: "7", detail: "This term", tone: "green" },
      { label: "Teacher feedback", value: "1", detail: "Ready to read", tone: "blue" },
    ], [
      row("p-work-1", "Zola · Quadratic functions practice", "Grade 10 Mathematics", "In progress", "Due tomorrow"),
      row("p-work-2", "Ayo · Reading response", "Grade 6 English", "Not started", "Due Friday"),
      row("p-work-3", "Zola · Linear equations exit ticket", "Grade 10 Mathematics", "Feedback ready", "Marked 24 Nov"),
    ], "Search homework"),
    timetable: page("FAMILY SCHEDULE", "Timetable", "Plan around lessons and school activities for both children.", [
      { label: "Lessons today", value: "6", detail: "Across both children", tone: "blue" },
      { label: "Online sessions", value: "2", detail: "This week", tone: "green" },
      { label: "Next activity", value: "09:30", detail: "Zola · Mathematics", tone: "amber" },
    ], [
      row("p-time-1", "Zola · Mathematics", "Quadratic functions · Room 12", "Upcoming", "09:30–10:15"),
      row("p-time-2", "Ayo · English reading", "Room 06 · Nandi Petersen", "Upcoming", "10:00–10:45"),
      row("p-time-3", "Zola · Natural Sciences", "Lab 02 · hybrid group", "Today", "11:00–11:45"),
    ], "Search timetable"),
    results: page("ACADEMIC RESULTS", "Results", "Follow academic progress and teacher feedback for each learner.", [
      { label: "Zola average", value: "78%", detail: "+4 this term", tone: "green" },
      { label: "Ayo average", value: "81%", detail: "+2 this term", tone: "blue" },
      { label: "Recent feedback", value: "2", detail: "Available to review", tone: "amber" },
    ], [
      row("p-result-1", "Zola · English comprehension", "Grade 10 · Reading and inference", "82%", "Feedback available"),
      row("p-result-2", "Ayo · Mathematics checkpoint", "Grade 6 · Fractions", "79%", "Teacher note added"),
      row("p-result-3", "Zola · Natural Sciences quiz", "Grade 10 · Energy transfer", "80%", "16 / 20 marks"),
    ], "Search results"),
    subscriptions: page("LEARNER ACCESS", "Subscriptions", "Manage each child’s access independently and keep payment history visible.", [
      { label: "Active plans", value: "2", detail: "One per learner", tone: "green" },
      { label: "Renewal due", value: "1", detail: "Zola · 01 Dec", tone: "amber" },
      { label: "Ayo access", value: "Active", detail: "Unaffected by Zola plan", tone: "blue" },
    ], [
      row("p-plan-1", "Zola Dlamini · Term plan", "Grade 10 · Greenridge Centre", "Renewal due", "01 Dec · South African Rand"),
      row("p-plan-2", "Ayo Dlamini · Annual plan", "Grade 6 · Greenridge Centre", "Active", "Valid to 31 Dec"),
      row("p-plan-3", "Payment receipt · Term 4", "Zola’s account only", "Paid", "18 Sep · Reference LB-2409"),
    ], "Search subscriptions", "Review payment", "acknowledge"),
    notifications: page("FAMILY UPDATES", "Notifications", "Important learning updates for your linked children.", [
      { label: "Unread", value: "3", detail: "Across both children", tone: "amber" },
      { label: "Attendance alerts", value: "1", detail: "This week", tone: "coral" },
      { label: "School updates", value: "2", detail: "New this week", tone: "blue" },
    ], [
      row("p-note-1", "Homework due tomorrow", "Zola · Mathematics practice", "Unread", "Today · 08:20"),
      row("p-note-2", "Attendance update", "Ayo · absence reported and confirmed", "Read", "24 Nov · 10:30"),
      row("p-note-3", "New result published", "Zola · English comprehension · 82%", "Unread", "24 Nov · 15:05"),
    ], "Search notifications", "Mark all read", "acknowledge"),
  },
  platform: {
    overview: page("PLATFORM OPERATIONS", "Platform overview", "A high-level view of institutions, learner access, and support activity.", [
      { label: "Institutions", value: "38", detail: "3 onboarding", tone: "blue" },
      { label: "Active learners", value: "12,480", detail: "+6.2% this term", tone: "green" },
      { label: "Active access plans", value: "10,942", detail: "Across all schools", tone: "amber" },
      { label: "Support requests", value: "14", detail: "4 need follow-up", tone: "coral" },
    ], [
      row("o-over-1", "Greenridge Learning Centre", "842 learners · 46 staff", "Active", "Updated today"),
      row("o-over-2", "New institution review", "Lakeside Study Hub · application complete", "Review needed", "Submitted 25 Nov"),
      row("o-over-3", "Support request · access help", "Parent account · independent learner plan", "Open", "Updated 26 Nov"),
    ], "Search platform activity"),
    institutions: page("INSTITUTION DIRECTORY", "Institutions", "Review school records, onboarding status, and account health.", [
      { label: "Active institutions", value: "38", detail: "Across 6 regions", tone: "green" },
      { label: "Onboarding", value: "3", detail: "In review", tone: "amber" },
      { label: "Needs attention", value: "2", detail: "Access or billing", tone: "coral" },
    ], [
      row("o-inst-1", "Greenridge Learning Centre", "Cape Town · 842 learners · 46 staff", "Active", "Hybrid programme"),
      row("o-inst-2", "Lakeside Study Hub", "Durban · 126 learners · 8 staff", "Onboarding", "Documents submitted"),
      row("o-inst-3", "Northstar Academy", "Johannesburg · 410 learners · 22 staff", "Review needed", "Renewal due 30 Nov"),
    ], "Search institutions", "Register institution", "add"),
    people: page("PEOPLE & ACCESS", "People", "Review platform accounts and trusted role assignments.", [
      { label: "People", value: "13,208", detail: "All institutions", tone: "blue" },
      { label: "Administrators", value: "56", detail: "School and platform", tone: "green" },
      { label: "Invitations", value: "19", detail: "Awaiting acceptance", tone: "amber" },
    ], [
      row("o-people-1", "Amina Dlamini", "Teacher · Greenridge Learning Centre", "Active", "Last access today"),
      row("o-people-2", "Nandi Petersen", "School administrator · Greenridge", "Active", "Role verified"),
      row("o-people-3", "New staff invitation", "Northstar Academy · English teacher", "Pending", "Sent 25 Nov"),
    ], "Search people"),
    plans: page("PLANS & PAYMENTS", "Plans & payments", "Review plan performance and payment exceptions without storing card details.", [
      { label: "Active plans", value: "10,942", detail: "Across all learners", tone: "green" },
      { label: "Renewals this month", value: "624", detail: "Learner-level plans", tone: "blue" },
      { label: "Payment review", value: "31", detail: "Provider confirmation needed", tone: "amber" },
    ], [
      row("o-plan-1", "Term Learning Plan", "School-managed · learner access", "Active", "Renewal cycle: each term"),
      row("o-plan-2", "Annual Learning Plan", "Family-managed · independent child plans", "Active", "Renewal cycle: annual"),
      row("o-plan-3", "Payment exception batch", "Provider references only · no card data", "Needs review", "31 items"),
    ], "Search plans and payments", "Review payments", "acknowledge"),
    support: page("SUPPORT DESK", "Support", "Keep school and family requests moving with a clear ownership trail.", [
      { label: "Open requests", value: "14", detail: "Across 8 institutions", tone: "blue" },
      { label: "Due today", value: "4", detail: "Priority follow-up", tone: "amber" },
      { label: "Resolved this week", value: "27", detail: "Sample queue", tone: "green" },
    ], [
      row("o-help-1", "Parent cannot see linked learner", "Family account · Greenridge", "Open", "Updated 08:10"),
      row("o-help-2", "Teacher invitation expired", "Northstar Academy · staff access", "Assigned", "Owner: Support team"),
      row("o-help-3", "Subscription renewal question", "Independent learner plan", "Due today", "Priority: normal"),
    ], "Search support requests"),
    audit: page("AUDIT TRAIL", "Audit log", "Review a sample trail of important access and account changes.", [
      { label: "Events today", value: "124", detail: "Across platform", tone: "blue" },
      { label: "Role changes", value: "6", detail: "Verified by admins", tone: "amber" },
      { label: "Flagged events", value: "0", detail: "No sample alerts", tone: "green" },
    ], [
      row("o-audit-1", "School role assigned", "Nandi Petersen · Greenridge", "Verified", "26 Nov · 08:10"),
      row("o-audit-2", "Learner plan renewed", "Zola Dlamini · independent record", "Completed", "25 Nov · 16:42"),
      row("o-audit-3", "Staff invitation sent", "Northstar Academy · English teacher", "Recorded", "25 Nov · 11:18"),
    ], "Search audit events", "Export audit report", "export"),
    reports: page("PLATFORM REPORTS", "Reports", "Review operational summaries with filters for institution, date, and activity.", [
      { label: "Available summaries", value: "8", detail: "Sample reports", tone: "green" },
      { label: "Updated", value: "Today", detail: "08:30 sample refresh", tone: "blue" },
      { label: "Pending review", value: "2", detail: "Financial summaries", tone: "amber" },
    ], [
      row("o-report-1", "Institution activity", "Schools · learner and teacher counts", "Ready", "CSV preview"),
      row("o-report-2", "Access plan summary", "Active, pending, and expiring learner plans", "Ready", "CSV preview"),
      row("o-report-3", "Support response times", "Open and resolved requests", "Draft", "Review sample filters"),
    ], "Search platform reports", "Export report", "export"),
    settings: page("PLATFORM SETTINGS", "Settings", "Review operational choices reserved for platform administrators.", [
      { label: "Policies", value: "6", detail: "Access and retention", tone: "blue" },
      { label: "Integrations", value: "0", detail: "Provider setup pending", tone: "amber" },
      { label: "Security review", value: "Ready", detail: "Sample checklist", tone: "green" },
    ], [
      row("o-setting-1", "Role assignment policy", "Trusted administrators assign school roles", "Enabled", "Reviewed 20 Nov"),
      row("o-setting-2", "Learning data retention", "Sample policy awaiting legal review", "Draft", "POPIA review required"),
      row("o-setting-3", "Payment provider connection", "No payment provider connected", "Not configured", "No card data stored"),
    ], "Search settings"),
  },
};

export const workspaceRoleLabels: Record<WorkspaceRole, string> = {
  school: "School admin",
  learner: "Learner",
  parent: "Parent / guardian",
  platform: "Platform owner",
};

export function getWorkspacePage(role: WorkspaceRole, section: string): WorkspacePageData {
  const rolePages = workspaceContent[role];
  return rolePages[section] ?? rolePages.overview ?? Object.values(rolePages)[0] ?? {
    eyebrow: "LEARNING WORKSPACE",
    title: "Workspace",
    description: "A sample view of the learning platform.",
    metrics: [],
    rows: [],
    searchLabel: "Search records",
  };
}

export function getWorkspaceHead(role: WorkspaceRole, section: string) {
  const screen = getWorkspacePage(role, section);
  const title = `${screen.title} | LearnBridge`;
  return {
    meta: [
      { title },
      { name: "description", content: screen.description },
      { property: "og:title", content: title },
      { property: "og:description", content: screen.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  };
}