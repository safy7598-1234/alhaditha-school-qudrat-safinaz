import React, { useState } from 'react';
import { SCHOOL_LOGO_URL } from '../data/curriculum';

interface SchoolLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<SchoolLogoProps['size']>, string> = {
  xs: 'w-8 h-8 rounded-lg p-0.5',
  sm: 'w-9 h-9 sm:w-11 sm:h-11 rounded-xl p-0.5',
  md: 'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl p-1',
  lg: 'w-20 h-20 sm:w-24 sm:h-24 rounded-2xl p-1.5'
};

export const SchoolLogo: React.FC<SchoolLogoProps> = ({ size = 'sm', className = '' }) => {
  const [imgFailed, setImgFailed] = useState(false);

  if (imgFailed) {
    return (
      <div
        className={`${SIZE_CLASSES[size]} bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-center font-black select-none shrink-0 ${className}`}
        aria-label="شعار مدارس الحديثة الأهلية بنات"
      >
        <span className="text-xs sm:text-sm">م.ح</span>
      </div>
    );
  }

  return (
    <div
      className={`${SIZE_CLASSES[size]} bg-white border-2 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)] flex items-center justify-center overflow-hidden shrink-0 ${className}`}
    >
      <img
        src={SCHOOL_LOGO_URL}
        alt="شعار مدارس الحديثة الأهلية بنات"
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className="w-full h-full object-contain p-0.5"
      />
    </div>
  );
};
