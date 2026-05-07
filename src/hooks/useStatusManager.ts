import { useState, useEffect, useCallback } from 'react';
import { GameState, Debuff, Stats } from '../types';
import { toast } from 'sonner';

export function useStatusManager(gameState: GameState | null, setGameState: React.Dispatch<React.SetStateAction<GameState | null>>) {
  useEffect(() => {
    if (!gameState || gameState.isGameOver) return;

    const checkStatus = () => {
      setGameState(curr => {
        if (!curr) return null;
        
        let newStats = { ...curr.stats };
        let newDebuffs = [...curr.debuffs];
        let consecutiveHighStressDays = curr.consecutiveHighStressDays;
        let logs = [...curr.logs];

        // Chronic Stress -> Burnout
        if (newStats.stress > 80) {
          consecutiveHighStressDays += 1;
          if (consecutiveHighStressDays >= 3 && !newDebuffs.some(d => d.type === 'Burnout')) {
            newDebuffs.push({ type: 'Burnout', daysRemaining: 7 });
            toast.error("BURNOUT!", { description: "Chronic stress has taken its toll. Health drops daily and income is halved." });
            logs.push("BURNOUT: Chronic stress detected. Health and Income penalized.");
          }
        } else if (newStats.stress < 40) {
          consecutiveHighStressDays = 0;
          if (newDebuffs.some(d => d.type === 'Burnout')) {
            newDebuffs = newDebuffs.filter(d => d.type !== 'Burnout');
            toast.success("Recovered from Burnout!");
            logs.push("Recovered from Burnout. Take it easy.");
          }
        } else {
          consecutiveHighStressDays = 0;
        }

        // Burnout Effects
        if (newDebuffs.some(d => d.type === 'Burnout')) {
          newStats.health = Math.max(0, newStats.health - 15);
        }

        // Malnutrition
        if (newStats.hunger < 20) {
          newStats.health = Math.max(0, newStats.health - 5);
          if (curr.day % 1 === 0) { // Every day
             logs.push("MALNUTRITION: Health is draining. Stress is mounting faster.");
          }
        }

        return {
          ...curr,
          stats: newStats,
          debuffs: newDebuffs,
          consecutiveHighStressDays,
          logs: logs.slice(-50)
        };
      });
    };

    checkStatus();
  }, [gameState?.day]);
}
