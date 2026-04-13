import { HTMLAttributes } from "react";
import clsx from "clsx";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variante?: "padrao" | "destaque" | "roxo" | "amarelo";
  padding?: "sm" | "md" | "lg";
  semSombra?: boolean;
}

const variantesClasses = {
  padrao: "bg-white border-2 border-roxo shadow-brutal",
  destaque: "bg-white border-4 border-roxo shadow-brutal-lg",
  roxo: "bg-roxo text-white border-2 border-roxo-escuro shadow-brutal",
  amarelo: "bg-amarelo border-2 border-amarelo-hover shadow-brutal-amarelo",
};

const paddingClasses = {
  sm: "p-3",
  md: "p-5",
  lg: "p-7",
};

export default function Card({
  variante = "padrao",
  padding = "md",
  semSombra = false,
  children,
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-xl",
        variantesClasses[variante],
        paddingClasses[padding],
        semSombra && "shadow-none",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
