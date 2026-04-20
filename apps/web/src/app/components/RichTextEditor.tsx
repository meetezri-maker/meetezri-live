import { motion } from "motion/react";
import { useState, useRef, useEffect } from "react";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
  Smile,
  Image,
  Paperclip,
  Undo,
  Redo,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight
} from "lucide-react";
import { cn } from "./ui/utils";
import { htmlToPlainText } from "../../lib/htmlPlainText";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  hideMoodSelector?: boolean;
}

export function RichTextEditor({ value, onChange, placeholder = "Start writing...", className, hideMoodSelector = false }: RichTextEditorProps) {
  const [selectedMood, setSelectedMood] = useState<string>("");
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef<Range | null>(null);

  const moods = [
    { emoji: "😊", label: "Happy", color: "text-green-500" },
    { emoji: "😌", label: "Calm", color: "text-blue-500" },
    { emoji: "😰", label: "Anxious", color: "text-orange-500" },
    { emoji: "😢", label: "Sad", color: "text-gray-500" },
    { emoji: "🤩", label: "Excited", color: "text-purple-500" },
    { emoji: "😡", label: "Angry", color: "text-red-500" }
  ];

  const toolbarButtons: Array<{
    icon: any;
    label: string;
    action?: string;
    value?: string;
  }> = [
    { icon: Bold, label: "Bold", action: "bold" },
    { icon: Italic, label: "Italic", action: "italic" },
    { icon: Underline, label: "Underline", action: "underline" },
    { icon: null, label: "divider" },
    { icon: List, label: "Bullet List", action: "insertUnorderedList" },
    { icon: ListOrdered, label: "Numbered List", action: "insertOrderedList" },
    { icon: Quote, label: "Quote", action: "formatBlock", value: "<blockquote>" },
    { icon: null, label: "divider" },
    { icon: AlignLeft, label: "Align Left", action: "justifyLeft" },
    { icon: AlignCenter, label: "Align Center", action: "justifyCenter" },
    { icon: AlignRight, label: "Align Right", action: "justifyRight" },
  ];

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    selectionRef.current = sel.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    if (selectionRef.current) {
      sel.addRange(selectionRef.current);
    }
  };

  const focusEditor = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    restoreSelection();
  };

  const handleFormat = (action: string, value?: string) => {
    focusEditor();
    const ok = document.execCommand(action, false, value ?? null);
    if (!ok) {
      // Fallback for browsers where some execCommand actions are flaky.
      const selectedText = (window.getSelection()?.toString() || "").trim();
      if (action === "insertUnorderedList") {
        const item = selectedText || "List item";
        document.execCommand("insertHTML", false, `<ul><li>${item}</li></ul>`);
      } else if (action === "insertOrderedList") {
        const item = selectedText || "List item";
        document.execCommand("insertHTML", false, `<ol><li>${item}</li></ol>`);
      } else if (action === "formatBlock" && (value === "blockquote" || value === "<blockquote>")) {
        const content = selectedText || "Quote";
        document.execCommand("insertHTML", false, `<blockquote>${content}</blockquote>`);
      }
    }
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleImageInsert = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === "string" ? reader.result : "";
      if (!src) return;
      focusEditor();
      document.execCommand("insertImage", false, src);
      if (editorRef.current) onChange(editorRef.current.innerHTML);
    };
    reader.readAsDataURL(file);
  };

  const handleFileAttach = (file: File) => {
    const url = URL.createObjectURL(file);
    focusEditor();
    document.execCommand("insertHTML", false, `<a href="${url}" target="_blank" rel="noopener noreferrer">${file.name}</a>`);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  return (
    <div className={cn("border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800", className)}>
      {/* Toolbar */}
      <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700 p-2">
        <div className="flex flex-wrap items-center gap-1">
          {toolbarButtons.map((button, index) => {
            if (button.label === "divider") {
              return <div key={index} className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1" />;
            }

            const Icon = button.icon!;
            return (
              <motion.button
                key={button.label}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleFormat(button.action!, button.value)}
                className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title={button.label}
              >
                <Icon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
              </motion.button>
            );
          })}

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1" />

          {/* Undo/Redo */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleFormat("undo")}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Undo"
          >
            <Undo className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleFormat("redo")}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Redo"
          >
            <Redo className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          </motion.button>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1" />

          {/* Media Buttons */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => imageInputRef.current?.click()}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Insert Image"
          >
            <Image className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Attach File"
          >
            <Paperclip className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          </motion.button>
        </div>
      </div>

      {/* Mood Selector */}
      {!hideMoodSelector && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-gray-300 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2">
            <Smile className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">How are you feeling?</span>
            <div className="flex gap-2 ml-2">
              {moods.map((mood) => (
                <motion.button
                  key={mood.label}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedMood(mood.label)}
                  className={`text-2xl transition-all ${
                    selectedMood === mood.label
                      ? "scale-125 drop-shadow-lg"
                      : "opacity-50 hover:opacity-100"
                  }`}
                  title={mood.label}
                >
                  {mood.emoji}
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => {
          saveSelection();
          onChange(e.currentTarget.innerHTML);
        }}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onFocus={saveSelection}
        className="min-h-[300px] p-4 focus:outline-none text-gray-900 dark:text-gray-100 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 dark:empty:before:text-gray-500"
        data-placeholder={placeholder}
      />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageInsert(file);
          e.currentTarget.value = "";
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileAttach(file);
          e.currentTarget.value = "";
        }}
      />

      {/* Footer Stats */}
      <div className="bg-gray-50 dark:bg-gray-900 border-t border-gray-300 dark:border-gray-700 px-4 py-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-4">
          <span>
            {value ? htmlToPlainText(value).split(/\s+/).filter(Boolean).length : 0} words
          </span>
          <span>{value ? htmlToPlainText(value).length : 0} characters</span>
        </div>
        {!hideMoodSelector && selectedMood && (
          <div className="flex items-center gap-2">
            <span>Mood:</span>
            <span className="font-medium">{selectedMood}</span>
            <span>{moods.find(m => m.label === selectedMood)?.emoji}</span>
          </div>
        )}
      </div>
    </div>
  );
}
