'use client'

import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { cn } from '@/lib/utils'

/**
 * Stage 189.0 — OTP cells with 48px touch targets + numeric keyboard.
 */
export function AuthOtpInput({ value, onChange, disabled, className, maxLength = 6 }) {
  return (
    <InputOTP
      maxLength={maxLength}
      value={value}
      onChange={onChange}
      disabled={disabled}
      inputMode="numeric"
      autoComplete="one-time-code"
      containerClassName={cn('justify-center gap-2', className)}
    >
      <InputOTPGroup className="gap-2">
        {Array.from({ length: maxLength }).map((_, index) => (
          <InputOTPSlot
            key={index}
            index={index}
            className="h-12 w-11 rounded-xl border-slate-200 text-lg font-semibold first:rounded-xl last:rounded-xl"
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  )
}

export default AuthOtpInput
