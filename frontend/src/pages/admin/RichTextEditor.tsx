import { useEffect, useRef, useState } from "react";
import MediaPicker, { type PickedMedia } from "./MediaPicker";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
}

const RichTextEditor = ({
  value,
  onChange,
  placeholder = "Type here...",
  minHeight = 200,
}: RichTextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLTextAreaElement>(null);
  const isInternalChange = useRef(false);
  const [mode, setMode] = useState<"visual" | "code">("visual");
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});
  const savedRange = useRef<Range | null>(null);
  const savedCodeSelection = useRef<{ start: number; end: number } | null>(null);

  const handleMediaSelect = (media: PickedMedia | PickedMedia[]) => {
    const picked = Array.isArray(media) ? media[0] : media;
    if (!picked) return;

    const imageHtml = `<img src="${picked.url}" alt="${picked.alt.replace(/"/g, "&quot;")}" />`;
    if (mode === "code") {
      const textarea = codeRef.current;
      const selection = savedCodeSelection.current;
      if (!textarea || !selection) return;
      const currentValue = textarea.value;
      const nextValue =
        currentValue.slice(0, selection.start) +
        imageHtml +
        currentValue.slice(selection.end);
      onChange(nextValue);
      requestAnimationFrame(() => {
        textarea.focus();
        const cursor = selection.start + imageHtml.length;
        textarea.setSelectionRange(cursor, cursor);
      });
    } else {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      const selection = window.getSelection();
      if (savedRange.current && editor.contains(savedRange.current.commonAncestorContainer)) {
        selection?.removeAllRanges();
        selection?.addRange(savedRange.current);
      } else if (selection) {
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      document.execCommand("insertImage", false, picked.url);
      isInternalChange.current = true;
      onChange(editor.innerHTML);
    }
    setMediaPickerOpen(false);
  };

  // ============ SYNC VALUE ============
  useEffect(() => {
    if (mode === "visual" && editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || "";
      }
    }
    isInternalChange.current = false;
  }, [value, mode]);

  // ============ VISUAL MODE HANDLERS ============
  const handleInput = () => {
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
      updateActiveFormats();
    }
  };

  const updateActiveFormats = () => {
    const formats: Record<string, boolean> = {};
    ["bold", "italic", "underline", "strikeThrough",
      "insertUnorderedList", "insertOrderedList",
      "justifyLeft", "justifyCenter", "justifyRight", "justifyFull"].forEach((cmd) => {
      try {
        formats[cmd] = document.queryCommandState(cmd);
      } catch {
        formats[cmd] = false;
      }
    });
    setActiveFormats(formats);
  };

  const exec = (command: string, arg?: string) => {
    document.execCommand(command, false, arg);
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
      editorRef.current.focus();
      updateActiveFormats();
    }
  };

  const handleLink = () => {
    const url = window.prompt("Enter URL:", "https://");
    if (url) {
      editorRef.current?.focus();
      exec("createLink", url);
    }
  };

  const handleBlockFormat = (tag: string) => {
    exec("formatBlock", tag);
  };

  const handleTextColor = () => {
    const color = window.prompt("Enter text color (hex):", "#1a1a2e");
    if (color) exec("foreColor", color);
  };

  const handleBgColor = () => {
    const color = window.prompt("Enter highlight color:", "#ffff00");
    if (color) exec("hiliteColor", color);
  };

  // ============ CODE MODE HANDLERS ============
  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  // Insert text at cursor position in the code textarea
  const insertInCode = (before: string, after: string = "") => {
    const textarea = codeRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = textarea.value;
    const selectedText = currentValue.substring(start, end);

    const newValue =
      currentValue.substring(0, start) +
      before +
      selectedText +
      after +
      currentValue.substring(end);

    onChange(newValue);

    // Restore cursor position after insert
    setTimeout(() => {
      textarea.focus();
      const newCursor = start + before.length + selectedText.length + after.length;
      textarea.setSelectionRange(newCursor, newCursor);
    }, 0);
  };

  return (
    <div className="rich-text-editor">
      {/* ============ TOP BAR ============ */}
      <div className="rte-topbar">
        <button
          type="button"
          className="rte-add-media"
          onClick={() => {
            if (mode === "code" && codeRef.current) {
              savedCodeSelection.current = {
                start: codeRef.current.selectionStart,
                end: codeRef.current.selectionEnd,
              };
            } else {
              const selection = window.getSelection();
              savedRange.current =
                selection && selection.rangeCount > 0
                  ? selection.getRangeAt(0).cloneRange()
                  : null;
            }
            setMediaPickerOpen(true);
          }}
        >
          <span className="rte-media-icon">🖼</span> Add Media
        </button>

        <div className="rte-tabs">
          <button
            type="button"
            className={`rte-tab ${mode === "visual" ? "active" : ""}`}
            onClick={() => setMode("visual")}
          >
            Visual
          </button>
          <button
            type="button"
            className={`rte-tab ${mode === "code" ? "active" : ""}`}
            onClick={() => setMode("code")}
          >
            Code
          </button>
          <button type="button" className="rte-tab" title="Fullscreen">
            ⛶
          </button>
        </div>
      </div>

      {/* ============ VISUAL MODE ============ */}
      {mode === "visual" && (
        <>
          {/* Toolbar Row 1 */}
          <div className="rte-toolbar">
            <select
              className="rte-format-select"
              onChange={(e) => {
                handleBlockFormat(e.target.value);
                e.target.value = "";
              }}
              defaultValue=""
            >
              <option value="" disabled>
                Paragraph
              </option>
              <option value="p">Paragraph</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
              <option value="h4">Heading 4</option>
              <option value="h5">Heading 5</option>
              <option value="h6">Heading 6</option>
              <option value="pre">Preformatted</option>
            </select>

            <button
              type="button"
              className={`rte-btn ${activeFormats.bold ? "active" : ""}`}
              onClick={() => exec("bold")}
              title="Bold"
            >
              <b>B</b>
            </button>
            <button
              type="button"
              className={`rte-btn ${activeFormats.italic ? "active" : ""}`}
              onClick={() => exec("italic")}
              title="Italic"
            >
              <i>I</i>
            </button>
            <button
              type="button"
              className={`rte-btn ${activeFormats.underline ? "active" : ""}`}
              onClick={() => exec("underline")}
              title="Underline"
            >
              <u>U</u>
            </button>
            <button
              type="button"
              className={`rte-btn ${activeFormats.strikeThrough ? "active" : ""}`}
              onClick={() => exec("strikeThrough")}
              title="Strikethrough"
            >
              S̶
            </button>

            <div className="rte-divider" />

            <button
              type="button"
              className={`rte-btn ${activeFormats.insertUnorderedList ? "active" : ""}`}
              onClick={() => exec("insertUnorderedList")}
              title="Bullet List"
            >
              ≡
            </button>
            <button
              type="button"
              className={`rte-btn ${activeFormats.insertOrderedList ? "active" : ""}`}
              onClick={() => exec("insertOrderedList")}
              title="Numbered List"
            >
              1≡
            </button>

            <div className="rte-divider" />

            <button
              type="button"
              className="rte-btn"
              onClick={() => exec("outdent")}
              title="Decrease Indent"
            >
              ⇤
            </button>
            <button
              type="button"
              className="rte-btn"
              onClick={() => exec("indent")}
              title="Increase Indent"
            >
              ⇥
            </button>

            <div className="rte-divider" />

            <button
              type="button"
              className="rte-btn rte-link-btn"
              onClick={handleLink}
              title="Insert/Edit Link"
            >
              🔗
            </button>
            <button
              type="button"
              className="rte-btn"
              onClick={() => exec("unlink")}
              title="Remove Link"
            >
              ⛓️‍💥
            </button>

            <div className="rte-divider" />

            <button
              type="button"
              className="rte-btn"
              onClick={() => exec("insertHorizontalRule")}
              title="Horizontal Line"
            >
              —
            </button>

            <button
              type="button"
              className="rte-btn"
              onClick={() => exec("superscript")}
              title="Superscript"
            >
              X²
            </button>
            <button
              type="button"
              className="rte-btn"
              onClick={() => exec("subscript")}
              title="Subscript"
            >
              X₂
            </button>
          </div>

          {/* Toolbar Row 2 */}
          <div className="rte-toolbar">
            <select
              className="rte-format-select small"
              onChange={(e) => {
                exec("fontSize", e.target.value);
                e.target.value = "";
              }}
              defaultValue=""
            >
              <option value="" disabled>
                A
              </option>
              <option value="1">8pt</option>
              <option value="2">10pt</option>
              <option value="3">12pt</option>
              <option value="4">14pt</option>
              <option value="5">18pt</option>
              <option value="6">24pt</option>
              <option value="7">36pt</option>
            </select>

            <button
              type="button"
              className="rte-btn"
              onClick={handleTextColor}
              title="Text Color"
            >
              A
            </button>
            <button
              type="button"
              className="rte-btn"
              onClick={handleBgColor}
              title="Highlight"
            >
              🖍
            </button>
            <button
              type="button"
              className="rte-btn"
              onClick={() => exec("removeFormat")}
              title="Clear Formatting"
            >
              ⌫
            </button>
            <button
              type="button"
              className="rte-btn"
              onClick={() => exec("insertHTML", "<blockquote>Quote</blockquote>")}
              title="Blockquote"
            >
              ❝
            </button>

            <div className="rte-divider" />

            <button
              type="button"
              className={`rte-btn ${activeFormats.justifyLeft ? "active" : ""}`}
              onClick={() => exec("justifyLeft")}
              title="Align Left"
            >
              ⬅
            </button>
            <button
              type="button"
              className={`rte-btn ${activeFormats.justifyCenter ? "active" : ""}`}
              onClick={() => exec("justifyCenter")}
              title="Align Center"
            >
              ↔
            </button>
            <button
              type="button"
              className={`rte-btn ${activeFormats.justifyRight ? "active" : ""}`}
              onClick={() => exec("justifyRight")}
              title="Align Right"
            >
              ➡
            </button>
            <button
              type="button"
              className={`rte-btn ${activeFormats.justifyFull ? "active" : ""}`}
              onClick={() => exec("justifyFull")}
              title="Justify"
            >
              ☰
            </button>

            <div className="rte-divider" />

            <button
              type="button"
              className="rte-btn"
              onClick={() => exec("undo")}
              title="Undo"
            >
              ↺
            </button>
            <button
              type="button"
              className="rte-btn"
              onClick={() => exec("redo")}
              title="Redo"
            >
              ↻
            </button>
          </div>

          {/* Editable Content */}
          <div
            ref={editorRef}
            className="rte-content"
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onBlur={handleInput}
            onKeyUp={updateActiveFormats}
            onMouseUp={updateActiveFormats}
            data-placeholder={placeholder}
            style={{ minHeight }}
          />
        </>
      )}

      {/* ============ CODE MODE ============ */}
      {mode === "code" && (
        <>
          {/* Quick-insert toolbar (like Elementor's code view) */}
          <div className="rte-code-toolbar">
            <button
              type="button"
              className="rte-code-quick-btn"
              onClick={() => insertInCode("<b>", "</b>")}
              title="Bold"
            >
              b
            </button>
            <button
              type="button"
              className="rte-code-quick-btn"
              onClick={() => insertInCode("<i>", "</i>")}
              title="Italic"
            >
              i
            </button>
            <button
              type="button"
              className="rte-code-quick-btn"
              onClick={() => {
                const url = window.prompt("Enter URL:", "https://");
                if (url) insertInCode(`<a href="${url}">`, "</a>");
              }}
              title="Link"
            >
              link
            </button>
            <button
              type="button"
              className="rte-code-quick-btn"
              onClick={() => insertInCode("<del>", "</del>")}
              title="Deleted text"
            >
              del
            </button>
            <button
              type="button"
              className="rte-code-quick-btn"
              onClick={() => {
                const url = window.prompt("Enter image URL:");
                if (url) insertInCode(`<img src="${url}" alt="" />`);
              }}
              title="Image"
            >
              img
            </button>
            <button
              type="button"
              className="rte-code-quick-btn"
              onClick={() => insertInCode(">", "")}
              title="Close tag"
            >
              close tags
            </button>
          </div>

          {/* Raw code editor */}
          <textarea
            ref={codeRef}
            className="rte-code-editor"
            value={value || ""}
            onChange={handleCodeChange}
            spellCheck={false}
            style={{ minHeight }}
            placeholder="<p>Enter your HTML code here...</p>"
          />
        </>
      )}

      {/* Footer Info */}
      <div className="rte-footer">
        <span className="rte-footer-label">
          {mode === "visual" ? "P" : "HTML"}
        </span>
        <span className="rte-footer-resize">◢</span>
      </div>
      <MediaPicker
        isOpen={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={handleMediaSelect}
        fileType="image"
      />
    </div>
  );
};

export default RichTextEditor;