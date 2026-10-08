interface Props {
  onAddElement: (type: string, parentId?: string | null) => void;
}

const ElementsPanel = ({ onAddElement }: Props) => {
  const structureElements = [
    {
      type: "container",
      label: "Container",
      icon: "▣",
    },

    {
      type: "row",
      label: "Row",
      icon: "▤",
    },

    {
      type: "column",
      label: "Column",
      icon: "▥",
    },

    {
      type: "block",
      label: "Block",
      icon: "□",
    },
  ];

  const elements = [
    {
      type: "logo",
      label: "Logo",
      icon: "🖼️",
    },

    {
      type: "menu",
      label: "Menu",
      icon: "☰",
    },

    {
      type: "heading",
      label: "Heading",
      icon: "H",
    },

    {
      type: "text",
      label: "Text",
      icon: "T",
    },

    {
      type: "button",
      label: "Button",
      icon: "🔘",
    },

    {
      type: "icon",
      label: "Icon",
      icon: "⭐",
    },

    {
      type: "social",
      label: "Social Icons",
      icon: "🔗",
    },

    {
      type: "image",
      label: "Image",
      icon: "🌄",
    },

    {
      type: "search",
      label: "Search",
      icon: "🔍",
    },

    {
      type: "divider",
      label: "Divider",
      icon: "➖",
    },

    {
      type: "spacer",
      label: "Spacer",
      icon: "↕️",
    },

    {
      type: "html",
      label: "HTML",
      icon: "</>",
    },
  ];

  const handleDragStart = (event: React.DragEvent, type: string) => {
    event.dataTransfer.effectAllowed = "copy";

    event.dataTransfer.setData("application/hf-element", type);
  };

  const renderElement = (item: {
    type: string;
    label: string;
    icon: string;
  }) => {
    return (
      <button
        key={item.type}
        type="button"
        className="hf-element-panel-item"
        draggable
        onDragStart={(event) => handleDragStart(event, item.type)}
        onClick={() => onAddElement(item.type)}
      >
        <span className="hf-element-panel-icon">{item.icon}</span>

        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <div className="hf-elements-panel">
      <div className="hf-panel-title">
        <strong>Elements</strong>

        <span>Drag & Drop</span>
      </div>

      <div className="hf-elements-section">
        <div className="hf-elements-section-title">Structure</div>

        <div className="hf-elements-grid">
          {structureElements.map(renderElement)}
        </div>
      </div>

      <div className="hf-elements-section">
        <div className="hf-elements-section-title">Basic Elements</div>

        <div className="hf-elements-grid">{elements.map(renderElement)}</div>
      </div>
    </div>
  );
};

export default ElementsPanel;
