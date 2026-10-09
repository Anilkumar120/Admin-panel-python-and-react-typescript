
import {
    useEffect,
    useState
} from "react";

import {
    useNavigate,
    useSearchParams
} from "react-router-dom";

import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent
} from "@dnd-kit/core";

import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
    arrayMove
} from "@dnd-kit/sortable";

import {
    CSS
} from "@dnd-kit/utilities";

import {
    createPage,
    getPage,
    updatePage
} from "../../api/pageBuilder";

import type {
    PageWidget,
    WidgetType,
    WidgetStyle,
    PageStatus
} from "../../types/pageBuilder";

import "./PageBuilder.css";


const createId = () => {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};


const createWidget = (
    type: WidgetType
): PageWidget => {

    const defaults: Record<WidgetType, PageWidget> = {

        container: {
            id: createId(),
            type: "container",
            label: "Container",
            children: [],
            style: {
                backgroundColor: "#ffffff",
                padding: 20,
                margin: 0,
                width: "100%",
                borderRadius: 0
            }
        },

        heading: {
            id: createId(),
            type: "heading",
            label: "Heading",
            content: "Add Your Heading Text",
            style: {
                color: "#222222",
                fontSize: 32,
                textAlign: "left",
                padding: 0,
                margin: 10
            }
        },

        text: {
            id: createId(),
            type: "text",
            label: "Text Editor",
            content: "Start writing your content here.",
            style: {
                color: "#555555",
                fontSize: 16,
                textAlign: "left",
                padding: 0,
                margin: 10
            }
        },

        image: {
            id: createId(),
            type: "image",
            label: "Image",
            url: "",
            content: "Image URL",
            style: {
                width: "100%",
                padding: 0,
                margin: 10,
                borderRadius: 0
            }
        },

        button: {
            id: createId(),
            type: "button",
            label: "Button",
            content: "Click Here",
            url: "#",
            style: {
                backgroundColor: "#0c2f55",
                color: "#ffffff",
                fontSize: 16,
                textAlign: "center",
                padding: 12,
                margin: 10,
                borderRadius: 5
            }
        },

        spacer: {
            id: createId(),
            type: "spacer",
            label: "Spacer",
            style: {
                padding: 30,
                margin: 0
            }
        }

    };

    return JSON.parse(
        JSON.stringify(
            defaults[type]
        )
    ) as PageWidget;
};


interface SortableWidgetProps {
    widget: PageWidget;
    selected: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
}


const SortableWidget = ({
    widget,
    selected,
    onSelect,
    onDelete
}: SortableWidgetProps) => {

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: widget.id
    });

    const style = {
        transform: CSS.Transform.toString(
            transform
        ),
        transition,
        opacity: isDragging ? 0.5 : 1
    };

    return (

        <div
            ref={setNodeRef}
            style={style}
            className={`builder-widget ${selected ? "selected" : ""}`}
            onClick={() => onSelect(widget.id)}
        >

            <div className="builder-widget-toolbar">

                <button
                    type="button"
                    className="widget-drag-handle"
                    {...attributes}
                    {...listeners}
                    title="Drag widget"
                    onClick={(event) => event.stopPropagation()}
                >
                    ⠿
                </button>

                <span>
                    {widget.label}
                </span>

                <button
                    type="button"
                    className="widget-delete"
                    title="Delete widget"
                    onClick={(event) => {
                        event.stopPropagation();
                        onDelete(widget.id);
                    }}
                >
                    ×
                </button>

            </div>

            <div className="builder-widget-preview">

                {widget.type === "container" && (

                    <div className="empty-container">

                        {widget.children?.length
                            ? `${widget.children.length} element(s) inside`
                            : "Container — add elements below"}

                    </div>

                )}

                {widget.type === "heading" && (

                    <h2
                        style={{
                            color: widget.style.color,
                            fontSize: widget.style.fontSize,
                            textAlign: widget.style.textAlign
                        }}
                    >
                        {widget.content}
                    </h2>

                )}

                {widget.type === "text" && (

                    <p
                        style={{
                            color: widget.style.color,
                            fontSize: widget.style.fontSize,
                            textAlign: widget.style.textAlign
                        }}
                    >
                        {widget.content}
                    </p>

                )}

                {widget.type === "image" && (

                    widget.url ? (

                        <img
                            src={widget.url}
                            alt={widget.label}
                            style={{
                                width: widget.style.width,
                                borderRadius: widget.style.borderRadius
                            }}
                        />

                    ) : (

                        <div className="image-placeholder">
                            Image URL not set
                        </div>

                    )

                )}

                {widget.type === "button" && (

                    <button
                        type="button"
                        style={{
                            backgroundColor: widget.style.backgroundColor,
                            color: widget.style.color,
                            fontSize: widget.style.fontSize,
                            padding: widget.style.padding,
                            borderRadius: widget.style.borderRadius
                        }}
                    >
                        {widget.content}
                    </button>

                )}

                {widget.type === "spacer" && (

                    <div
                        className="spacer-preview"
                        style={{
                            height: widget.style.padding
                        }}
                    >
                        Spacer
                    </div>

                )}

            </div>

        </div>

    );
};


const PageBuilder = () => {

    const navigate = useNavigate();

    const [searchParams] = useSearchParams();

    const pageId = searchParams.get("id");


    const [title, setTitle] = useState("");

    const [slug, setSlug] = useState("");

    const [layout, setLayout] = useState<PageWidget[]>([]);

    const [selectedId, setSelectedId] = useState<string | null>(null);

    const [status, setStatus] = useState<PageStatus>("draft");

    const [activePanel, setActivePanel] = useState<
        "widgets" | "layers"
    >("widgets");

    const [loading, setLoading] = useState(false);

    const [saving, setSaving] = useState(false);

    const [message, setMessage] = useState("");


    const sensors = useSensors(
        useSensor(
            PointerSensor,
            {
                activationConstraint: {
                    distance: 5
                }
            }
        )
    );


    useEffect(() => {

        if (!pageId) {
            return;
        }

        let active = true;

        const loadPage = async () => {

            setLoading(true);

            try {

                const page = await getPage(
                    pageId
                );

                if (!active) {
                    return;
                }

                setTitle(page.title);

                setSlug(page.slug);

                setLayout(page.layout || []);

                setStatus(page.status);

            } catch {

                if (active) {
                    setMessage("Unable to load page.");
                }

            } finally {

                if (active) {
                    setLoading(false);
                }

            }

        };

        void loadPage();

        return () => {
            active = false;
        };

    }, [pageId]);


    const findWidget = (
        widgets: PageWidget[],
        id: string
    ): PageWidget | undefined => {

        for (const widget of widgets) {

            if (widget.id === id) {
                return widget;
            }

            const found = findWidget(
                widget.children || [],
                id
            );

            if (found) {
                return found;
            }

        }

        return undefined;
    };


    const updateWidget = (
        widgets: PageWidget[],
        id: string,
        changes: Partial<PageWidget>
    ): PageWidget[] => {

        return widgets.map(
            (widget) => {

                if (widget.id === id) {

                    return {
                        ...widget,
                        ...changes
                    };

                }

                if (widget.children) {

                    return {
                        ...widget,
                        children: updateWidget(
                            widget.children,
                            id,
                            changes
                        )
                    };

                }

                return widget;

            }
        );

    };


    const deleteWidget = (
        widgets: PageWidget[],
        id: string
    ): PageWidget[] => {

        return widgets
            .filter(
                (widget) => widget.id !== id
            )
            .map(
                (widget) => ({
                    ...widget,
                    children: widget.children
                        ? deleteWidget(
                            widget.children,
                            id
                        )
                        : undefined
                })
            );

    };


    const addWidget = (
        type: WidgetType
    ) => {

        const widget = createWidget(
            type
        );

        setLayout(
            (current) => [
                ...current,
                widget
            ]
        );

        setSelectedId(
            widget.id
        );

        setMessage("");

    };


    const handleDelete = (
        id: string
    ) => {

        setLayout(
            (current) => deleteWidget(
                current,
                id
            )
        );

        if (selectedId === id) {
            setSelectedId(null);
        }

    };


    const handleDragEnd = (
        event: DragEndEvent
    ) => {

        const {
            active,
            over
        } = event;

        if (!over || active.id === over.id) {
            return;
        }

        const oldIndex = layout.findIndex(
            (widget) => widget.id === active.id
        );

        const newIndex = layout.findIndex(
            (widget) => widget.id === over.id
        );

        if (
            oldIndex !== -1 &&
            newIndex !== -1
        ) {

            setLayout(
                (current) => arrayMove(
                    current,
                    oldIndex,
                    newIndex
                )
            );

        }

    };


    const selectedWidget = selectedId
        ? findWidget(
            layout,
            selectedId
        )
        : undefined;


    const updateSelectedStyle = (
        changes: Partial<WidgetStyle>
    ) => {

        if (!selectedId) {
            return;
        }

        const currentWidget = findWidget(
            layout,
            selectedId
        );

        if (!currentWidget) {
            return;
        }

        setLayout(
            (current) => updateWidget(
                current,
                selectedId,
                {
                    style: {
                        ...currentWidget.style,
                        ...changes
                    }
                }
            )
        );

    };


    const updateSelectedContent = (
        content: string
    ) => {

        if (!selectedId) {
            return;
        }

        setLayout(
            (current) => updateWidget(
                current,
                selectedId,
                {
                    content
                }
            )
        );

    };


    const updateSelectedUrl = (
        url: string
    ) => {

        if (!selectedId) {
            return;
        }

        setLayout(
            (current) => updateWidget(
                current,
                selectedId,
                {
                    url
                }
            )
        );

    };


    const handleSave = async (
        publish: boolean
    ) => {

        if (!title.trim() || !slug.trim()) {

            setMessage(
                "Please enter both page title and slug."
            );

            return;

        }

        setSaving(true);

        setMessage("");

        const pageData = {
            title: title.trim(),
            slug: slug.trim().toLowerCase(),
            layout,
            status: publish
                ? "published" as PageStatus
                : status
        };

        try {

            if (pageId) {

                await updatePage(
                    pageId,
                    pageData
                );

            } else {

                const result = await createPage(
                    pageData
                );

                if (result.id) {

                    navigate(
                        `/admin/appearance/page-builder?id=${result.id}`,
                        {
                            replace: true
                        }
                    );

                }

            }

            setStatus(
                pageData.status
            );

            setMessage(
                publish
                    ? "Page published successfully."
                    : "Page saved successfully."
            );

        } catch (error) {

            if (
                typeof error === "object" &&
                error !== null &&
                "response" in error
            ) {

                const responseError = error as {
                    response?: {
                        data?: {
                            detail?: string
                        }
                    }
                };

                setMessage(
                    responseError.response?.data?.detail ||
                    "Unable to save page."
                );

            } else {

                setMessage(
                    "Unable to save page."
                );

            }

        } finally {

            setSaving(false);

        }

    };


    const renderLayers = (
        widgets: PageWidget[],
        depth = 0
    ) => {

        return widgets.map(
            (widget) => (

                <div key={widget.id}>

                    <button
                        type="button"
                        className={`layer-item ${selectedId === widget.id ? "active" : ""}`}
                        style={{
                            paddingLeft: 12 + depth * 16
                        }}
                        onClick={() => setSelectedId(widget.id)}
                    >
                        <span>
                            {widget.type === "container"
                                ? "▦"
                                : widget.type === "heading"
                                    ? "H"
                                    : widget.type === "text"
                                        ? "T"
                                        : widget.type === "image"
                                            ? "▧"
                                            : widget.type === "button"
                                                ? "▣"
                                                : "↕"}
                        </span>

                        {widget.label}

                    </button>

                    {widget.children &&
                        renderLayers(
                            widget.children,
                            depth + 1
                        )}

                </div>

            )
        );

    };


    const renderWidget = (
        widget: PageWidget,
        depth = 0
    ): React.ReactNode => {

        return (

            <div
                key={widget.id}
                className={`canvas-element ${selectedId === widget.id ? "active" : ""}`}
                style={{
                    backgroundColor: widget.style.backgroundColor,
                    color: widget.style.color,
                    padding: widget.style.padding,
                    margin: widget.style.margin,
                    borderRadius: widget.style.borderRadius,
                    width: widget.style.width
                }}
                onClick={(event) => {
                    event.stopPropagation();
                    setSelectedId(widget.id);
                }}
            >

                <div className="canvas-element-label">
                    {widget.label}

                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            handleDelete(widget.id);
                        }}
                    >
                        ×
                    </button>
                </div>

                {widget.type === "container" && (

                    <div className="nested-container">

                        {widget.children?.map(
                            (child) => renderWidget(
                                child,
                                depth + 1
                            )
                        )}

                        <button
                            type="button"
                            className="add-inside-button"
                            onClick={(event) => {
                                event.stopPropagation();

                                const child = createWidget(
                                    "heading"
                                );

                                setLayout(
                                    (current) => updateWidget(
                                        current,
                                        widget.id,
                                        {
                                            children: [
                                                ...(widget.children || []),
                                                child
                                            ]
                                        }
                                    )
                                );

                                setSelectedId(
                                    child.id
                                );
                            }}
                        >
                            + Add Heading Inside
                        </button>

                    </div>

                )}

                {widget.type === "heading" && (

                    <h2
                        style={{
                            fontSize: widget.style.fontSize,
                            textAlign: widget.style.textAlign
                        }}
                    >
                        {widget.content}
                    </h2>

                )}

                {widget.type === "text" && (

                    <p
                        style={{
                            fontSize: widget.style.fontSize,
                            textAlign: widget.style.textAlign
                        }}
                    >
                        {widget.content}
                    </p>

                )}

                {widget.type === "image" && (

                    widget.url ? (

                        <img
                            src={widget.url}
                            alt={widget.label}
                            style={{
                                width: widget.style.width,
                                borderRadius: widget.style.borderRadius
                            }}
                        />

                    ) : (

                        <div className="image-placeholder">
                            Add an image URL in settings
                        </div>

                    )

                )}

                {widget.type === "button" && (

                    <span
                        className="canvas-button-preview"
                        style={{
                            backgroundColor: widget.style.backgroundColor,
                            color: widget.style.color,
                            fontSize: widget.style.fontSize,
                            padding: widget.style.padding,
                            borderRadius: widget.style.borderRadius
                        }}
                    >
                        {widget.content}
                    </span>

                )}

                {widget.type === "spacer" && (

                    <div
                        className="spacer-preview"
                        style={{
                            height: widget.style.padding
                        }}
                    />

                )}

            </div>

        );

    };


    if (loading) {

        return (
            <div className="page-builder-loading">
                Loading page...
            </div>
        );

    }


    return (

        <div className="page-builder">

            <header className="builder-topbar">

                <button
                    type="button"
                    className="builder-back"
                    onClick={() => navigate(-1)}
                >
                    ← Back
                </button>

                <div className="builder-page-details">

                    <input
                        type="text"
                        value={title}
                        placeholder="Page Title"
                        onChange={(event) => setTitle(event.target.value)}
                    />

                    <input
                        type="text"
                        value={slug}
                        placeholder="page-slug"
                        onChange={(event) => setSlug(
                            event.target.value
                                .toLowerCase()
                                .replace(/\s+/g, "-")
                        )}
                    />

                </div>

                <div className="builder-actions">

                    <span className={`builder-status ${status}`}>
                        {status}
                    </span>

                    <button
                        type="button"
                        onClick={() => void handleSave(false)}
                        disabled={saving}
                    >
                        {saving ? "Saving..." : "Save Draft"}
                    </button>

                    <button
                        type="button"
                        className="publish-button"
                        onClick={() => void handleSave(true)}
                        disabled={saving}
                    >
                        {saving ? "Saving..." : "Publish"}
                    </button>

                </div>

            </header>


            {message && (

                <div className="builder-message">
                    {message}
                </div>

            )}


            <div className="builder-workspace">


                <aside className="builder-left-panel">

                    <div className="builder-panel-tabs">

                        <button
                            type="button"
                            className={activePanel === "widgets" ? "active" : ""}
                            onClick={() => setActivePanel("widgets")}
                        >
                            Widgets
                        </button>

                        <button
                            type="button"
                            className={activePanel === "layers" ? "active" : ""}
                            onClick={() => setActivePanel("layers")}
                        >
                            Layers
                        </button>

                    </div>


                    {activePanel === "widgets" && (

                        <div className="widget-library">

                            <p className="panel-heading">
                                Layout
                            </p>

                            <button
                                type="button"
                                onClick={() => addWidget("container")}
                            >
                                ▦ Container
                            </button>

                            <p className="panel-heading">
                                Basic Elements
                            </p>

                            <div className="widget-grid">

                                <button
                                    type="button"
                                    onClick={() => addWidget("heading")}
                                >
                                    H
                                    <span>Heading</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => addWidget("text")}
                                >
                                    T
                                    <span>Text Editor</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => addWidget("image")}
                                >
                                    ▧
                                    <span>Image</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => addWidget("button")}
                                >
                                    ▣
                                    <span>Button</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => addWidget("spacer")}
                                >
                                    ↕
                                    <span>Spacer</span>
                                </button>

                            </div>

                        </div>

                    )}


                    {activePanel === "layers" && (

                        <div className="builder-layers">

                            {layout.length ? (

                                renderLayers(
                                    layout
                                )

                            ) : (

                                <p className="empty-layers">
                                    No elements added yet.
                                </p>

                            )}

                        </div>

                    )}

                </aside>


                <main
                    className="builder-canvas-area"
                    onClick={() => setSelectedId(null)}
                >

                    <div className="canvas-toolbar">
                        <span>Page Canvas</span>
                        <span>{layout.length} top-level elements</span>
                    </div>


                    <div
                        className="builder-canvas"
                        onClick={(event) => event.stopPropagation()}
                    >

                        {!layout.length && (

                            <div className="canvas-empty-state">

                                <div className="empty-state-icon">
                                    +
                                </div>

                                <h2>
                                    Build Your Page
                                </h2>

                                <p>
                                    Add a container or select a widget from the left panel.
                                </p>

                                <button
                                    type="button"
                                    onClick={() => addWidget("container")}
                                >
                                    + Add Container
                                </button>

                            </div>

                        )}


                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >

                            <SortableContext
                                items={layout.map(
                                    (widget) => widget.id
                                )}
                                strategy={verticalListSortingStrategy}
                            >

                                {layout.map(
                                    (widget) => (

                                        <SortableWidget
                                            key={widget.id}
                                            widget={widget}
                                            selected={selectedId === widget.id}
                                            onSelect={setSelectedId}
                                            onDelete={handleDelete}
                                        />

                                    )
                                )}

                            </SortableContext>

                        </DndContext>


                        {layout.length > 0 && (

                            <div className="canvas-render-preview">

                                <h3>Page Layout Preview</h3>

                                {layout.map(
                                    (widget) => renderWidget(
                                        widget
                                    )
                                )}

                                <button
                                    type="button"
                                    className="add-element-button"
                                    onClick={() => addWidget("container")}
                                >
                                    + Add Container
                                </button>

                            </div>

                        )}

                    </div>

                </main>


                <aside className="builder-right-panel">

                    <div className="right-panel-heading">
                        <h3>Element Settings</h3>
                    </div>


                    {!selectedWidget && (

                        <p className="no-selection">
                            Select an element on the canvas or in Layers to edit its settings.
                        </p>

                    )}


                    {selectedWidget && (

                        <div className="widget-settings">

                            <p className="settings-section-title">
                                Content
                            </p>

                            {(selectedWidget.type === "heading" ||
                                selectedWidget.type === "text" ||
                                selectedWidget.type === "button") && (

                                <label>
                                    Text

                                    <textarea
                                        value={selectedWidget.content || ""}
                                        onChange={(event) => updateSelectedContent(
                                            event.target.value
                                        )}
                                    />

                                </label>

                            )}


                            {(selectedWidget.type === "image" ||
                                selectedWidget.type === "button") && (

                                <label>
                                    {selectedWidget.type === "image"
                                        ? "Image URL"
                                        : "Button Link"}

                                    <input
                                        type="text"
                                        value={selectedWidget.type === "image"
                                            ? selectedWidget.url || ""
                                            : selectedWidget.url || ""}
                                        placeholder="Enter URL"
                                        onChange={(event) => updateSelectedUrl(
                                            event.target.value
                                        )}
                                    />

                                </label>

                            )}


                            <p className="settings-section-title">
                                Style
                            </p>


                            {selectedWidget.type !== "container" &&
                                selectedWidget.type !== "spacer" && (

                                <label>
                                    Text Alignment

                                    <select
                                        value={selectedWidget.style.textAlign || "left"}
                                        onChange={(event) => updateSelectedStyle({
                                            textAlign: event.target.value as WidgetStyle["textAlign"]
                                        })}
                                    >
                                        <option value="left">Left</option>
                                        <option value="center">Center</option>
                                        <option value="right">Right</option>
                                    </select>

                                </label>

                            )}


                            {selectedWidget.type !== "image" &&
                                selectedWidget.type !== "spacer" && (

                                <label>
                                    Text Color

                                    <input
                                        type="color"
                                        value={selectedWidget.style.color || "#222222"}
                                        onChange={(event) => updateSelectedStyle({
                                            color: event.target.value
                                        })}
                                    />

                                </label>

                            )}


                            {(selectedWidget.type === "container" ||
                                selectedWidget.type === "button") && (

                                <label>
                                    Background Color

                                    <input
                                        type="color"
                                        value={selectedWidget.style.backgroundColor || "#ffffff"}
                                        onChange={(event) => updateSelectedStyle({
                                            backgroundColor: event.target.value
                                        })}
                                    />

                                </label>

                            )}


                            {selectedWidget.type !== "container" &&
                                selectedWidget.type !== "image" &&
                                selectedWidget.type !== "spacer" && (

                                <label>
                                    Font Size

                                    <input
                                        type="number"
                                        min="8"
                                        max="100"
                                        value={selectedWidget.style.fontSize || 16}
                                        onChange={(event) => updateSelectedStyle({
                                            fontSize: Number(event.target.value)
                                        })}
                                    />

                                </label>

                            )}


                            <label>
                                Padding

                                <input
                                    type="number"
                                    min="0"
                                    max="200"
                                    value={selectedWidget.style.padding ?? 0}
                                    onChange={(event) => updateSelectedStyle({
                                        padding: Number(event.target.value)
                                    })}
                                />

                            </label>


                            <label>
                                Margin

                                <input
                                    type="number"
                                    min="0"
                                    max="200"
                                    value={selectedWidget.style.margin ?? 0}
                                    onChange={(event) => updateSelectedStyle({
                                        margin: Number(event.target.value)
                                    })}
                                />

                            </label>


                            <label>
                                Border Radius

                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={selectedWidget.style.borderRadius ?? 0}
                                    onChange={(event) => updateSelectedStyle({
                                        borderRadius: Number(event.target.value)
                                    })}
                                />

                            </label>


                            <button
                                type="button"
                                className="delete-selected-button"
                                onClick={() => handleDelete(
                                    selectedWidget.id
                                )}
                            >
                                Delete Element
                            </button>

                        </div>

                    )}

                </aside>

            </div>

        </div>

    );

};


export default PageBuilder;