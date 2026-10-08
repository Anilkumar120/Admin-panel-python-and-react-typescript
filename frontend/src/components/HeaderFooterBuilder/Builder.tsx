import { useState } from "react";

import ElementsPanel from "./ElementsPanel";

import Canvas from "./Canvas";

import ElementSettings from "./ElementSettings";

interface BuilderProps {
  initialElements?: any[];

  menus?: any[];

  onChange?: (elements: any[]) => void;

  initialType?: "header" | "footer";
}

const STRUCTURE_ELEMENTS = [
  "container",
  "row",
  "column",
  "block",
];

const canHaveChildren = (
  type: string,
) => {
  return STRUCTURE_ELEMENTS.includes(type);
};

const normalizeElements = (
  elements: any[],
): any[] => {
  return (elements || []).map(
    (element: any) => ({
      ...element,

      settings:
        element.settings || {},

      children: normalizeElements(
        element.children || [],
      ),
    }),
  );
};

const Builder = ({
  initialElements = [],
  menus = [],
  onChange = () => {},
  initialType = "header",
}: BuilderProps) => {

  const [
    elements,
    setElements,
  ] = useState<any[]>(
    normalizeElements(
      initialElements,
    ),
  );

  const [
    selectedId,
    setSelectedId,
  ] = useState<string | null>(
    null,
  );

  const selectedElement =
    findElement(
      elements,
      selectedId,
    );

  const updateElements = (
    newElements: any[],
  ) => {
    setElements(newElements);

    onChange(newElements);
  };

  const addElement = (
    type: string,
    parentId?: string | null,
  ) => {

    const newElement = {
      id: `${type}-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)}`,

      type,

      settings:
        getDefaultSettings(type),

      children: [],
    };

    if (!parentId) {

      const newElements = [
        ...elements,
        newElement,
      ];

      updateElements(
        newElements,
      );

      setSelectedId(
        newElement.id,
      );

      return;
    }

    const newElements =
      addChildToElement(
        elements,
        parentId,
        newElement,
      );

    updateElements(
      newElements,
    );

    setSelectedId(
      newElement.id,
    );
  };

  const updateElement = (
    elementId: string,
    settings: any,
  ) => {

    const newElements =
      updateElementSettings(
        elements,
        elementId,
        settings,
      );

    updateElements(
      newElements,
    );
  };

  const removeElement = (
    elementId: string,
  ) => {

    const newElements =
      removeElementById(
        elements,
        elementId,
      );

    updateElements(
      newElements,
    );

    if (
      selectedId ===
      elementId
    ) {
      setSelectedId(null);
    }
  };

  const moveElement = (
    activeId: string,
    overId: string,
  ) => {

    if (
      !activeId ||
      !overId ||
      activeId === overId
    ) {
      return;
    }

    const activeElement =
      findElement(
        elements,
        activeId,
      );

    if (!activeElement) {
      return;
    }

    if (
      containsElement(
        activeElement,
        overId,
      )
    ) {
      return;
    }

    const targetElement =
      findElement(
        elements,
        overId,
      );

    if (!targetElement) {
      return;
    }

    let newElements =
      removeElementById(
        elements,
        activeId,
      );

    if (
      canHaveChildren(
        targetElement.type,
      )
    ) {

      newElements =
        addChildToElement(
          newElements,
          overId,
          activeElement,
        );

      updateElements(
        newElements,
      );

      return;
    }

    const targetParent =
      findParentId(
        newElements,
        overId,
      );

    newElements =
      insertBeforeElement(
        newElements,
        targetParent,
        overId,
        activeElement,
      );

    updateElements(
      newElements,
    );
  };

  const handlePanelDrop = (
    type: string,
    parentId?: string | null,
  ) => {

    addElement(
      type,
      parentId,
    );
  };

  return (
    <div
      className="hf-builder"
      data-template-type={
        initialType
      }
    >

      <div className="hf-builder-left">

        <ElementsPanel
          onAddElement={
            addElement
          }

        />

      </div>

      <div className="hf-builder-center">

        <Canvas
          elements={
            elements
          }

          selectedId={
            selectedId
          }

          menus={
            menus
          }

          onSelect={
            setSelectedId
          }

          onDelete={
            removeElement
          }

          onMove={
            moveElement
          }

          onAddElement={
            handlePanelDrop
          }

        />

      </div>

      <div className="hf-builder-right">

        <ElementSettings
          element={
            selectedElement
          }

          menus={
            menus
          }

          onChange={(
            settings,
          ) => {

            if (
              selectedId
            ) {
              updateElement(
                selectedId,
                settings,
              );
            }

          }}
        />

      </div>

    </div>
  );
};

const findElement = (
  elements: any[],
  id: string | null,
): any | null => {

  if (!id) {
    return null;
  }

  for (
    const element of elements
  ) {

    if (
      element.id === id
    ) {
      return element;
    }

    const found =
      findElement(
        element.children ||
          [],
        id,
      );

    if (found) {
      return found;
    }
  }

  return null;
};

const containsElement = (
  element: any,
  id: string,
): boolean => {

  if (
    !element.children ||
    !element.children.length
  ) {
    return false;
  }

  for (
    const child of element.children
  ) {

    if (
      child.id === id
    ) {
      return true;
    }

    if (
      containsElement(
        child,
        id,
      )
    ) {
      return true;
    }
  }

  return false;
};

const addChildToElement = (
  elements: any[],
  parentId: string,
  child: any,
): any[] => {

  return elements.map(
    (element: any) => {

      if (
        element.id ===
        parentId
      ) {

        return {
          ...element,

          children: [
            ...(element.children ||
              []),
            child,
          ],
        };
      }

      return {
        ...element,

        children:
          addChildToElement(
            element.children ||
              [],
            parentId,
            child,
          ),
      };
    },
  );
};

const updateElementSettings = (
  elements: any[],
  elementId: string,
  settings: any,
): any[] => {

  return elements.map(
    (element: any) => {

      if (
        element.id ===
        elementId
      ) {

        return {
          ...element,

          settings,
        };
      }

      return {
        ...element,

        children:
          updateElementSettings(
            element.children ||
              [],
            elementId,
            settings,
          ),
      };
    },
  );
};

const removeElementById = (
  elements: any[],
  elementId: string,
): any[] => {

  return elements
    .filter(
      (element: any) =>
        element.id !==
        elementId,
    )
    .map(
      (element: any) => ({
        ...element,

        children:
          removeElementById(
            element.children ||
              [],
            elementId,
          ),
      }),
    );
};

const findParentId = (
  elements: any[],
  childId: string,
  parentId:
    | string
    | null = null,
): string | null => {

  for (
    const element of elements
  ) {

    if (
      element.id ===
      childId
    ) {
      return parentId;
    }

    const found =
      findParentId(
        element.children ||
          [],
        childId,
        element.id,
      );

    if (
      found !== null
    ) {
      return found;
    }
  }

  return null;
};

const insertBeforeElement = (
  elements: any[],
  parentId:
    | string
    | null,
  targetId: string,
  elementToInsert: any,
): any[] => {

  if (!parentId) {

    const newElements = [
      ...elements,
    ];

    const index =
      newElements.findIndex(
        (element) =>
          element.id ===
          targetId,
      );

    if (index === -1) {
      return newElements;
    }

    newElements.splice(
      index,
      0,
      elementToInsert,
    );

    return newElements;
  }

  return elements.map(
    (element: any) => {

      if (
        element.id ===
        parentId
      ) {

        const children = [
          ...(element.children ||
            []),
        ];

        const index =
          children.findIndex(
            (child) =>
              child.id ===
              targetId,
          );

        if (
          index !== -1
        ) {

          children.splice(
            index,
            0,
            elementToInsert,
          );
        }

        return {
          ...element,

          children,
        };
      }

      return {
        ...element,

        children:
          insertBeforeElement(
            element.children ||
              [],
            parentId,
            targetId,
            elementToInsert,
          ),
      };
    },
  );
};

const getDefaultSettings = (
  type: string,
) => {

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

        background:
          "transparent",

        align: "stretch",
      };

    case "row":

      return {
        direction: "row",

        gap: 20,

        align: "stretch",

        justify:
          "flex-start",

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

        background:
          "transparent",
      };

    case "block":

      return {
        width: "100%",

        gap: 10,

        paddingTop: 10,

        paddingRight: 10,

        paddingBottom: 10,

        paddingLeft: 10,

        background:
          "transparent",
      };

    case "logo":

      return {
        src: "",

        media_id: "",

        width: 150,

        link: "/",
      };

    case "menu":

      return {
        menuId: "",

        layout:
          "horizontal",

        fontSize: 16,

        textColor:
          "#222222",

        hoverColor:
          "#0c2f55",

        backgroundColor:
          "transparent",

        itemGap: 25,
      };

    case "heading":

      return {
        text:
          "Your Heading",

        tag: "h2",

        fontSize: 28,

        color:
          "#222222",

        align: "left",

        marginTop: 0,

        marginBottom: 10,
      };

    case "text":

      return {
        text:
          "<p>Your text goes here...</p>",

        fontSize: 16,

        color:
          "#333333",

        align: "left",

        lineHeight: 1.6,
      };

    case "button":

      return {
        text:
          "Click Here",

        url: "#",

        background:
          "#0c2f55",

        color:
          "#ffffff",

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

        color:
          "#0c2f55",

        link: "#",

        align: "left",
      };

    case "social":

      return {
        size: 30,

        gap: 10,

        align: "left",

        color:
          "#0c2f55",

        items: [
          {
            id: "facebook",

            platform:
              "facebook",

            url: "#",
          },

          {
            id: "instagram",

            platform:
              "instagram",

            url: "#",
          },

          {
            id: "youtube",

            platform:
              "youtube",

            url: "#",
          },
        ],
      };

    case "image":

      return {
        src: "",

        media_id: "",

        width: 300,

        link: "#",

        alt: "",
      };

    case "search":

      return {
        placeholder:
          "Search...",

        width: 250,

        height: 40,
      };

    case "divider":

      return {
        color:
          "#dddddd",

        thickness: 1,

        width: 100,

        style: "solid",
      };

    case "spacer":

      return {
        height: 30,
      };

    case "html":

      return {
        html:
          "<div>Custom HTML</div>",
      };

    default:

      return {};
  }
};

export default Builder;