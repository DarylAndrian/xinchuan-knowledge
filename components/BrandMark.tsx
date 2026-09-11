type Props = {
  size?: number;
  className?: string;
};

/**
 * Open book + outlined inkwell + long natural brass quill.
 * Colors track the paper-and-moss tokens for light/dark.
 */
export default function BrandMark({ size = 24, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="8" fill="var(--moss)" />
      <path
        d="M3.5 19.5c0-.6.5-1.1 1.1-1.1 3.5 0 6.9.85 10.9 2.4v5.75c-4-1.55-7.4-2.4-10.9-2.4-.6 0-1.1-.5-1.1-1.1v-3.55z"
        fill="var(--canvas)"
      />
      <path
        d="M28.5 19.5c0-.6-.5-1.1-1.1-1.1-3.5 0-6.9.85-10.9 2.4v5.75c4-1.55 7.4-2.4 10.9-2.4.6 0 1.1-.5 1.1-1.1v-3.55z"
        fill="var(--canvas)"
      />
      <rect
        x="20.5"
        y="21"
        width="6.2"
        height="7"
        rx="1.25"
        fill="var(--moss)"
        stroke="var(--brass)"
        strokeWidth="0.9"
      />
      <rect x="21.7" y="19.5" width="3.8" height="1.6" rx="0.55" fill="var(--brass)" />
      <path
        d="M23.6 19.8 L9.5 3.5"
        stroke="var(--brass)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M8.8 2.2C12.5 1 17 2.5 20 6C22 8.5 22.5 12 21 15.5C20.2 13.5 19.5 12.2 18.5 11.2C19.2 13.2 19 15.2 17.8 17C17 15.2 16.2 14 15.2 13C15.2 15 14.5 16.8 13 18.2C12.5 16.2 11.8 14.8 10.8 13.5C10.2 15 9.2 16 8 16.5C7.8 14.2 7.2 12.5 6.5 11C6 9 6.2 6.5 7.2 4.5C7.6 3.6 8.2 2.8 8.8 2.2z"
        fill="var(--brass)"
      />
      <path
        d="M9.2 3.5 L18.5 16.2"
        stroke="var(--moss)"
        strokeWidth="0.65"
        strokeLinecap="round"
        opacity="0.32"
      />
    </svg>
  );
}
