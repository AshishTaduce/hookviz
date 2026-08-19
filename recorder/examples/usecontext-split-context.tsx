// @title useContext — avoid re-renders by splitting context
// @hook useContext
import { createContext, useContext, useState, memo } from 'react';

// @annotate:comment Two contexts instead of one | Splitting theme (rare change) from counter (frequent change) means ThemeDisplay only re-renders on theme changes, and CountDisplay only re-renders on count changes. One fat context would re-render both consumers on every count tick.
const ThemeContext = createContext<{ theme: string }>({ theme: 'dark' });
const CountContext = createContext<{ count: number }>({ count: 0 });

// @annotate:function-decl Memoized consumer | ThemeDisplay is wrapped in memo AND reads only ThemeContext. It will not re-render when count changes — memo prevents prop-triggered re-renders, and it's not subscribed to CountContext.
const ThemeDisplay = memo(function ThemeDisplay() {
  const { theme } = useContext(ThemeContext);
  return <div id="theme">theme: {theme}</div>;
});

// @annotate:function-decl Memoized consumer | CountDisplay reads only CountContext. It re-renders on every count change but is shielded from theme changes.
const CountDisplay = memo(function CountDisplay() {
  const { count } = useContext(CountContext);
  return <div id="count">count: {count}</div>;
});

// @annotate:function-decl Root component | App provides both contexts. Changing count only notifies CountContext subscribers; changing theme only notifies ThemeContext subscribers. No consumer sees changes it doesn't care about.
export default function App() {
  const [count, setCount] = useState(0);
  const [theme, setTheme] = useState('dark');

  return (
    <ThemeContext.Provider value={{ theme }}>
      <CountContext.Provider value={{ count }}>
        <ThemeDisplay />
        <CountDisplay />
        <button id="inc" onClick={() => setCount((c) => c + 1)}>+count</button>
        <button id="theme-btn" onClick={() => setTheme((t) => t === 'dark' ? 'light' : 'dark')}>
          toggle theme
        </button>
      </CountContext.Provider>
    </ThemeContext.Provider>
  );
}

export const scenario = async ({ click }: { click: (s: string) => void }) => {
  click('#inc');        // only CountDisplay re-renders
  click('#inc');
  click('#theme-btn');  // only ThemeDisplay re-renders
};
