
export type WidgetType =
  | "container"
  | "heading"
  | "text"
  | "image"
  | "button"
  | "spacer";

export type PageStatus = "draft" | "published";

export interface WidgetStyle {
  backgroundColor?: string;
  color?: string;
  fontSize?: number;
  textAlign?: "left" | "center" | "right";
  padding?: number;
  margin?: number;
  width?: string;
  borderRadius?: number;
}

export interface PageWidget {
  id: string;
  type: WidgetType;
  label: string;
  content?: string;
  url?: string;
  children?: PageWidget[];
  style: WidgetStyle;
}

export interface BuilderPage {
  id: string;
  title: string;
  slug: string;
  layout: PageWidget[];
  status: PageStatus;
  created_at?: string;
  updated_at?: string;
}

export interface CreatePageData {
  title: string;
  slug: string;
  layout: PageWidget[];
  status: PageStatus;
}

export type UpdatePageData = CreatePageData;