import React from "react";

type Props = {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: React.CSSProperties;
  className?: string;
};

export default function Skeleton({
  width = "100%",
  height = 16,
  radius = 8,
  style,
  className,
}: Props) {
  return (
    <div
      className={`skeleton ${className ?? ""}`}
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}
