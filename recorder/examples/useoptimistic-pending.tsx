// @title useOptimistic — show the result now, confirm when the server answers
// @hook useOptimistic
import { useState, useOptimistic, useTransition } from 'react';

const fakeServer = (text: string) => new Promise<string>((resolve) => setTimeout(() => resolve(text), 200));

// @annotate:function-decl Component declaration | Todos adds an item instantly with useOptimistic while the (fake) server call is still in flight. The optimistic item disappears and is replaced by the real one when the request finishes.
export default function Todos() {
  const [todos, setTodos] = useState<string[]>(['write tests']);
  const [, startTransition] = useTransition();

  // @note useOptimistic takes the real state and a reducer. During an async
  // transition it shows real state PLUS the optimistic item. When the transition
  // ends, React throws the optimistic layer away and shows the real state again.
  // @annotate:closure Optimistic layer over real state | optimisticTodos is derived from todos on every render. While the transition is pending it includes the extra item; once setTodos commits the real list, the extra item is no longer needed.
  const [optimisticTodos, addOptimistic] = useOptimistic(todos, (current: string[], item: string) => [...current, `${item} (sending…)`]);

  const add = () => {
    startTransition(async () => {
      addOptimistic('buy milk');
      const saved = await fakeServer('buy milk');
      setTodos((t) => [...t, saved]);
    });
  };

  return (
    <div>
      <ul id="list">
        {optimisticTodos.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <button id="add" onClick={add}>add "buy milk"</button>
    </div>
  );
}

export const scenario = async ({
  click,
  tick,
}: {
  click: (s: string) => void;
  tick: (ms?: number) => Promise<void>;
}) => {
  click('#add'); // optimistic item appears immediately
  await tick(400); // server answers, real item replaces the optimistic one
};
