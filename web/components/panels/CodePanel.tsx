'use client';

import { useEffect, useRef, useCallback } from 'react';
import Editor, { loader, OnMount } from '@monaco-editor/react';
import type * as MonacoType from 'monaco-editor';
import type { Trace, Annotation } from '@/types/trace';
import { useCodeCursor, useStore } from '@/store';

// Serve Monaco from /public/monaco/vs (copied from node_modules at setup time)
// so the editor loads without a CDN fetch and works deterministically.
loader.config({ paths: { vs: '/monaco/vs' } });

interface Props {
  trace: Trace;
}

// Annotation type → Monaco glyph class
const GLYPH_CLASSES: Record<string, string> = {
  comment: 'hv-annot hv-annot-comment',
  'function-decl': 'hv-annot hv-annot-function-decl',
  'side-effect': 'hv-annot hv-annot-side-effect',
  closure: 'hv-annot hv-annot-closure',
};

export default function CodePanel({ trace }: Props) {
  const cursor = useCodeCursor();
  const audience = useStore((s) => s.audience);

  const editorRef = useRef<MonacoType.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof MonacoType | null>(null);
  const lineCollectionRef = useRef<MonacoType.editor.IEditorDecorationsCollection | null>(null);
  const annotCollectionRef = useRef<MonacoType.editor.IEditorDecorationsCollection | null>(null);
  const hoverDisposableRef = useRef<MonacoType.IDisposable | null>(null);

  const { source, annotations } = trace.meta;

  // Build annotation decorations based on current audience
  const buildAnnotDecorations = useCallback(
    (monaco: typeof MonacoType, show: boolean): MonacoType.editor.IModelDeltaDecoration[] => {
      if (!show) return [];
      return annotations.map((ann: Annotation) => ({
        range: new monaco.Range(ann.line, 1, ann.line, 1),
        options: {
          glyphMarginClassName: GLYPH_CLASSES[ann.type] ?? 'hv-annot',
          glyphMarginHoverMessage: { value: `**${ann.label}**\n\n${ann.detail}` },
          stickiness:
            monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      }));
    },
    [annotations]
  );

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Create two separate decoration collections
    lineCollectionRef.current = editor.createDecorationsCollection([]);
    annotCollectionRef.current = editor.createDecorationsCollection([]);

    // Register hover provider for annotation popovers
    hoverDisposableRef.current = monaco.languages.registerHoverProvider('typescript', {
      provideHover: (_model, position) => {
        const ann = annotations.find((a: Annotation) => a.line === position.lineNumber);
        if (!ann) return null;
        return {
          range: new monaco.Range(ann.line, 1, ann.line, 1),
          contents: [
            { value: `**${ann.label}**` },
            { value: ann.detail },
          ],
        };
      },
    });

    // Initial annotation render
    const show = useStore.getState().audience === 'guided';
    annotCollectionRef.current.set(buildAnnotDecorations(monaco, show));
  };

  // Update line highlight decoration when cursor changes
  useEffect(() => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    const lineCol = lineCollectionRef.current;
    if (!monaco || !editor || !lineCol || !cursor) return;

    const { line, phase } = cursor;

    // Phase → color class for the line highlight
    const lineClass = `hv-line-${phase}`;

    lineCol.set([
      {
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: lineClass,
          stickiness:
            monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      },
    ]);

    // Reveal line if outside viewport (without yanking)
    editor.revealLineInCenterIfOutsideViewport(line);
  }, [cursor]);

  // Update annotation decorations when audience changes — no remount
  useEffect(() => {
    const monaco = monacoRef.current;
    const annotCol = annotCollectionRef.current;
    if (!monaco || !annotCol) return;

    annotCol.set(buildAnnotDecorations(monaco, audience === 'guided'));
  }, [audience, buildAnnotDecorations]);

  // Cleanup hover provider on unmount
  useEffect(() => {
    return () => {
      hoverDisposableRef.current?.dispose();
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">Source</div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Editor
          height="100%"
          language="typescript"
          value={source}
          theme="vs-dark"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            lineNumbers: 'on',
            glyphMargin: true,
            scrollBeyondLastLine: false,
            renderLineHighlight: 'none', // we handle highlight via decorations
            fontSize: 13,
            fontFamily: 'Consolas, Menlo, Monaco, "Cascadia Code", "Courier New", monospace',
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
            },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            automaticLayout: false, // we use CSS grid sizing
            wordWrap: 'off',
            contextmenu: false,
            folding: false,
            lineDecorationsWidth: 4,
          }}
          onMount={handleMount}
        />
      </div>
      <style>{lineHighlightStyles}</style>
    </div>
  );
}

// Inline styles for line-highlight classes (one per phase)
// These add the colored left-border + background tint
const lineHighlightStyles = `
.hv-line-render {
  background: rgba(59, 130, 246, 0.1) !important;
  border-left: 3px solid #3b82f6 !important;
}
.hv-line-commit {
  background: rgba(245, 158, 11, 0.12) !important;
  border-left: 3px solid #f59e0b !important;
}
.hv-line-passive-effect {
  background: rgba(34, 197, 94, 0.1) !important;
  border-left: 3px solid #22c55e !important;
}
.hv-line-event {
  background: rgba(168, 85, 247, 0.1) !important;
  border-left: 3px solid #a855f7 !important;
}
.hv-line-idle {
  background: rgba(107, 114, 128, 0.08) !important;
  border-left: 3px solid #6b7280 !important;
}
`;
