"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type Variante = "primario" | "secundario" | "amarelo" | "perigo" | "fantasma";
type Tamanho = "sm" | "md" | "lg" | "xl";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamanho?: Tamanho;
  carregando?: boolean;
  icone?: React.ReactNode;
  larguraTotal?: boolean;
}

const variantesClasses: Record<Variante, string> = {
  primario:
    "bg-roxo text-white border-2 border-roxo-escuro shadow-brutal hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-brutal-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
  secundario:
    "bg-white text-roxo border-2 border-roxo shadow-brutal hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-brutal-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
  amarelo:
    "bg-amarelo text-roxo-escuro border-2 border-amarelo-hover shadow-brutal-amarelo hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#F5C800] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
  perigo:
    "bg-vermelho text-white border-2 border-red-700 shadow-[4px_4px_0_#991b1b] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#991b1b] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
  fantasma:
    "bg-transparent text-white border-2 border-white/50 hover:border-white hover:bg-white/10 active:bg-white/20",
};

const tamanhosClasses: Record<Tamanho, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
  xl: "px-8 py-4 text-lg",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variante = "primario",
      tamanho = "md",
      carregando = false,
      icone,
      larguraTotal = false,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || carregando;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={clsx(
          "font-corpo font-black uppercase tracking-wide rounded transition-all duration-100 cursor-pointer select-none",
          "flex items-center justify-center gap-2",
          variantesClasses[variante],
          tamanhosClasses[tamanho],
          larguraTotal && "w-full",
          isDisabled &&
            "opacity-50 cursor-not-allowed pointer-events-none translate-x-0 translate-y-0 shadow-none",
          className
        )}
        {...props}
      >
        {carregando ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Carregando...
          </span>
        ) : (
          <>
            {icone && <span>{icone}</span>}
            {children}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
