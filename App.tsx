
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Mic2, Activity, Ear, Music4, Drum, Sun, Moon, Volume2 } from 'lucide-react';
import Tuner from './components/Tuner';
import Metronome from './components/Metronome';
import EarTraining from './components/EarTraining';
import Keyboard from './components/Keyboard';
import DrumMachine from './components/DrumMachine';
import { Tab } from './types';
import { useTheme } from './hooks/useTheme';

const TABS = [
  { id: Tab.TUNER, icon: Mic2, label: '調音' },
  { id: Tab.METRONOME, icon: Activity, label: '節拍' },
  { id: Tab.EAR_TRAINING, icon: Ear, label: '聽力' },
  { id: Tab.KEYBOARD, icon: Music4, label: '鍵盤' },
  { id: Tab.DRUM, icon: Drum, label: '鼓機' },
] as const;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.METRONOME);
  const [tabKey, setTabKey] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const { theme, toggleTheme } = useTheme();
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  useLayoutEffect(() => {
    const btn = tabRefs.current[activeTab];
    if (btn) {
      setIndicatorStyle({ left: btn.offsetLeft, width: btn.offsetWidth });
    }
  }, [activeTab]);

  // Re-measure on resize so the pill indicator tracks layout changes.
  useEffect(() => {
    const onResize = () => {
      const btn = tabRefs.current[activeTab];
      if (btn) setIndicatorStyle({ left: btn.offsetLeft, width: btn.offsetWidth });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [activeTab]);

  const handleTabChange = (tab: Tab) => {
    if (tab !== activeTab) {
      setActiveTab(tab);
      setTabKey(k => k + 1);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-tx flex flex-col max-w-full overflow-x-hidden relative">
      <header className="sticky top-0 z-50 border-b border-bd" style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
        <div className="max-w-5xl mx-auto px-3 sm:px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}>
              <Music4 size={14} className="text-white" />
            </div>
            <span className="font-extrabold text-sm sm:text-base tracking-tight hidden xs:block">耳孔無有力</span>
          </div>

          <nav role="tablist" className="relative flex p-1 rounded-xl mx-2" style={{ background: 'var(--input-bg)' }}>
            <div
              className="absolute top-1 bottom-1 rounded-lg transition-all duration-300 ease-out"
              style={{
                left: indicatorStyle.left,
                width: indicatorStyle.width,
                background: 'var(--primary-bg)',
                border: '1px solid var(--primary)',
              }}
            />
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={(el) => { tabRefs.current[tab.id] = el; }}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleTabChange(tab.id)}
                  className={`relative z-10 flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-colors duration-150 whitespace-nowrap cursor-pointer ${
                    isActive ? 'text-primary-sub' : 'text-tx-muted hover:text-tx-sub'
                  }`}
                >
                  <Icon size={15} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1.5 rounded-lg" style={{ background: 'var(--input-bg)', border: '1px solid var(--bd)' }}>
              <Volume2 size={13} className="text-tx-muted shrink-0" />
              <input
                type="range" min="0" max="1" step="0.05" value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-16 h-1 cursor-pointer"
                aria-label="全域音量"
              />
            </div>
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors shrink-0"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--bd)' }}
              aria-label="切換主題"
            >
              {theme === 'dark' ? <Sun size={15} className="text-tx-sub" /> : <Moon size={15} className="text-tx-sub" />}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 relative overflow-x-hidden z-10">
        <div key={tabKey} className="animate-fade-in">
          <div className={activeTab === Tab.TUNER ? 'block h-full' : 'hidden h-full'}>
            <Tuner />
          </div>
          <div className={activeTab === Tab.METRONOME ? 'block h-full' : 'hidden h-full'}>
            <Metronome volume={volume} setVolume={setVolume} />
          </div>
          <div className={activeTab === Tab.EAR_TRAINING ? 'block h-full' : 'hidden h-full'}>
            <EarTraining volume={volume} />
          </div>
          <div className={activeTab === Tab.KEYBOARD ? 'block h-full' : 'hidden h-full'}>
            <Keyboard isActive={activeTab === Tab.KEYBOARD} volume={volume} setVolume={setVolume} />
          </div>
          <div className={activeTab === Tab.DRUM ? 'block h-full' : 'hidden h-full'}>
            <DrumMachine volume={volume} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
