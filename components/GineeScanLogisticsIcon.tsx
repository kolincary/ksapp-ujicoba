import React from 'react';

/**
 * GineeScanLogisticsIcon
 * Icon resmi Ginee OMS untuk Status Pemindaian Logistik ("Sudah Discan")
 * Sesuai referensi gambar lampiran 3, 4, dan 5:
 * Berbentuk kotak viewfinder dengan 4 sudut siku biru (#2F54EB) dan garis pemindai horizontal oranye (#FA8C16) di tengah.
 */
interface GineeScanLogisticsIconProps {
  size?: number;
  className?: string;
  title?: string;
  showBadgeText?: boolean;
}

export const GineeScanLogisticsIcon: React.FC<GineeScanLogisticsIconProps> = ({
  size = 18,
  className = '',
  title = 'Status Pemindaian: Sudah Discan Logistik',
  showBadgeText = false,
}) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 select-none ${className}`}
      title={title}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-150 hover:scale-110 drop-shadow-2xs"
      >
        {/* Sudut Siku Kiri Atas (Biru Ginee) */}
        <path
          d="M3.5 7.5V5A2 2 0 0 1 5.5 3H8"
          stroke="#2F54EB"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* Sudut Siku Kanan Atas (Biru Ginee) */}
        <path
          d="M12 3H14.5A2 2 0 0 1 16.5 5V7.5"
          stroke="#2F54EB"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* Sudut Siku Kiri Bawah (Biru Ginee) */}
        <path
          d="M3.5 12.5V15A2 2 0 0 0 5.5 17H8"
          stroke="#2F54EB"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* Sudut Siku Kanan Bawah (Biru Ginee) */}
        <path
          d="M12 17H14.5A2 2 0 0 0 16.5 15V12.5"
          stroke="#2F54EB"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* Garis Sensor Barcode Tengah (Oranye Ginee) */}
        <line
          x1="5.5"
          y1="10"
          x2="14.5"
          y2="10"
          stroke="#FA8C16"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
      {showBadgeText && (
        <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
          Discan
        </span>
      )}
    </span>
  );
};
