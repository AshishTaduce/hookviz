'use client';

import { useEffect, useRef, useCallback } from 'react';
import Editor, { loader, OnMount } from '@monaco-editor/react';
import type * as MonacoType from 'monaco-editor';
import type { Trace, Annotation } from '@/types/trace';
import { useCodeCursor, useStore } from '@/store';
import { useTheme } from '@/lib/theme';

// Serve Monaco from /public/monaco/vs (copied from node_modules at setup time).
// MonacoEnvironment.getWorkerUrl must return absolute URLs — inside a Web
// Worker the base URL is blob: (or the worker script URL), so relative paths
// like /monaco/vs/... can't be resolved by fetch(). Absolute URL fixes it.
if (typeof window !== 'undefined') {
  (window as any).MonacoEnvironment = {
    // We only need Monaco's tokenizer (syntax highlighting), which runs on
    // the main thread. The TypeScript language-service worker (type checking,
    // completions, hover types) is unnecessary for a read-only display editor
    // and causes loader errors because tsWorker.js is an AMD module that needs
    // workerMain.js's define() bootstrap to run. Return a no-op blob worker
    // so Monaco doesn't error out trying to start language services it won't use.
    getWorker(_workerId: string, _label: string): Worker {
      const blob = new Blob(['self.onmessage=function(){}'], {
        type: 'application/javascript',
      });
      return new Worker(URL.createObjectURL(blob));
    },
  };
}
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
  const fontSize = useStore((s) => s.fontSize);
  const theme = useTheme();

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

  // Sync Monaco font size when user changes zoom level
  useEffect(() => {
    editorRef.current?.updateOptions({ fontSize });
  }, [fontSize]);

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
          theme={theme === 'dark' ? 'hookviz-dark' : 'hookviz-light'}
          beforeMount={(monaco) => {
            monaco.editor.defineTheme('hookviz-dark', {
              base: 'vs-dark',
              inherit: true,
              rules: [
                { token: 'comment', foreground: '7a8296' },
                { token: 'keyword', foreground: 'c58bff' },
                { token: 'string', foreground: 'ffb547' },
                { token: 'number', foreground: '3ddc97' },
                { token: 'type', foreground: '6b9bff' },
              ],
              colors: {
                'editor.background': '#0b0d14',
                'editor.foreground': '#eef0f5',
                'editorLineNumber.foreground': '#7a8296',
                'editorLineNumber.activeForeground': '#eef0f5',
                'editor.lineHighlightBackground': '#151925',
                'editorGutter.background': '#0b0d14',
              },
            });
            monaco.editor.defineTheme('hookviz-light', {
              base: 'vs',
              inherit: true,
              rules: [
                { token: 'comment', foreground: '8a8173' },
                { token: 'keyword', foreground: '8a3ffc' },
                { token: 'string', foreground: 'b86e00' },
                { token: 'number', foreground: '0a8f63' },
                { token: 'type', foreground: '2457f5' },
              ],
              colors: {
                'editor.background': '#f7f3ea',
                'editor.foreground': '#1f1b16',
                'editorLineNumber.foreground': '#6d6458',
                'editorLineNumber.activeForeground': '#1f1b16',
                'editor.lineHighlightBackground': '#f3eee2',
                'editorGutter.background': '#f7f3ea',
              },
            });
          }}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            lineNumbers: 'on',
            glyphMargin: true,
            scrollBeyondLastLine: false,
            renderLineHighlight: 'none', // we handle highlight via decorations
            fontSize,
            fontFamily: '"JetBrains Mono", "Cascadia Code", Menlo, Consolas, monospace',
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
            },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            automaticLayout: true,
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
  background: color-mix(in srgb, var(--phase-render) 14%, transparent) !important;
  border-left: 3px solid var(--phase-render) !important;
}
.hv-line-commit {
  background: color-mix(in srgb, var(--phase-commit) 14%, transparent) !important;
  border-left: 3px solid var(--phase-commit) !important;
}
.hv-line-passive-effect {
  background: color-mix(in srgb, var(--phase-passive-effect) 14%, transparent) !important;
  border-left: 3px solid var(--phase-passive-effect) !important;
}
.hv-line-event {
  background: color-mix(in srgb, var(--phase-event) 14%, transparent) !important;
  border-left: 3px solid var(--phase-event) !important;
}
.hv-line-idle {
  background: rgba(107, 114, 128, 0.08) !important;
  border-left: 3px solid #7a7a80 !important;
}
`;
