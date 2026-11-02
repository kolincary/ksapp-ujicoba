import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Megaphone } from 'lucide-react';
import { UserRole } from '../types';

interface RunningText {
   id: string;
   text: string;
   roles: string[];
   is_active: boolean;
   interval_minutes: number;
   duration_seconds: number;
   scroll_speed?: number;
}

interface RunningTextBannerProps {
   role: UserRole;
}

export const RunningTextBanner: React.FC<RunningTextBannerProps> = ({ role }) => {
   const [texts, setTexts] = useState<RunningText[]>([]);
   const [activeText, setActiveText] = useState<RunningText | null>(null);
   const lastShownRef = useRef<Record<string, number>>({});

   useEffect(() => {
      let isMounted = true;

      const fetchTexts = async () => {
         try {
            const { data, error } = await supabase
               .from('running_texts')
               .select('*')
               .eq('is_active', true);

            if (error) {
               if (error.code !== '42P01') console.error('Error fetching running texts:', error);
               return;
            }

            if (isMounted && data) {
               const relevantTexts = data.filter((t: RunningText) => 
                  t.roles.includes('ALL') || t.roles.includes(role)
               );
               setTexts(relevantTexts);
            }
         } catch (err) {
            console.error('Exception fetching running texts:', err);
         }
      };

      fetchTexts();

      const subscription = supabase
         .channel('running_texts_changes')
         .on('postgres_changes', { event: '*', schema: 'public', table: 'running_texts' }, () => {
            fetchTexts();
         })
         .subscribe();

      return () => {
         isMounted = false;
         supabase.removeChannel(subscription);
      };
   }, [role]);

   useEffect(() => {
      if (texts.length === 0) return;

      const checkInterval = setInterval(() => {
         // Don't interrupt if currently showing something
         if (activeText) return;

         const now = Date.now();
         
         // Find the first text that is due to be shown
         const dueText = texts.find(t => {
            const lastShown = lastShownRef.current[t.id] || 0;
            const intervalMs = t.interval_minutes * 60 * 1000;
            return (now - lastShown) >= intervalMs;
         });

         if (dueText) {
            setActiveText(dueText);
            lastShownRef.current[dueText.id] = now;

            // Automatically hide after duration
            setTimeout(() => {
               setActiveText((current) => current?.id === dueText.id ? null : current);
            }, dueText.duration_seconds * 1000);
         }
      }, 5000); // Check every 5 seconds

      return () => clearInterval(checkInterval);
   }, [texts, activeText]);

   if (!activeText) return null;

   return (
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md relative overflow-hidden flex items-center z-[50] animate-in slide-in-from-top-2 fade-in duration-500 border-b border-white/10">
         <div className="pl-4 pr-3 py-2.5 flex-shrink-0 flex items-center gap-2 bg-gradient-to-r from-blue-700 to-transparent relative z-10 backdrop-blur-sm">
            <Megaphone size={16} className="animate-pulse text-blue-200" />
            <span className="text-xs font-bold uppercase tracking-wider text-blue-100 hidden sm:inline-block">Info</span>
         </div>
         
         {/* Marquee Container */}
         <div className="flex-1 overflow-hidden whitespace-nowrap relative py-2.5 flex items-center h-full">
            <div 
               className="inline-block hover:[animation-play-state:paused] font-semibold text-sm"
               style={{
                  animation: `marquee ${Math.max(activeText.scroll_speed || 30, (activeText.text.length / 50) * (activeText.scroll_speed || 30))}s linear infinite`
               }}
            >
               {activeText.text}
               <span className="mx-32 text-blue-300/50">✦</span>
               {activeText.text}
            </div>
         </div>

         <style>{`
            @keyframes marquee {
               0% { transform: translateX(100vw); }
               100% { transform: translateX(-100%); }
            }
         `}</style>
      </div>
   );
};
