interface Props {
  platform: string;
  size?: number;
}

export function PlatformIcon({ platform, size = 18 }: Props) {
  const s = size;

  switch (platform) {
    case "meta":
      return (
        <img
          src="/platforms/meta.png"
          width={size}
          height={size}
          alt="Meta"
          style={{ objectFit: "contain" }}
        />
      );

    case "google":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.66 15.63 16.88 16.79 15.71 17.57V20.34H19.28C21.36 18.42 22.56 15.6 22.56 12.25Z" fill="#4285F4" />
          <path d="M12 23C14.97 23 17.46 22.02 19.28 20.34L15.71 17.57C14.73 18.23 13.48 18.63 12 18.63C9.14 18.63 6.71 16.7 5.84 14.1H2.18V16.94C3.99 20.53 7.7 23 12 23Z" fill="#34A853" />
          <path d="M5.84 14.09C5.62 13.43 5.49 12.73 5.49 12C5.49 11.27 5.62 10.57 5.84 9.91V7.07H2.18C1.43 8.55 1 10.22 1 12C1 13.78 1.43 15.45 2.18 16.93L5.84 14.09Z" fill="#FBBC05" />
          <path d="M12 5.38C13.62 5.38 15.06 5.94 16.21 7.02L19.36 3.87C17.45 2.09 14.97 1 12 1C7.7 1 3.99 3.47 2.18 7.07L5.84 9.91C6.71 7.31 9.14 5.38 12 5.38Z" fill="#EA4335" />
        </svg>
      );

    case "tiktok":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="6" fill="#010101" />
          <path d="M17.5 7.5C16.3 7.5 15.3 6.5 15.3 5.3V5H13V15.5C13 16.6 12.1 17.5 11 17.5C9.9 17.5 9 16.6 9 15.5C9 14.4 9.9 13.5 11 13.5C11.2 13.5 11.4 13.5 11.6 13.6V11.2C11.4 11.2 11.2 11.1 11 11.1C8.8 11.1 7 12.9 7 15.1C7 17.3 8.8 19.1 11 19.1C13.2 19.1 15 17.3 15 15.1V10.2C15.8 10.8 16.8 11.1 17.8 11.1V8.8C17.7 8.8 17.6 7.5 17.5 7.5Z" fill="white" />
          <path d="M17.5 7.5C16.3 7.5 15.3 6.5 15.3 5.3V5H13V15.5C13 16.6 12.1 17.5 11 17.5C9.9 17.5 9 16.6 9 15.5C9 14.4 9.9 13.5 11 13.5C11.2 13.5 11.4 13.5 11.6 13.6V11.2C11.4 11.2 11.2 11.1 11 11.1C8.8 11.1 7 12.9 7 15.1C7 17.3 8.8 19.1 11 19.1C13.2 19.1 15 17.3 15 15.1V10.2C15.8 10.8 16.8 11.1 17.8 11.1V8.8C17.7 8.8 17.6 7.5 17.5 7.5Z" fill="#EE1D52" opacity="0.5" />
        </svg>
      );

    case "snapchat":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="6" fill="#FFFC00" />
          <path d="M12 4C9.2 4 7 6.2 7 9V11.5C6.6 11.7 6 12 6 12.5C6 13 6.5 13.3 7 13.3C7.1 13.3 7.2 13.3 7.3 13.2C7.5 14.3 8.5 16 10.5 16.3C10.5 16.5 10.3 16.7 10 16.8C9.5 17 8.5 17.2 7.5 17.5C7.2 17.6 7 17.8 7 18C7 18.5 8 19 12 19C16 19 17 18.5 17 18C17 17.8 16.8 17.6 16.5 17.5C15.5 17.2 14.5 17 14 16.8C13.7 16.7 13.5 16.5 13.5 16.3C15.5 16 16.5 14.3 16.7 13.2C16.8 13.3 16.9 13.3 17 13.3C17.5 13.3 18 13 18 12.5C18 12 17.4 11.7 17 11.5V9C17 6.2 14.8 4 12 4Z" fill="#1C1C1C" />
        </svg>
      );

    case "pinterest":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="6" fill="#E60023" />
          <path d="M12 3C7 3 4 6.5 4 10C4 12.5 5.5 14.5 7.5 15C7.7 15 7.8 14.9 7.8 14.7L8 13.7C8 13.5 8 13.4 7.8 13.3C6.8 12.3 6.5 11 6.5 10C6.5 7.5 8.5 5.5 12 5.5C15 5.5 16.8 7 16.8 9.5C16.8 12 15.5 14 13.5 14C12.5 14 11.8 13.2 12 12.2L12.5 9.8C12.7 9 12.2 8.3 11.5 8.3C10.5 8.3 9.5 9.5 9.5 11C9.5 12 9.8 12.7 9.8 12.7L8.8 17C8.6 18 8.7 19 8.7 19H8.8C8.8 19 9.8 17.5 10.2 16C10.3 15.7 10.8 13.8 10.8 13.8C11.2 14.5 12.2 15 13.2 15C16.5 15 19 12 19 9.5C19 6 15.8 3 12 3Z" fill="white" />
        </svg>
      );

    default:
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="6" fill="#E5E7EB" />
          <text x="12" y="17" textAnchor="middle" fill="#6B7280" fontSize="12" fontWeight="600" fontFamily="sans-serif">
            {platform.charAt(0).toUpperCase()}
          </text>
        </svg>
      );
  }
}
