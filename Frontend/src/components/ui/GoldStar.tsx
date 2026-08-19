export function GoldStar({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="wesal-gold-star"
    >
      <path
        d="M12 3.6l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.9 7.2 18.5l.9-5.4L4.2 9.3l5.4-.8L12 3.6Z"
        fill="#C4A05C"
        stroke="#B08A48"
        strokeWidth="0.6"
      />
    </svg>
  );
}

export function GoldStars({
  rating,
  size = 14,
}: {
  rating: number;
  size?: number;
}) {
  return (
    <span
      className="inline-flex items-center gap-1"
      aria-label={`التقييم ${Number(rating).toFixed(1)} من 5`}
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <GoldStar key={index} size={size} />
      ))}
    </span>
  );
}
