import React from 'react';
import { NewsArticle } from '../types/powerplant';

export type MascotPose = 'wave' | 'study' | 'bolt' | 'cheer' | 'blackout';

const MASCOT_SRC_MAP: Record<MascotPose, string> = {
  wave: '/assets/mascot/wave.png',
  study: '/assets/mascot/study.png',
  bolt: '/assets/mascot/bolt.png',
  cheer: '/assets/mascot/cheer.png',
  blackout: '/assets/mascot/bolt.png',
};

export const PowerMascot: React.FC<{
  pose?: MascotPose;
  className?: string;
}> = ({ pose = 'wave', className = 'w-16 h-16' }) => {
  const isBlackout = pose === 'blackout';
  return (
    <img
      src={MASCOT_SRC_MAP[pose]}
      alt="발전소 키우기 마스코트"
      draggable={false}
      className={`object-contain select-none pointer-events-none ${
        isBlackout ? 'grayscale opacity-70' : ''
      } ${className}`}
    />
  );
};

export const PowerPlantLogoSvg: React.FC<{ className?: string }> = ({
  className = 'w-24 h-24',
}) => (
  <svg
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="발전소 키우기 로고"
  >
    <defs>
      <linearGradient id="ppBg" x1="12" y1="12" x2="108" y2="108" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FF5E1E" />
        <stop offset="1" stopColor="#D87D00" />
      </linearGradient>
      <linearGradient id="ppBolt" x1="60" y1="24" x2="60" y2="96" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFFFFF" />
        <stop offset="1" stopColor="#FFDCBF" />
      </linearGradient>
    </defs>
    <rect x="8" y="8" width="104" height="104" rx="28" fill="url(#ppBg)" />
    <circle cx="60" cy="60" r="40" stroke="#FFFFFF" strokeOpacity="0.22" strokeWidth="2.5" strokeDasharray="6 6" />
    {/* Stylized Cooling Tower / Plant Base + Lightning Bolt */}
    <path
      d="M36 92L42 66H78L84 92H36Z"
      fill="#FFFFFF"
      fillOpacity="0.22"
    />
    <path
      d="M65.5 24L40 63H58L52.5 96L80 55H61.5L65.5 24Z"
      fill="url(#ppBolt)"
    />
    <circle cx="90" cy="30" r="6" fill="#FFDCBF" />
  </svg>
);

export const UserAvatarBadge: React.FC<{
  photoUrl?: string | null;
  displayName?: string;
  sizeClass?: string;
}> = ({ photoUrl, displayName = '전', sizeClass = 'w-8 h-8' }) => {
  const [imgError, setImgError] = React.useState(false);

  if (photoUrl && !imgError) {
    return (
      <img
        alt={`${displayName} 프로필`}
        src={photoUrl}
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-full object-cover ring-2 ring-primary-container/20`}
      />
    );
  }

  const initial = displayName.trim().charAt(0) || '⚡';
  return (
    <div
      className={`${sizeClass} rounded-full bg-primary-fixed text-on-primary-fixed font-label-md text-label-md font-extrabold flex items-center justify-center ring-2 ring-primary-container/20`}
      aria-label={`${displayName} 아바타`}
    >
      {initial}
    </div>
  );
};

export const NewsVisualBanner: React.FC<{
  theme: NewsArticle['visualTheme'];
  caption?: string;
  compact?: boolean;
}> = ({ theme, caption, compact = false }) => {
  const configs: Record<
    NewsArticle['visualTheme'],
    { bg: string; icon: string; badge: string; accent: string }
  > = {
    nuclear: {
      bg: 'from-[#0b1c30] via-[#1b3554] to-[#2e527c]',
      icon: 'bolt',
      badge: 'APR1000 · TEAM KOREA',
      accent: 'bg-primary-container',
    },
    grid: {
      bg: 'from-[#1a2b44] via-[#2b4569] to-[#426694]',
      icon: 'electrical_services',
      badge: '500kV HVDC GRID',
      accent: 'bg-tertiary-container',
    },
    smr: {
      bg: 'from-[#1e2f46] via-[#344e70] to-[#ab3500]',
      icon: 'precision_manufacturing',
      badge: 'SMR · 제11차 전기본',
      accent: 'bg-primary-container',
    },
    hydrogen: {
      bg: 'from-[#143342] via-[#215568] to-[#2b7a78]',
      icon: 'wind_power',
      badge: 'CLEAN H2 · OFFSHORE',
      accent: 'bg-tertiary-container',
    },
    offshore: {
      bg: 'from-[#13293d] via-[#1b4965] to-[#3d708a]',
      icon: 'cyclone',
      badge: 'DIGITAL TWIN · DX',
      accent: 'bg-primary-container',
    },
    solar: {
      bg: 'from-[#3a1f0d] via-[#8c5000] to-[#d87d00]',
      icon: 'solar_power',
      badge: 'BESS · RENEWABLE',
      accent: 'bg-primary-container',
    },
  };

  const cfg = configs[theme];

  if (compact) {
    return (
      <div
        className={`w-16 h-16 rounded-xl bg-gradient-to-br ${cfg.bg} flex items-center justify-center text-white shrink-0 shadow-sm relative overflow-hidden`}
      >
        <div className="absolute -right-2 -bottom-2 w-10 h-10 rounded-full bg-white/10" />
        <span className="material-symbols-outlined text-[28px] icon-filled">{cfg.icon}</span>
      </div>
    );
  }

  return (
    <div
      className={`w-full h-44 rounded-xl overflow-hidden my-1 relative bg-gradient-to-br ${cfg.bg} flex flex-col justify-between p-4 text-white`}
    >
      <div className="absolute right-4 top-4 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none" />
      <div className="absolute -left-6 -bottom-6 w-32 h-32 rounded-full bg-primary-container/25 blur-xl pointer-events-none" />
      <div className="flex items-center justify-between z-10">
        <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm font-label-sm text-label-sm tracking-wider">
          {cfg.badge}
        </span>
        <div className={`w-8 h-8 rounded-full ${cfg.accent} flex items-center justify-center shadow`}>
          <span className="material-symbols-outlined text-[18px] icon-filled">electric_bolt</span>
        </div>
      </div>
      <div className="flex items-center justify-center my-auto z-10">
        <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-lg">
          <span className="material-symbols-outlined text-[36px] text-tertiary-fixed-dim icon-filled">
            {cfg.icon}
          </span>
        </div>
      </div>
      {caption && (
        <div className="self-end z-10 px-2.5 py-0.5 rounded bg-on-surface/75 backdrop-blur-md text-surface font-label-sm text-label-sm flex items-center gap-1">
          <span className="material-symbols-outlined text-[13px]">verified</span>
          <span>{caption}</span>
        </div>
      )}
    </div>
  );
};
