"use client";

import { useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { cn } from "@/lib/utils";

/**
 * Production-grade rich text editor built on TipTap (ProseMirror).
 *
 * Replaces the earlier contenteditable/execCommand implementation which had
 * three unfixable classes of bug: (a) toggles like H2 didn't actually toggle
 * off, (b) newly-inserted lists could escape the editor's box because
 * execCommand let the browser insert them at the document level, (c) the
 * output HTML varied per browser and sometimes injected inline styles.
 *
 * TipTap gives us structural editing (Schema-based DOM), reliable toggling,
 * and clean output — the exact HTML tags render the same way in every
 * browser and match what the site's DOMPurify allow-list already accepts.
 */

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

const TOOLBAR_BTN =
  "min-w-[34px] rounded-lg border border-line bg-white px-2 py-1.5 text-[13px] font-bold text-ink-soft hover:bg-brand-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
const TOOLBAR_BTN_ACTIVE = "bg-brand-600 text-white border-brand-600 hover:bg-brand-700";

function ToolbarButton({
  onClick,
  active = false,
  disabled = false,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(TOOLBAR_BTN, active && TOOLBAR_BTN_ACTIVE)}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  if (!editor) return null;
  return (
    <div className="flex flex-wrap gap-1 border-b border-line bg-page p-2">
      <ToolbarButton
        title="H2 — শিরোনাম / Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        title="H3 — উপ-শিরোনাম / Heading 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </ToolbarButton>
      <ToolbarButton
        title="প্যারাগ্রাফ / Paragraph"
        active={editor.isActive("paragraph")}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        P
      </ToolbarButton>

      <span className="mx-1 self-stretch border-l border-line" />

      <ToolbarButton
        title="বোল্ড / Bold (Ctrl+B)"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <b>B</b>
      </ToolbarButton>
      <ToolbarButton
        title="ইটালিক / Italic (Ctrl+I)"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <i>I</i>
      </ToolbarButton>
      <ToolbarButton
        title="আন্ডারলাইন / Underline (Ctrl+U)"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <u>U</u>
      </ToolbarButton>
      <ToolbarButton
        title="স্ট্রাইকথ্রু / Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <s>S</s>
      </ToolbarButton>

      <span className="mx-1 self-stretch border-l border-line" />

      <ToolbarButton
        title="বুলেট লিস্ট / Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        ••
      </ToolbarButton>
      <ToolbarButton
        title="নাম্বার লিস্ট / Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        ১.
      </ToolbarButton>
      <ToolbarButton
        title="উদ্ধৃতি / Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        ❝
      </ToolbarButton>
      <ToolbarButton
        title="কোড ব্লক / Code block"
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        {"</>"}
      </ToolbarButton>
      <ToolbarButton
        title="দুই কলাম বিভাজক / Horizontal rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        ─
      </ToolbarButton>

      <span className="mx-1 self-stretch border-l border-line" />

      <ToolbarButton
        title="লিংক / Link"
        active={editor.isActive("link")}
        onClick={() => {
          const prev = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("লিংক URL / Link URL:", prev ?? "https://");
          if (url === null) return;
          if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
          }
          editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        }}
      >
        🔗
      </ToolbarButton>

      <span className="mx-1 self-stretch border-l border-line" />

      <ToolbarButton
        title="পূর্বাবস্থা / Undo (Ctrl+Z)"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        ↶
      </ToolbarButton>
      <ToolbarButton
        title="পুনরাবৃত্তি / Redo (Ctrl+Shift+Z)"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        ↷
      </ToolbarButton>

      <span className="mx-1 self-stretch border-l border-line" />

      <ToolbarButton
        title="ফরম্যাট মুছুন / Clear formatting"
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
      >
        ✕
      </ToolbarButton>
    </div>
  );
}

export function RichTextEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    // Client-only render — TipTap listens to selection events that don't exist in SSR.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // We wire our own Link extension below to control opener/rel attrs.
        link: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "এখানে লিখুন / Start writing…",
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        // `prose-bn` = the site's tailwind-typography class; keeps admin editor
        // rendering typography identically to the public site.
        class:
          "prose-bn max-w-none min-h-[280px] bg-white p-4 outline-none focus:outline-none " +
          "[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 " +
          "[&_h2]:font-heading [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 " +
          "[&_h3]:font-heading [&_h3]:text-[18px] [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-2 " +
          "[&_blockquote]:border-l-4 [&_blockquote]:border-brand-200 [&_blockquote]:pl-4 [&_blockquote]:text-ink-mute [&_blockquote]:italic " +
          "[&_a]:text-brand-700 [&_a]:underline " +
          "[&_p:empty]:min-h-[1em]",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // Emit empty string (not "<p></p>") when the editor is really empty, so
      // downstream checks like `if (bio) …` behave as expected.
      onChange(editor.isEmpty ? "" : html);
    },
  });

  // If the parent replaces `value` externally (e.g. loading a different row
  // into the same open form), sync the editor content without losing focus.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value === current) return;
    if (editor.isEmpty && (value === "" || value === "<p></p>")) return;
    editor.commands.setContent(value || "", { emitUpdate: false });
  }, [value, editor]);

  return (
    <div className="overflow-hidden rounded-xl border border-line">
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}
