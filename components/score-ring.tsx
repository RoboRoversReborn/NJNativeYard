export function ScoreRing({
  score,
  size = 150,
  tone = "dark",
  className = "",
}: {
  score: number;
  size?: number;
  tone?: "dark" | "light";
  className?: string;
}) {
  const track =
    tone === "dark" ? "rgba(247,244,233,0.14)" : "rgba(22,63,44,0.12)";
  const fill = tone === "dark" ? "#d7f27a" : "#3f7d45";
  const text = tone === "dark" ? "#f7f4e9" : "#163f2c";

  return (
    <div
      className={`score-ring ${className}`}
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${fill} ${score * 3.6}deg, ${track} 0deg)`,
      }}
      role="img"
      aria-label={`Ecological score ${score} out of 100`}
    >
      <div
        className="score-ring__inner"
        style={{
          color: text,
          background: tone === "dark" ? "#163f2c" : "#fbfaf4",
        }}
      >
        <span
          className="score-ring__value"
          style={{ fontSize: Math.round(size * 0.3) }}
        >
          {score}
        </span>
        <span
          className="score-ring__unit"
          style={{ fontSize: Math.max(8, Math.round(size * 0.085)) }}
        >
          / 100
        </span>
      </div>
    </div>
  );
}
