import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface FloatingButtonProps {
  icon: LucideIcon;
  onClick: () => void;
  children?: React.ReactNode;
  className?: string;
  variant?: "primary" | "accent";
}

export function FloatingButton({
  icon: Icon,
  onClick,
  children,
  className,
  variant = "primary"
}: FloatingButtonProps) {
  const variantStyles = {
    primary: "bg-gradient-primary hover:shadow-strong",
    accent: "bg-gradient-accent hover:shadow-medium"
  };

  return (
    <Button
      onClick={onClick}
      className={cn(
        "fixed bottom-6 right-6 h-14 min-w-14 rounded-full shadow-medium hover:shadow-strong transition-all duration-300",
        variantStyles[variant],
        children && "px-6",
        className
      )}
    >
      <Icon className="h-6 w-6" />
      {children && <span className="ml-2 font-medium">{children}</span>}
    </Button>
  );
}