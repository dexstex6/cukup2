import React, { useCallback } from 'react';
import { GameState, Loan, Stats } from '../types';
import { toast } from 'sonner';

export function useFinanceCenter(gameState: GameState | null, setGameState: React.Dispatch<React.SetStateAction<GameState | null>>) {
  const applyMonthlyFinance = useCallback(() => {
    setGameState(curr => {
      if (!curr) return null;

      let newStats = { ...curr.stats };
      let newLoans = [...curr.loans];
      let logs = [...curr.logs];
      let epfContribution = 0;

      // EPF Logic (11% for working roles)
      if (curr.persona === 'Fresh Grad' || curr.persona === 'Working Parent') {
        // We assume income is already added, but EPF is deducted from the "gross"
        // For simplicity, we deduct it monthly based on a base salary
        const baseSalary = curr.persona === 'Fresh Grad' ? 3000 : 6000;
        epfContribution = baseSalary * 0.11;
        newStats.wealth -= epfContribution;
        logs.push(`EPF: RM${epfContribution.toFixed(2)} contributed to your retirement fund.`);
      }

      // Loan Installments
      newLoans = newLoans.map(loan => {
        if (loan.monthsRemaining > 0) {
          if (newStats.wealth >= loan.monthlyInstallment) {
            newStats.wealth -= loan.monthlyInstallment;
            logs.push(`Loan Payment: Paid RM${loan.monthlyInstallment} for ${loan.type} loan.`);
            return { ...loan, monthsRemaining: loan.monthsRemaining - 1 };
          } else {
            loan.missedPayments += 1;
            logs.push(`MISSED PAYMENT: Could not afford RM${loan.monthlyInstallment} for ${loan.type} loan!`);
            if (loan.missedPayments >= 3) {
              newStats.creditScore = Math.max(300, (newStats.creditScore || 700) - 50);
              logs.push("CREDIT SCORE DROP: 3 consecutive missed payments.");
            }
            return loan;
          }
        }
        return loan;
      }).filter(loan => loan.monthsRemaining > 0 || loan.amount > 0);

      // Inflation (every 12 months)
      let inflationLevel = curr.inflationLevel;
      if (curr.month === 12 && curr.day === 28) {
        inflationLevel += 0.05;
        logs.push("INFLATION: Cost of living increased by 5%.");
      }

      return {
        ...curr,
        stats: newStats,
        loans: newLoans,
        epfBalance: curr.epfBalance + epfContribution,
        inflationLevel,
        logs: logs.slice(-50)
      };
    });
  }, [setGameState]);

  return { applyMonthlyFinance };
}
