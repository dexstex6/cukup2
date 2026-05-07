import React, { useState, useEffect, useCallback, useRef } from 'react';
import { auth, db, signIn, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, deleteDoc, collection, query, orderBy, limit, getDocs, addDoc, serverTimestamp, getDocFromServer } from 'firebase/firestore';
import { GameState, PersonaType, PERSONA_CONFIGS, Stats, ACTIONS, ActionDefinition, ActionCategory, Buff, ChoiceEvent } from './types';
import { PersonaSelection } from './components/PersonaSelection';
import { StatBar } from './components/StatBar';
import { GameLog } from './components/GameLog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { Zap, Heart, Wallet, Brain, Sun, Moon, LogOut, Trophy, Coffee, Utensils, Plane, FastForward, Home, ChevronDown, ChevronLeft, ChevronRight, Pause, Play, Pizza, GraduationCap, AlertTriangle, Loader2 } from 'lucide-react';
import { generateEmergency, generatePostMortem, generateWeeklyPostMortem } from './services/geminiService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Markdown from 'react-markdown';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useStatusManager } from './hooks/useStatusManager';
import { useFinanceCenter } from './hooks/useFinanceCenter';

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) errorMessage = `Firestore Error: ${parsed.error} (${parsed.operationType})`;
      } catch {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="h-screen flex flex-col items-center justify-center bg-[#141414] text-[#E4E3E0] p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-2 uppercase tracking-tight">Application Error</h1>
          <p className="text-sm opacity-70 mb-6 max-w-md">{errorMessage}</p>
          <Button onClick={() => window.location.reload()} variant="outline" className="rounded-none border-white/20 hover:bg-white/10">
            Reload Application
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

const DAY_DURATION = 120000; // 2 minutes
const RENT_INTERVAL = 7;
const MAX_DAYS = 28;

export default function App() {
  return (
    <GameContent />
  );
}

function GameContent() {
  const [user, setUser] = useState<User | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const hasSubmittedLeaderboard = useRef(false);
  const [isPaused, setIsPaused] = useState(false);
  const [postMortem, setPostMortem] = useState<string | null>(null);
  const [isGeneratingPostMortem, setIsGeneratingPostMortem] = useState(false);
  const [showProbationDialog, setShowProbationDialog] = useState(false);
  const [pendingVariableAction, setPendingVariableAction] = useState<{ action: ActionDefinition, hours: number } | null>(null);
  const [showVariableTimeDialog, setShowVariableTimeDialog] = useState(false);
  const [showLoanDialog, setShowLoanDialog] = useState(false);
  const [loanIdx, setLoanIdx] = useState(0);
  const [showDaySummary, setShowDaySummary] = useState(false);
  const [daySummaryData, setDaySummaryData] = useState<any>(null);
  const [showSeniorPainDialog, setShowSeniorPainDialog] = useState(false);
  const [seniorPainType, setSeniorPainType] = useState<string>("");

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSlotsLoading, setIsSlotsLoading] = useState(true);
  const [saveSlots, setSaveSlots] = useState<Record<string, GameState>>({});

  useEffect(() => {
    if (user) {
      setIsSlotsLoading(true);
      const q = query(collection(db, 'users', user.uid, 'slots'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const slots: Record<string, GameState> = {};
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          // Sanitize loaded data to ensure all arrays and objects exist
          slots[doc.id] = {
            ...data,
            logs: data.logs || [],
            weeklyLogs: data.weeklyLogs || [],
            buffs: data.buffs || [],
            debuffs: data.debuffs || [],
            neglectCounters: data.neglectCounters || { hunger: 0, stress: 0, social: 0 },
            loans: data.loans || [],
            inventory: data.inventory || [],
            weeklyPostMortem: data.weeklyPostMortem || null,
            lastWeeklyReportDay: data.lastWeeklyReportDay || null,
            pendingChoiceEvent: data.pendingChoiceEvent || null,
            lastWorkFinishHour: data.lastWorkFinishHour || null,
            currentHour: data.currentHour ?? 8,
            workStreak: data.workStreak ?? 0,
            consecutiveOTDays: data.consecutiveOTDays ?? 0,
            consecutiveHighStressDays: data.consecutiveHighStressDays ?? 0,
            consecutiveHungerDays: data.consecutiveHungerDays ?? 0,
            epfBalance: data.epfBalance ?? 0,
            childrenCount: data.childrenCount ?? 0,
            inflationLevel: data.inflationLevel ?? 1.0,
            hasMonthlyEventTriggered: data.hasMonthlyEventTriggered ?? false,
            pendingPain: data.pendingPain || null,
          } as GameState;
        });
        setSaveSlots(slots);
        setIsSlotsLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'slots');
        setIsSlotsLoading(false);
      });
      return unsubscribe;
    }
  }, [user]);

  const [showMedicalEmergency, setShowMedicalEmergency] = useState(false);

  // Hooks
  useStatusManager(gameState, setGameState);
  const { applyMonthlyFinance } = useFinanceCenter(gameState, setGameState);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, 'leaderboard'), orderBy('score', 'desc'), limit(10));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setLeaderboard(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'leaderboard');
      });
      return unsubscribe;
    }
  }, [user]);

  const saveProgress = useCallback(async (state: GameState) => {
    if (!user) return;
    const slotId = `${state.persona.toLowerCase().replace(' ', '-')}-${state.saveSlot}`;
    const path = `users/${user.uid}/slots/${slotId}`;
    
    // Sanitize state to remove undefined values which Firestore rejects
    const sanitizedState = JSON.parse(JSON.stringify(state));
    
    try {
      await setDoc(doc(db, 'users', user.uid, 'slots', slotId), {
        ...sanitizedState,
        uid: user.uid,
        lastUpdated: serverTimestamp(),
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  }, [user]);

  const handleGameOver = useCallback(async (state: GameState, isGraduation = false) => {
    if (!user || hasSubmittedLeaderboard.current) return;
    hasSubmittedLeaderboard.current = true;
    setIsGeneratingPostMortem(true);
    setIsPaused(true);
    const path = 'leaderboard';
    try {
      const pm = await generatePostMortem(state.persona, state.stats, state.day, state.logs);
      setPostMortem(pm);
      
      await addDoc(collection(db, 'leaderboard'), {
        uid: user.uid,
        displayName: user.displayName || 'Anonymous',
        score: state.day * 100 + state.stats.wealth + (state.stats.academics || 0) * 10,
        persona: state.persona,
        daysSurvived: state.day,
        isGraduated: isGraduation,
        gameOverReason: state.gameOverReason || (isGraduation ? "Graduated successfully!" : "Completed journey."),
        timestamp: serverTimestamp(),
      });

      // Reset the slot in Firestore so it's fresh for next time
      const slotId = `${state.persona.toLowerCase().replace(' ', '-')}-${state.saveSlot}`;
      await setDoc(doc(db, 'users', user.uid, 'slots', slotId), {
        uid: user.uid,
        persona: state.persona,
        saveSlot: state.saveSlot,
        isGameOver: true, // Mark as game over so the UI knows to offer a fresh start
        lastUpdated: serverTimestamp(),
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    } finally {
      setIsGeneratingPostMortem(false);
    }
  }, [user]);

  const handleDeleteLeaderboardEntry = async (entryId: string) => {
    if (!user || user.email !== 'lohdexstex22@gmail.com') return;
    try {
      await deleteDoc(doc(db, 'leaderboard', entryId));
      toast.success("Entry deleted successfully");
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `leaderboard/${entryId}`);
    }
  };

  useEffect(() => {
    if (!gameState || gameState.isGameOver || isPaused || !!gameState.weeklyPostMortem || isGeneratingPostMortem || !!gameState.pendingChoiceEvent) return;

    const timer = setInterval(() => {
      // Time now progresses through actions, but we can have a slow passive energy drain
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused, !!gameState, gameState?.isGameOver, !!gameState?.weeklyPostMortem, isGeneratingPostMortem, !!gameState?.pendingChoiceEvent]);

  const triggerDayTransition = (curr: GameState) => {
    let nextDay = curr.day + 1;
    let nextMonth = curr.month;
    let nextYear = curr.year;
    let hasMonthlyEventTriggered = curr.hasMonthlyEventTriggered;
    let isGameOver = curr.isGameOver;
    let gameOverReason = curr.gameOverReason;

    let newStats = { ...curr.stats };
    let newLogs = [...curr.logs];
    let newWeeklyLogs = [...curr.weeklyLogs];

    const pushLog = (msg: string) => {
      newLogs = [...newLogs, msg].slice(-50);
    };

    if (nextDay > 28) {
      nextDay = 28; // Keep it at 28 for the final summary if needed, but we'll trigger game over
      isGameOver = true;
      if (curr.persona === 'Uni Student') {
        gameOverReason = "Graduated successfully!";
      } else {
        gameOverReason = "Completed your journey successfully!";
      }
    }

    if (nextDay === 1 && curr.day === 28 && !isGameOver) {
      nextMonth += 1;
      hasMonthlyEventTriggered = false; // Reset for new month
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }
      // Apply monthly finance
      setTimeout(() => applyMonthlyFinance(), 0);
    }
    
    let newBuffs = curr.buffs.map(b => ({ ...b, daysRemaining: b.daysRemaining - 1 })).filter(b => b.daysRemaining > 0);
    let newDebuffs = curr.debuffs.map(d => ({ ...d, daysRemaining: d.daysRemaining - 1 })).filter(d => d.daysRemaining > 0);
    
    // Rent deduction (now monthly)
    if (nextDay === 1 && curr.day === 28) {
      const config = PERSONA_CONFIGS[curr.persona];
      let rent = config.rentCost * curr.inflationLevel;
      
      // Working Parent Childcare costs
      if (curr.persona === 'Working Parent') {
        const childcareCost = curr.childrenCount * 800;
        rent += childcareCost;
        newLogs.push(`Monthly Childcare: RM${childcareCost} for ${curr.childrenCount} children.`);
      }

      newStats.wealth -= rent;
      newLogs.push(`Month ${nextMonth}, Year ${nextYear}: Rent & Fixed Costs deducted (RM${rent.toFixed(2)})`);
      toast.info(`Monthly Costs: RM${rent.toFixed(2)}`);
    }

    // Buff impacts
    const isRelaxed = newBuffs.some(b => b.type === 'Relaxed');
    const isWellFed = newBuffs.some(b => b.type === 'Well-Fed');
    
    // Natural decay
    newStats.energy = Math.max(0, newStats.energy - 5);
    
    // Loan Repayment Logic (Every 7 days)
    let updatedLoans = [...curr.loans];
    if (nextDay % 7 === 0 && updatedLoans.length > 0) {
      let totalRepayment = 0;
      updatedLoans = updatedLoans.map(loan => {
        if (loan.monthsRemaining > 0) {
          if (newStats.wealth >= loan.monthlyInstallment) {
            newStats.wealth -= loan.monthlyInstallment;
            totalRepayment += loan.monthlyInstallment;
            return { ...loan, monthsRemaining: loan.monthsRemaining - 1 };
          } else {
            // Missed payment
            newStats.creditScore = Math.max(300, (newStats.creditScore || 700) - 30);
            pushLog(`Day ${nextDay}: Missed payment for ${loan.type} loan! Credit score penalized.`);
            return { ...loan, missedPayments: loan.missedPayments + 1 };
          }
        }
        return loan;
      }).filter(loan => loan.monthsRemaining > 0);
      
      if (totalRepayment > 0) {
        pushLog(`Day ${nextDay}: Paid RM${totalRepayment.toFixed(2)} in loan repayments.`);
      }
    }

    // Stress Multiplier for Loans
    if (updatedLoans.length > 0) {
      const loanStress = updatedLoans.length * 5;
      newStats.stress = Math.min(100, newStats.stress + loanStress);
      pushLog(`Day ${nextDay}: Financial pressure from ${updatedLoans.length} active loans increases stress.`);
    }

    // Bankruptcy Check
    if (updatedLoans.length > 3 || newStats.wealth < -5000 || (newStats.creditScore || 700) < 300) {
      pushLog(`Day ${nextDay}: BANKRUPTCY! You cannot sustain your debts. Game Over.`);
      isGameOver = true;
      gameOverReason = "Bankrupt: Excessive debt and poor credit.";
    }
    
    // Compounding Neglect Logic
    const nextNeglect = { ...curr.neglectCounters };
    
    // Stress Neglect (Burnout risk)
    if (newStats.stress > 90) {
      nextNeglect.stress += 1;
      const stressPenalty = Math.floor(5 * (1 + nextNeglect.stress * 0.5));
      newStats.health = Math.max(0, newStats.health - stressPenalty);
      pushLog(`Day ${nextDay}: Critical stress! Health penalty compounded: -${stressPenalty}`);
    } else {
      nextNeglect.stress = 0;
    }

    const stressIncreaseBase = newDebuffs.some(d => d.type === 'Burnout') ? 8 : 4;
    const seniorMultiplier = curr.persona === 'Retired Senior' ? 2 : 1;
    const stressIncrease = stressIncreaseBase * seniorMultiplier;
    newStats.stress = Math.min(100, newStats.stress + (isRelaxed ? Math.floor(stressIncrease / 2) : stressIncrease));
    
    // Senior Health Penalties
    let nextPendingPain = curr.pendingPain;
    if (curr.persona === 'Retired Senior') {
      // Strike logic for ignored pain
      if (nextPendingPain && nextPendingPain.isIgnored && nextDay >= nextPendingPain.dayToStrike) {
        const penalty = nextPendingPain.penalty * 2;
        newStats.health = Math.max(0, newStats.health - penalty);
        newStats.stress = Math.min(100, newStats.stress + 20);
        pushLog(`Day ${nextDay}: The ignored ${nextPendingPain.type} has returned with a vengeance! Health -${penalty}, Stress +20`);
        nextPendingPain = null;
      }
      
      // Trigger new random pain every 4 days
      if (!nextPendingPain && nextDay % 4 === 0 && Math.random() > 0.2) {
        const pains = ['Back Ache', 'Knee Pain', 'Joint Stiffness', 'Shoulder Pain'];
        const type = pains[Math.floor(Math.random() * pains.length)];
        setTimeout(() => {
          setSeniorPainType(type);
          setShowSeniorPainDialog(true);
        }, 500);
      }
    }

    // Social decay
    newStats.social = Math.max(0, newStats.social - 10);
    if (newStats.social < 20) {
      nextNeglect.social += 1;
      const socialStressPenalty = Math.floor(10 * (1 + nextNeglect.social * 0.3));
      newStats.stress = Math.min(100, newStats.stress + socialStressPenalty);
      pushLog(`Day ${nextDay}: Feeling isolated. Stress penalty compounded: +${socialStressPenalty}`);
    } else {
      nextNeglect.social = 0;
    }

    // Hunger decay
    const hungerDecay = (isWellFed ? 5 : 15) * curr.inflationLevel;
    newStats.hunger = Math.max(0, newStats.hunger - hungerDecay);
    let nextConsecutiveHunger = curr.consecutiveHungerDays;
    if (newStats.hunger < 10) {
      nextNeglect.hunger += 1;
      nextConsecutiveHunger += 1;
      const hungerHealthPenalty = Math.floor(10 * (1 + nextNeglect.hunger * 0.5));
      newStats.health = Math.max(0, newStats.health - hungerHealthPenalty);
      pushLog(`Day ${nextDay}: Starving! Health penalty compounded: -${hungerHealthPenalty}`);
      toast.error("Starving!", { description: `Health penalty compounded: -${hungerHealthPenalty}` });
      
      if (nextConsecutiveHunger >= 3) {
        pushLog(`Day ${nextDay}: You have died of hunger after 3 consecutive days of starvation.`);
        isGameOver = true;
        gameOverReason = "Died of hunger: 3 consecutive days of starvation.";
      }
    } else {
      nextNeglect.hunger = 0;
      nextConsecutiveHunger = 0;
    }

    // Academics decay for students
    if (curr.persona === 'Uni Student' && newStats.academics !== undefined) {
      newStats.academics = Math.max(0, newStats.academics - 3);
    }

    // Stability decay for working parents
    if (curr.persona === 'Working Parent' && newStats.stability !== undefined) {
      const childStress = curr.childrenCount * 5;
      newStats.stability = Math.max(0, newStats.stability - (10 + childStress));
      newStats.stress = Math.min(100, newStats.stress + childStress);
    }

    // Pension for Retired Senior (Daily passive income)
    if (curr.persona === 'Retired Senior') {
      const pension = PERSONA_CONFIGS['Retired Senior'].workIncome;
      newStats.wealth += pension;
      pushLog(`Day ${nextDay}: Received daily pension: RM${pension}`);
    }

    const burnout = newDebuffs.some(d => d.type === 'Burnout');

    const summary = {
      day: curr.day,
      statsBefore: curr.stats,
      statsAfter: newStats,
      logs: newLogs.filter(l => l.startsWith(`Day ${nextDay}:`))
    };
    
    if (!isGameOver) {
      setDaySummaryData(summary);
      setShowDaySummary(true);
    }

    return { 
      ...curr, 
      day: nextDay, 
      month: nextMonth, 
      year: nextYear, 
      stats: newStats, 
      logs: newLogs, 
      weeklyLogs: newWeeklyLogs, 
      buffs: newBuffs, 
      debuffs: newDebuffs, 
      burnout, 
      neglectCounters: nextNeglect,
      consecutiveHungerDays: nextConsecutiveHunger,
      hasMonthlyEventTriggered,
      loans: updatedLoans,
      isGameOver,
      gameOverReason
    };
  };

  // Handle side effects of day transition
  useEffect(() => {
    if (!gameState) return;
    
    // Weekly Post-Mortem
    if (!gameState.isGameOver && gameState.day > 1 && gameState.day % 7 === 0 && gameState.day !== gameState.lastWeeklyReportDay && !gameState.weeklyPostMortem && gameState.weeklyLogs.length > 0 && !isGeneratingPostMortem) {
      const week = gameState.day / 7;
      setIsGeneratingPostMortem(true);
      generateWeeklyPostMortem(gameState.persona, gameState.stats, week, gameState.weeklyLogs).then(pm => {
        setGameState(s => s ? { ...s, weeklyPostMortem: pm, weeklyLogs: [], lastWeeklyReportDay: gameState.day } : null);
        setIsGeneratingPostMortem(false);
      }).catch(() => {
        setIsGeneratingPostMortem(false);
      });
    }

    // Game Over check
    if (gameState.isGameOver && !postMortem && !isGeneratingPostMortem) {
      handleGameOver(gameState, gameState.day >= MAX_DAYS);
    }

    if (!gameState.isGameOver) {
      if (gameState.day >= MAX_DAYS) { 
        // This case is handled in triggerDayTransition, but for safety:
        const reason = gameState.persona === 'Uni Student' ? "Graduated successfully!" : "Completed your journey successfully!";
        const nextState = { ...gameState, isGameOver: true, gameOverReason: reason };
        setGameState(nextState);
      } else if (gameState.stats.health <= 0) {
        const reason = gameState.persona === 'Retired Senior' ? "Died due to sickness." : "Died due to poor health.";
        const nextState = { ...gameState, isGameOver: true, gameOverReason: reason };
        setGameState(nextState);
      } else if (gameState.stats.wealth <= -5000) {
        const nextState = { ...gameState, isGameOver: true, gameOverReason: "Bankrupt: Critical financial failure." };
        setGameState(nextState);
      } else if (gameState.stats.health < 20 && !showMedicalEmergency) {
        setShowMedicalEmergency(true);
      }
    }

    // Progress saving (debounced)
    const timeoutId = setTimeout(() => {
      saveProgress(gameState);
    }, 2000); // Save every 2 seconds of inactivity or after change
    
    return () => clearTimeout(timeoutId);
  }, [gameState?.day, gameState?.isGameOver, gameState?.stats?.health, gameState?.stats?.wealth, saveProgress, postMortem, isGeneratingPostMortem]);

  // Emergency Trigger
  useEffect(() => {
    if (!gameStateRef.current || gameStateRef.current.isGameOver || isPaused || !!gameStateRef.current.weeklyPostMortem) return;

    const triggerEmergency = async () => {
      const state = gameStateRef.current;
      if (!state || state.hasMonthlyEventTriggered) return;
      
      // Monthly Event Engine: Weighted probability
      // We trigger it once per month
      if (Math.random() > 0.3) return; // 30% chance each check until it triggers

      // Working Parent Stability Check
      if (state.persona === 'Working Parent' && (state.stats.stability || 0) < 30) {
        const emergency = {
          title: "Family Emergency!",
          description: "Low household stability triggered a crisis at home.",
          impact: { wealth: -800, energy: -30, stress: 40, stability: 20 }
        };
        applyEmergency(emergency);
        return;
      }

      // Car Trap
      const car = state.inventory.find(i => i.type === 'Car');
      if (car && car.status === 'Functional' && Math.random() < 0.1) {
        const emergency = {
          title: "Car Breakdown!",
          description: "Your car broke down in the middle of Federal Highway. Repair costs are steep.",
          impact: { wealth: -800, stress: 20 }
        };
        setGameState(s => s ? {
          ...s,
          inventory: s.inventory.map(i => i.id === car.id ? { ...i, status: 'Broken' } : i)
        } : null);
        applyEmergency(emergency);
        return;
      }

      const currentStats = state.stats;
      const emergency = await generateEmergency(state.persona, currentStats);
      applyEmergency(emergency);
    };

    const applyEmergency = (emergency: any) => {
      setGameState((curr) => {
        if (!curr) return null;
        const newStats = { ...curr.stats };
        
        Object.entries(emergency.impact).forEach(([key, val]) => {
          const k = key as keyof Stats;
          if (typeof newStats[k] === 'number') {
            if (k === 'wealth' && (val as number) < 0 && curr.persona === 'Retired Senior') {
              const securityShield = (newStats.medicalSecurity || 0) / 100;
              const saved = Math.floor(Math.abs(val as number) * securityShield);
              newStats[k] = (newStats[k] as number) + (val as number) + saved;
              toast.info(`Medical Security saved you RM${saved}!`);
            } else {
              newStats[k] = Math.min(100, Math.max(-2000, (newStats[k] as number) + (val as number)));
            }
          }
        });
        
        // Detailed impact logging
        const impacts = Object.entries(emergency.impact)
          .filter(([_, val]) => (val as number) !== 0)
          .map(([key, val]) => {
            const label = key.charAt(0).toUpperCase() + key.slice(1);
            const prefix = (val as number) > 0 ? '+' : '';
            const unit = key === 'wealth' ? 'RM' : '';
            return `${label}: ${unit}${prefix}${val}`;
          })
          .join(', ');
        
        const newLogs = [...curr.logs, `EMERGENCY: ${emergency.title} - ${emergency.description} (${impacts})`].slice(-50);
        toast.error(emergency.title, { description: emergency.description });
        
        return { ...curr, stats: newStats, logs: newLogs, hasMonthlyEventTriggered: true };
      });
    };

    const interval = setInterval(triggerEmergency, 45000 + Math.random() * 30000); // Every 45-75s
    return () => clearInterval(interval);
  }, [isPaused]);

  const startAs = (persona: PersonaType, slot: number = 1) => {
    const slotId = `${persona.toLowerCase().replace(' ', '-')}-${slot}`;
    const savedGame = saveSlots[slotId];
    
    // If there's a saved game and it's NOT game over, load it.
    // If it IS game over, we treat it as a new game.
    if (savedGame && !savedGame.isGameOver) {
      setGameState(savedGame);
      setPostMortem(null);
      return;
    }

    const config = PERSONA_CONFIGS[persona];
    const initialState: GameState = {
      persona,
      stats: { ...config.initialStats },
      day: 1,
      month: 1,
      year: 2024,
      isGameOver: false,
      logs: [`Started life as a ${persona}. Good luck!`],
      weeklyLogs: [],
      lastRentDay: 0,
      workStreak: 0,
      burnout: false,
      weeklyPostMortem: null,
      buffs: [],
      debuffs: [],
      currentHour: 8,
      consecutiveOTDays: 0,
      consecutiveHighStressDays: 0,
      consecutiveHungerDays: 0,
      lastWorkFinishHour: null,
      pendingChoiceEvent: null,
      lastWeeklyReportDay: null,
      neglectCounters: { hunger: 0, stress: 0, social: 0 },
      loans: persona === 'Uni Student' ? [{ id: 'ptptn', type: 'PTPTN', amount: 20000, interestRate: 0.01, monthlyInstallment: 37.5, monthsRemaining: 480, missedPayments: 0 }] : [],
      inventory: (persona === 'Fresh Grad' || persona === 'Working Parent') ? [
        { id: 'car-1', name: 'My Proton', type: 'Car', status: 'Functional', maintenanceCost: 200 }
      ] : [],
      epfBalance: 0,
      childrenCount: persona === 'Working Parent' ? 1 : 0,
      inflationLevel: 1.0,
      hasMonthlyEventTriggered: false,
      saveSlot: slot,
      pendingPain: null,
    };
    setGameState(initialState);
    hasSubmittedLeaderboard.current = false;
    setPostMortem(null);
    setIsGeneratingPostMortem(false);
    // Immediately save the fresh state
    saveProgress(initialState);
  };

  const handleSkipDay = () => {
    if (!gameState || gameState.isGameOver) return;
    setGameState(curr => {
      if (!curr) return null;
      const next = triggerDayTransition({ ...curr, currentHour: 8 });
      return next;
    });
    toast.info("Skipped to next day.");
  };

  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);

  const handleExitToMenu = () => {
    setIsExitDialogOpen(true);
  };

  const confirmExit = () => {
    if (gameState) saveProgress(gameState);
    setGameState(null);
    setIsPaused(false);
    setIsExitDialogOpen(false);
  };

  const [slotToDelete, setSlotToDelete] = useState<string | null>(null);

  const handleDeleteSlot = async (slotId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'slots', slotId));
      toast.success("Slot cleared successfully.");
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `slots/${slotId}`);
    } finally {
      setSlotToDelete(null);
    }
  };

  const handleAction = (action: ActionDefinition, chosenHours?: number) => {
    if (!gameState || gameState.isGameOver) return;

    // Adjust hours for Uni Student work
    let effectiveHours = (gameState.persona === 'Uni Student' && action.category === 'Work') 
      ? (action.id === 'work-normal' ? 3 : (action.id === 'work-ot' ? 6 : action.hours))
      : action.hours;

    if (action.variableTime && chosenHours === undefined) {
      setPendingVariableAction({ action, hours: effectiveHours });
      setShowVariableTimeDialog(true);
      return;
    }

    const hoursToDeduct = chosenHours || effectiveHours;

    if (gameState.stats.wealth < action.cost) {
      toast.warning(`Not enough money! Need RM${action.cost}`);
      return;
    }

    // Logical constraints
    if (action.category === 'Work') {
      if (gameState.currentHour < 8 || gameState.currentHour > 20) {
        toast.warning("Work is only possible between 8am and 8pm.");
        return;
      }
      if (gameState.lastWorkFinishHour !== null) {
        const currentAbsoluteHour = gameState.day * 24 + gameState.currentHour;
        if (currentAbsoluteHour < gameState.lastWorkFinishHour + 8) {
          toast.warning("You need at least 8 hours of rest between work shifts.");
          return;
        }
      }
    }

    setGameState((curr) => {
      if (!curr) return null;

      let burnout = curr.burnout;
      let newBuffs = [...curr.buffs];
      let newDebuffs = [...curr.debuffs];
      let newStats = { ...curr.stats };
      let newLogs = [...curr.logs];
      let newWeeklyLogs = [...curr.weeklyLogs];
      let workStreak = curr.workStreak;

      const pushLog = (msg: string) => {
        newLogs = [...newLogs, msg].slice(-50);
      };

      const applyBuffOrDebuff = (state: any, type: 'buff' | 'debuff', item: any) => {
        let b = [...state.buffs];
        let d = [...state.debuffs];
        if (type === 'buff') {
          if (d.length > 0) {
            d.shift();
            toast.info("Buff cancelled out a Debuff!");
          } else {
            b.push(item);
            toast.success(`Gained Buff: ${item.type}`);
          }
        } else {
          if (b.length > 0) {
            b.shift();
            toast.info("Debuff cancelled out a Buff!");
          } else {
            d.push(item);
            toast.error(`Gained Debuff: ${item.type}`, { description: item.type === 'Burnout' ? "Stress gains are doubled and energy recovery is halved." : "" });
          }
        }
        return { buffs: b, debuffs: d };
      };
      let nextDay = curr.day;
      let currentHour = curr.currentHour + hoursToDeduct;
      let consecutiveOTDays = curr.consecutiveOTDays;
      let lastWorkFinishHour = curr.lastWorkFinishHour;

      const config = PERSONA_CONFIGS[curr.persona];
      const isRelaxed = curr.buffs.some(b => b.type === 'Relaxed');

      // Apply action impacts
      newStats.wealth -= action.cost;
      
      if (action.category === 'Work') {
        lastWorkFinishHour = curr.day * 24 + curr.currentHour + hoursToDeduct;
        // Income logic
        let income = action.id === 'work-ot' ? config.workIncome * 1.5 : config.workIncome;
        if (action.id === 'work-freelance') income = config.workIncome * 0.6;
        if (action.id === 'work-high-tier') income = config.workIncome * 2.5;
        
        // Fresh Grad Upskilling Bonus
        if (curr.persona === 'Fresh Grad' && newStats.upskilling) {
          const bonus = (newStats.upskilling / 100) * income;
          income += bonus;
        }
        
        newStats.wealth += income;
        
        // Stress logic
        let stressInc = action.impact.stress || 0;
        
        // Work penalties increase
        if (action.id === 'work-ot') {
          stressInc += 15; // Extra penalty for OT
          consecutiveOTDays++;
          if (consecutiveOTDays >= 2) {
            stressInc += 20;
            newStats.health -= 10;
            pushLog("Consecutive OT Penalty: High stress and health decline.");
            
            const result = applyBuffOrDebuff({ buffs: newBuffs, debuffs: newDebuffs }, 'debuff', { type: 'Burnout', daysRemaining: 3 });
            newBuffs = result.buffs;
            newDebuffs = result.debuffs;
          }
        } else {
          consecutiveOTDays = 0;
        }

        if (action.id === 'work-high-tier') {
          stressInc += 20; // High tier work is stressful
        }
        
        // Fresh Grad Upskilling Stress Penalty
        if (curr.persona === 'Fresh Grad' && newStats.upskilling) {
          stressInc += (newStats.upskilling / 5); // Increased penalty
        }

        if (newDebuffs.some(d => d.type === 'Burnout')) stressInc *= 2;
        if (newStats.hunger < 20) stressInc *= 2; // Malnutrition penalty
        if (isRelaxed) stressInc = Math.floor(stressInc / 2);
        newStats.stress = Math.min(100, newStats.stress + stressInc);
        
        // Energy logic
        let energyImpact = action.impact.energy || 0;
        if (action.id === 'work-ot') {
          energyImpact -= 20; // Extra penalty for OT
        }
        
        if (newDebuffs.some(d => d.type === 'Burnout') && energyImpact < 0) energyImpact *= 1.5; // Burnout makes energy loss worse
        newStats.energy = Math.max(0, newStats.energy + energyImpact);
        
        // Hunger logic
        newStats.hunger = Math.max(0, newStats.hunger + (action.impact.hunger || 0));
        
        // Social impact
        newStats.social = Math.max(0, newStats.social + (action.impact.social || 0));

        // Income logic (Burnout halves income)
        if (newDebuffs.some(d => d.type === 'Burnout')) income *= 0.5;

        pushLog(`${action.label}: +RM${Math.floor(income)}`);
        newWeeklyLogs.push(`${action.label}: +RM${Math.floor(income)}`);
        workStreak += (action.id === 'work-ot' ? 2 : 1);
      } else {
        // Non-work actions
        let finalImpact = { ...action.impact };
        
        // Handle variable time impacts
        if (action.id === 'rest-sleep') {
          const hours = hoursToDeduct;
          if (hours === 8) {
            finalImpact = { energy: 80, health: 10, stress: -30, hunger: -20 };
          } else if (hours < 8) {
            finalImpact = { energy: hours * 8, health: -5, stress: -10, hunger: -15 };
          } else {
            finalImpact = { energy: 90, health: -5, stress: -20, hunger: -25 };
          }
        } else if (action.id === 'study') {
          const hours = hoursToDeduct;
          finalImpact = { energy: -hours * 5, stress: hours * 4, hunger: -hours * 3, academics: hours * 4 };
        }

        Object.entries(finalImpact).forEach(([key, val]) => {
          const k = key as keyof Stats;
          let impactValue = val as number;

          if (k === 'stress') {
            if (impactValue > 0 && newDebuffs.some(d => d.type === 'Burnout')) impactValue *= 2;
            if (impactValue < 0 && isRelaxed) impactValue *= 2;
          }
          
          if (k === 'energy' && impactValue > 0 && newDebuffs.some(d => d.type === 'Burnout')) {
            impactValue = Math.floor(impactValue / 2);
          }

          newStats[k] = Math.min(100, Math.max(0, (newStats[k] ?? 0) + impactValue));
        });
        
        if (action.cost > 0) {
          pushLog(`${action.label}: -RM${action.cost}`);
          newWeeklyLogs.push(`${action.label}: -RM${action.cost}`);
        } else {
          pushLog(`${action.label} (Free)`);
        }
        
        if (action.category === 'Rest' || action.category === 'Entertainment') {
          workStreak = 0;
        }
      }

      if (action.buff) {
        const result = applyBuffOrDebuff({ buffs: newBuffs, debuffs: newDebuffs }, 'buff', action.buff);
        newBuffs = result.buffs;
        newDebuffs = result.debuffs;
        pushLog(`Gained buff: ${action.buff.type}`);
      }

      // Burnout Logic
      if (workStreak >= 5 && !newDebuffs.some(d => d.type === 'Burnout')) {
        const result = applyBuffOrDebuff({ buffs: newBuffs, debuffs: newDebuffs }, 'debuff', { type: 'Burnout', daysRemaining: 3 });
        newBuffs = result.buffs;
        newDebuffs = result.debuffs;
        newStats.stress = Math.min(100, newStats.stress + 20);
        pushLog("BURNOUT! You've been working too hard. Stress is mounting.");
      } else if (workStreak === 0) {
        newDebuffs = newDebuffs.filter(d => d.type !== 'Burnout');
        if (curr.debuffs.some(d => d.type === 'Burnout') && !newDebuffs.some(d => d.type === 'Burnout')) {
          pushLog("Burnout recovered. Take it easy.");
          toast.success("Recovered", { description: "Burnout recovered. Take it easy." });
        }
      }

      burnout = newDebuffs.some(d => d.type === 'Burnout');

      // Retired Senior Medical Emergency
      if (curr.persona === 'Retired Senior' && workStreak > 2) {
        const securityShield = (newStats.medicalSecurity || 0) / 100;
        const baseCost = 500;
        const finalCost = Math.floor(baseCost * (1 - securityShield));
        
        newStats.health -= 40;
        newStats.wealth -= finalCost;
        pushLog(`MEDICAL EMERGENCY: Back Pain flare-up from overworking! -RM${finalCost}, -Health`);
        toast.error("Medical Emergency!", { description: `Back pain flare-up. Medical Security saved you RM${baseCost - finalCost}.` });
        workStreak = 0;
      }

      // Student Probation & Expulsion
      if (curr.persona === 'Uni Student') {
        if (newStats.academics === 0) {
          pushLog("EXPELLED! Your grades hit zero. Game Over.");
          toast.error("EXPELLED!", { description: "Your grades hit zero. You have been expelled from university." });
          const nextState = { ...curr, day: nextDay, stats: newStats, logs: newLogs, weeklyLogs: newWeeklyLogs, workStreak, burnout, buffs: newBuffs, debuffs: newDebuffs, isGameOver: true, gameOverReason: "Expelled! Your grades hit zero." };
          return nextState;
        } else if (newStats.academics! < 15) {
          setShowProbationDialog(true);
          pushLog("ACADEMIC PROBATION: Your grades are dangerously low!");
        }
      }

      let nextState = { ...curr, day: nextDay, stats: newStats, logs: newLogs, weeklyLogs: newWeeklyLogs, workStreak, burnout, buffs: newBuffs, debuffs: newDebuffs, currentHour, consecutiveOTDays, lastWorkFinishHour };
      
      // Day transition (Loop for multi-day jumps like trips)
      while (nextState.currentHour >= 24) {
        nextState.currentHour -= 24;
        nextState = triggerDayTransition(nextState);
        if (nextState.isGameOver) {
          break;
        }
      }

      // Random Choice Events
      if (Math.random() < 0.2 && !nextState.pendingChoiceEvent) {
        const events: ChoiceEvent[] = [
          {
            id: 'friend-out',
            title: 'Night Out?',
            description: 'Your friends want to go out for Mamak. It will cost RM50.',
            options: [
              { label: 'Go Out (RM50)', impact: { wealth: -50, social: 20, stress: -10 }, log: 'Went out with friends. Had a good time.' },
              { 
                label: 'Stay In', 
                impact: { social: -15, stress: 5 }, 
                log: 'Stayed in.',
                outcomes: [
                  {
                    chance: 0.2,
                    impact: { social: -30, stress: 15 },
                    log: 'FOmo hitting hard. Friends basically stopped inviting you for a while.',
                    description: '20% chance of extreme social withdrawal if you keep staying in'
                  }
                ]
              }
            ]
          },
          {
            id: 'lend-money',
            title: 'Lend Money?',
            description: 'A friend is short on cash and asks for RM200.',
            options: [
              { 
                label: 'Lend RM200', 
                impact: { wealth: -200, social: 30 }, 
                log: 'Lent money to a friend.',
                outcomes: [
                  {
                    chance: 0.3,
                    impact: { wealth: 200, social: 10 },
                    log: 'Friend paid back early with interest!',
                    description: '30% chance of early repayment'
                  }
                ]
              },
              { label: 'Say No', impact: { social: -20 }, log: 'Refused to lend money. Relationship strained.' }
            ]
          },
          {
            id: 'car-service',
            title: 'Car Service Reminder',
            description: 'Your car is due for a service. Ignoring it might lead to a breakdown.',
            options: [
              { label: 'Service Car (RM300)', impact: { wealth: -300, stress: -5 }, log: 'Serviced the car. It runs smoothly now.' },
              { 
                label: 'Ignore', 
                impact: { stress: 10 }, 
                log: 'Ignored the service.',
                outcomes: [
                  { 
                    chance: 0.3, 
                    impact: { wealth: -1200, stress: 45, energy: -20 }, 
                    log: 'CRITICAL BREAKDOWN! Your car stalled in the middle of a busy intersection.',
                    description: '30% chance of a expensive breakdown'
                  },
                  {
                    chance: 0.1,
                    impact: { stress: -5 },
                    log: 'Nothing happened. You saved some money for now.',
                    description: '10% chance of getting away with it'
                  }
                ]
              }
            ]
          }
        ];
        nextState.pendingChoiceEvent = events[Math.floor(Math.random() * events.length)];
      }

      if (newStats.health <= 0 || newStats.wealth <= -1000 || newStats.energy <= 0) {
        if (newStats.energy <= 0) {
          newStats.health -= 10;
          newLogs = [...newLogs, "Exhausted! Health declining."].slice(-50);
        }
        if (newStats.health <= 0 || newStats.wealth <= -1000) {
          nextState.isGameOver = true;
          if (newStats.wealth <= -1000) {
            nextState.gameOverReason = "Bankrupt: Critical financial failure.";
          } else {
            nextState.gameOverReason = curr.persona === 'Retired Senior' ? "Passed away due to critical health." : "Collapsed due to critical health.";
          }
        }
      }
      return nextState;
    });
  };

  const handleSignIn = async () => {
    try {
      await signIn();
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        toast.info("Sign-in cancelled. Please try again when you're ready.");
      } else {
        console.error("Sign-in error:", error);
        toast.error("An error occurred during sign-in. Please try again.");
      }
    }
  };

  if (!isAuthReady) return <div className="h-screen flex items-center justify-center font-mono">Loading Cukup Cukup...</div>;

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background text-foreground p-6 dark">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl font-bold uppercase tracking-tighter mb-4 text-center"
        >
          Cukup Cukup
        </motion.h1>
        <p className="text-sm italic mb-8 opacity-60">Socio-Economic Survival</p>
        <Button onClick={handleSignIn} size="lg" className="rounded-full uppercase tracking-widest text-xs font-bold px-8">
          Sign in with Google to Start
        </Button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <TooltipProvider>
        <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground transition-colors duration-300 dark">
        <Toaster position="top-right" theme="dark" />
        
        {/* Header */}
        <header className="border-b border-border p-4 flex justify-between items-center bg-card/50 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <h1 className="font-bold uppercase tracking-widest text-sm">Cukup Cukup</h1>
            {gameState && (
              <div className="flex gap-2 items-center">
                <Badge variant="outline" className="rounded-full uppercase text-[10px]">
                  {gameState.persona}
                </Badge>
                {gameState.burnout && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="destructive" className="rounded-full uppercase text-[10px] animate-pulse cursor-help flex gap-1 items-center">
                        <AlertTriangle className="h-3 w-3" /> Burnout
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px] p-2">
                      <p className="font-bold uppercase mb-1">Burnout Debuff</p>
                      <ul className="list-disc list-inside opacity-80">
                        <li>Stress gains are doubled</li>
                        <li>Energy recovery is halved</li>
                        <li>Health drops daily</li>
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}
          </div>
        <div className="flex items-center gap-2 md:gap-4">
          {isSlotsLoading && <Loader2 className="h-4 w-4 animate-spin opacity-30" />}
          <span className="text-xs opacity-60 hidden md:inline">{user?.displayName}</span>
          {gameState && (
            <>
              <Button variant="ghost" size="icon" onClick={() => setIsPaused(!isPaused)} title={isPaused ? "Resume" : "Pause"} className="h-8 w-8 rounded-full">
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleExitToMenu} title="Exit to Menu" className="h-8 w-8 rounded-full">
                <Home className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={() => auth.signOut()} title="Logout" className="h-8 w-8 rounded-full">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {isSlotsLoading && !gameState ? (
          <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
            <p className="text-xs uppercase tracking-[0.3em] opacity-30">Synchronizing Life Data...</p>
          </div>
        ) : !gameState ? (
          <div className="space-y-12">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-serif italic">Choose your path</h2>
              <p className="text-sm opacity-60 max-w-md mx-auto">Life in Malaysia is a balance of resilience, grit, and managing your resources. Select a persona and slot to begin.</p>
            </div>
            <PersonaSelection onSelect={startAs} saveSlots={saveSlots} onDelete={(slotId) => setSlotToDelete(slotId)} />
            
            {leaderboard.length > 0 && (
              <div className="mt-16 border-t border-[#141414]/10 pt-12">
                <h3 className="text-center font-bold uppercase tracking-[0.3em] mb-8 flex items-center justify-center gap-2">
                  <Trophy className="h-4 w-4" /> Hall of Resilience
                </h3>
                <div className="max-w-2xl mx-auto space-y-2">
                  {leaderboard.map((entry, i) => (
                    <div key={i} className="group relative flex flex-col p-3 border border-border bg-card rounded-xl gap-2">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-4">
                          <span className="opacity-30 font-mono">#{i+1}</span>
                          <span className="font-bold">{entry.displayName}</span>
                          <Badge variant="secondary" className="text-[9px] h-4 rounded-full">{entry.persona}</Badge>
                        </div>
                        <div className="flex gap-8 font-mono">
                          <span>Day {entry.daysSurvived}</span>
                          <span className="font-bold">RM{entry.score.toFixed(2)}</span>
                        </div>
                      </div>
                      {entry.gameOverReason && (
                        <div className="text-[10px] italic opacity-50 pl-10">
                          "{entry.gameOverReason}"
                        </div>
                      )}
                      {user?.email === 'lohdexstex22@gmail.com' && (
                        <button 
                          onClick={() => handleDeleteLeaderboardEntry(entry.id)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 hover:opacity-100 transition-all p-1 text-destructive hover:bg-destructive/10 rounded"
                          title="Delete Entry"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Stats & Actions */}
            <div className="lg:col-span-8 space-y-8">
              {/* Day & Time Info */}
              <div className="flex flex-col md:flex-row justify-between items-center md:items-end border-b border-[#141414] pb-6 gap-6">
                <div className="w-full flex flex-col items-center md:items-start">
                  <div className="text-[10px] uppercase tracking-[0.3em] opacity-40 mb-2 font-bold">Current Progress</div>
                  <div className="flex flex-col sm:flex-row items-center sm:items-baseline gap-3 sm:gap-5">
                    <div className="text-5xl md:text-6xl font-serif italic tracking-tight">Day {gameState.day}</div>
                    <div className="flex items-center gap-4">
                      <div className="bg-[#141414] text-white px-5 py-2 text-3xl md:text-4xl font-mono font-bold tracking-tighter shadow-2xl border-b-4 border-primary/30 rounded-sm">
                        {String(gameState.currentHour).padStart(2, '0')}:00
                      </div>
                      <div className="text-[10px] font-mono opacity-50 uppercase tracking-[0.1em] leading-tight border-l border-[#141414]/10 pl-4 py-1">
                        {MAX_DAYS - gameState.day} days to<br />
                        <span className="font-bold text-foreground opacity-100">{gameState.persona === 'Uni Student' ? 'graduation' : 'conclusion'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center md:items-end w-full md:w-auto pt-2 md:pt-0">
                    <div className="flex items-center justify-center md:justify-end gap-6 mb-3">
                      <div className="flex flex-col items-center md:items-end">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-60">
                          {(gameState.currentHour >= 6 && gameState.currentHour < 19) ? <Sun className="h-3 w-3 text-orange-500" /> : <Moon className="h-3 w-3 text-blue-400" />}
                          <span>{gameState.currentHour >= 6 && gameState.currentHour < 19 ? "Daytime" : "Nighttime"}</span>
                        </div>
                        <div className="text-[9px] opacity-30 font-mono">Kuala Lumpur, MY</div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleSkipDay}
                        className="h-8 px-3 text-[10px] uppercase tracking-widest rounded-full border-border hover:bg-primary hover:text-primary-foreground transition-all"
                      >
                        <FastForward className="h-3 w-3 mr-1" /> Skip Day
                      </Button>
                    </div>
                    <div className="w-64 h-1.5 bg-muted relative overflow-hidden mb-2 rounded-full">
                      <motion.div 
                        className="absolute inset-y-0 left-0 bg-primary" 
                        initial={{ width: "0%" }}
                        animate={{ width: `${(gameState.currentHour / 24) * 100}%` }}
                        transition={{ type: 'spring', bounce: 0, duration: 0.8 }}
                      />
                    </div>
                    {gameState.currentHour >= 22 && (
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="text-[10px] uppercase tracking-widest p-0 h-auto opacity-60 hover:opacity-100 transition-opacity"
                        onClick={() => handleAction(ACTIONS.find(a => a.id === 'rest-sleep')!, 8)}
                      >
                        <Moon className="h-3 w-3 mr-1" /> End Day & Sleep
                      </Button>
                    )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-card border-border shadow-sm rounded-2xl">
                  <CardContent className="p-6 space-y-6">
                    <StatBar 
                      label="Energy" 
                      value={gameState.stats.energy} 
                      max={100} 
                      color="bg-yellow-400" 
                      icon={<Zap className="h-3 w-3" />} 
                    />
                    <StatBar 
                      label="Health" 
                      value={gameState.stats.health} 
                      max={100} 
                      color="bg-red-500" 
                      icon={<Heart className="h-3 w-3" />} 
                    />
                    <StatBar 
                      label="Hunger" 
                      value={gameState.stats.hunger} 
                      max={100} 
                      color="bg-orange-500" 
                      icon={<Pizza className="h-3 w-3" />} 
                    />
                  </CardContent>
                </Card>
                <Card className="bg-card border-border shadow-sm rounded-2xl">
                  <CardContent className="p-6 space-y-6">
                    <StatBar 
                      label="Wealth" 
                      value={gameState.stats.wealth} 
                      max={5000} 
                      color="bg-green-600" 
                      icon={<Wallet className="h-3 w-3" />} 
                      suffix=" RM"
                    />
                    <StatBar 
                      label="Stress" 
                      value={gameState.stats.stress} 
                      max={100} 
                      color="bg-purple-600" 
                      icon={<Brain className="h-3 w-3" />} 
                    />
                    <StatBar 
                      label="Social Life" 
                      value={gameState.stats.social} 
                      max={100} 
                      color="bg-pink-500" 
                      icon={<Sun className="h-3 w-3" />} 
                    />
                  </CardContent>
                </Card>
                <Card className="bg-card border-border shadow-sm rounded-2xl">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase opacity-60">Credit Score</span>
                      <span className="text-lg font-bold">{gameState.stats.creditScore || 700}</span>
                    </div>
                    {gameState.stats.wealth < 200 && (
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="w-full rounded-full uppercase text-[10px] tracking-widest"
                        onClick={() => setShowLoanDialog(true)}
                      >
                        Apply for Loan
                      </Button>
                    )}
                    {gameState.persona === 'Uni Student' && (
                      <StatBar 
                        label="Academics" 
                        value={gameState.stats.academics || 0} 
                        max={100} 
                        color="bg-blue-600" 
                        icon={<GraduationCap className="h-3 w-3" />} 
                      />
                    )}
                    {gameState.persona === 'Fresh Grad' && (
                      <StatBar 
                        label="Upskilling" 
                        value={gameState.stats.upskilling || 0} 
                        max={100} 
                        color="bg-cyan-600" 
                        icon={<Brain className="h-3 w-3" />} 
                      />
                    )}
                    {gameState.persona === 'Working Parent' && (
                      <div className="space-y-4">
                        <StatBar 
                          label="Stability" 
                          value={gameState.stats.stability || 0} 
                          max={100} 
                          color="bg-emerald-600" 
                          icon={<Home className="h-3 w-3" />} 
                        />
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase opacity-60">Children</span>
                          <span className="text-sm font-bold">{gameState.childrenCount}</span>
                        </div>
                      </div>
                    )}
                    {gameState.persona === 'Retired Senior' && (
                      <StatBar 
                        label="Med. Security" 
                        value={gameState.stats.medicalSecurity || 0} 
                        max={100} 
                        color="bg-rose-600" 
                        icon={<Heart className="h-3 w-3" />} 
                      />
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Actions */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] opacity-50">Available Actions</h3>
                  {(gameState.buffs.length > 0 || gameState.debuffs.length > 0) && (
                    <div className="flex gap-2">
                      {gameState.buffs.map((b, i) => (
                        <Tooltip key={`buff-${i}`}>
                          <TooltipTrigger>
                            <Badge variant="secondary" className="text-[9px] rounded-none uppercase bg-green-100 text-green-800 border-green-200 cursor-help">
                              {b.type} ({b.daysRemaining}d)
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#141414] text-white border-none rounded-none text-[10px] p-2">
                            <p className="font-bold uppercase mb-1">{b.type} Buff</p>
                            <p className="opacity-80">
                              {b.type === 'Relaxed' && "Stress gains are halved."}
                              {b.type === 'Well-Fed' && "Hunger decay is reduced."}
                              {b.type === 'Resilient' && "Health penalties are reduced."}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                      {gameState.debuffs.map((d, i) => (
                        <Tooltip key={`debuff-${i}`}>
                          <TooltipTrigger>
                            <Badge variant="destructive" className="text-[9px] rounded-none uppercase cursor-help">
                              {d.type} ({d.daysRemaining}d)
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#141414] text-white border-none rounded-none text-[10px] p-2">
                            <p className="font-bold uppercase mb-1">{d.type} Debuff</p>
                            <p className="opacity-80">
                              {d.type === 'Burnout' && "Stress gains are doubled and energy recovery is halved."}
                              {d.type === 'Exhausted' && "Energy drains faster."}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {gameState.persona !== 'Retired Senior' && (
                    <div className="w-full">
                      <ActionDropdown 
                        category="Work" 
                        icon={<Wallet className="h-4 w-4" />}
                        actions={ACTIONS.filter(a => {
                          if (a.category !== 'Work') return false;
                          if (a.id === 'work-high-tier' && (gameState.stats.upskilling || 0) < 50) return false;
                          return true;
                        }).map(a => {
                          if (gameState.persona === 'Uni Student') {
                            if (a.id === 'work-normal') {
                              return { ...a, hours: 3, description: 'Standard student job duration. (3 hours)' };
                            }
                            if (a.id === 'work-ot') {
                              return { ...a, hours: 6, description: 'Extended student shift. (6 hours)' };
                            }
                          }
                          return a;
                        })}
                        onSelect={handleAction}
                        gameState={gameState}
                      />
                    </div>
                  )}
                  {ACTIONS.filter(a => {
                    if (a.category !== 'Study') return false;
                    if (gameState.persona === 'Working Parent' || gameState.persona === 'Retired Senior') return false;
                    if (a.id === 'upskill-course' && gameState.persona !== 'Fresh Grad') return false;
                    if ((a.id === 'study' || a.id === 'study-group') && gameState.persona !== 'Uni Student') return false;
                    return true;
                  }).length > 0 && (
                    <div className="w-full">
                      <ActionDropdown 
                        category="Study" 
                        icon={<GraduationCap className="h-4 w-4" />}
                        actions={ACTIONS.filter(a => {
                          if (a.category !== 'Study') return false;
                          if (gameState.persona === 'Working Parent' || gameState.persona === 'Retired Senior') return false;
                          if (a.id === 'upskill-course' && gameState.persona !== 'Fresh Grad') return false;
                          if ((a.id === 'study' || a.id === 'study-group') && gameState.persona !== 'Uni Student') return false;
                          return true;
                        })}
                        onSelect={handleAction}
                        gameState={gameState}
                      />
                    </div>
                  )}
                  <div className="w-full">
                    <ActionDropdown 
                      category="Eat" 
                      icon={<Utensils className="h-4 w-4" />}
                      actions={ACTIONS.filter(a => a.category === 'Eat')}
                      onSelect={handleAction}
                      gameState={gameState}
                    />
                  </div>
                  <div className="w-full">
                    <ActionDropdown 
                      category="Medical" 
                      icon={<Heart className="h-4 w-4" />}
                      actions={ACTIONS.filter(a => {
                        if (a.category !== 'Medical') return false;
                        if (a.id === 'medical-checkup' && gameState.persona !== 'Retired Senior') return false;
                        if (a.id === 'fin-counseling' && (gameState.stats.creditScore || 700) > 650) return false;
                        return true;
                      })}
                      onSelect={handleAction}
                      gameState={gameState}
                    />
                  </div>
                  <div className="w-full">
                    <ActionDropdown 
                      category="Rest" 
                      icon={<Coffee className="h-4 w-4" />}
                      actions={ACTIONS.filter(a => {
                        if (a.category === 'Rest') return true;
                        if (a.id === 'family-time' && gameState.persona === 'Working Parent') return true;
                        if (a.id === 'household-repair' && gameState.persona === 'Working Parent') return true;
                        return false;
                      })}
                      onSelect={handleAction}
                      gameState={gameState}
                    />
                  </div>
                  <div className="w-full">
                    <ActionDropdown 
                      category="Entertainment" 
                      icon={<Plane className="h-4 w-4" />}
                      actions={ACTIONS.filter(a => a.category === 'Entertainment')}
                      onSelect={handleAction}
                      gameState={gameState}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Log */}
            <div className="lg:col-span-4 border-l-0 lg:border-l border-border pl-0 lg:pl-8 mt-12 lg:mt-0 min-h-0">
              <div className="sticky top-24 h-fit">
                <GameLog logs={gameState.logs} />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Loading Post-Mortem Overlay */}
      <AnimatePresence>
        {isGeneratingPostMortem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-4"
          >
            <Loader2 className="h-12 w-12 animate-spin mb-4 opacity-50" />
            <h2 className="text-2xl font-serif italic mb-2">Analyzing your life...</h2>
            <p className="text-xs uppercase tracking-[0.3em] opacity-50">Generating Resilience Post-Mortem</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pause Modal */}
      <Dialog open={isPaused && !!gameState && !gameState.isGameOver} onOpenChange={setIsPaused}>
        <DialogContent className="bg-[#E4E3E0] border-[#141414] rounded-none max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-bold uppercase tracking-widest text-center">Game Paused</DialogTitle>
            <DialogDescription className="text-center italic text-xs">
              Life is on hold. Take a breath.
            </DialogDescription>
          </DialogHeader>
          {gameState && (
            <div className="py-8 flex flex-col items-center gap-6">
              <div className="text-4xl font-bold font-mono">DAY {gameState.day}</div>
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="text-center border-r border-[#141414]/10">
                  <div className="text-[10px] uppercase opacity-50 font-bold tracking-tighter">Wealth</div>
                  <div className="font-bold">RM{gameState.stats.wealth}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] uppercase opacity-50 font-bold tracking-tighter">Health</div>
                  <div className="font-bold">{gameState.stats.health}%</div>
                </div>
              </div>
              <Button onClick={() => setIsPaused(false)} className="w-full rounded-none h-12 uppercase tracking-widest text-xs bg-[#141414] text-white hover:bg-[#141414]/90">
                Resume Game
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Weekly Post-Mortem Modal */}
      <Dialog open={!!gameState?.weeklyPostMortem} onOpenChange={(open) => !open && setGameState(s => s ? { ...s, weeklyPostMortem: null } : null)}>
        <DialogContent className="bg-[#E4E3E0] border-[#141414]/20 rounded-none max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif italic">Weekly Resilience Report</DialogTitle>
            <DialogDescription className="text-xs uppercase tracking-widest opacity-50">
              Week {gameState ? Math.floor(gameState.day / 7) : 0} Summary
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-sm leading-relaxed markdown-body">
            <Markdown>{gameState?.weeklyPostMortem}</Markdown>
          </div>
          <Button onClick={() => setGameState(s => s ? { ...s, weeklyPostMortem: null } : null)} className="w-full rounded-none uppercase tracking-widest text-xs">
            Continue to next week
          </Button>
        </DialogContent>
      </Dialog>

      {/* Academic Probation Dialog */}
      <Dialog open={showProbationDialog} onOpenChange={setShowProbationDialog}>
        <DialogContent className="bg-card text-card-foreground border-red-500 border-2 rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-bold uppercase tracking-widest text-center text-red-600 flex items-center justify-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Academic Probation
            </DialogTitle>
            <DialogDescription className="text-center text-xs font-bold">
              Your grades have fallen below 15%.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center space-y-4">
            <p className="text-sm">The University has issued a final warning. If your academics hit <span className="font-bold text-red-600">0%</span>, you will be <span className="font-bold underline">expelled</span> immediately.</p>
            <Button onClick={() => setShowProbationDialog(false)} className="w-full rounded-full bg-red-600 text-white hover:bg-red-700 uppercase tracking-widest text-xs font-bold">
              I understand
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Choice Event Dialog */}
      <Dialog open={!!gameState?.pendingChoiceEvent} onOpenChange={() => {}}>
        <DialogContent 
          showCloseButton={false}
          className="bg-card text-card-foreground border-border rounded-2xl max-w-md"
        >
          <DialogHeader>
            <DialogTitle className="font-bold uppercase tracking-widest text-center">{gameState?.pendingChoiceEvent?.title}</DialogTitle>
            <DialogDescription className="text-center italic text-xs">
              {gameState?.pendingChoiceEvent?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 flex flex-col gap-3">
            {gameState?.pendingChoiceEvent?.options.map((option, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Button 
                  onClick={() => {
                    setGameState(curr => {
                      if (!curr || !curr.pendingChoiceEvent) return curr;
                      let newStats = { ...curr.stats };
                      let logMsg = `CHOICE: ${option.log}`;
                      
                      // Handle RNG Outcomes
                      if (option.outcomes && option.outcomes.length > 0) {
                        const rand = Math.random();
                        let cumulativeChance = 0;
                        for (const outcome of option.outcomes) {
                          cumulativeChance += outcome.chance;
                          if (rand < cumulativeChance) {
                            // Apply outcome impact
                            Object.entries(outcome.impact).forEach(([key, val]) => {
                              const k = key as keyof Stats;
                              const impactValue = val as number;
                              if (k === 'wealth') {
                                newStats[k] = (newStats[k] ?? 0) + impactValue;
                              } else {
                                newStats[k] = Math.min(100, Math.max(0, (newStats[k] ?? 0) + impactValue));
                              }
                            });
                            logMsg += ` -> RESULT: ${outcome.log}`;
                            toast.info("Unforeseen Outcome!", { description: outcome.description });
                            break;
                          }
                        }
                      }

                      Object.entries(option.impact).forEach(([key, val]) => {
                        const k = key as keyof Stats;
                        const impactValue = val as number;
                        if (k === 'wealth') {
                          newStats[k] = (newStats[k] ?? 0) + impactValue;
                        } else {
                          newStats[k] = Math.min(100, Math.max(0, (newStats[k] ?? 0) + impactValue));
                        }
                      });
                      return { ...curr, stats: newStats, logs: [...curr.logs, logMsg], pendingChoiceEvent: null };
                    });
                  }}
                  className="w-full rounded-full h-12 uppercase tracking-widest text-[10px] bg-primary text-primary-foreground font-bold hover:scale-[1.02] active:scale-[0.98] transition-transform"
                >
                  {option.label}
                </Button>
                <div className="px-4 text-[9px] opacity-60 italic text-center leading-tight">
                  {option.outcomes && option.outcomes.length > 0 ? (
                    <span className="text-accent-foreground font-medium">Potential outcomes: {option.outcomes.map(o => o.description).join(', ')}</span>
                  ) : (
                    <span className="opacity-80 text-foreground">No additional outcomes for this choice.</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Variable Time Dialog */}
      <Dialog open={showVariableTimeDialog} onOpenChange={setShowVariableTimeDialog}>
        <DialogContent className="bg-card text-card-foreground border-border rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-bold uppercase tracking-widest text-center">
              {pendingVariableAction?.action.label} Duration
            </DialogTitle>
            <DialogDescription className="text-center text-xs">
              Choose how many hours you want to {pendingVariableAction?.action.label.toLowerCase()}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-8 space-y-6">
            <div className="flex items-center justify-center gap-8">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setPendingVariableAction(p => p ? { ...p, hours: Math.max(1, p.hours - 1) } : null)}
                className="rounded-full border-border"
              >
                -
              </Button>
              <div className="text-4xl font-bold font-mono">{pendingVariableAction?.hours}h</div>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setPendingVariableAction(p => p ? { ...p, hours: Math.min(12, p.hours + 1) } : null)}
                className="rounded-full border-border"
              >
                +
              </Button>
            </div>
            <Button 
              onClick={() => {
                if (pendingVariableAction) {
                  handleAction(pendingVariableAction.action, pendingVariableAction.hours);
                  setShowVariableTimeDialog(false);
                  setPendingVariableAction(null);
                }
              }}
              className="w-full rounded-full h-12 uppercase tracking-widest text-xs bg-primary text-primary-foreground font-bold"
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Loan Dialog */}
      <Dialog open={showLoanDialog} onOpenChange={(open) => {
        setShowLoanDialog(open);
        if (open) setLoanIdx(0);
      }}>
        <DialogContent className="bg-card text-card-foreground border-border rounded-2xl max-w-sm overflow-hidden">
          <DialogHeader>
            <DialogTitle className="font-bold uppercase tracking-widest text-center">Emergency Loan Center</DialogTitle>
            <DialogDescription className="text-center text-xs opacity-60">
              Low on cash? Browse available loan packages.
            </DialogDescription>
          </DialogHeader>
          
          {gameState && (
            <div className="relative py-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={loanIdx}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="px-8"
                >
                  {(() => {
                    const packages = PERSONA_CONFIGS[gameState.persona].loanPackages;
                    const loan = packages[loanIdx];
                    const weeklyInterest = (loan.amount * loan.interestRate);
                    const totalRepayment = loan.amount + weeklyInterest;
                    const weeklyInstallment = totalRepayment / 4;
                    const threshold = loan.amount > 1000 ? 550 : (loan.amount > 500 ? 400 : 350);
                    const canApply = (gameState.stats.creditScore || 0) >= threshold;

                    return (
                      <div className="border border-border p-6 space-y-4 rounded-3xl bg-muted/20 shadow-inner">
                        <div className="text-center">
                          <Badge variant="outline" className="mb-2 text-[10px] uppercase tracking-tighter opacity-50">
                            Package {loanIdx + 1} of {packages.length}
                          </Badge>
                          <h4 className="text-xl font-black text-primary">RM {loan.amount}</h4>
                          <p className="text-[11px] font-bold uppercase opacity-80">{loan.name}</p>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-border/50">
                          <div className="flex justify-between text-[11px]">
                            <span className="opacity-60">Interest (Total)</span>
                            <span className="font-mono text-red-500">+RM{weeklyInterest.toFixed(0)}</span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="opacity-60">Weekly Payment</span>
                            <span className="font-mono text-primary font-bold">RM{weeklyInstallment.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="opacity-60">Tenure</span>
                            <span>4 Weeks (1 Month)</span>
                          </div>
                          <div className="flex justify-between text-[11px] pt-1 text-red-400 italic">
                            <span>Credit Penalty</span>
                            <span>~{loan.creditPenalty} pts</span>
                          </div>
                          {!canApply && (
                            <div className="text-[10px] text-destructive text-center font-bold mt-2 animate-pulse">
                                REQUIRES {threshold} CREDIT SCORE
                            </div>
                          )}
                        </div>

                        <Button 
                          disabled={!canApply}
                          onClick={() => {
                            setGameState(curr => {
                              if (!curr) return null;
                              // RNG penalty: +-20 of the base penalty
                              const offset = Math.floor(Math.random() * 41) - 20;
                              const actualPenalty = Math.max(10, loan.creditPenalty + offset);
                              
                              const newLoans = [...curr.loans, {
                                id: `${loan.id}-${Date.now()}`,
                                type: 'Personal' as any,
                                amount: loan.amount,
                                interestRate: loan.interestRate,
                                monthlyInstallment: weeklyInstallment, // We use this field for weekly in the 28-day loop
                                monthsRemaining: 4, // 4 weeks
                                missedPayments: 0
                              }];
                              return {
                                ...curr,
                                stats: { 
                                  ...curr.stats, 
                                  wealth: curr.stats.wealth + loan.amount,
                                  creditScore: Math.max(300, (curr.stats.creditScore || 700) - actualPenalty)
                                },
                                loans: newLoans,
                                logs: [...curr.logs, `LOAN: Approved for ${loan.name}. RM${loan.amount} credited. Credit score hit: -${actualPenalty}.`].slice(-50)
                              };
                            });
                            setShowLoanDialog(false);
                            toast.success("Loan Disbursed!", { description: `RM${loan.amount} has been added to your account.` });
                          }}
                          className="w-full rounded-2xl h-12 uppercase text-[11px] tracking-widest bg-primary text-primary-foreground font-black shadow-lg"
                        >
                          {canApply ? "Sign Contract" : "Credit Rating Low"}
                        </Button>
                      </div>
                    );
                  })()}
                </motion.div>
              </AnimatePresence>

              {/* Navigation Controls */}
              <div className="flex justify-between absolute top-1/2 -translate-y-1/2 w-full px-2 pointer-events-none md:px-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full bg-background/80 shadow-md pointer-events-auto hover:bg-muted hidden md:flex"
                  onClick={() => setLoanIdx(prev => Math.max(0, prev - 1))}
                  disabled={loanIdx === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full bg-background/80 shadow-md pointer-events-auto hover:bg-muted hidden md:flex"
                  onClick={() => setLoanIdx(prev => {
                    const packages = PERSONA_CONFIGS[gameState.persona].loanPackages;
                    return Math.min(packages.length - 1, prev + 1);
                  })}
                  disabled={loanIdx === PERSONA_CONFIGS[gameState.persona].loanPackages.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Mobile Controls (Bottom) */}
              <div className="flex justify-center gap-4 mt-6 md:hidden">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full px-4 text-[10px] uppercase font-bold"
                  onClick={() => setLoanIdx(prev => Math.max(0, prev - 1))}
                  disabled={loanIdx === 0}
                >
                  <ChevronLeft className="h-3 w-3 mr-1" /> Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full px-4 text-[10px] uppercase font-bold"
                  onClick={() => setLoanIdx(prev => {
                    const packages = PERSONA_CONFIGS[gameState.persona].loanPackages;
                    return Math.min(packages.length - 1, prev + 1);
                  })}
                  disabled={loanIdx === PERSONA_CONFIGS[gameState.persona].loanPackages.length - 1}
                >
                  Next <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Senior Pain Dialog */}
      <Dialog open={showSeniorPainDialog} onOpenChange={setShowSeniorPainDialog}>
        <DialogContent className="bg-card text-card-foreground border-border rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-bold uppercase tracking-widest text-center text-red-600 flex items-center justify-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Health Warning
            </DialogTitle>
            <DialogDescription className="text-center text-xs">
              You are experiencing a sudden {seniorPainType}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-center">It's quite serious. How would you like to handle this?</p>
            <div className="flex flex-col gap-2">
              <Button 
                onClick={() => {
                  setGameState(s => {
                    if (!s) return null;
                    return {
                      ...s,
                      stats: {
                        ...s.stats,
                        wealth: s.stats.wealth - 50,
                        health: Math.min(100, s.stats.health + 5),
                        stress: Math.min(100, s.stats.stress + 10)
                      },
                      logs: [...s.logs, `HEALTH: Treated ${seniorPainType} at clinic. -RM50, +5 Health, +10 Stress`].slice(-50)
                    };
                  });
                  setShowSeniorPainDialog(false);
                  toast.success("Treated", { description: "You feel slightly better after the clinic visit." });
                }}
                className="w-full rounded-full bg-primary text-primary-foreground uppercase tracking-widest text-xs font-bold"
              >
                Treat at Clinic (RM50)
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  setGameState(s => {
                    if (!s) return null;
                    return {
                      ...s,
                      pendingPain: {
                        type: seniorPainType,
                        dayToStrike: s.day + 2,
                        penalty: 15,
                        isIgnored: true
                      },
                      logs: [...s.logs, `HEALTH: Ignored ${seniorPainType}. It might come back worse.`].slice(-50)
                    };
                  });
                  setShowSeniorPainDialog(false);
                  toast.warning("Ignored", { description: "The pain subsides for now, but for how long?" });
                }}
                className="w-full rounded-full border-border uppercase tracking-widest text-xs"
              >
                Ignore (RM0)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Day Summary Dialog */}
      <Dialog open={showDaySummary} onOpenChange={setShowDaySummary}>
        <DialogContent className="bg-card text-card-foreground border-border rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif italic text-3xl text-center">End of Day {daySummaryData?.day}</DialogTitle>
            <DialogDescription className="text-center text-[10px] uppercase tracking-[0.2em] opacity-50">
              Daily Resilience Summary
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-6">
            <div className="grid grid-cols-3 gap-4 border-y border-border py-6">
              {[
                { label: 'Wealth', key: 'wealth', unit: 'RM' },
                { label: 'Health', key: 'health', unit: '%' },
                { label: 'Stress', key: 'stress', unit: '%' },
              ].map(stat => {
                const before = daySummaryData?.statsBefore[stat.key] || 0;
                const after = daySummaryData?.statsAfter[stat.key] || 0;
                const diff = after - before;
                
                // For stress, increase is bad, decrease is good.
                // But user explicitly asked: "if stress increase the counter in green"
                // This usually means they want positive deltas to be green.
                const isPositive = diff > 0;
                const isNegative = diff < 0;
                
                const diffColor = isPositive ? "text-green-500" : isNegative ? "text-red-500" : "opacity-40";
                
                const formattedDiff = stat.unit === 'RM'
                  ? (diff > 0 ? `+RM${diff.toFixed(2)}` : diff < 0 ? `-RM${Math.abs(diff).toFixed(2)}` : `RM0.00`)
                  : (diff > 0 ? `+${diff}${stat.unit}` : diff < 0 ? `${diff}${stat.unit}` : `0${stat.unit}`);

                return (
                  <div key={stat.key} className="text-center">
                    <div className="text-[10px] uppercase opacity-50 font-bold mb-1">{stat.label}</div>
                    <div className="text-lg font-bold">
                      {stat.unit === 'RM' ? `RM${after.toFixed(2)}` : `${after}${stat.unit}`}
                    </div>
                    <div className={cn("text-[10px] font-bold", diffColor)}>
                      {formattedDiff}
                    </div>
                  </div>
                );
              })}
            </div>
            {daySummaryData?.logs.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[10px] uppercase font-bold opacity-40 tracking-widest">Key Events</h4>
                <div className="space-y-1">
                  {daySummaryData.logs.map((log: string, i: number) => (
                    <div key={i} className="text-xs opacity-70 flex gap-2">
                      <span className="text-primary">•</span>
                      {log.split(': ').slice(1).join(': ')}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Button 
              onClick={() => setShowDaySummary(false)}
              className="w-full rounded-full h-12 uppercase tracking-widest text-xs bg-primary text-primary-foreground font-bold"
            >
              Start Day {daySummaryData?.day + 1}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Exit Confirmation Dialog */}
      <Dialog open={isExitDialogOpen} onOpenChange={setIsExitDialogOpen}>
        <DialogContent className="bg-card text-card-foreground border-border rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-bold uppercase tracking-widest text-center text-sm">Exit to Menu?</DialogTitle>
            <DialogDescription className="text-center text-xs opacity-90 text-foreground/80">
              Your progress will be saved. Any current session progress is preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-4 mt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsExitDialogOpen(false)} 
              className="flex-1 rounded-full border-border uppercase text-[10px] tracking-widest"
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmExit} 
              className="flex-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 uppercase text-[10px] tracking-widest font-bold"
            >
              Exit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Slot Deletion Confirmation Dialog */}
      <Dialog open={!!slotToDelete} onOpenChange={(open) => !open && setSlotToDelete(null)}>
        <DialogContent className="bg-card text-card-foreground border-border rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-bold uppercase tracking-widest text-center text-sm">Clear this slot?</DialogTitle>
            <DialogDescription className="text-center text-xs opacity-90 text-foreground/80">
              This action cannot be undone. All progress in this slot will be lost.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-4 mt-4">
            <Button 
              variant="outline" 
              onClick={() => setSlotToDelete(null)} 
              className="flex-1 rounded-full border-border uppercase text-[10px] tracking-widest"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => slotToDelete && handleDeleteSlot(slotToDelete)} 
              className="flex-1 rounded-full uppercase text-[10px] tracking-widest font-bold"
            >
              Clear Slot
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <AnimatePresence>
        {gameState?.isGameOver && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-card border border-border max-w-2xl w-full p-8 md:p-12 space-y-8 text-card-foreground rounded-3xl shadow-2xl"
            >
              <div className="text-center space-y-2">
                <h2 className="text-5xl font-serif italic">
                  {gameState?.day >= MAX_DAYS && gameState?.stats.health > 0 && gameState?.stats.wealth >= 0 
                    ? "Congratulations!" 
                    : gameState?.day >= MAX_DAYS 
                      ? "Journey's End" 
                      : "Game Over"}
                </h2>
                <p className="text-xs uppercase tracking-[0.3em] opacity-50">
                  {gameState?.day >= MAX_DAYS 
                    ? "You completed the 28-day journey" 
                    : `You survived ${gameState?.day} days`}
                </p>
              </div>

              <div className="border-y border-border py-8 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] opacity-60">Resilience Post-Mortem</h3>
                <div className="text-lg leading-relaxed font-serif markdown-body opacity-90">
                  <Markdown>{postMortem || "Generating your life analysis..."}</Markdown>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                <Button onClick={() => setGameState(null)} className="flex-1 rounded-full h-12 uppercase tracking-widest text-xs bg-primary text-primary-foreground font-bold">
                  Try Again
                </Button>
                <Button variant="outline" onClick={() => window.location.reload()} className="flex-1 rounded-full h-12 uppercase tracking-widest text-xs border-border hover:bg-muted">
                  Main Menu
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
      </TooltipProvider>
      {/* Medical Emergency Dialog */}
      <Dialog open={showMedicalEmergency} onOpenChange={setShowMedicalEmergency}>
        <DialogContent className="rounded-2xl border-border bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle className="text-red-500 uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Medical Emergency
            </DialogTitle>
            <DialogDescription className="opacity-60">
              Your health has dropped to critical levels. You have been hospitalized.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm opacity-70">
              Hospitalization costs RM1,500. Your recovery will take 3 days.
            </p>
            <Button 
              className="w-full bg-red-600 hover:bg-red-700 text-white rounded-full font-bold uppercase tracking-widest text-xs"
              onClick={() => {
                setGameState(s => {
                  if (!s) return null;
                  let newStats = { ...s.stats };
                  newStats.wealth -= 1500;
                  newStats.health = 60;
                  newStats.energy = 50;
                  return {
                    ...s,
                    stats: newStats,
                    day: s.day + 3,
                    logs: [...s.logs, "HOSPITALIZED: Recovered after 3 days. Bill: RM1500."].slice(-50)
                  };
                });
                setShowMedicalEmergency(false);
              }}
            >
              Pay & Recover
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ErrorBoundary>
  );
}

function ActionDropdown({ category, icon, actions, onSelect, gameState }: any) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "h-24 flex flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card text-card-foreground hover:bg-muted/50 hover:text-foreground group w-full cursor-pointer transition-all shadow-sm",
          "inline-flex shrink-0 items-center justify-center bg-clip-padding text-sm font-medium whitespace-nowrap outline-none select-none"
        )}
      >
        <span className="group-hover:scale-110 transition-transform flex items-center justify-center">{icon}</span>
        <span className="text-sm font-bold uppercase tracking-widest">{category}</span>
        <ChevronDown className="h-3 w-3 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-card border-border rounded-xl w-56 p-0 text-card-foreground shadow-xl">
        <DropdownMenuGroup>
          <div className="px-3 py-2 text-[10px] uppercase tracking-widest opacity-50 font-bold border-b border-border">
            {category} Options
          </div>
          <div className="p-1">
            {actions.map((action: ActionDefinition) => {
              const isDisabled = (gameState?.stats?.wealth ?? 0) < action.cost;
              return (
                <DropdownMenuItem 
                  key={action.id} 
                  disabled={isDisabled}
                  onClick={() => onSelect(action)}
                  className="flex flex-col items-start gap-1 p-3 cursor-pointer group/item hover:bg-[#DDDDDD] hover:text-black focus:bg-[#DDDDDD] focus:text-black data-[highlighted]:bg-[#DDDDDD] data-[highlighted]:text-black outline-none transition-colors rounded-lg"
                >
                  <div className="flex justify-between w-full items-center">
                    <span className="font-bold text-xs data-[highlighted]:text-black group-hover/item:text-black group-focus/item:text-black">{action.label}</span>
                    <span className="text-[10px] font-mono opacity-60 data-[highlighted]:opacity-100 data-[highlighted]:text-black group-hover/item:opacity-100 group-hover/item:text-black group-focus/item:opacity-100 group-focus/item:text-black">RM{action.cost}</span>
                  </div>
                  <p className="text-[9px] opacity-50 leading-tight data-[highlighted]:opacity-100 data-[highlighted]:text-black group-hover/item:opacity-100 group-hover/item:text-black group-focus/item:opacity-100 group-focus/item:text-black">{action.description}</p>
                  <div className="text-[8px] uppercase tracking-tighter opacity-40 data-[highlighted]:opacity-100 data-[highlighted]:text-black group-hover/item:opacity-100 group-hover/item:text-black group-focus/item:opacity-100 group-focus/item:text-black">
                    Time: {action.hours}h
                  </div>
                </DropdownMenuItem>
              );
            })}
          </div>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
