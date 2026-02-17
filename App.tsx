
import React, { useState, useRef, useEffect } from 'react';
import { Mic2, Activity, Ear, Music4, Sun, Moon, Volume2 } from 'lucide-react';
import Tuner from './components/Tuner';
import Metronome from './components/Metronome';
import EarTraining from './components/EarTraining';
import Keyboard from './components/Keyboard';
import { Tab } from './types';

const TABS = [
  { id: Tab.TUNER, icon: Mic2, label: '調音' },
  { id: Tab.METRONOME, icon: Activity, label: '節拍' },
  { id: Tab.EAR_TRAINING, icon: Ear, label: '聽力' },
  { id: Tab.KEYBOARD, icon: Music4, label: '鍵盤' },
] as const;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.METRONOME);
  const [tabKey, setTabKey] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const stored = localStorage.getItem('earlessly-theme');
    return (stored === 'light' || stored === 'dark') ? stored : 'dark';
  });
  const navRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('earlessly-theme', theme);
  }, [theme]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const activeBtn = nav.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement;
    if (activeBtn) {
      setIndicatorStyle({
        left: activeBtn.offsetLeft,
        width: activeBtn.offsetWidth,
      });
    }
  }, [activeTab]);

  const handleTabChange = (tab: Tab) => {
    if (tab !== activeTab) {
      setActiveTab(tab);
      setTabKey(k => k + 1);
    }
  };

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <div className="min-h-screen bg-bg text-tx flex flex-col max-w-full overflow-x-hidden relative">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-bd" style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
        <div className="max-w-5xl mx-auto px-3 sm:px-5 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}>
              <Music4 size={14} className="text-white" />
            </div>
            <span className="font-extrabold text-sm sm:text-base tracking-tight hidden xs:block">耳孔無有力</span>
          </div>

          {/* Center Nav */}
          <nav ref={navRef} className="relative flex p-1 rounded-xl mx-2" style={{ background: 'var(--input-bg)' }}>
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
                  data-tab={tab.id}
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

          {/* Right: Volume + Theme Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1.5 rounded-lg" style={{ background: 'var(--input-bg)', border: '1px solid var(--bd)' }}>
              <Volume2 size={13} className="text-tx-muted shrink-0" />
              <input
                type="range" min="0" max="1" step="0.05" value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-16 h-1 cursor-pointer"
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

      {/* Main Content */}
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
        </div>
      </main>
    </div>
  );
};

export default App;
