import React, { useEffect, useState } from "react";
import { animate } from "framer-motion";
import { formatCurrency } from "@/lib/calculations";

interface CountUpProps {
  value: number;
  className?: string;
  decimals?: number;
  prefix?: string;
  currency?: boolean;
}

export function CountUp({ value, className = "", decimals, prefix = "", currency = true }: CountUpProps) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    const controls = animate(displayValue, value, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1], // Spring-like ease out
      onUpdate(v) {
        setDisplayValue(v);
      }
    });
    return () => controls.stop();
  }, [value]);

  if (typeof decimals === "number" || !currency) {
    const rounded = typeof decimals === "number" ? displayValue.toFixed(decimals) : Math.round(displayValue).toString();
    return (
      <span className={className}>
        {prefix}
        {rounded}
      </span>
    );
  }

  return (
    <span className={className}>
      {formatCurrency(displayValue)}
    </span>
  );
}
