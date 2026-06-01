'use client';

import { Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * @param {{ mode: 'standard' | 'fraud_adjusted', onChange: (mode: 'standard' | 'fraud_adjusted') => void, suspiciousCount?: number, className?: string }} props
 */
export function RoiFraudModeToggle({ mode, onChange, suspiciousCount = 0, className }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
        {[
          { id: 'standard', label: 'Обычный ROI' },
          { id: 'fraud_adjusted', label: 'Fraud-adjusted' },
        ].map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-md transition',
              mode === opt.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
            <Shield className="h-3.5 w-3.5" />
            {suspiciousCount > 0 ? `${suspiciousCount} подозр.` : 'fraud OK'}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          Fraud-adjusted исключает брони с меткой anti-fraud (fraud_suspicious в атрибуции/ledger).
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export default RoiFraudModeToggle;
