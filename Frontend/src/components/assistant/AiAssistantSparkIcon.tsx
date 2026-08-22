type AiAssistantSparkIconProps = {
  className?: string;
};

/** Shared spark mark used by the floating button, the panel avatar and message labels. */
export default function AiAssistantSparkIcon({
  className,
}: AiAssistantSparkIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M11.4 2.3a.65.65 0 0 1 1.2 0l1.36 3.79 3.79 1.36a.65.65 0 0 1 0 1.2l-3.79 1.36-1.36 3.79a.65.65 0 0 1-1.2 0L10.04 10.01 6.25 8.65a.65.65 0 0 1 0-1.2l3.79-1.36L11.4 2.3Z" />
      <path d="M18.05 14.1a.5.5 0 0 1 .94 0l.66 1.83 1.83.66a.5.5 0 0 1 0 .94l-1.83.66-.66 1.83a.5.5 0 0 1-.94 0l-.66-1.83-1.83-.66a.5.5 0 0 1 0-.94l1.83-.66.66-1.83Z" />
      <path d="M5.6 14.9a.5.5 0 0 1 .94 0l.53 1.47 1.47.53a.5.5 0 0 1 0 .94l-1.47.53-.53 1.47a.5.5 0 0 1-.94 0l-.53-1.47-1.47-.53a.5.5 0 0 1 0-.94l1.47-.53.53-1.47Z" />
    </svg>
  );
}
