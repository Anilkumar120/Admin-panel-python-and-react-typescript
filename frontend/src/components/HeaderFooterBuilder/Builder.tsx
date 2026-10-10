
import { useEffect, useState } from "react";
import { getHeaderFooterMenus } from "../../api/headerFooter";

import ElementsPanel from "./ElementsPanel";
import Canvas from "./Canvas";
import ElementSettings from "./ElementSettings";

interface BuilderProps {
  initialElements?: any[];
  menus?: any[];
  onChange?: (elements: any[]) => void;
  initialType?: "header" | "footer";
}

const STRUCTURE_ELEMENTS = ["container", "row", "column", "block"];

const canHaveChildren = (type: string) =>
  STRUCTURE_ELEMENTS.includes(type);

const normalizeElements = (elements: any[] = []): any[] =>
  elements.map((element: any) => ({
    ...element,
    id: String(element.id),
    settings: element.settings || {},
    children: normalizeElements(element.children || []),
  }));

const normalizeMenus = (response: any): any[] => {
  const candidates = [
    response,
    response?.data,
    response?.menus,
    response?.data?.menus,
    response?.data?.data,
  ];

  const list = candidates.find(Array.isArray);

  if (!list) return [];

  return list.map((menu: any) => ({
    ...menu,
    id: String(menu.id ?? menu._id ?? menu.menu_id ?? ""),
    name: menu.name ?? menu.title ?? menu.label ?? "Untitled Menu",
    items: Array.isArray(menu.items)
      ? menu.items
      : Array.isArray(menu.menu_items)
        ? menu.menu_items
        : Array.isArray(menu.menuItems)
          ? menu.menuItems
          : [],
  })).filter((menu: any) => menu.id !== "");
};

const Builder = ({
  initialElements = [],
  menus: providedMenus,
  onChange = () => {},
  initialType = "header",
}: BuilderProps) => {
  const [elements, setElements] = useState<any[]>(() =>
    normalizeElements(initialElements)
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fetchedMenus, setFetchedMenus] = useState<any[]>([]);
  const [menusLoading, setMenusLoading] = useState(false);
  const [menusError, setMenusError] = useState("");

  // Parent se menus nahi mile ya empty array mila, to API se fetch karo.
  useEffect(() => {
    if (providedMenus && providedMenus.length > 0) {
      setMenusError("");
      return;
    }

    let active = true;

    const loadMenus = async () => {
      setMenusLoading(true);
      setMenusError("");

      try {
        const response = await getHeaderFooterMenus();

        if (!active) return;

        const result = normalizeMenus(response);
        setFetchedMenus(result);

        if (result.length === 0) {
          setMenusError(
            "No menus found. Create a menu first or check the menus API."
          );
        }
      } catch (error) {
        console.error("Failed to load header/footer menus:", error);

        if (active) {
          setFetchedMenus([]);
          setMenusError(
            "Menus could not be loaded. Check your login, permissions and API."
          );
        }
      } finally {
        if (active) setMenusLoading(false);
      }
    };

    loadMenus();

    return () => {
      active = false;
    };
  }, [providedMenus]);

  const menus = normalizeMenus(
    providedMenus && providedMenus.length > 0
      ? providedMenus
      : fetchedMenus
  );

  const selectedElement = findElement(elements, selectedId);

  const updateElements = (newElements: any[]) => {
    setElements(newElements);
    onChange(newElements);
  };

  const addElement = (type: string, parentId?: string | null) => {
    const newElement = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      type,
      settings: getDefaultSettings(type),
      children: [],
    };

    if (!parentId) {
      updateElements([...elements, newElement]);
      setSelectedId(newElement.id);
      return;
    }

    const newElements = addChildToElement(elements, parentId, newElement);
    updateElements(newElements);
    setSelectedId(newElement.id);
  };

  const updateElement = (elementId: string, settings: any) => {
    const newElements = updateElementSettings(elements, elementId, settings);
    updateElements(newElements);
  };

  const removeElement = (elementId: string) => {
    updateElements(removeElementById(elements, elementId));

    if (selectedId === elementId) {
      setSelectedId(null);
    }
  };

  const moveElement = (activeId: string, overId: string) => {
    if (!activeId || !overId || activeId === overId) return;

    const activeElement = findElement(elements, activeId);
    const targetElement = findElement(elements, overId);

    if (!activeElement || !targetElement) return;
    if (containsElement(activeElement, overId)) return;

    const newElements = removeElementById(elements, activeId);

    // Target element ke parent ko removal ke baad dobara find karo.
    const updatedTarget = findElement(newElements, overId);
    if (!updatedTarget) return;

    let result: any[];

    if (canHaveChildren(updatedTarget.type)) {
      result = addChildToElement(newElements, overId, activeElement);
    } else {
      const targetParent = findParentId(newElements, overId);
      result = insertBeforeElement(
        newElements,
        targetParent,
        overId,
        activeElement
      );
    }

    updateElements(result);
  };

  return (
    <div className="hf-builder" data-template-type={initialType}>
      <div className="hf-builder-left">
        <ElementsPanel onAddElement={addElement} />
      </div>

      <div className="hf-builder-center">
        {menusLoading && (
          <div className="hf-menu-status">Loading menus...</div>
        )}

        {!menusLoading && menusError && (
          <div className="hf-menu-status hf-menu-status-error">
            {menusError}
          </div>
        )}

        <Canvas
          elements={elements}
          selectedId={selectedId}
          menus={menus}
          onSelect={setSelectedId}
          onDelete={removeElement}
          onMove={moveElement}
          onAddElement={addElement}
        />
      </div>

      <div className="hf-builder-right">
        <ElementSettings
          element={selectedElement}
          menus={menus}
          onChange={(settings: any) => {
            if (selectedId) {
              updateElement(selectedId, settings);
            }
          }}
        />
      </div>
    </div>
  );
};

const findElement = (
  elements: any[],
  id: string | null
): any | null => {
  if (!id) return null;

  for (const element of elements) {
    if (String(element.id) === String(id)) return element;

    const found = findElement(element.children || [], id);
    if (found) return found;
  }

  return null;
};

const containsElement = (element: any, id: string): boolean => {
  for (const child of element.children || []) {
    if (String(child.id) === String(id)) return true;
    if (containsElement(child, id)) return true;
  }

  return false;
};

const addChildToElement = (
  elements: any[],
  parentId: string,
  child: any
): any[] =>
  elements.map((element: any) => {
    if (String(element.id) === String(parentId)) {
      return {
        ...element,
        children: [...(element.children || []), child],
      };
    }

    return {
      ...element,
      children: addChildToElement(
        element.children || [],
        parentId,
        child
      ),
    };
  });

const updateElementSettings = (
  elements: any[],
  elementId: string,
  settings: any
): any[] =>
  elements.map((element: any) => {
    if (String(element.id) === String(elementId)) {
      return {
        ...element,
        settings: {
          ...(element.settings || {}),
          ...settings,
        },
      };
    }

    return {
      ...element,
      children: updateElementSettings(
        element.children || [],
        elementId,
        settings
      ),
    };
  });

const removeElementById = (
  elements: any[],
  elementId: string
): any[] =>
  elements
    .filter((element: any) => String(element.id) !== String(elementId))
    .map((element: any) => ({
      ...element,
      children: removeElementById(
        element.children || [],
        elementId
      ),
    }));

const findParentId = (
  elements: any[],
  childId: string,
  parentId: string | null = null
): string | null => {
  for (const element of elements) {
    if (String(element.id) === String(childId)) return parentId;

    const found = findParentId(
      element.children || [],
      childId,
      String(element.id)
    );

    if (found !== null) return found;
  }

  return null;
};

const insertBeforeElement = (
  elements: any[],
  parentId: string | null,
  targetId: string,
  elementToInsert: any
): any[] => {
  if (!parentId) {
    const result = [...elements];
    const index = result.findIndex(
      (element) => String(element.id) === String(targetId)
    );

    if (index === -1) return result;

    result.splice(index, 0, elementToInsert);
    return result;
  }

  return elements.map((element: any) => {
    if (String(element.id) === String(parentId)) {
      const children = [...(element.children || [])];
      const index = children.findIndex(
        (child) => String(child.id) === String(targetId)
      );

      if (index !== -1) {
        children.splice(index, 0, elementToInsert);
      }

      return { ...element, children };
    }

    return {
      ...element,
      children: insertBeforeElement(
        element.children || [],
        parentId,
        targetId,
        elementToInsert
      ),
    };
  });
};

const getDefaultSettings = (type: string) => {
  switch (type) {
    case "container":
      return {
        width: "100%",
        direction: "column",
        gap: 20,
        paddingTop: 20,
        paddingRight: 20,
        paddingBottom: 20,
        paddingLeft: 20,
        background: "transparent",
        align: "stretch",
      };

    case "row":
      return {
        direction: "row",
        gap: 20,
        align: "stretch",
        justify: "flex-start",
        wrap: true,
      };

    case "column":
      return {
        width: 100,
        minHeight: 80,
        paddingTop: 10,
        paddingRight: 10,
        paddingBottom: 10,
        paddingLeft: 10,
        background: "transparent",
      };

    case "block":
      return {
        width: "100%",
        gap: 10,
        paddingTop: 10,
        paddingRight: 10,
        paddingBottom: 10,
        paddingLeft: 10,
        background: "transparent",
      };

    case "logo":
      return { src: "", media_id: "", width: 150, link: "/" };

    case "menu":
      return {
        menuId: "",
        layout: "horizontal",
        fontSize: 16,
        textColor: "#222222",
        hoverColor: "#0c2f55",
        backgroundColor: "transparent",
        itemGap: 25,
      };

    case "heading":
      return {
        text: "Your Heading",
        tag: "h2",
        fontSize: 28,
        color: "#222222",
        align: "left",
        marginTop: 0,
        marginBottom: 10,
      };

    case "text":
      return {
        text: "<p>Your text goes here...</p>",
        fontSize: 16,
        color: "#333333",
        align: "left",
        lineHeight: 1.6,
      };

    case "button":
      return {
        text: "Click Here",
        url: "#",
        background: "#0c2f55",
        color: "#ffffff",
        fontSize: 16,
        paddingTop: 10,
        paddingRight: 20,
        paddingBottom: 10,
        paddingLeft: 20,
        borderRadius: 5,
        align: "left",
      };

    case "icon":
      return {
        icon: "home",
        size: 30,
        color: "#0c2f55",
        link: "#",
        align: "left",
      };

    case "social":
      return {
        size: 30,
        gap: 10,
        align: "left",
        color: "#0c2f55",
        items: [
          { id: "facebook", platform: "facebook", url: "#" },
          { id: "instagram", platform: "instagram", url: "#" },
          { id: "youtube", platform: "youtube", url: "#" },
        ],
      };

    case "image":
      return { src: "", media_id: "", width: 300, link: "#", alt: "" };

    case "search":
      return { placeholder: "Search...", width: 250, height: 40 };

    case "divider":
      return { color: "#dddddd", thickness: 1, width: 100, style: "solid" };

    case "spacer":
      return { height: 30 };

    case "html":
      return { html: "<div>Custom HTML</div>" };

    default:
      return {};
  }
};

export default Builder;
