import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";

import SortableElement from "./SortableElement";

interface CanvasProps {
  elements: any[];

  selectedId: string | null;

  menus: any[];

  onSelect: (id: string) => void;

  onDelete: (id: string) => void;

  onMove: (
    activeId: string,
    overId: string,
  ) => void;

  onAddElement: (
    type: string,
    parentId?: string | null,
  ) => void;
}

const Canvas = ({
  elements,
  selectedId,
  menus,
  onSelect,
  onDelete,
  onMove,
  onAddElement,
}: CanvasProps) => {

  const sensors =
    useSensors(
      useSensor(
        PointerSensor,
        {
          activationConstraint: {
            distance: 5,
          },
        },
      ),
    );

  const handleDragEnd = (
    event: DragEndEvent,
  ) => {

    const {
      active,
      over,
    } = event;

    if (!over) {
      return;
    }

    const activeId =
      String(active.id);

    const overId =
      String(over.id);

    if (
      activeId ===
      overId
    ) {
      return;
    }

    onMove(
      activeId,
      overId,
    );
  };

  const handleRootDrop = (
    event: React.DragEvent,
  ) => {

    event.preventDefault();

    const type =
      event.dataTransfer.getData(
        "application/hf-element",
      );

    if (!type) {
      return;
    }

    onAddElement(type);
  };

  return (
    <div
      className="hf-canvas"
      onDragOver={(event) =>
        event.preventDefault()
      }
      onDrop={handleRootDrop}
    >

      <DndContext
        sensors={sensors}
        collisionDetection={
          closestCenter
        }
        onDragEnd={
          handleDragEnd
        }
      >

        <div className="hf-canvas-inner">

          {elements.length === 0 && (
            <div className="hf-empty-canvas">

              <strong>
                Start Building
              </strong>

              <p>
                Drag an element from
                the left panel here.
              </p>

            </div>
          )}

          {elements.map(
            (element) => (
              <SortableElement
                key={
                  element.id
                }

                element={
                  element
                }

                selectedId={
                  selectedId
                }

                menus={
                  menus
                }

                onSelect={
                  onSelect
                }

                onDelete={
                  onDelete
                }

                onAddElement={
                  onAddElement
                }
              />
            ),
          )}

        </div>

      </DndContext>

    </div>
  );
};

export default Canvas;