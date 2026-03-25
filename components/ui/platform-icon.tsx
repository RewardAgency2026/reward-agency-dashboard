interface Props {
  platform: string;
  size?: number;
}

export function PlatformIcon({ platform, size = 18 }: Props) {
  switch (platform) {
    case "meta":
      return (
        <img src="/platforms/meta.png" width={size} height={size} alt="Meta" style={{ objectFit: "contain" }} />
      );
    case "google":
      return (
        <img src="/platforms/google.png" width={size} height={size} alt="Google" style={{ objectFit: "contain" }} />
      );
    case "tiktok":
      return (
        <img src="/platforms/tiktok.png" width={size} height={size} alt="TikTok" style={{ objectFit: "contain" }} />
      );
    case "snapchat":
      return (
        <img src="/platforms/snapchat.png" width={size} height={size} alt="Snapchat" style={{ objectFit: "contain" }} />
      );
    case "linkedin":
      return (
        <img src="/platforms/linkedin.png" width={size} height={size} alt="LinkedIn" style={{ objectFit: "contain" }} />
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="6" fill="#E5E7EB" />
          <text x="12" y="17" textAnchor="middle" fill="#6B7280" fontSize="12" fontWeight="600" fontFamily="sans-serif">
            {platform.charAt(0).toUpperCase()}
          </text>
        </svg>
      );
  }
}
