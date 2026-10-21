type HallsNavIconProps = {
  className?: string;
};

/** Exact hall mark used beside "Halls / القاعات" nav labels. */
export default function HallsNavIcon({ className = "h-5 w-5" }: HallsNavIconProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand icon asset
    <img
      src="/icons/nav-halls.png"
      alt=""
      width={22}
      height={22}
      className={`shrink-0 object-contain ${className}`}
      draggable={false}
      aria-hidden="true"
    />
  );
}
