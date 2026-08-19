// @title useContext — reading a shared value without prop drilling
// @hook useContext
import { createContext, useContext, useState } from 'react';

type Theme = 'light' | 'dark';

const ThemeContext = createContext<Theme>('light');

// @annotate:comment Consumer reads context without props | ThemedBox receives no props. useContext subscribes it directly to the nearest ThemeContext.Provider — React re-renders it whenever the provider's value changes, no prop threading required.
function ThemedBox() {
  // @note useContext subscribes this component to context changes. Any re-render of a Provider with a changed value propagates down to all consumers, skipping memo boundaries.
  const theme = useContext(ThemeContext);
  return (
    <div
      id="box"
      style={{
        background: theme === 'dark' ? '#1e1e1e' : '#ffffff',
        color: theme === 'dark' ? '#cccccc' : '#111111',
        padding: '8px',
        borderRadius: '4px',
      }}
    >
      {theme}
    </div>
  );
}

// @annotate:function-decl Component declaration | App holds the theme state and wraps its subtree in a Provider. The value prop is what consumers receive — changing it triggers re-renders in all subscribed consumers.
export default function App() {
  const [theme, setTheme] = useState<Theme>('light');

  return (
    <ThemeContext.Provider value={theme}>
      <ThemedBox />
      <button
        id="toggle"
        onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
      >
        toggle
      </button>
    </ThemeContext.Provider>
  );
}

export const scenario = async ({ click }: { click: (s: string) => void }) => {
  click('#toggle');
};
