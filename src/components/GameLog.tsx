import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface GameLogProps {
  logs: string[];
}

export function GameLog({ logs }: GameLogProps) {
  return (
    <div className="flex flex-col w-full bg-card/30 rounded-2xl p-4 border border-border/50 h-[450px] lg:h-[calc(100vh-200px)] overflow-hidden">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 opacity-50 flex items-center gap-2 shrink-0">
        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
        Live Life Log
      </h3>
      <ScrollArea className="flex-1 -mr-2 pr-2">
        <div className="space-y-2 pb-4">
          <AnimatePresence initial={false}>
            {logs.slice().reverse().map((log, i) => (
              <motion.div
                key={`${i}-${log.substring(0, 20)}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "text-[11px] leading-relaxed font-mono border-l-2 pl-3 py-2 rounded-r-lg break-words",
                  log.startsWith('EMERGENCY') ? "border-red-500 bg-red-500/10 text-red-500 dark:text-red-400" : 
                  log.startsWith('BURNOUT') ? "border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400" :
                  log.startsWith('HEALTH') ? "border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400" :
                  log.includes('CHOICE') ? "border-accent bg-accent/10 italic" :
                  "border-border bg-muted/30 text-muted-foreground opacity-90"
                )}
              >
                {log}
              </motion.div>
            ))}
          </AnimatePresence>
          {logs.length === 0 && (
            <div className="text-[10px] opacity-20 italic py-8 text-center">Your life story starts here...</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
