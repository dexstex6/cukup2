export type PersonaType = 'Uni Student' | 'Fresh Grad' | 'Working Parent' | 'Retired Senior';

export interface Stats {
  energy: number;
  health: number;
  wealth: number;
  stress: number;
  hunger: number;
  social: number;
  academics?: number;
  upskilling?: number;
  stability?: number;
  medicalSecurity?: number;
  creditScore?: number;
}

export interface Buff {
  type: 'Resilient' | 'Relaxed' | 'Well-Fed';
  daysRemaining: number;
}

export interface Debuff {
  type: 'Burnout' | 'Exhausted';
  daysRemaining: number;
}

export interface Loan {
  id: string;
  type: 'Micro' | 'PTPTN' | 'Personal' | 'Bank';
  amount: number;
  interestRate: number;
  monthlyInstallment: number;
  monthsRemaining: number;
  missedPayments: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  type: 'Car' | 'House' | 'Asset';
  status: 'Functional' | 'Broken' | 'None';
  maintenanceCost: number;
  lastServiceMonth?: number;
}

export interface GameState {
  persona: PersonaType;
  stats: Stats;
  day: number;
  month: number;
  year: number;
  isGameOver: boolean;
  logs: string[];
  weeklyLogs: string[];
  lastRentDay: number;
  workStreak: number; // For Retired Senior medical emergency
  burnout: boolean;
  weeklyPostMortem: string | null;
  buffs: Buff[];
  debuffs: Debuff[];
  currentHour: number; // 0-23
  consecutiveOTDays: number;
  consecutiveHighStressDays: number;
  consecutiveHungerDays: number;
  lastWorkFinishHour: number | null; // Absolute hour (day * 24 + hour)
  pendingChoiceEvent: ChoiceEvent | null;
  lastWeeklyReportDay: number | null;
  neglectCounters: {
    hunger: number;
    stress: number;
    social: number;
  };
  loans: Loan[];
  inventory: InventoryItem[];
  epfBalance: number;
  childrenCount: number;
  inflationLevel: number;
  hasMonthlyEventTriggered: boolean;
  saveSlot: number;
  gameOverReason?: string;
  pendingPain: {
    type: string;
    dayToStrike: number;
    penalty: number;
    isIgnored: boolean;
  } | null;
}

export interface ChoiceOption {
  label: string;
  impact: Partial<Stats>;
  log: string;
  outcomes?: {
    chance: number;
    impact: Partial<Stats>;
    log: string;
    description: string;
  }[];
}

export interface ChoiceEvent {
  id: string;
  title: string;
  description: string;
  options: ChoiceOption[];
}

export type ActionCategory = 'Work' | 'Eat' | 'Rest' | 'Entertainment' | 'Study' | 'Medical';

export interface ActionDefinition {
  id: string;
  label: string;
  category: ActionCategory;
  cost: number;
  hours: number;
  impact: Partial<Stats>;
  description: string;
  variableTime?: boolean;
  skipsDays?: number;
  buff?: Buff;
}

export const ACTIONS: ActionDefinition[] = [
  // Work
  { id: 'work-normal', label: 'Normal Work', category: 'Work', cost: 0, hours: 8, impact: { stress: 15, energy: -20, hunger: -15, social: -10 }, description: 'A standard day at the office. (8am-8pm)' },
  { id: 'work-ot', label: 'Overtime (OT)', category: 'Work', cost: 0, hours: 11, impact: { stress: 35, energy: -45, hunger: -25, social: -20 }, description: 'Grinding late for that extra RM. High penalty. (8am-8pm)' },
  { id: 'work-freelance', label: 'Freelance Gig', category: 'Work', cost: 0, hours: 4, impact: { stress: 10, energy: -15, hunger: -10, social: -5 }, description: 'Quick side hustle for extra cash.' },
  { id: 'work-high-tier', label: 'Senior Consultant Work', category: 'Work', cost: 0, hours: 8, impact: { stress: 40, energy: -30, hunger: -20, social: -15 }, description: 'High-paying work unlocked by upskilling.' },
  
  // Eat
  { id: 'eat-nasi-lemak', label: 'RM5 Nasi Lemak', category: 'Eat', cost: 5, hours: 1, impact: { health: 5, energy: 10, stress: -2, hunger: 30 }, description: 'Cheap and satisfying.' },
  { id: 'eat-japanese', label: 'RM20 Japanese Lunch', category: 'Eat', cost: 20, hours: 1, impact: { health: 15, energy: 20, stress: -10, hunger: 50 }, description: 'A nice mid-day treat.' },
  { id: 'eat-buffet', label: 'RM50 Buffet', category: 'Eat', cost: 50, hours: 2, impact: { health: 25, energy: 40, stress: -20, hunger: 100 }, description: 'Eat till you drop.' },
  { id: 'eat-fine-dining', label: 'RM500 7-Course Meal', category: 'Eat', cost: 500, hours: 3, impact: { health: 40, energy: 60, stress: -50, hunger: 100, social: 20 }, description: 'The peak of luxury.', buff: { type: 'Well-Fed', daysRemaining: 3 } },

  // Rest
  { id: 'rest-nap', label: 'Power Nap', category: 'Rest', cost: 0, hours: 1, impact: { energy: 15, stress: -5, hunger: -5 }, description: 'A quick 1-hour shut-eye.' },
  { id: 'rest-sleep', label: 'Sleep', category: 'Rest', cost: 0, hours: 8, variableTime: true, impact: { energy: 10, health: 1, stress: -4, hunger: -2 }, description: 'Restorative rest. Ideal: 8 hours.' },

  // Entertainment
  { id: 'ent-youtube', label: 'Watch YouTube', category: 'Entertainment', cost: 0, hours: 1, impact: { stress: -10, hunger: -5, social: -2, health: -1 }, description: 'Mindless scrolling. Reduces health by 1.' },
  { id: 'ent-movie', label: 'Watch a Movie', category: 'Entertainment', cost: 25, hours: 3, impact: { stress: -25, hunger: -10, social: 5 }, description: 'Cinema experience.' },
  { id: 'ent-go-out', label: 'Going Out', category: 'Entertainment', cost: 150, hours: 4, impact: { stress: -45, energy: -10, hunger: -15, social: 40 }, description: 'Night out with friends.' },
  { id: 'ent-call-family', label: 'Call Family', category: 'Entertainment', cost: 0, hours: 1, impact: { stress: -10, social: 15 }, description: 'Checking in with loved ones.' },
  { id: 'ent-coffee', label: 'Coffee with Friend', category: 'Entertainment', cost: 15, hours: 2, impact: { stress: -15, energy: 10, social: 20 }, description: 'Quick catch up.' },
  { id: 'ent-trip', label: 'Taking a Trip', category: 'Entertainment', cost: 1500, hours: 84, impact: { stress: -100, energy: 50, hunger: 20, social: 50 }, description: 'A much-needed vacation. (84 hours)', buff: { type: 'Relaxed', daysRemaining: 4 } },

  // Study
  { id: 'study', label: 'Study', category: 'Study', cost: 0, hours: 4, variableTime: true, impact: { energy: -5, stress: 3, hunger: -4, academics: 3 }, description: 'Hitting the books.' },
  { id: 'study-group', label: 'Study Group', category: 'Study', cost: 10, hours: 3, impact: { energy: -15, stress: 5, hunger: -10, academics: 10, social: 15 }, description: 'Learning with friends.' },
  
  // Medical
  { id: 'med-clinic', label: 'Klinik Kesihatan', category: 'Medical', cost: 1, hours: 4, impact: { health: 10, stress: 5, energy: -10 }, description: 'Affordable government clinic. Long wait time.' },
  { id: 'med-private', label: 'Private Specialist', category: 'Medical', cost: 250, hours: 1, impact: { health: 30, stress: -10, energy: -5 }, description: 'Fast and efficient medical care.' },
  { id: 'med-supplements', label: 'Vitamins & Herbs', category: 'Medical', cost: 80, hours: 0, impact: { health: 5, energy: 10 }, description: 'Daily health boost.' },
  { id: 'med-therapy', label: 'Mental Health Therapy', category: 'Medical', cost: 200, hours: 2, impact: { stress: -50, health: 5 }, description: 'Professional counseling.' },

  // Persona Specific Actions
  { id: 'upskill-course', label: 'Online Course', category: 'Study', cost: 200, hours: 4, impact: { energy: -40, stress: 20, upskilling: 25 }, description: 'Investing in your future career.' },
  { id: 'family-time', label: 'Family Quality Time', category: 'Rest', cost: 150, hours: 4, impact: { energy: -30, stress: -25, stability: 30, social: 30 }, description: 'Maintaining household harmony. Costs RM and Energy.' },
  { id: 'medical-checkup', label: 'Medical Checkup', category: 'Medical', cost: 300, hours: 3, impact: { health: 10, medicalSecurity: 20 }, description: 'Preventive healthcare.' },
  { id: 'fin-counseling', label: 'Financial Counseling', category: 'Medical', cost: 200, hours: 2, impact: { stress: 10, creditScore: 40 }, description: 'Professional advice to rebuild your credit score.' },
  { id: 'household-repair', label: 'Home Maintenance', category: 'Rest', cost: 500, hours: 6, impact: { energy: -40, stability: 50 }, description: 'Fixing things around the house to improve stability.' }
];

export interface Event {
  title: string;
  description: string;
  impact: Partial<Stats>;
}

export const PERSONA_CONFIGS: Record<PersonaType, {
  initialStats: Stats;
  workIncome: number;
  workStress: number;
  workEnergy: number;
  rentCost: number;
  description: string;
  loanPackages: {
    id: string;
    name: string;
    amount: number;
    interestRate: number; // Monthly interest rate
    creditPenalty: number;
  }[];
}> = {
  'Uni Student': {
    initialStats: { energy: 100, health: 100, wealth: 500, stress: 0, hunger: 100, social: 70, academics: 30, creditScore: 450 },
    workIncome: 50, // PTPTN
    workStress: 15,
    workEnergy: 20,
    rentCost: 200,
    description: "High stress ceiling, low income. Energy drains faster from study. Maintain academics above 0.",
    loanPackages: [
      { id: 'uni-small', name: 'Micro Study Loan', amount: 100, interestRate: 0.15, creditPenalty: 40 },
      { id: 'uni-med', name: 'Student Advance', amount: 300, interestRate: 0.12, creditPenalty: 60 },
      { id: 'uni-large', name: 'Emergency Semester Fund', amount: 800, interestRate: 0.10, creditPenalty: 100 },
    ]
  },
  'Fresh Grad': {
    initialStats: { energy: 100, health: 100, wealth: 1500, stress: 0, hunger: 100, social: 80, academics: 0, upskilling: 0, creditScore: 650 },
    workIncome: 150,
    workStress: 20,
    workEnergy: 25,
    rentCost: 800,
    description: "Moderate income. Career Upskilling unlocks better pay but increases stress.",
    loanPackages: [
      { id: 'grad-small', name: 'Micro Credit', amount: 200, interestRate: 0.08, creditPenalty: 30 },
      { id: 'grad-med', name: 'Career Advance', amount: 500, interestRate: 0.07, creditPenalty: 50 },
      { id: 'grad-large', name: 'Personal Booster', amount: 1500, interestRate: 0.06, creditPenalty: 80 },
    ]
  },
  'Working Parent': {
    initialStats: { energy: 100, health: 100, wealth: 3000, stress: 0, hunger: 100, social: 60, academics: 0, stability: 100, creditScore: 750 },
    workIncome: 300,
    workStress: 30,
    workEnergy: 35,
    rentCost: 1500,
    description: "Highest income. Household Stability requires RM and Energy to maintain.",
    loanPackages: [
      { id: 'parent-small', name: 'Family Buffer', amount: 500, interestRate: 0.05, creditPenalty: 20 },
      { id: 'parent-med', name: 'Quick Cash Flow', amount: 1500, interestRate: 0.04, creditPenalty: 40 },
      { id: 'parent-large', name: 'Education Fund Loan', amount: 3000, interestRate: 0.03, creditPenalty: 70 },
    ]
  },
  'Retired Senior': {
    initialStats: { energy: 80, health: 100, wealth: 5000, stress: 0, hunger: 100, social: 50, academics: 0, medicalSecurity: 50, creditScore: 800 },
    workIncome: 100,
    workStress: 10,
    workEnergy: 30,
    rentCost: 300,
    description: "Lives from pension. Medical Security reduces the cost of health emergencies.",
    loanPackages: [
      { id: 'senior-small', name: 'Medical Buffer', amount: 300, interestRate: 0.04, creditPenalty: 15 },
      { id: 'senior-med', name: 'Senior Advance', amount: 800, interestRate: 0.03, creditPenalty: 30 },
      { id: 'senior-large', name: 'Trustee Loan', amount: 2000, interestRate: 0.02, creditPenalty: 50 },
    ]
  }
};
