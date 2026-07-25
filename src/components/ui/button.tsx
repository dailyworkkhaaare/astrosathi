import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground rounded-full font-medium shadow-[var(--shadow-glow-gold)] hover:brightness-105 active:scale-[0.98] transition-all duration-150",
        default:
          "bg-primary text-primary-foreground rounded-full font-medium shadow-[var(--shadow-glow-gold)] hover:brightness-105 active:scale-[0.98] transition-all duration-150",
        secondary:
          "bg-secondary text-secondary-foreground rounded-full border border-border hover:brightness-105 active:scale-[0.98] transition-all duration-150",
        ghost:
          "bg-transparent text-foreground rounded-lg hover:bg-muted active:scale-[0.98] transition-all duration-150",
        destructive:
          "bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 active:scale-[0.98] transition-all duration-150",
        outline:
          "border border-input bg-background rounded-full shadow-sm hover:bg-accent hover:text-accent-foreground active:scale-[0.98] transition-all duration-150",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-6 text-sm",
        lg: "h-13 px-8 text-base",
        sm: "h-9 px-4 text-sm",
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
