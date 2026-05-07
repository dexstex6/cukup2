import { PERSONA_CONFIGS, PersonaType, GameState } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'motion/react';
import { Badge } from '@/components/ui/badge';

interface PersonaSelectionProps {
  onSelect: (persona: PersonaType, slot: number) => void;
  onDelete: (slotId: string) => void;
  saveSlots: Record<string, GameState>;
}

export function PersonaSelection({ onSelect, onDelete, saveSlots }: PersonaSelectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
      {(Object.keys(PERSONA_CONFIGS) as PersonaType[]).map((persona, i) => (
        <motion.div
          key={persona}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
        >
          <Card className="h-full flex flex-col hover:border-primary transition-all bg-card border-border text-card-foreground rounded-2xl shadow-sm hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-foreground">{persona}</CardTitle>
              <CardDescription className="text-muted-foreground">{PERSONA_CONFIGS[persona].description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {[1, 2].map(slot => {
                  const slotId = `${persona.toLowerCase().replace(' ', '-')}-${slot}`;
                  const savedGame = saveSlots[slotId];
                  
                  return (
                    <div key={slot} className="relative group">
                      <Button 
                        variant={savedGame && !savedGame.isGameOver ? "outline" : "default"}
                        className="w-full h-24 py-3 flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-muted/50 hover:text-foreground transition-colors"
                        onClick={() => onSelect(persona, slot)}
                      >
                        <span className="text-[10px] uppercase opacity-60">Slot {slot}</span>
                        {savedGame && !savedGame.isGameOver ? (
                          <div className="flex flex-col items-center">
                            <span className="text-sm font-bold">Day {savedGame.day}</span>
                            <span className="text-[10px] opacity-60">RM{savedGame.stats.wealth.toFixed(0)}</span>
                          </div>
                        ) : (
                          <span className="text-sm font-bold">New Game</span>
                        )}
                      </Button>
                      {savedGame && !savedGame.isGameOver && (
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onDelete(slotId);
                          }}
                          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10 hover:scale-110 active:scale-95"
                          title="Clear Slot"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
