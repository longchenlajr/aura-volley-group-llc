import Image from "next/image";

interface DecorativeAssetProps {
  src: string;
  className?: string;
  style?: React.CSSProperties;
  width: number;
  height: number;
  priority?: boolean;
}

export function DecorativeAsset({
  src,
  className,
  style,
  width,
  height,
  priority = false,
}: DecorativeAssetProps) {
  return (
    <Image
      src={`/longvolleyball/${src}`}
      alt=""
      aria-hidden="true"
      className={className}
      style={{ pointerEvents: "none", userSelect: "none", ...style }}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      priority={priority}
    />
  );
}
