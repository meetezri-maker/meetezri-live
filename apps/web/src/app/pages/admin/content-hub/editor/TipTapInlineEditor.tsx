/**
 * TipTap inline editor — THE ONLY FILE THAT IMPORTS TIPTAP.
 *
 * Loaded exclusively through `React.lazy` from `InlineEditor.tsx`, so ProseMirror lands in the
 * `vendor-editor` chunk and never enters the public or member-app bundles.
 *
 * DELIBERATELY NOT `@tiptap/starter-kit`: the Content Hub owns headings, lists, quotes, tables,
 * FAQs and CTAs as document BLOCKS. TipTap is only the inline text editor inside a block, so the
 * schema declares exactly one block node (paragraph) and four marks. Anything else — a pasted
 * heading, a Word colour span, an image — is structurally impossible rather than merely
 * discouraged, because ProseMirror validates every change against this schema.
 */

import { useEffect, useMemo } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Code from '@tiptap/extension-code';
import Link from '@tiptap/extension-link';
import History from '@tiptap/extension-history';
import { isSafeExternalUrl, type InlineContent } from '@meetezri/shared';
import { cn } from '@/lib/utils';
import { inlineToTipTap, normalisePastedInline, tipTapToInline } from './inlineConversion';

export interface TipTapInlineEditorProps {
  value: InlineContent;
  onChange: (next: InlineContent) => void;
  placeholder?: string;
  /** Single-line fields (a heading, a CTA label) suppress the Enter key. */
  singleLine?: boolean;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}

export default function TipTapInlineEditor({
  value,
  onChange,
  placeholder,
  singleLine,
  ariaLabel,
  className,
  disabled,
}: TipTapInlineEditorProps) {
  const extensions = useMemo(
    () => [
      Document,
      Paragraph,
      Text,
      Bold,
      Italic,
      Code,
      History,
      Link.configure({
        openOnClick: false,
        autolink: false,
        // ProseMirror still validates each href; this is belt-and-braces for pasted links.
        protocols: ['http', 'https', 'mailto', 'tel'],
        validate: (href: string) =>
          href.startsWith('content:') || href.startsWith('route:') || isSafeExternalUrl(href),
      }),
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    editable: !disabled,
    content: inlineToTipTap(value),
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-label': ariaLabel,
        'aria-multiline': singleLine ? 'false' : 'true',
        class: 'outline-none min-h-[1.5rem]',
        ...(placeholder ? { 'data-placeholder': placeholder } : {}),
      },
      handleKeyDown: (_view, event) => {
        // Single-line fields must not gain paragraphs.
        if (singleLine && event.key === 'Enter') {
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChange(tipTapToInline(instance.getJSON()));
    },
  });

  // Paste normalisation runs AFTER ProseMirror has applied its schema, so this second pass only
  // has to remove the invisible characters and unsafe links that survive a Word/Docs paste.
  useEffect(() => {
    if (!editor) return;

    const handlePaste = () => {
      // Deferred: read the document once ProseMirror has finished applying the transaction.
      queueMicrotask(() => {
        const normalised = normalisePastedInline(tipTapToInline(editor.getJSON()));
        onChange(normalised);
      });
    };

    editor.view.dom.addEventListener('paste', handlePaste);
    return () => editor.view.dom.removeEventListener('paste', handlePaste);
  }, [editor, onChange]);

  // Re-sync when the value changes from outside (revision restore, conflict reload). Guarded by a
  // content comparison so ordinary typing does not reset the cursor on every keystroke.
  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(tipTapToInline(editor.getJSON()));
    if (current !== JSON.stringify(value)) {
      editor.commands.setContent(inlineToTipTap(value), false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  const toggle = (mark: 'bold' | 'italic' | 'code') => {
    if (mark === 'bold') editor.chain().focus().toggleBold().run();
    if (mark === 'italic') editor.chain().focus().toggleItalic().run();
    if (mark === 'code') editor.chain().focus().toggleCode().run();
  };

  const setLink = () => {
    const existing = editor.getAttributes('link').href as string | undefined;
    const href = window.prompt('Link URL (https://…), or leave blank to remove', existing ?? '');
    if (href === null) return;
    if (href.trim() === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    if (!isSafeExternalUrl(href.trim())) {
      // Refused rather than silently stored — publish validation would reject it anyway.
      window.alert('That link is not allowed. Use http, https, mailto or tel.');
      return;
    }
    editor.chain().focus().setLink({ href: href.trim() }).run();
  };

  return (
    <div className={cn('rounded-md border border-white/10 bg-white/[0.03]', className)}>
      <div className="flex items-center gap-1 border-b border-white/10 px-2 py-1" role="toolbar" aria-label={`${ariaLabel} formatting`}>
        {(['bold', 'italic', 'code'] as const).map((mark) => (
          <button
            key={mark}
            type="button"
            onClick={() => toggle(mark)}
            // `aria-pressed` is what makes the active state audible, not just visible.
            aria-pressed={editor.isActive(mark)}
            aria-label={mark === 'code' ? 'Inline code' : mark.charAt(0).toUpperCase() + mark.slice(1)}
            disabled={disabled}
            className={cn(
              'rounded px-2 py-0.5 text-xs',
              editor.isActive(mark)
                ? 'bg-white/15 text-[var(--admin-text)]'
                : 'text-[var(--admin-text-secondary)] hover:bg-white/[0.06]',
            )}
          >
            {mark === 'bold' ? 'B' : mark === 'italic' ? 'I' : '<>'}
          </button>
        ))}
        <button
          type="button"
          onClick={setLink}
          aria-pressed={editor.isActive('link')}
          aria-label="Link"
          disabled={disabled}
          className={cn(
            'rounded px-2 py-0.5 text-xs',
            editor.isActive('link')
              ? 'bg-white/15 text-[var(--admin-text)]'
              : 'text-[var(--admin-text-secondary)] hover:bg-white/[0.06]',
          )}
        >
          Link
        </button>
      </div>

      <EditorContent editor={editor} className="px-3 py-2 text-sm text-[var(--admin-text)]" />
    </div>
  );
}
