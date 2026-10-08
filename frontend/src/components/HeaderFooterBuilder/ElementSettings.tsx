import { useState } from "react";

import MediaSelector from "../../components/Media/MediaSelector";

import { getMediaUrl, type MediaItem } from "../../api/media";

import {
  FaFacebookF,
  FaInstagram,
  FaYoutube,
  FaLinkedinIn,
  FaWhatsapp,
  FaTelegramPlane,
  FaPinterestP,
  FaGithub,
  FaTwitter,
  FaHome,
  FaUser,
  FaSearch,
  FaPhone,
  FaEnvelope,
  FaBars,
  FaStar,
  FaHeart,
  FaCheck,
  FaArrowRight,
  FaGlobe,
  FaMapMarkerAlt,
  FaCalendar,
  FaClock,
  FaShoppingCart,
} from "react-icons/fa";

interface Props {
  element: any;

  menus: any[];

  onChange: (settings: any) => void;
}

const ElementSettings = ({ element, menus, onChange }: Props) => {
  const [iconSearch, setIconSearch] = useState("");

  const [isMediaSelectorOpen, setIsMediaSelectorOpen] = useState(false);

  const [mediaSelectorTarget, setMediaSelectorTarget] = useState<
    "logo" | "image" | null
  >(null);

  if (!element) {
    return (
      <div className="hf-settings-panel">
        <h3>Settings</h3>

        <p>Select an element from the canvas to edit it.</p>
      </div>
    );
  }

  const settings = element.settings || {};

  const update = (key: string, value: any) => {
    onChange({
      ...settings,

      [key]: value,
    });
  };

  const openMediaSelector = (target: "logo" | "image") => {
    setMediaSelectorTarget(target);

    setIsMediaSelectorOpen(true);
  };

  const handleMediaSelect = (media: MediaItem) => {
    if (mediaSelectorTarget !== "logo" && mediaSelectorTarget !== "image") {
      return;
    }

    onChange({
      ...settings,

      media_id: media._id,

      src: media.url,

      alt: settings.alt || media.alt_text || media.title || "",
    });

    setIsMediaSelectorOpen(false);

    setMediaSelectorTarget(null);
  };

  const iconList = [
    {
      name: "home",
      label: "Home",
      icon: FaHome,
    },

    {
      name: "user",
      label: "User",
      icon: FaUser,
    },

    {
      name: "search",
      label: "Search",
      icon: FaSearch,
    },

    {
      name: "phone",
      label: "Phone",
      icon: FaPhone,
    },

    {
      name: "envelope",
      label: "Email",
      icon: FaEnvelope,
    },

    {
      name: "bars",
      label: "Menu",
      icon: FaBars,
    },

    {
      name: "star",
      label: "Star",
      icon: FaStar,
    },

    {
      name: "heart",
      label: "Heart",
      icon: FaHeart,
    },

    {
      name: "check",
      label: "Check",
      icon: FaCheck,
    },

    {
      name: "arrowRight",
      label: "Arrow Right",
      icon: FaArrowRight,
    },

    {
      name: "globe",
      label: "Globe",
      icon: FaGlobe,
    },

    {
      name: "location",
      label: "Location",
      icon: FaMapMarkerAlt,
    },

    {
      name: "calendar",
      label: "Calendar",
      icon: FaCalendar,
    },

    {
      name: "clock",
      label: "Clock",
      icon: FaClock,
    },

    {
      name: "cart",
      label: "Shopping Cart",
      icon: FaShoppingCart,
    },
  ];

  const filteredIcons = iconList.filter((item) =>
    item.label.toLowerCase().includes(iconSearch.toLowerCase()),
  );

  const socialPlatforms = [
    {
      platform: "facebook",
      label: "Facebook",
      icon: FaFacebookF,
    },

    {
      platform: "instagram",
      label: "Instagram",
      icon: FaInstagram,
    },

    {
      platform: "youtube",
      label: "YouTube",
      icon: FaYoutube,
    },

    {
      platform: "linkedin",
      label: "LinkedIn",
      icon: FaLinkedinIn,
    },

    {
      platform: "whatsapp",
      label: "WhatsApp",
      icon: FaWhatsapp,
    },

    {
      platform: "telegram",
      label: "Telegram",
      icon: FaTelegramPlane,
    },

    {
      platform: "pinterest",
      label: "Pinterest",
      icon: FaPinterestP,
    },

    {
      platform: "github",
      label: "GitHub",
      icon: FaGithub,
    },

    {
      platform: "twitter",
      label: "X / Twitter",
      icon: FaTwitter,
    },
  ];

  const addSocialIcon = (platform: string) => {
    const currentItems = settings.items || [];

    if (currentItems.some((item: any) => item.platform === platform)) {
      return;
    }

    const newItem = {
      id: `${platform}-${Date.now()}`,

      platform,

      url: "#",

      color: settings.color || "#0c2f55",
    };

    update("items", [...currentItems, newItem]);
  };

  const updateSocialIcon = (id: string, key: string, value: any) => {
    const newItems = (settings.items || []).map((item: any) => {
      if (item.id !== id) {
        return item;
      }

      return {
        ...item,

        [key]: value,
      };
    });

    update("items", newItems);
  };

  const removeSocialIcon = (id: string) => {
    const newItems = (settings.items || []).filter(
      (item: any) => item.id !== id,
    );

    update("items", newItems);
  };

  return (
    <div className="hf-settings-panel">
      <h3>{element.type} Settings</h3>

      {element.type === "container" && (
        <>
          <label>Width</label>

          <select
            value={settings.width || "100%"}
            onChange={(event) => update("width", event.target.value)}
          >
            <option value="100%">Full Width</option>

            <option value="1200px">1200px</option>

            <option value="1140px">1140px</option>

            <option value="1000px">1000px</option>

            <option value="800px">800px</option>
          </select>

          <label>Direction</label>

          <select
            value={settings.direction || "column"}
            onChange={(event) => update("direction", event.target.value)}
          >
            <option value="column">Column</option>

            <option value="row">Row</option>
          </select>

          <label>Gap</label>

          <input
            type="number"
            min="0"
            value={settings.gap ?? 20}
            onChange={(event) => update("gap", Number(event.target.value))}
          />

          <label>Background</label>

          <input
            type="color"
            value={
              settings.background === "transparent"
                ? "#ffffff"
                : settings.background || "#ffffff"
            }
            onChange={(event) => update("background", event.target.value)}
          />

          <label>Padding Top</label>

          <input
            type="number"
            value={settings.paddingTop ?? 20}
            onChange={(event) =>
              update("paddingTop", Number(event.target.value))
            }
          />

          <label>Padding Right</label>

          <input
            type="number"
            value={settings.paddingRight ?? 20}
            onChange={(event) =>
              update("paddingRight", Number(event.target.value))
            }
          />

          <label>Padding Bottom</label>

          <input
            type="number"
            value={settings.paddingBottom ?? 20}
            onChange={(event) =>
              update("paddingBottom", Number(event.target.value))
            }
          />

          <label>Padding Left</label>

          <input
            type="number"
            value={settings.paddingLeft ?? 20}
            onChange={(event) =>
              update("paddingLeft", Number(event.target.value))
            }
          />
        </>
      )}

      {element.type === "row" && (
        <>
          <label>Direction</label>

          <select
            value={settings.direction || "row"}
            onChange={(event) => update("direction", event.target.value)}
          >
            <option value="row">Row</option>

            <option value="column">Column</option>
          </select>

          <label>Gap</label>

          <input
            type="number"
            min="0"
            value={settings.gap ?? 20}
            onChange={(event) => update("gap", Number(event.target.value))}
          />

          <label>Align Items</label>

          <select
            value={settings.align || "stretch"}
            onChange={(event) => update("align", event.target.value)}
          >
            <option value="stretch">Stretch</option>

            <option value="flex-start">Start</option>

            <option value="center">Center</option>

            <option value="flex-end">End</option>
          </select>

          <label>Justify Content</label>

          <select
            value={settings.justify || "flex-start"}
            onChange={(event) => update("justify", event.target.value)}
          >
            <option value="flex-start">Start</option>

            <option value="center">Center</option>

            <option value="flex-end">End</option>

            <option value="space-between">Space Between</option>

            <option value="space-around">Space Around</option>
          </select>

          <label>Wrap</label>

          <select
            value={settings.wrap === false ? "nowrap" : "wrap"}
            onChange={(event) => update("wrap", event.target.value === "wrap")}
          >
            <option value="wrap">Wrap</option>

            <option value="nowrap">No Wrap</option>
          </select>
        </>
      )}

      {element.type === "column" && (
        <>
          <label>Width %</label>

          <input
            type="number"
            min="1"
            max="100"
            value={settings.width ?? 100}
            onChange={(event) => update("width", Number(event.target.value))}
          />

          <label>Minimum Height</label>

          <input
            type="number"
            min="0"
            value={settings.minHeight ?? 50}
            onChange={(event) =>
              update("minHeight", Number(event.target.value))
            }
          />

          <label>Background</label>

          <input
            type="color"
            value={
              settings.background === "transparent"
                ? "#ffffff"
                : settings.background || "#ffffff"
            }
            onChange={(event) => update("background", event.target.value)}
          />

          <label>Padding Top</label>

          <input
            type="number"
            value={settings.paddingTop ?? 10}
            onChange={(event) =>
              update("paddingTop", Number(event.target.value))
            }
          />

          <label>Padding Right</label>

          <input
            type="number"
            value={settings.paddingRight ?? 10}
            onChange={(event) =>
              update("paddingRight", Number(event.target.value))
            }
          />

          <label>Padding Bottom</label>

          <input
            type="number"
            value={settings.paddingBottom ?? 10}
            onChange={(event) =>
              update("paddingBottom", Number(event.target.value))
            }
          />

          <label>Padding Left</label>

          <input
            type="number"
            value={settings.paddingLeft ?? 10}
            onChange={(event) =>
              update("paddingLeft", Number(event.target.value))
            }
          />
        </>
      )}

      {element.type === "block" && (
        <>
          <label>Width</label>

          <input
            type="text"
            value={settings.width || "100%"}
            onChange={(event) => update("width", event.target.value)}
          />

          <label>Gap</label>

          <input
            type="number"
            min="0"
            value={settings.gap ?? 10}
            onChange={(event) => update("gap", Number(event.target.value))}
          />

          <label>Background</label>

          <input
            type="color"
            value={
              settings.background === "transparent"
                ? "#ffffff"
                : settings.background || "#ffffff"
            }
            onChange={(event) => update("background", event.target.value)}
          />
        </>
      )}

      {element.type === "logo" && (
        <>
          <label>Logo Image</label>

          <button
            type="button"
            className="hf-upload-button"
            onClick={() => openMediaSelector("logo")}
          >
            Choose From Media Library
          </button>

          {settings.src && (
            <div
              style={{
                marginTop: "15px",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "5px",
              }}
            >
              <strong>Logo Preview</strong>

              <img
                src={getMediaUrl(settings.src)}
                alt="Logo"
                style={{
                  display: "block",
                  width: "100%",
                  maxHeight: "100px",
                  objectFit: "contain",
                  marginTop: "10px",
                }}
              />
            </div>
          )}

          {settings.media_id && (
            <small
              style={{
                display: "block",
                marginTop: "8px",
                color: "#666",
              }}
            >
              Media ID: {settings.media_id}
            </small>
          )}

          <label>Logo Width</label>

          <input
            type="number"
            min="20"
            max="1000"
            value={settings.width || 150}
            onChange={(event) => update("width", Number(event.target.value))}
          />

          <label>Logo Link</label>

          <input
            type="text"
            value={settings.link || "/"}
            onChange={(event) => update("link", event.target.value)}
          />
        </>
      )}

      {element.type === "menu" && (
        <>
          <label>Select Menu</label>

          <select
            value={settings.menuId || ""}
            onChange={(event) => update("menuId", event.target.value)}
          >
            <option value="">Select Menu</option>

            {menus.map((menu) => (
              <option key={menu.id} value={menu.id}>
                {menu.name}
              </option>
            ))}
          </select>

          <label>Layout</label>

          <select
            value={settings.layout || "horizontal"}
            onChange={(event) => update("layout", event.target.value)}
          >
            <option value="horizontal">Horizontal</option>

            <option value="vertical">Vertical</option>
          </select>

          <label>Font Size</label>

          <input
            type="number"
            value={settings.fontSize || 16}
            onChange={(event) => update("fontSize", Number(event.target.value))}
          />

          <label>Text Color</label>

          <input
            type="color"
            value={settings.textColor || "#222222"}
            onChange={(event) => update("textColor", event.target.value)}
          />

          <label>Background Color</label>

          <input
            type="color"
            value={
              settings.backgroundColor === "transparent"
                ? "#ffffff"
                : settings.backgroundColor || "#ffffff"
            }
            onChange={(event) => update("backgroundColor", event.target.value)}
          />

          <label>Item Gap</label>

          <input
            type="number"
            value={settings.itemGap || 25}
            onChange={(event) => update("itemGap", Number(event.target.value))}
          />
        </>
      )}

      {element.type === "heading" && (
        <>
          <label>Heading</label>

          <input
            type="text"
            value={settings.text || ""}
            onChange={(event) => update("text", event.target.value)}
          />

          <label>Heading Tag</label>

          <select
            value={settings.tag || "h2"}
            onChange={(event) => update("tag", event.target.value)}
          >
            <option value="h1">H1</option>

            <option value="h2">H2</option>

            <option value="h3">H3</option>

            <option value="h4">H4</option>

            <option value="h5">H5</option>

            <option value="h6">H6</option>
          </select>

          <label>Font Size</label>

          <input
            type="number"
            value={settings.fontSize || 28}
            onChange={(event) => update("fontSize", Number(event.target.value))}
          />

          <label>Text Color</label>

          <input
            type="color"
            value={settings.color || "#222222"}
            onChange={(event) => update("color", event.target.value)}
          />

          <label>Alignment</label>

          <select
            value={settings.align || "left"}
            onChange={(event) => update("align", event.target.value)}
          >
            <option value="left">Left</option>

            <option value="center">Center</option>

            <option value="right">Right</option>
          </select>
        </>
      )}

      {element.type === "text" && (
        <>
          <label>Text Editor</label>

          <div className="hf-editor-toolbar">
            <button type="button" onClick={() => document.execCommand("bold")}>
              <b>B</b>
            </button>

            <button
              type="button"
              onClick={() => document.execCommand("italic")}
            >
              <i>I</i>
            </button>

            <button
              type="button"
              onClick={() => document.execCommand("underline")}
            >
              <u>U</u>
            </button>

            <button
              type="button"
              onClick={() => document.execCommand("insertUnorderedList")}
            >
              • List
            </button>

            <button
              type="button"
              onClick={() => document.execCommand("insertOrderedList")}
            >
              1. List
            </button>

            <button
              type="button"
              onClick={() => document.execCommand("justifyLeft")}
            >
              L
            </button>

            <button
              type="button"
              onClick={() => document.execCommand("justifyCenter")}
            >
              C
            </button>

            <button
              type="button"
              onClick={() => document.execCommand("justifyRight")}
            >
              R
            </button>
          </div>

          <div
            className="hf-rich-editor"
            contentEditable
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{
              __html: settings.text || "<p>Your text goes here...</p>",
            }}
            onInput={(event) => update("text", event.currentTarget.innerHTML)}
          />

          <label>Font Size</label>

          <input
            type="number"
            value={settings.fontSize || 16}
            onChange={(event) => update("fontSize", Number(event.target.value))}
          />

          <label>Text Color</label>

          <input
            type="color"
            value={settings.color || "#333333"}
            onChange={(event) => update("color", event.target.value)}
          />

          <label>Alignment</label>

          <select
            value={settings.align || "left"}
            onChange={(event) => update("align", event.target.value)}
          >
            <option value="left">Left</option>

            <option value="center">Center</option>

            <option value="right">Right</option>
          </select>

          <label>Line Height</label>

          <input
            type="number"
            step="0.1"
            value={settings.lineHeight || 1.6}
            onChange={(event) =>
              update("lineHeight", Number(event.target.value))
            }
          />
        </>
      )}

      {element.type === "button" && (
        <>
          <label>Button Text</label>

          <input
            type="text"
            value={settings.text || "Click Here"}
            onChange={(event) => update("text", event.target.value)}
          />

          <label>Button URL</label>

          <input
            type="text"
            value={settings.url || "#"}
            onChange={(event) => update("url", event.target.value)}
          />

          <label>Background Color</label>

          <input
            type="color"
            value={settings.background || "#0c2f55"}
            onChange={(event) => update("background", event.target.value)}
          />

          <label>Text Color</label>

          <input
            type="color"
            value={settings.color || "#ffffff"}
            onChange={(event) => update("color", event.target.value)}
          />

          <label>Font Size</label>

          <input
            type="number"
            value={settings.fontSize || 16}
            onChange={(event) => update("fontSize", Number(event.target.value))}
          />

          <label>Border Radius</label>

          <input
            type="number"
            value={settings.borderRadius || 5}
            onChange={(event) =>
              update("borderRadius", Number(event.target.value))
            }
          />

          <label>Alignment</label>

          <select
            value={settings.align || "left"}
            onChange={(event) => update("align", event.target.value)}
          >
            <option value="left">Left</option>

            <option value="center">Center</option>

            <option value="right">Right</option>
          </select>
        </>
      )}

      {element.type === "icon" && (
        <>
          <label>Search Icon</label>

          <input
            type="text"
            value={iconSearch}
            onChange={(event) => setIconSearch(event.target.value)}
            placeholder="Search icons..."
          />

          <div className="hf-icon-grid">
            {filteredIcons.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.name}
                  type="button"
                  className={
                    settings.icon === item.name
                      ? "hf-icon-option active"
                      : "hf-icon-option"
                  }
                  onClick={() => update("icon", item.name)}
                >
                  <Icon size={22} />

                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <label>Icon Size</label>

          <input
            type="number"
            min="10"
            max="200"
            value={settings.size || 30}
            onChange={(event) => update("size", Number(event.target.value))}
          />

          <label>Icon Color</label>

          <input
            type="color"
            value={settings.color || "#0c2f55"}
            onChange={(event) => update("color", event.target.value)}
          />

          <label>Icon Link</label>

          <input
            type="text"
            value={settings.link || "#"}
            onChange={(event) => update("link", event.target.value)}
          />

          <label>Alignment</label>

          <select
            value={settings.align || "left"}
            onChange={(event) => update("align", event.target.value)}
          >
            <option value="left">Left</option>

            <option value="center">Center</option>

            <option value="right">Right</option>
          </select>
        </>
      )}

      {element.type === "social" && (
        <>
          <label>Add Social Icon</label>

          <div className="hf-social-platforms">
            {socialPlatforms.map((item) => {
              const Icon = item.icon;

              const alreadyAdded = (settings.items || []).some(
                (social: any) => social.platform === item.platform,
              );

              return (
                <button
                  key={item.platform}
                  type="button"
                  disabled={alreadyAdded}
                  onClick={() => addSocialIcon(item.platform)}
                  className="hf-social-add"
                >
                  <Icon />

                  <span>{item.label}</span>

                  {alreadyAdded && <small>✓</small>}
                </button>
              );
            })}
          </div>

          <label>Icon Size</label>

          <input
            type="number"
            min="10"
            max="100"
            value={settings.size || 30}
            onChange={(event) => update("size", Number(event.target.value))}
          />

          <label>Icon Gap</label>

          <input
            type="number"
            min="0"
            max="100"
            value={settings.gap || 10}
            onChange={(event) => update("gap", Number(event.target.value))}
          />

          <label>Default Icon Color</label>

          <input
            type="color"
            value={settings.color || "#0c2f55"}
            onChange={(event) => update("color", event.target.value)}
          />

          <label>Alignment</label>

          <select
            value={settings.align || "left"}
            onChange={(event) => update("align", event.target.value)}
          >
            <option value="left">Left</option>

            <option value="center">Center</option>

            <option value="right">Right</option>
          </select>

          <div className="hf-social-list">
            {(settings.items || []).map((item: any) => {
              const platform = socialPlatforms.find(
                (social) => social.platform === item.platform,
              );

              if (!platform) {
                return null;
              }

              const Icon = platform.icon;

              return (
                <div key={item.id} className="hf-social-item">
                  <div className="hf-social-item-title">
                    <Icon />

                    <strong>{platform.label}</strong>
                  </div>

                  <label>URL</label>

                  <input
                    type="text"
                    value={item.url || ""}
                    onChange={(event) =>
                      updateSocialIcon(item.id, "url", event.target.value)
                    }
                    placeholder="https://..."
                  />

                  <label>Color</label>

                  <input
                    type="color"
                    value={item.color || settings.color || "#0c2f55"}
                    onChange={(event) =>
                      updateSocialIcon(item.id, "color", event.target.value)
                    }
                  />

                  <button
                    type="button"
                    className="hf-remove-social"
                    onClick={() => removeSocialIcon(item.id)}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {element.type === "image" && (
        <>
          <label>Image</label>

          <button
            type="button"
            className="hf-upload-button"
            onClick={() => openMediaSelector("image")}
          >
            Choose From Media Library
          </button>

          {settings.src && (
            <div
              style={{
                marginTop: "15px",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "5px",
              }}
            >
              <strong>Image Preview</strong>

              <img
                src={getMediaUrl(settings.src)}
                alt={settings.alt || ""}
                style={{
                  display: "block",
                  width: "100%",
                  maxHeight: "180px",
                  objectFit: "contain",
                  marginTop: "10px",
                }}
              />
            </div>
          )}

          {settings.media_id && (
            <small
              style={{
                display: "block",
                marginTop: "8px",
                color: "#666",
              }}
            >
              Media ID: {settings.media_id}
            </small>
          )}

          <label>Image Width</label>

          <input
            type="number"
            value={settings.width || 300}
            onChange={(event) => update("width", Number(event.target.value))}
          />

          <label>Alt Text</label>

          <input
            type="text"
            value={settings.alt || ""}
            onChange={(event) => update("alt", event.target.value)}
          />

          <label>Link</label>

          <input
            type="text"
            value={settings.link || "#"}
            onChange={(event) => update("link", event.target.value)}
          />
        </>
      )}

      {element.type === "search" && (
        <>
          <label>Placeholder</label>

          <input
            type="text"
            value={settings.placeholder || "Search..."}
            onChange={(event) => update("placeholder", event.target.value)}
          />

          <label>Width</label>

          <input
            type="number"
            value={settings.width || 250}
            onChange={(event) => update("width", Number(event.target.value))}
          />

          <label>Height</label>

          <input
            type="number"
            value={settings.height || 40}
            onChange={(event) => update("height", Number(event.target.value))}
          />
        </>
      )}

      {element.type === "divider" && (
        <>
          <label>Color</label>

          <input
            type="color"
            value={settings.color || "#dddddd"}
            onChange={(event) => update("color", event.target.value)}
          />

          <label>Thickness</label>

          <input
            type="number"
            min="1"
            max="20"
            value={settings.thickness || 1}
            onChange={(event) =>
              update("thickness", Number(event.target.value))
            }
          />

          <label>Width %</label>

          <input
            type="number"
            min="1"
            max="100"
            value={settings.width || 100}
            onChange={(event) => update("width", Number(event.target.value))}
          />

          <label>Style</label>

          <select
            value={settings.style || "solid"}
            onChange={(event) => update("style", event.target.value)}
          >
            <option value="solid">Solid</option>

            <option value="dashed">Dashed</option>

            <option value="dotted">Dotted</option>
          </select>
        </>
      )}

      {element.type === "spacer" && (
        <>
          <label>Height</label>

          <input
            type="number"
            min="1"
            max="1000"
            value={settings.height || 30}
            onChange={(event) => update("height", Number(event.target.value))}
          />
        </>
      )}

      {element.type === "html" && (
        <>
          <label>Custom HTML</label>

          <textarea
            rows={12}
            value={settings.html || ""}
            onChange={(event) => update("html", event.target.value)}
          />
        </>
      )}

      <MediaSelector
        isOpen={isMediaSelectorOpen}
        onClose={() => {
          setIsMediaSelectorOpen(false);

          setMediaSelectorTarget(null);
        }}
        onSelect={handleMediaSelect}
        selectedMediaId={settings.media_id || ""}
      />
    </div>
  );
};

export default ElementSettings;
