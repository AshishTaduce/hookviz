// @title useReducer — managing state with dispatch
// @hook useReducer
import { useReducer } from 'react';

type State = { count: number };
type Action = { type: 'increment' } | { type: 'decrement' } | { type: 'reset' };

// @annotate:function-decl Reducer function | A reducer is a pure function — given current state and an action, it returns next state. No side effects, no mutations, no async work.
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'increment': return { count: state.count + 1 };
    case 'decrement': return { count: Math.max(0, state.count - 1) };
    case 'reset':     return { count: 0 };
  }
}

// @annotate:function-decl Component declaration | Counter delegates all state transitions to reducer — the component only decides which action to dispatch, never how state changes.
export default function Counter() {
  // @note useReducer returns [currentState, dispatch]. Dispatch sends an action object to reducer; the return value becomes the next state.
  // @annotate:comment Predictable transitions | Every state change goes through one function with one input and one output. This makes state transitions enumerable, testable, and reversible — unlike multiple useState setters scattered across handlers.
  const [state, dispatch] = useReducer(reducer, { count: 0 });

  return (
    <div>
      <span id="count">{state.count}</span>
      <button id="inc" onClick={() => dispatch({ type: 'increment' })}>+</button>
      <button id="dec" onClick={() => dispatch({ type: 'decrement' })}>−</button>
      <button id="reset" onClick={() => dispatch({ type: 'reset' })}>reset</button>
    </div>
  );
}

export const scenario = async ({ click }: { click: (s: string) => void }) => {
  click('#inc');
  click('#inc');
  click('#dec');
  click('#reset');
};
