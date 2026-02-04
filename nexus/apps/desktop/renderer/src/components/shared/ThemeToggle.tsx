import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, type Theme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

const themes: { value: Theme; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Monitor, label: 'System' },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1 p-1 bg-secondary/50 rounded-lg">
      {themes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            theme === value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
          title={label}
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  );
}

// Compact version for tight spaces
export function ThemeToggleCompact() {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const order: Theme[] = ['light', 'dark', 'system'];
    const currentIndex = order.indexOf(theme);
    const nextIndex = (currentIndex + 1) % order.length;
    setTheme(order[nextIndex]);
  };

  const CurrentIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <button
      onClick={cycleTheme}
      className="p-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
      title={`Theme: ${theme}`}
    >
      <CurrentIcon className="w-4 h-4" />
    </button>
  );
}
