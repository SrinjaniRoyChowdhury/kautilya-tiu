"use client";

import { useState, type InputHTMLAttributes } from "react";
import { HiOutlineEye, HiOutlineEyeOff } from "react-icons/hi";
import { cn } from "@/lib/format";
import { Input } from "@/components/ui/field";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  defaultVisible?: boolean;
};

export function PasswordInput({ className, defaultVisible = false, ...props }: Props) {
  const [visible, setVisible] = useState(defaultVisible);
  const label = visible ? "Hide password" : "Show password";
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-11", className)} />
      <button
        type="button"
        className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center text-gold-700 hover:text-[#74541f]"
        onClick={() => setVisible((open) => !open)}
        aria-label={label}
        aria-pressed={visible}
        title={label}
      >
        {visible ? <HiOutlineEyeOff size={18} aria-hidden /> : <HiOutlineEye size={18} aria-hidden />}
      </button>
    </div>
  );
}
