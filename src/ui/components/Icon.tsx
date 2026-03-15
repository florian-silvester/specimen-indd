import { h } from "preact";
import { iconSvgs } from "../generated-icons";

interface IconProps {
  name: string;
  className?: string;
  size?: number;
}

export function Icon({ name, className, size = 16 }: IconProps) {
  const svgContent = iconSvgs[name];

  if (!svgContent) {
    console.warn(`Icon not found: ${name}`);
    return <span className={`icon icon-placeholder ${className || ''}`}>?</span>;
  }

  const style = {
    width: `${size}px`,
    height: `${size}px`,
    display: 'inline-block',
    verticalAlign: 'middle',
  };

  return (
    <span
      className={`icon icon-${name} ${className || ''}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
} 