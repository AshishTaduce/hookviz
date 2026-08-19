// @title useReducer — coordinated state beats scattered setters
// @hook useReducer
import { useReducer } from 'react';

// @annotate:function-decl Type declarations | State and Action types make every possible transition explicit and checkable. There's no way to put the form into an impossible state like { submitting: false, error: 'network timeout', submitted: true } simultaneously.
type State =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'error'; message: string }
  | { status: 'success' };

type Action =
  | { type: 'submit' }
  | { type: 'error'; message: string }
  | { type: 'success' }
  | { type: 'reset' };

// @annotate:function-decl Reducer function | The reducer is a state machine — it maps (current state, action) → next state. All valid transitions live in one place. Impossible combinations simply don't appear as cases.
function reducer(_state: State, action: Action): State {
  switch (action.type) {
    case 'submit':  return { status: 'submitting' };
    case 'error':   return { status: 'error', message: action.message };
    case 'success': return { status: 'success' };
    case 'reset':   return { status: 'idle' };
  }
}

// @annotate:function-decl Component declaration | Form drives the state machine via dispatch. The component only chooses which action to send — the reducer enforces what's valid. This prevents the impossible-state bugs that plague scattered useState setters (isSubmitting + isError + isSuccess as three separate booleans).
export default function Form() {
  const [state, dispatch] = useReducer(reducer, { status: 'idle' });

  const handleSubmit = async () => {
    dispatch({ type: 'submit' });
    // Simulate network
    await Promise.resolve();
    dispatch({ type: 'success' });
  };

  const handleError = () => {
    dispatch({ type: 'submit' });
    dispatch({ type: 'error', message: 'network timeout' });
  };

  return (
    <div>
      <span id="status">{state.status}</span>
      {state.status === 'error' && <span id="msg">{state.message}</span>}
      <button id="submit" onClick={handleSubmit} disabled={state.status === 'submitting'}>
        submit
      </button>
      <button id="error-btn" onClick={handleError}>simulate error</button>
      <button id="reset" onClick={() => dispatch({ type: 'reset' })}>reset</button>
    </div>
  );
}

export const scenario = async ({ click }: { click: (s: string) => void }) => {
  click('#error-btn');  // submitting → error in two dispatches
  click('#reset');      // back to idle
  click('#submit');     // submitting → success
};
