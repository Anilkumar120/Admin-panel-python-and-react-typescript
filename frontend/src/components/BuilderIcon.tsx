import type { CSSProperties } from "react";
import { createElement } from "react";
import { ICON_LIBRARY } from "./iconLibrary";

const iconByName = new Map(ICON_LIBRARY.map((item) => [item.name, item.Icon]));

const BuilderIcon = ({
  name,
  style,
  className,
}: {
  name?: string;
  style?: CSSProperties;
  className?: string;
}) => {
  const Icon = name ? iconByName.get(name) : undefined;
  if (Icon) return createElement(Icon, { "aria-hidden": true, className, style });
  return <span aria-hidden="true" className={className} style={style}>{name || "✓"}</span>;
};

export default BuilderIcon;
