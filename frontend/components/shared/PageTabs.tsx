'use client';

import React from 'react';

export interface TabItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  badge?: React.ReactNode;
  count?: number;
}

export interface PageTabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  className?: string;
  ariaLabel?: string;
}

export default function PageTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className = '',
  ariaLabel = 'Danh mục điều hướng',
}: PageTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex flex-wrap items-center p-1 bg-[#F1F5F9] dark:bg-slate-800/80 rounded-xl gap-1 border border-[#E2E8F0] dark:border-slate-700/60 max-w-full overflow-x-auto ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center justify-center gap-2 h-10 sm:h-11 px-4 sm:px-5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] ${
              isActive
                ? 'bg-white dark:bg-slate-900 text-[#059669] dark:text-emerald-400 font-semibold shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:shadow-none'
                : 'bg-transparent text-[#475569] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700/50'
            }`}
          >
            {Icon && <Icon size={16} className={isActive ? 'text-[#059669] dark:text-emerald-400' : 'text-[#64748B]'} />}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold leading-none ${
                  isActive
                    ? 'bg-[#ECFDF5] text-[#059669] dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                {tab.count}
              </span>
            )}
            {tab.badge && <span className="ml-1">{tab.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}
