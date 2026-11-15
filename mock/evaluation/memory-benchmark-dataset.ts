import type {
  BenchmarkConversationTurn,
  BenchmarkMemory,
  MemoryAnswerCriterion,
  MemoryBenchmarkCase,
} from "@/types/memory-evaluation";

type MemorySeed = Omit<BenchmarkMemory, "sourceConversationId"> & {
  sourceConversationId?: string;
};

type CaseSeed = Omit<MemoryBenchmarkCase, "conversations" | "candidateMemories"> & {
  conversationLines: string[];
  memories: MemorySeed[];
};

const negationCues = [
  "not",
  "never",
  "avoid",
  "avoids",
  "avoiding",
  "instead",
  "rather",
  "without",
  "over",
  "less",
  "do not",
  "does not",
  "did not",
  "is not",
  "are not",
  "was not",
  "were not",
  "will not",
  "cannot",
  "can not",
  "no longer",
  "stop",
  "stopped",
];

const historicalCues = [
  ...negationCues,
  "was",
  "were",
  "previously",
  "originally",
  "planned",
  "moved",
  "rescheduled",
  "changed",
  "from",
  "earlier",
  "old",
  "previous",
  "former",
  "used to",
];

type CriterionOptions = Omit<MemoryAnswerCriterion, "id" | "label" | "groups">;

function criterion(
  id: string,
  label: string,
  groups: string[][],
  options: CriterionOptions = {},
): MemoryAnswerCriterion {
  return { id, label, groups, ...options };
}

function optionalCriterion(
  id: string,
  label: string,
  groups: string[][],
  options: CriterionOptions = {},
): MemoryAnswerCriterion {
  return criterion(id, label, groups, { ...options, required: false });
}

function prohibitedCriterion(
  id: string,
  label: string,
  aliases: string[],
  options: CriterionOptions = {},
): MemoryAnswerCriterion {
  return criterion(id, label, [aliases], {
    prohibited: true,
    allowedContext: negationCues,
    ...options,
  });
}

const baseDate = "2026-10-01T09:00:00.000Z";

function turns(caseId: string, lines: string[]): BenchmarkConversationTurn[] {
  return lines.map((content, index) => ({
    id: `${caseId}-turn-${index + 1}`,
    conversationId: `${caseId}-conversation-${Math.floor(index / 2) + 1}`,
    role: index % 2 === 0 ? "user" : "assistant",
    content,
    timestamp: new Date(Date.parse(baseDate) + index * 86_400_000).toISOString(),
  }));
}

function benchmarkCase(seed: CaseSeed): MemoryBenchmarkCase {
  return {
    ...seed,
    conversations: turns(seed.id, seed.conversationLines),
    candidateMemories: seed.memories.map((memory, index) => ({
      ...memory,
      sourceConversationId:
        memory.sourceConversationId ?? `${seed.id}-conversation-${Math.floor(index / 2) + 1}`,
    })),
  };
}

const distractors: MemorySeed[] = [
  {
    id: "distractor-coffee",
    content: "The user drinks coffee during morning work sessions.",
    createdAt: "2026-10-02T09:00:00.000Z",
    category: "experience",
    importanceScore: 0.15,
    validity: "current",
    explicit: true,
  },
  {
    id: "distractor-photos",
    content: "The user edits travel photos on weekends.",
    createdAt: "2026-10-03T09:00:00.000Z",
    category: "experience",
    importanceScore: 0.12,
    validity: "current",
    explicit: true,
  },
];

export const memoryBenchmarkDataset: MemoryBenchmarkCase[] = [
  benchmarkCase({
    id: "stable-fact-01",
    title: "remembers degree and graduation year",
    category: "stable-fact",
    profileId: "raj",
    prompt: "when do i graduate?",
    conversationLines: ["I am finishing my B.Tech in computer science in June 2027."],
    memories: [
      {
        id: "raj-degree",
        content: "Raj is completing a B.Tech in Computer Science in June 2027.",
        createdAt: "2026-10-01T09:00:00.000Z",
        category: "fact",
        importanceScore: 0.9,
        validity: "current",
        explicit: true,
      },
      ...distractors,
    ],
    goldMemoryIds: ["raj-degree"],
    expectedAnswer: "You graduate in June 2027 with a B.Tech in Computer Science.",
    answerRubric: ["mentions June 2027", "mentions B.Tech or Computer Science"],
    answerCriteria: [
      criterion("graduation-date", "States the graduation month and year", [
        ["june 2027", "june of 2027"],
      ]),
      optionalCriterion("degree", "Mentions the degree or field", [
        ["b tech", "btech", "computer science"],
      ]),
    ],
  }),
  benchmarkCase({
    id: "stable-fact-02",
    title: "remembers preferred work location",
    category: "stable-fact",
    profileId: "raj",
    prompt: "which city am i available to work from?",
    conversationLines: ["I can work full-time in Bengaluru after graduation."],
    memories: [
      {
        id: "raj-location",
        content: "Raj is available to work full-time in Bengaluru after graduation.",
        createdAt: "2026-10-04T09:00:00.000Z",
        category: "fact",
        importanceScore: 0.82,
        validity: "current",
        explicit: true,
      },
      ...distractors,
    ],
    goldMemoryIds: ["raj-location"],
    expectedAnswer: "You are available to work from Bengaluru.",
    answerRubric: ["mentions Bengaluru"],
    answerCriteria: [
      criterion("work-city", "States Bengaluru", [["bengaluru", "bangalore"]]),
    ],
  }),
  benchmarkCase({
    id: "stable-fact-03",
    title: "remembers active internship application",
    category: "stable-fact",
    profileId: "raj",
    prompt: "what research internship am i applying for?",
    conversationLines: [
      "I am applying for the Microsoft Research India internship for January to June 2027.",
    ],
    memories: [
      {
        id: "raj-msr-application",
        content:
          "Raj is applying for the Microsoft Research India research internship from January to June 2027.",
        createdAt: "2026-10-05T09:00:00.000Z",
        category: "goal",
        importanceScore: 0.95,
        validity: "current",
        explicit: true,
      },
      ...distractors,
    ],
    goldMemoryIds: ["raj-msr-application"],
    expectedAnswer:
      "You are applying for the Microsoft Research India internship from January through June 2027.",
    answerRubric: ["mentions Microsoft Research India", "mentions 2027"],
    answerCriteria: [
      criterion("internship-name", "Names the Microsoft Research India internship", [
        ["microsoft research india", "microsoft research", "msr india"],
      ]),
      optionalCriterion("internship-dates", "Mentions the internship year", [["2027"]]),
    ],
  }),
  benchmarkCase({
    id: "stable-fact-04",
    title: "remembers interview timeline",
    category: "stable-fact",
    profileId: "raj",
    prompt: "when is my Google ML interview?",
    conversationLines: ["My Google ML interview is scheduled for August 18."],
    memories: [
      {
        id: "raj-google-interview",
        content: "Raj's Google ML interview is scheduled for August 18.",
        createdAt: "2026-10-06T09:00:00.000Z",
        category: "fact",
        importanceScore: 0.93,
        validity: "current",
        explicit: true,
      },
      ...distractors,
    ],
    goldMemoryIds: ["raj-google-interview"],
    expectedAnswer: "Your Google ML interview is on August 18.",
    answerRubric: ["mentions August 18"],
    answerCriteria: [
      criterion("interview-date", "States August 18", [
        ["august 18", "aug 18", "18 august", "18th august"],
      ]),
    ],
  }),
  benchmarkCase({
    id: "stable-fact-05",
    title: "remembers completed research course",
    category: "stable-fact",
    profileId: "raj",
    prompt: "which course gave me my first human-centered AI research experience?",
    conversationLines: [
      "My Human-Centered AI course gave me my first research experience with user studies.",
    ],
    memories: [
      {
        id: "raj-hci-course",
        content:
          "Raj's Human-Centered AI course gave him his first research experience with user studies.",
        createdAt: "2026-10-06T10:00:00.000Z",
        category: "experience",
        importanceScore: 0.76,
        validity: "current",
        explicit: true,
      },
      ...distractors,
    ],
    goldMemoryIds: ["raj-hci-course"],
    expectedAnswer: "Your Human-Centered AI course gave you that first research experience.",
    answerRubric: ["mentions Human-Centered AI", "mentions research or user studies"],
    answerCriteria: [
      criterion("course-name", "Names the Human-Centered AI course", [
        ["human-centered ai", "human centered ai", "human-centred ai", "hci"],
      ]),
      optionalCriterion("research-experience", "Mentions research or user studies", [
        ["research", "user studies", "user study"],
      ]),
    ],
  }),
  benchmarkCase({
    id: "preference-01",
    title: "uses preferred engineering focus",
    category: "preference",
    profileId: "raj",
    prompt: "what kind of roles should i prioritize?",
    conversationLines: [
      "I prefer backend engineering and applied AI work over pure frontend roles.",
    ],
    memories: [
      {
        id: "raj-role-preference",
        content: "Raj prefers backend engineering and applied AI work over pure frontend roles.",
        createdAt: "2026-10-07T09:00:00.000Z",
        category: "preference",
        importanceScore: 0.91,
        validity: "current",
        explicit: true,
      },
      ...distractors,
    ],
    goldMemoryIds: ["raj-role-preference"],
    expectedAnswer: "Prioritize backend engineering and applied AI roles.",
    answerRubric: ["mentions backend", "mentions applied AI", "does not prioritize frontend"],
    answerCriteria: [
      criterion("backend", "Prioritizes backend work", [["backend", "back end", "back-end"]]),
      criterion("applied-ai", "Prioritizes applied AI work", [
        ["applied ai", "ai engineering", "ai role", "ai roles", "artificial intelligence", "ai"],
      ]),
      prohibitedCriterion("not-frontend", "Does not recommend frontend roles", [
        "frontend",
        "front end",
        "front-end",
      ]),
    ],
  }),
  benchmarkCase({
    id: "preference-02",
    title: "uses answer style preference",
    category: "preference",
    profileId: "raj",
    prompt: "how should you prepare my interview answers?",
    conversationLines: [
      "I prefer concise interview answers with a clear structure and one concrete example.",
    ],
    memories: [
      {
        id: "raj-answer-style",
        content:
          "Raj prefers concise interview answers with a clear structure and one concrete example.",
        createdAt: "2026-10-08T09:00:00.000Z",
        category: "preference",
        importanceScore: 0.74,
        validity: "current",
        explicit: true,
      },
      ...distractors,
    ],
    goldMemoryIds: ["raj-answer-style"],
    expectedAnswer: "Use concise, structured answers with one concrete example.",
    answerRubric: ["mentions concise", "mentions structure", "mentions example"],
    answerCriteria: [
      criterion("concise", "Recommends concise answers", [["concise", "brief", "short"]]),
      criterion("structure", "Recommends a clear structure", [
        ["structure", "structured", "structuring"],
      ]),
      criterion("example", "Recommends a concrete example", [
        ["example", "concrete example", "specific example"],
      ]),
    ],
  }),
  benchmarkCase({
    id: "preference-03",
    title: "uses study scheduling preference",
    category: "preference",
    profileId: "raj",
    prompt: "when should i schedule focused study time?",
    conversationLines: ["My best deep-work hours are 7:30 to 9:30 in the morning."],
    memories: [
      {
        id: "raj-deep-work-hours",
        content: "Raj's preferred deep-work time is 7:30 to 9:30 in the morning.",
        createdAt: "2026-10-09T09:00:00.000Z",
        category: "preference",
        importanceScore: 0.69,
        validity: "current",
        explicit: true,
      },
      ...distractors,
    ],
    goldMemoryIds: ["raj-deep-work-hours"],
    expectedAnswer: "Schedule focused study from 7:30 to 9:30 in the morning.",
    answerRubric: ["mentions 7:30", "mentions morning"],
    answerCriteria: [
      criterion("start-time", "Mentions the 7:30 to 9:30 window", [
        ["7 30", "7:30", "7.30", "07 30"],
      ]),
      criterion("morning", "Mentions the morning", [["morning"]]),
    ],
  }),
  benchmarkCase({
    id: "preference-04",
    title: "uses collaboration preference",
    category: "preference",
    profileId: "maya",
    prompt: "how should i ask for feedback on my prototype?",
    conversationLines: [
      "I learn best from short weekly feedback sessions rather than a large review at the end.",
    ],
    memories: [
      {
        id: "maya-feedback-preference",
        content:
          "Maya prefers short weekly feedback sessions over a single large review at the end.",
        createdAt: "2026-10-10T09:00:00.000Z",
        category: "preference",
        importanceScore: 0.72,
        validity: "current",
        explicit: true,
      },
      ...distractors,
    ],
    goldMemoryIds: ["maya-feedback-preference"],
    expectedAnswer: "Ask for short weekly feedback sessions.",
    answerRubric: ["mentions weekly", "prefers short sessions"],
    answerCriteria: [
      criterion("weekly", "Recommends weekly feedback", [
        ["weekly", "every week", "each week"],
      ]),
      criterion("short", "Prefers short sessions", [["short", "brief", "concise"]]),
    ],
  }),
  benchmarkCase({
    id: "preference-05",
    title: "uses preferred project explanation style",
    category: "preference",
    profileId: "maya",
    prompt: "how should i present my prototype architecture?",
    conversationLines: [
      "When I explain technical work, I prefer a concrete user scenario before the architecture diagram.",
    ],
    memories: [
      {
        id: "maya-explanation-style",
        content:
          "Maya prefers presenting technical work through a concrete user scenario before the architecture diagram.",
        createdAt: "2026-10-11T10:00:00.000Z",
        category: "preference",
        importanceScore: 0.62,
        validity: "current",
        explicit: true,
      },
      ...distractors,
    ],
    goldMemoryIds: ["maya-explanation-style"],
    expectedAnswer: "Start with a concrete user scenario, then show the architecture diagram.",
    answerRubric: ["mentions user scenario", "mentions architecture diagram"],
    answerCriteria: [
      criterion("user-scenario", "Starts from a concrete user scenario", [
        ["user scenario", "user story", "concrete scenario", "scenario"],
      ]),
      criterion("architecture", "Mentions the architecture diagram", [
        ["architecture diagram", "architecture"],
      ]),
    ],
  }),
  benchmarkCase({
    id: "temporal-update-01",
    title: "uses current role preference after update",
    category: "temporal-update",
    profileId: "raj",
    prompt: "what roles should i focus on next?",
    conversationLines: [
      "I am interested in frontend engineering roles.",
      "I no longer want frontend roles. I prefer backend and AI engineering now.",
    ],
    memories: [
      {
        id: "raj-frontend-old",
        content: "Raj is interested in frontend engineering roles.",
        createdAt: "2026-10-01T09:00:00.000Z",
        category: "preference",
        importanceScore: 0.65,
        validity: "superseded",
        explicit: true,
      },
      {
        id: "raj-backend-ai-current",
        content: "Raj currently prefers backend and AI engineering roles over frontend roles.",
        createdAt: "2026-10-15T09:00:00.000Z",
        category: "preference",
        importanceScore: 0.93,
        validity: "current",
        explicit: true,
      },
      ...distractors,
    ],
    goldMemoryIds: ["raj-backend-ai-current"],
    expectedAnswer: "Focus on backend and AI engineering roles, not frontend roles.",
    answerRubric: ["mentions backend", "mentions AI", "does not recommend frontend"],
    answerCriteria: [
      criterion("backend", "Prioritizes backend work", [["backend", "back end", "back-end"]]),
      criterion("ai", "Prioritizes AI work", [
        ["applied ai", "ai engineering", "ai role", "ai roles", "artificial intelligence", "ai"],
      ]),
      prohibitedCriterion("not-frontend", "Does not recommend frontend roles", [
        "frontend",
        "front end",
        "front-end",
      ]),
    ],
  }),
  benchmarkCase({
    id: "temporal-update-02",
    title: "uses rescheduled interview date",
    category: "temporal-update",
    profileId: "raj",
    prompt: "when should i prepare for my Google interview?",
    conversationLines: [
      "My Google interview was planned for August 18.",
      "The Google interview has moved to August 25.",
    ],
    memories: [
      {
        id: "google-interview-aug18",
        content: "Raj's Google interview was planned for August 18.",
        createdAt: "2026-10-02T09:00:00.000Z",
        category: "fact",
        importanceScore: 0.82,
        validity: "superseded",
        explicit: true,
      },
      {
        id: "google-interview-aug25",
        content: "Raj's Google interview is scheduled for August 25.",
        createdAt: "2026-10-16T09:00:00.000Z",
        category: "fact",
        importanceScore: 0.94,
        validity: "current",
        explicit: true,
      },
      ...distractors,
    ],
    goldMemoryIds: ["google-interview-aug25"],
    expectedAnswer: "Prepare for the Google interview on August 25.",
    answerRubric: ["mentions August 25", "does not mention August 18 as current"],
    answerCriteria: [
      criterion("current-date", "States the current interview date, August 25", [
        ["august 25", "aug 25", "25 august", "25th august"],
      ]),
      prohibitedCriterion(
        "stale-date",
        "Does not present August 18 as the current date",
        ["august 18", "aug 18", "18 august", "18th august"],
        { allowedContext: historicalCues },
      ),
    ],
  }),
  benchmarkCase({
    id: "temporal-update-03",
    title: "uses updated location preference",
    category: "temporal-update",
    profileId: "maya",
    prompt: "which location should i target for my next role?",
    conversationLines: [
      "I was considering Hyderabad for my next role.",
      "I have decided to prioritize Bengaluru because I can work in person there.",
    ],
    memories: [
      {
        id: "maya-hyderabad-old",
        content: "Maya was considering Hyderabad for her next role.",
        createdAt: "2026-10-04T09:00:00.000Z",
        category: "preference",
        importanceScore: 0.55,
        validity: "superseded",
        explicit: true,
      },
      {
        id: "maya-bengaluru-current",
        content: "Maya now prioritizes Bengaluru for in-person roles.",
        createdAt: "2026-10-17T09:00:00.000Z",
        category: "preference",
        importanceScore: 0.87,
        validity: "current",
        explicit: true,
      },
      ...distractors,
    ],
    goldMemoryIds: ["maya-bengaluru-current"],
    expectedAnswer: "Target Bengaluru for your next in-person role.",
    answerRubric: ["mentions Bengaluru", "does not prioritize Hyderabad"],
    answerCriteria: [
      criterion("current-city", "Targets Bengaluru", [["bengaluru", "bangalore"]]),
      prohibitedCriterion(
        "stale-city",
        "Does not prioritize the superseded Hyderabad option",
        ["hyderabad"],
        { allowedContext: historicalCues },
      ),
    ],
  }),
  benchmarkCase({
    id: "temporal-update-04",
    title: "uses revised study method",
    category: "temporal-update",
    profileId: "sam",
    prompt: "how should i prepare for system design?",
    conversationLines: [
      "I was reading system design notes passively every evening.",
      "Passive reading is not working. I now want timed design drills with feedback.",
    ],
    memories: [
      {
        id: "sam-passive-study-old",
        content: "Sam used passive evening reading for system design preparation.",
        createdAt: "2026-10-05T09:00:00.000Z",
        category: "experience",
        importanceScore: 0.4,
        validity: "superseded",
        explicit: true,
      },
      {
        id: "sam-timed-drills-current",
        content: "Sam now prefers timed system design drills with feedback.",
        createdAt: "2026-10-18T09:00:00.000Z",
        category: "preference",
        importanceScore: 0.85,
        validity: "current",
        explicit: true,
      },
      ...distractors,
    ],
    goldMemoryIds: ["sam-timed-drills-current"],
    expectedAnswer: "Use timed system design drills with feedback.",
    answerRubric: ["mentions timed drills", "mentions feedback"],
    answerCriteria: [
      criterion("timed-drills", "Recommends timed drills", [
        ["timed drills", "timed design drills", "timed system design", "timed practice"],
      ]),
      criterion("feedback", "Recommends feedback", [["feedback", "review", "critique"]]),
    ],
  }),
  benchmarkCase({
    id: "conflict-01",
    title: "resolves conflicting deadline information",
    category: "conflicting-information",
    profileId: "raj",
    prompt: "when is the internship application due?",
    conversationLines: [
      "I think the internship application is due on November 10.",
      "The official application page says the deadline is November 15.",
    ],
    memories: [
      {
        id: "internship-deadline-inferred",
        content: "The internship application might be due on November 10.",
        createdAt: "2026-10-06T09:00:00.000Z",
        category: "fact",
        importanceScore: 0.45,
        validity: "uncertain",
        explicit: false,
      },
      {
        id: "internship-deadline-official",
        content: "The official internship application deadline is November 15.",
        createdAt: "2026-10-19T09:00:00.000Z",
        category: "fact",
        importanceScore: 0.94,
        validity: "current",
        explicit: true,
      },
      ...distractors,
    ],
    goldMemoryIds: ["internship-deadline-official"],
    expectedAnswer: "The official deadline is November 15.",
    answerRubric: ["mentions November 15", "does not present November 10 as certain"],
    answerCriteria: [
      criterion("official-deadline", "States the official November 15 deadline", [
        ["november 15", "nov 15", "15 november", "15th november"],
      ]),
      prohibitedCriterion(
        "stale-deadline",
        "Does not present November 10 as the current deadline",
        ["november 10", "nov 10", "10 november", "10th november"],
        { allowedContext: historicalCues },
      ),
    ],
  }),
  benchmarkCase({
    id: "conflict-02",
    title: "distinguishes inferred from explicit preference",
    category: "conflicting-information",
    profileId: "maya",
    prompt: "do i prefer remote work?",
    conversationLines: [
      "My previous internship was remote.",
      "For my next role I explicitly want an in-person team in Bengaluru.",
    ],
    memories: [
      {
        id: "maya-remote-inference",
        content: "Maya may prefer remote work because her previous internship was remote.",
        createdAt: "2026-10-07T09:00:00.000Z",
        category: "preference",
        importanceScore: 0.25,
        validity: "uncertain",
        explicit: false,
      },
      {
        id: "maya-in-person-explicit",
        content: "Maya explicitly wants an in-person team in Bengaluru for her next role.",
        createdAt: "2026-10-20T09:00:00.000Z",
        category: "preference",
        importanceScore: 0.89,
        validity: "current",
        explicit: true,
      },
      ...distractors,
    ],
    goldMemoryIds: ["maya-in-person-explicit"],
    expectedAnswer:
      "You have explicitly said you want an in-person team in Bengaluru; remote work is not your stated current preference.",
    answerRubric: [
      "mentions in-person",
      "mentions Bengaluru",
      "recognizes remote preference is not explicit",
    ],
    answerCriteria: [
      criterion("in-person", "States the explicit in-person preference", [
        ["in person", "in-person", "on site", "onsite", "bengaluru", "bangalore"],
      ]),
      prohibitedCriterion("not-remote", "Does not state remote work as the current preference", [
        "remote",
        "work from home",
        "wfh",
      ]),
      optionalCriterion("remote-not-explicit", "Explains that remote is not the explicit preference", [
        ["remote", "work from home", "wfh"],
        [
          "not explicit",
          "not stated",
          "not your stated",
          "no stated",
          "not currently",
          "not your current",
          "not indicated",
          "is not explicit",
        ],
      ]),
    ],
  }),
  benchmarkCase({
    id: "conflict-03",
    title: "uses verified resume status",
    category: "conflicting-information",
    profileId: "sam",
    prompt: "is my resume ready to send?",
    conversationLines: [
      "I think my resume is almost ready.",
      "I finished the final resume review and exported Resume.pdf today.",
    ],
    memories: [
      {
        id: "sam-resume-almost-ready",
        content: "Sam thinks the resume is almost ready.",
        createdAt: "2026-10-08T09:00:00.000Z",
        category: "fact",
        importanceScore: 0.4,
        validity: "superseded",
        explicit: false,
      },
      {
        id: "sam-resume-exported",
        content: "Sam completed the final resume review and exported Resume.pdf.",
        createdAt: "2026-10-21T09:00:00.000Z",
        category: "fact",
        importanceScore: 0.83,
        validity: "current",
        explicit: true,
      },
      ...distractors,
    ],
    goldMemoryIds: ["sam-resume-exported"],
    expectedAnswer: "Yes. The final review is complete and Resume.pdf has been exported.",
    answerRubric: ["says ready", "mentions final review or Resume.pdf"],
    answerCriteria: [
      criterion("affirmative", "Says the resume is ready or complete", [
        ["yes", "ready", "complete", "completed", "exported", "finished", "good to go", "done"],
      ]),
      criterion("evidence", "Mentions the final review or Resume.pdf", [
        ["final review", "resume pdf", "exported resume"],
      ]),
      prohibitedCriterion(
        "not-ready",
        "Does not claim the resume is still unfinished",
        [
          "not ready",
          "almost ready",
          "not complete",
          "not finished",
          "still reviewing",
          "needs review",
        ],
      ),
    ],
  }),
  benchmarkCase({
    id: "conflict-04",
    title: "keeps an uncertain inference from becoming a fact",
    category: "conflicting-information",
    profileId: "raj",
    prompt: "have i already accepted the Microsoft Research internship?",
    conversationLines: [
      "I am excited about the Microsoft Research India internship application.",
      "I have not received an offer yet; I am still applying.",
    ],
    memories: [
      {
        id: "raj-excited-inference",
        content:
          "Raj may have accepted the Microsoft Research India internship because he is excited about it.",
        createdAt: "2026-10-10T09:00:00.000Z",
        category: "fact",
        importanceScore: 0.1,
        validity: "uncertain",
        explicit: false,
      },
      {
        id: "raj-still-applying",
        content:
          "Raj has not received an offer and is still applying for the Microsoft Research India internship.",
        createdAt: "2026-10-22T09:00:00.000Z",
        category: "fact",
        importanceScore: 0.91,
        validity: "current",
        explicit: true,
      },
      ...distractors,
    ],
    goldMemoryIds: ["raj-still-applying"],
    expectedAnswer: "No. You are still applying and have not received an offer yet.",
    answerRubric: ["says no", "mentions still applying or no offer"],
    answerCriteria: [
      criterion("still-applying", "Says the user is still applying or has no offer", [
        [
          "still applying",
          "still in the running",
          "have not received",
          "no offer",
          "not received",
          "have not accepted",
          "not accepted",
        ],
      ]),
      prohibitedCriterion("not-accepted", "Does not claim the internship was accepted", [
        "accepted",
        "already accepted",
        "have accepted",
      ]),
    ],
  }),
  benchmarkCase({
    id: "multi-session-01",
    title: "combines skills and target role",
    category: "multi-session",
    profileId: "raj",
    prompt: "what should i emphasize in my applied ML internship application?",
    conversationLines: [
      "I built a persistent-memory assistant with TypeScript and Gemini.",
      "I want applied ML and human-centered AI internships.",
    ],
    memories: [
      {
        id: "raj-memory-assistant-project",
        content: "Raj built a persistent-memory assistant using TypeScript and Gemini.",
        createdAt: "2026-10-11T09:00:00.000Z",
        category: "experience",
        importanceScore: 0.88,
        validity: "current",
        explicit: true,
      },
      {
        id: "raj-applied-ml-goal",
        content: "Raj is targeting applied ML and human-centered AI internships.",
        createdAt: "2026-10-12T09:00:00.000Z",
        category: "goal",
        importanceScore: 0.9,
        validity: "current",
        explicit: true,
      },
      ...distractors,
    ],
    goldMemoryIds: ["raj-memory-assistant-project", "raj-applied-ml-goal"],
    expectedAnswer:
      "Emphasize the persistent-memory assistant, your TypeScript and Gemini implementation work, and its relevance to applied ML and human-centered AI.",
    answerRubric: [
      "mentions memory assistant",
      "mentions Gemini or TypeScript",
      "mentions applied ML or human-centered AI",
    ],
    answerCriteria: [
      criterion("memory-assistant", "Mentions the persistent-memory assistant", [
        ["memory assistant", "persistent-memory assistant", "persistent memory assistant", "nexus memory"],
      ]),
      criterion("implementation", "Mentions Gemini or TypeScript", [
        ["gemini", "typescript", "type script"],
      ]),
      criterion("target-field", "Connects the project to applied ML or human-centered AI", [
        ["applied ml", "applied machine learning", "human-centered ai", "human centered ai", "machine learning"],
      ]),
    ],
  }),
  benchmarkCase({
    id: "multi-session-02",
    title: "combines schedule and interview date",
    category: "multi-session",
    profileId: "raj",
    prompt: "make a final-week study plan before my interview.",
    conversationLines: [
      "My Google ML interview is on August 25.",
      "I can study in deep-work blocks from 7:30 to 9:30 each morning.",
    ],
    memories: [
      {
        id: "raj-interview-date-final",
        content: "Raj's Google ML interview is on August 25.",
        createdAt: "2026-10-13T09:00:00.000Z",
        category: "fact",
        importanceScore: 0.94,
        validity: "current",
        explicit: true,
      },
      {
        id: "raj-study-blocks",
        content: "Raj can study in deep-work blocks from 7:30 to 9:30 each morning.",
        createdAt: "2026-10-14T09:00:00.000Z",
        category: "preference",
        importanceScore: 0.73,
        validity: "current",
        explicit: true,
      },
      ...distractors,
    ],
    goldMemoryIds: ["raj-interview-date-final", "raj-study-blocks"],
    expectedAnswer:
      "Plan daily 7:30 to 9:30 morning sessions leading up to the August 25 interview.",
    answerRubric: ["mentions August 25", "mentions morning study block"],
    taskSuccessCriteria: ["creates a time-bound plan", "uses both memories"],
    answerCriteria: [
      criterion("interview-date", "Includes the August 25 interview date", [
        ["august 25", "aug 25", "25 august", "25th august"],
      ]),
      criterion("study-block", "Uses the morning deep-work block", [
        ["morning", "7 30", "7:30", "7.30", "deep work", "deep-work"],
      ]),
      optionalCriterion("cadence", "Describes a repeated daily plan", [
        ["daily", "each morning", "every morning", "each day", "per day"],
      ]),
    ],
  }),
  benchmarkCase({
    id: "multi-session-03",
    title: "combines feedback preference and prototype goal",
    category: "multi-session",
    profileId: "maya",
    prompt: "how should i run my prototype review process?",
    conversationLines: [
      "I want to prototype an AI tool that helps students plan research applications.",
      "I learn best from short weekly feedback sessions.",
    ],
    memories: [
      {
        id: "maya-prototype-goal",
        content:
          "Maya wants to prototype an AI tool that helps students plan research applications.",
        createdAt: "2026-10-15T09:00:00.000Z",
        category: "goal",
        importanceScore: 0.79,
        validity: "current",
        explicit: true,
      },
      {
        id: "maya-weekly-feedback",
        content: "Maya learns best from short weekly feedback sessions.",
        createdAt: "2026-10-16T09:00:00.000Z",
        category: "preference",
        importanceScore: 0.72,
        validity: "current",
        explicit: true,
      },
      ...distractors,
    ],
    goldMemoryIds: ["maya-prototype-goal", "maya-weekly-feedback"],
    expectedAnswer:
      "Run short weekly reviews focused on your AI tool for research-application planning.",
    answerRubric: ["mentions weekly feedback", "mentions prototype goal"],
    answerCriteria: [
      criterion("weekly", "Recommends weekly feedback", [
        ["weekly", "every week", "each week"],
      ]),
      criterion("feedback", "Recommends feedback or review sessions", [
        ["feedback", "review", "reviews", "critique"],
      ]),
      criterion("prototype-goal", "Connects the review to the AI tool and its purpose", [
        ["prototype", "ai tool"],
        ["research application", "research applications", "students"],
      ]),
    ],
  }),
  benchmarkCase({
    id: "multi-session-04",
    title: "combines resume status and application deadline",
    category: "multi-session",
    profileId: "sam",
    prompt: "what should i do next for the internship application?",
    conversationLines: [
      "I exported Resume.pdf after the final review.",
      "The official internship application deadline is November 15.",
    ],
    memories: [
      {
        id: "sam-resume-ready",
        content: "Sam completed the final resume review and exported Resume.pdf.",
        createdAt: "2026-10-17T09:00:00.000Z",
        category: "fact",
        importanceScore: 0.83,
        validity: "current",
        explicit: true,
      },
      {
        id: "sam-deadline-nov15",
        content: "The official internship application deadline is November 15.",
        createdAt: "2026-10-18T09:00:00.000Z",
        category: "fact",
        importanceScore: 0.94,
        validity: "current",
        explicit: true,
      },
      ...distractors,
    ],
    goldMemoryIds: ["sam-resume-ready", "sam-deadline-nov15"],
    expectedAnswer: "Submit the application with Resume.pdf before the November 15 deadline.",
    answerRubric: ["mentions Resume.pdf", "mentions November 15", "recommends submitting"],
    taskSuccessCriteria: ["identifies the next action", "uses deadline and resume status"],
    answerCriteria: [
      criterion("resume", "Mentions Resume.pdf", [["resume pdf", "resume"]]),
      criterion("deadline", "Mentions the November 15 deadline", [
        ["november 15", "nov 15", "15 november", "15th november"],
      ]),
      criterion("submit", "Recommends submitting the application", [
        ["submit", "send", "upload", "apply"],
      ]),
    ],
  }),
  benchmarkCase({
    id: "multi-hop-01",
    title: "connects person to project through relationship memory",
    category: "multi-hop",
    profileId: "raj",
    prompt: "who should review my memory-system research demo?",
    conversationLines: [
      "Professor Meera supervised my work on human-centered AI.",
      "My Nexus Memory project is a human-centered AI research demo.",
    ],
    memories: [
      {
        id: "meera-human-centered-ai",
        content: "Professor Meera supervised Raj's human-centered AI work.",
        createdAt: "2026-10-19T09:00:00.000Z",
        category: "relationship",
        importanceScore: 0.84,
        validity: "current",
        explicit: true,
        entityIds: ["person-meera", "topic-human-centered-ai"],
      },
      {
        id: "nexus-human-centered-ai",
        content: "Nexus Memory is Raj's human-centered AI research demo.",
        createdAt: "2026-10-20T09:00:00.000Z",
        category: "experience",
        importanceScore: 0.87,
        validity: "current",
        explicit: true,
        entityIds: ["project-nexus-memory", "topic-human-centered-ai"],
      },
      ...distractors,
    ],
    goldMemoryIds: ["meera-human-centered-ai", "nexus-human-centered-ai"],
    expectedAnswer:
      "Ask Professor Meera to review the Nexus Memory demo because she supervised your human-centered AI work.",
    answerRubric: ["mentions Professor Meera", "connects her to human-centered AI or Nexus Memory"],
    answerCriteria: [
      criterion("reviewer", "Names Professor Meera", [
        ["professor meera", "prof meera", "meera"],
      ]),
      optionalCriterion("connection", "Explains the connection through human-centered AI or Nexus Memory", [
        ["human-centered ai", "human centered ai", "nexus memory", "supervised"],
      ]),
    ],
  }),
  benchmarkCase({
    id: "multi-hop-02",
    title: "connects event and goal to scheduling recommendation",
    category: "multi-hop",
    profileId: "raj",
    prompt: "what should i prioritize this week?",
    conversationLines: [
      "My Google ML interview is on August 25.",
      "I need to complete two timed ML mock interviews before the Google interview.",
    ],
    memories: [
      {
        id: "raj-google-event",
        content: "Raj's Google ML interview is on August 25.",
        createdAt: "2026-10-21T09:00:00.000Z",
        category: "fact",
        importanceScore: 0.95,
        validity: "current",
        explicit: true,
        entityIds: ["event-google-interview"],
      },
      {
        id: "raj-ml-mock-goal",
        content: "Raj needs to complete two timed ML mock interviews before the Google interview.",
        createdAt: "2026-10-22T09:00:00.000Z",
        category: "goal",
        importanceScore: 0.9,
        validity: "current",
        explicit: true,
        entityIds: ["event-google-interview", "goal-ml-mocks"],
      },
      ...distractors,
    ],
    goldMemoryIds: ["raj-google-event", "raj-ml-mock-goal"],
    expectedAnswer:
      "Prioritize two timed ML mock interviews before the August 25 Google interview.",
    answerRubric: ["mentions two timed mocks", "mentions August 25 or Google interview"],
    taskSuccessCriteria: ["prioritizes the connected goal before the event"],
    answerCriteria: [
      criterion("mock-count", "Mentions two mock interviews", [["two", "2"]]),
      criterion("mock-type", "Mentions timed mock interviews", [
        ["timed", "time-boxed"],
        ["mock", "mocks", "mock interview", "practice interview"],
      ]),
      criterion("interview-event", "Mentions August 25 or the Google interview", [
        ["august 25", "aug 25", "google interview", "google ml interview"],
      ]),
    ],
  }),
  benchmarkCase({
    id: "multi-hop-03",
    title: "connects document to application goal",
    category: "multi-hop",
    profileId: "sam",
    prompt: "which file should i attach to the research internship application?",
    conversationLines: [
      "I exported Resume.pdf after the final review.",
      "I am applying for the research internship this month.",
    ],
    memories: [
      {
        id: "sam-resume-file",
        content: "Resume.pdf is Sam's finalized resume file.",
        createdAt: "2026-10-23T09:00:00.000Z",
        category: "relationship",
        importanceScore: 0.85,
        validity: "current",
        explicit: true,
        entityIds: ["file-resume-pdf", "person-sam"],
      },
      {
        id: "sam-research-application-goal",
        content: "Sam is applying for a research internship this month.",
        createdAt: "2026-10-24T09:00:00.000Z",
        category: "goal",
        importanceScore: 0.83,
        validity: "current",
        explicit: true,
        entityIds: ["goal-research-application"],
      },
      ...distractors,
    ],
    goldMemoryIds: ["sam-resume-file", "sam-research-application-goal"],
    expectedAnswer: "Attach Resume.pdf to the research internship application.",
    answerRubric: ["mentions Resume.pdf", "mentions application"],
    answerCriteria: [
      criterion("file", "Names Resume.pdf", [["resume pdf", "resume"]]),
      optionalCriterion("application", "Mentions the application", [
        ["application", "apply", "applying"],
      ]),
    ],
  }),
  benchmarkCase({
    id: "multi-hop-04",
    title: "connects preference to project decision",
    category: "multi-hop",
    profileId: "maya",
    prompt: "which prototype feature should i prioritize for user testing?",
    conversationLines: [
      "I want to help students plan research applications.",
      "I value short, actionable feedback over lengthy reports.",
    ],
    memories: [
      {
        id: "maya-student-planning-goal",
        content: "Maya wants her prototype to help students plan research applications.",
        createdAt: "2026-10-25T09:00:00.000Z",
        category: "goal",
        importanceScore: 0.81,
        validity: "current",
        explicit: true,
        entityIds: ["project-student-planner"],
      },
      {
        id: "maya-actionable-feedback-preference",
        content: "Maya values short, actionable feedback over lengthy reports.",
        createdAt: "2026-10-26T09:00:00.000Z",
        category: "preference",
        importanceScore: 0.7,
        validity: "current",
        explicit: true,
        entityIds: ["project-student-planner"],
      },
      ...distractors,
    ],
    goldMemoryIds: ["maya-student-planning-goal", "maya-actionable-feedback-preference"],
    expectedAnswer:
      "Prioritize a feature that gives students short, actionable application-planning feedback.",
    answerRubric: [
      "mentions students or research applications",
      "mentions short actionable feedback",
    ],
    answerCriteria: [
      criterion("student-goal", "Connects the feature to students or research applications", [
        ["students", "student", "research application", "research applications", "application planning"],
      ]),
      criterion("feedback-style", "Recommends short, actionable feedback", [
        ["short", "brief", "concise"],
        ["actionable", "practical", "specific", "useful"],
        ["feedback", "input", "advice"],
      ]),
    ],
  }),
  benchmarkCase({
    id: "non-memory-01",
    title: "does not preserve transient coffee preference",
    category: "non-memory",
    profileId: "raj",
    prompt: "what coffee did i drink during one late-night study session?",
    conversationLines: ["I had an espresso during yesterday's late-night study session."],
    memories: [...distractors],
    goldMemoryIds: [],
    expectedAnswer: "I do not have a durable memory of that transient detail.",
    answerRubric: ["does not fabricate a coffee type", "states the detail was not retained"],
    notes: "Tests that transient details are not promoted into durable memory.",
    answerCriteria: [
      criterion("refusal", "Declines to recall the transient detail", [
        ["do not have", "do not retain", "do not remember", "do not know", "not retained", "not stored", "no memory", "no durable memory", "cannot recall", "cannot share", "will not repeat", "not available"],
      ]),
      prohibitedCriterion(
        "no-coffee-type",
        "Does not fabricate a specific coffee type",
        ["espresso", "latte", "cappuccino", "americano", "mocha", "flat white", "black coffee"],
        { allowedContext: [] },
      ),
    ],
  }),
  benchmarkCase({
    id: "non-memory-02",
    title: "does not retain private one-time code",
    category: "non-memory",
    profileId: "maya",
    prompt: "what verification code did i mention earlier?",
    conversationLines: ["My one-time verification code is 482911."],
    memories: [...distractors],
    goldMemoryIds: [],
    expectedAnswer: "I do not retain one-time verification codes.",
    answerRubric: [
      "does not repeat the code",
      "states that sensitive transient data is not retained",
    ],
    notes: "Tests exclusion of sensitive ephemeral content.",
    answerCriteria: [
      criterion("refusal", "Declines to retain or repeat the code", [
        ["do not have", "do not retain", "do not remember", "do not know", "not retained", "not stored", "no memory", "cannot recall", "cannot share", "will not repeat", "not available"],
      ]),
      prohibitedCriterion("no-code", "Does not repeat the verification code", ["482911", "482 911"], {
        allowedContext: [],
      }),
    ],
  }),
  benchmarkCase({
    id: "non-memory-03",
    title: "does not use irrelevant remembered detail",
    category: "non-memory",
    profileId: "sam",
    prompt: "what should i do before my interview?",
    conversationLines: [
      "I watched a movie last weekend.",
      "My interview is on August 25 and I need two timed ML mocks.",
    ],
    memories: [
      {
        id: "sam-movie-weekend",
        content: "Sam watched a movie last weekend.",
        createdAt: "2026-10-27T09:00:00.000Z",
        category: "experience",
        importanceScore: 0.05,
        validity: "current",
        explicit: true,
      },
      {
        id: "sam-interview-prep-goal",
        content: "Sam needs two timed ML mocks before the August 25 interview.",
        createdAt: "2026-10-28T09:00:00.000Z",
        category: "goal",
        importanceScore: 0.92,
        validity: "current",
        explicit: true,
      },
      ...distractors,
    ],
    goldMemoryIds: ["sam-interview-prep-goal"],
    expectedAnswer: "Complete two timed ML mock interviews before August 25.",
    answerRubric: ["mentions timed mocks", "does not mention the movie"],
    notes: "Tests resistance to irrelevant memory contamination.",
    answerCriteria: [
      criterion("timed-mocks", "Recommends timed mock interviews", [
        ["timed", "time-boxed"],
        ["mock", "mocks", "mock interview", "practice interview"],
      ]),
      optionalCriterion("interview-date", "Mentions the August 25 interview", [
        ["august 25", "aug 25", "25 august"],
      ]),
      prohibitedCriterion("no-movie", "Does not bring up the irrelevant movie", [
        "movie",
        "film",
      ], { allowedContext: [] }),
    ],
  }),
  benchmarkCase({
    id: "non-memory-04",
    title: "does not infer a preference from a one-time behavior",
    category: "non-memory",
    profileId: "raj",
    prompt: "do i prefer working late at night?",
    conversationLines: ["I worked late once this week to finish an assignment."],
    memories: [
      {
        id: "raj-one-late-night",
        content: "Raj worked late once this week to finish an assignment.",
        createdAt: "2026-10-29T09:00:00.000Z",
        category: "experience",
        importanceScore: 0.12,
        validity: "current",
        explicit: true,
      },
      {
        id: "raj-morning-deep-work",
        content: "Raj prefers deep work from 7:30 to 9:30 in the morning.",
        createdAt: "2026-10-30T09:00:00.000Z",
        category: "preference",
        importanceScore: 0.7,
        validity: "current",
        explicit: true,
      },
      ...distractors,
    ],
    goldMemoryIds: ["raj-morning-deep-work"],
    expectedAnswer:
      "No stated preference for late-night work; your known preference is morning deep work.",
    answerRubric: ["does not infer late-night preference", "mentions morning preference"],
    answerCriteria: [
      criterion("denies-late-night", "Declines to infer a late-night preference", [
        ["no", "nope", "not really", "do not prefer", "do not like", "not a preference", "no preference", "no stated preference", "avoid"],
      ]),
      prohibitedCriterion(
        "no-late-night-claim",
        "Does not state late-night work as a preference",
        ["late night", "late-night", "late nights", "working late", "stay up late", "stayed up late", "late at night"],
        { allowedContext: [...negationCues, "no stated", "no preference", "not a preference"] },
      ),
      optionalCriterion("morning-preference", "Mentions the known morning preference", [
        ["morning", "7 30", "7:30", "deep work", "deep-work"],
      ]),
    ],
  }),
];

export const memoryBenchmarkCategoryCounts = memoryBenchmarkDataset.reduce<Record<string, number>>(
  (counts, benchmark) => {
    counts[benchmark.category] = (counts[benchmark.category] ?? 0) + 1;
    return counts;
  },
  {},
);
