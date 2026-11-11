// @title useDeferredValue — urgent render first, deferred render after
// @hook useDeferredValue
import { useState, useDeferredValue } from 'react';

// @annotate:function-decl Component declaration | Typeahead renders the typed text immediately and a deferred copy of it that lags one render behind. React does the urgent update first and the deferred one in a follow-up render.
export default function Typeahead() {
  const [text, setText] = useState('');

  // @note useDeferredValue returns the OLD value during the urgent render and the
  // new value in a second, lower-priority render. Input stays responsive because the
  // expensive part of the UI (the list below) reads the deferred copy.
  // @annotate:comment Deferred copy lags on purpose | Compare the two numbers on the frame right after typing: text is already updated, deferred still shows the previous value. The next render catches it up.
  const deferred = useDeferredValue(text);

  return (
    <div>
      <input id="box" value={text} onChange={(e) => setText(e.target.value)} />
      <p>
        typed: <span id="typed">{text}</span>
      </p>
      <p>
        deferred: <span id="deferred">{deferred}</span>
      </p>
    </div>
  );
}

export const scenario = async ({
  type,
  tick,
}: {
  type: (s: string, v: string) => void;
  tick: (ms?: number) => Promise<void>;
}) => {
  type('#box', 'r');
  await tick(50);
  type('#box', 're');
  await tick(50);
};
