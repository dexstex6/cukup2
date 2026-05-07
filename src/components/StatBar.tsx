import React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface StatBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
  icon: React.ReactNode;
  suffix?: string;
}

export function StatBar({ label, value, max, color, icon, suffix = "" }: StatBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-[0.1em] opacity-70">
        <div className="flex items-center gap-1.5">
          <span className="opacity-60">{icon}</span>
          <span>{label}</span>
        </div>
        <span className="font-mono">{Math.floor(value)}{suffix}</span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden border border-border/50">
        <motion.div
          className={cn("h-full transition-all duration-500 rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          style={{ 
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        />
      </div>
    </div>
  );
}
