"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { type ReactNode, type ElementType } from "react";
import { cn } from "@/lib/utils";

interface AutoAnimateProps {
  as?: ElementType;
  children: ReactNode;
  className?: string;
}

export function AutoAnimate({
  as: Component = "div",
  children,
  className,
}: AutoAnimateProps) {
  const [parent] = useAutoAnimate();

  return (
    <Component ref={parent} className={className}>
      {children}
    </Component>
  );
}
