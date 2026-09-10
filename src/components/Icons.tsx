import React from "react";

type P = React.SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 20) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

export const IconHome = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h5v-6h4v6h5V10" /></svg>
);
export const IconEnvelope = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
);
export const IconTemplates = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="3" y="4" width="18" height="4" rx="1" /><rect x="3" y="10" width="8" height="10" rx="1" /><rect x="13" y="10" width="8" height="4" rx="1" /><rect x="13" y="16" width="8" height="4" rx="1" /></svg>
);
export const IconChat = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 5h16v10H9l-5 4z" /><path d="M8 9h8M8 12h5" /></svg>
);
export const IconBell = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
);
export const IconGear = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
);
export const IconSparkle = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} fill="currentColor" stroke="none"><path d="M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8z" /><path d="M18 14l.9 2.6 2.6.9-2.6.9L18 21l-.9-2.6-2.6-.9 2.6-.9z" /></svg>
);
export const IconCard = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /><path d="M7 14h3" /></svg>
);
export const IconCheck = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} strokeWidth={2.4}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
export const IconCheckCircle = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.5 2.5 4.5-5" /></svg>
);
export const IconChevronDown = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="m6 9 6 6 6-6" /></svg>
);
export const IconChevronRight = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="m9 6 6 6-6 6" /></svg>
);
export const IconChevronLeft = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="m15 6-6 6 6 6" /></svg>
);
export const IconArrowLeft = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></svg>
);
export const IconArrowRight = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
);
export const IconClose = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconUser = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
);
export const IconShield = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /></svg>
);
export const IconShieldCheck = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="m9 12 2 2 4-4" /></svg>
);
export const IconSignature = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M3 17c3-6 5-6 6-3s2 3 4-1 3-3 4 1" /><path d="M3 21h18" /></svg>
);
export const IconWrench = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M14.7 6.3a4 4 0 0 0 5 5l-9.4 9.4a2 2 0 0 1-2.8-2.8z" /><path d="M14.7 6.3 18 3l3 3-3.3 3.3" /></svg>
);
export const IconActivity = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7 14 3-4 3 3 4-5" /></svg>
);
export const IconContacts = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="10" r="2.5" /><path d="M8 17a4 4 0 0 1 8 0" /></svg>
);
export const IconReceipt = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21z" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>
);
export const IconSliders = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
);
export const IconCloud = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M7 18a4 4 0 0 1-.5-8 6 6 0 0 1 11.5 1.5A3.5 3.5 0 0 1 17.5 18z" /></svg>
);
export const IconFolder = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M3 6h6l2 2h10v11H3z" /></svg>
);
export const IconMail = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9h4M7 12h6" /></svg>
);
export const IconClock = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const IconInfo = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
);
export const IconWarning = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M12 4 2.5 20h19z" /><path d="M12 10v4M12 17h.01" /></svg>
);
export const IconRefresh = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v5h-5" /></svg>
);
export const IconDownload = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M12 4v11" /><path d="m7 11 5 5 5-5" /><path d="M4 20h16" /></svg>
);
export const IconSearch = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="11" cy="11" r="6" /><path d="m20 20-4-4" /></svg>
);
export const IconGift = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="3" y="9" width="18" height="12" rx="1.5" /><path d="M3 13h18M12 9v12" /><path d="M12 9c-2-.5-4-1.5-4-3.5a2 2 0 0 1 4 0c0-.5 0 0 0 0a2 2 0 0 1 4 0c0 2-2 3-4 3.5" /></svg>
);
export const IconBadge = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="9" r="5" /><path d="m9 13-1.5 8L12 18l4.5 3L15 13" /></svg>
);
export const IconLock = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
export const IconPlus = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconMinus = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M5 12h14" /></svg>
);
export const IconQr = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="4" y="4" width="6" height="6" /><rect x="14" y="4" width="6" height="6" /><rect x="4" y="14" width="6" height="6" /><path d="M14 14h2v2h-2zM18 14h2M14 18h2v2M18 18h2v2" /></svg>
);
export const IconCamera = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 8h3l2-2h6l2 2h3v11H4z" /><circle cx="12" cy="13" r="3" /></svg>
);
export const IconHandover = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 12h9" /><path d="m10 9 3 3-3 3" /><rect x="15" y="5" width="5" height="14" rx="1" /></svg>
);
export const IconBank = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M3 10 12 4l9 6" /><path d="M5 10v8M9 10v8M15 10v8M19 10v8" /><path d="M3 20h18" /></svg>
);
export const IconHistory = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 12a8 8 0 1 0 2.3-5.7" /><path d="M4 4v5h5" /><path d="M12 8v4l3 2" /></svg>
);
export const IconUsers = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.5" /><path d="M15 15.5a5 5 0 0 1 6.5 4.5" /></svg>
);
export const IconApple = ({ size = 18, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.8-3.5.8-.7 0-1.9-.8-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.7 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.4 0 1.9.8 3.1.8 1.3 0 2.1-1.2 2.9-2.4.9-1.3 1.3-2.6 1.3-2.7 0 0-2.7-1-2.7-4zM14.1 5.8c.6-.8 1.1-1.9.9-3-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1.1.1 2.1-.5 2.8-1.3z" /></svg>
);
export const IconGoogle = ({ size = 18, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...p}><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z" /><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" /><path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9z" /><path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.7 9.4 5.9 12 5.9z" /></svg>
);
