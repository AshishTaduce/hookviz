// @title useRef — accessing a DOM node imperatively
// @hook useRef
import { useRef, useState } from 'react';

// @annotate:function-decl Component declaration | FocusOnMount shows how to attach a ref to a real DOM node and read or mutate it imperatively — bypassing React's declarative data flow for operations that have no state equivalent.
export default function FocusOnMount() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState('');

  // @note After the first render, ref.current points to the actual <input> DOM node.
  // Calling .focus() is an imperative mutation React doesn't know about — that's the point.
  // @annotate:comment Escape hatch for DOM | useRef is React's sanctioned escape hatch. ref.current gives you the raw DOM node so you can call browser APIs (focus, scroll, measure, play/pause) that have no declarative equivalent.
  const handleFocus = () => {
    inputRef.current?.focus();
    setNote('focused via ref');
  };

  // @annotate:closure inputRef is stable | ref is the same object across renders; only .current changes. The handler always reads the latest DOM node, never a stale snapshot, because refs are mutable containers, not state.
  const handleSelect = () => {
    inputRef.current?.select();
    setNote('selected via ref');
  };

  return (
    <div>
      <input id="input" ref={inputRef} defaultValue="select me" />
      <button id="focus-btn" onClick={handleFocus}>focus</button>
      <button id="select-btn" onClick={handleSelect}>select all</button>
      <span id="note">{note}</span>
    </div>
  );
}

export const scenario = async ({ click }: { click: (s: string) => void }) => {
  click('#focus-btn');
  click('#select-btn');
};
