/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React from 'react';
import { Building2, Laptop, Store, DollarSign, Cpu, Globe } from 'lucide-react';

interface CompanyLogoBadgeProps {
  company: string;
  logoUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const BRAND_CONFIGS: Record<string, { bg: string; text: string; label: string; icon: React.ElementType }> = {
  fpt: { bg: 'bg-[#ff6f00]/10 text-[#ff6f00] border-[#ff6f00]/30', text: 'text-[#ff6f00]', label: 'FPT', icon: Laptop },
  vng: { bg: 'bg-[#ea580c]/10 text-[#ea580c] border-[#ea580c]/30', text: 'text-[#ea580c]', label: 'VNG', icon: Globe },
  viettel: { bg: 'bg-[#dc2626]/10 text-[#dc2626] border-[#dc2626]/30', text: 'text-[#dc2626]', label: 'VT', icon: Cpu },
  momo: { bg: 'bg-[#db2777]/10 text-[#db2777] border-[#db2777]/30', text: 'text-[#db2777]', label: 'MoMo', icon: DollarSign },
  shopee: { bg: 'bg-[#ea580c]/10 text-[#ea580c] border-[#ea580c]/30', text: 'text-[#ea580c]', label: 'Shopee', icon: Store },
  vnpt: { bg: 'bg-[#0284c7]/10 text-[#0284c7] border-[#0284c7]/30', text: 'text-[#0284c7]', label: 'VNPT', icon: Globe },
  techcombank: { bg: 'bg-[#e11d48]/10 text-[#e11d48] border-[#e11d48]/30', text: 'text-[#e11d48]', label: 'TCB', icon: DollarSign },
  vinai: { bg: 'bg-[#059669]/10 text-[#059669] border-[#059669]/30', text: 'text-[#059669]', label: 'VinAI', icon: Cpu },
  vingroup: { bg: 'bg-[#059669]/10 text-[#059669] border-[#059669]/30', text: 'text-[#059669]', label: 'Vin', icon: Building2 },
};

export default function CompanyLogoBadge({
  company = '',
  logoUrl,
  size = 'md',
  className = '',
}: CompanyLogoBadgeProps) {
  const cLower = company.toLowerCase();
  let brandKey = 'default';

  for (const key of Object.keys(BRAND_CONFIGS)) {
    if (cLower.includes(key)) {
      brandKey = key;
      break;
    }
  }

  const brand = BRAND_CONFIGS[brandKey] || {
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    text: 'text-slate-700',
    label: company.slice(0, 2).toUpperCase() || 'CO',
    icon: Building2,
  };

  const sizeClasses = {
    sm: 'w-8 h-8 rounded-lg text-xs font-bold',
    md: 'w-11 h-11 rounded-xl text-sm font-bold',
    lg: 'w-14 h-14 rounded-2xl text-base font-bold',
  };

  if (logoUrl && !logoUrl.includes('placeholder')) {
    return (
      <div
        className={`${sizeClasses[size]} border border-slate-200 overflow-hidden bg-white shrink-0 flex items-center justify-center ${className}`}
      >
        <img src={logoUrl} alt={company} className="w-full h-full object-cover" />
      </div>
    );
  }

  const Icon = brand.icon;

  return (
    <div
      className={`${sizeClasses[size]} border shrink-0 flex flex-col items-center justify-center ${brand.bg} ${className}`}
      title={company}
    >
      <span className="font-extrabold tracking-tighter leading-none">{brand.label}</span>
    </div>
  );
}
