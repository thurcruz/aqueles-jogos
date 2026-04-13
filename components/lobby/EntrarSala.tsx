"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import {
  buscarSalaPorCodigo,
  entrarNaSala,
  salvarDadosLocais,
} from "@/lib/supabase";

interface EntrarSalaProps {
  codigoInicial?: string;
}

export default function EntrarSala({ codigoInicial = "" }: EntrarSalaProps) {
  const router = useRouter();
  const [apelido, setApelido] = useState("");
  const [codigo, setCodigo] = useState(codigoInicial);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  function formatarCodigo(valor: string) {
    // Remove tudo que não é alfanumérico, converte para maiúsculo
    const limpo = valor.replace(/[^A-Z0-9a-z]/g, "").toUpperCase();

    // Reconstrói com prefixo AJ-
    if (limpo.startsWith("AJ")) {
      const resto = limpo.slice(2);
      if (resto.length === 0) return "AJ-";
      return `AJ-${resto.slice(0, 4)}`;
    }

    if (limpo.length === 0) return "";
    return `AJ-${limpo.slice(0, 4)}`;
  }

  async function handleEntrar(e: React.FormEvent) {
    e.preventDefault();
    if (!apelido.trim()) {
      setErro("Digite seu apelido!");
      return;
    }
    if (!codigo.trim() || codigo.length < 7) {
      setErro("Digite o código da sala (Ex: AJ-4K2M)");
      return;
    }

    setCarregando(true);
    setErro("");

    try {
      const sala = await buscarSalaPorCodigo(codigo.trim());

      if (sala.status === "encerrada") {
        setErro("Esta sala já foi encerrada.");
        return;
      }

      const jogador = await entrarNaSala(sala.id, apelido.trim(), 1);

      salvarDadosLocais({
        apelido: apelido.trim(),
        sala_id: sala.id,
        jogador_id: jogador.id,
        codigo_sala: sala.codigo,
      });

      if (sala.status === "jogando") {
        router.push(`/jogo/adivinhe-palavras/${sala.codigo}`);
      } else {
        router.push(`/sala/${sala.codigo}`);
      }
    } catch (err: unknown) {
      console.error(err);
      if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "PGRST116") {
        setErro("Sala não encontrada. Verifique o código.");
      } else {
        setErro("Erro ao entrar na sala. Tente novamente.");
      }
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={handleEntrar} className="space-y-5">
      {/* Apelido */}
      <div>
        <label className="block font-corpo font-black text-white text-sm mb-2 uppercase tracking-wide">
          Seu apelido
        </label>
        <input
          type="text"
          value={apelido}
          onChange={(e) => setApelido(e.target.value)}
          placeholder="Ex: Luana, Thiaguinho..."
          maxLength={20}
          className="w-full px-4 py-3 rounded-xl border-2 border-roxo bg-white font-corpo font-bold text-roxo-escuro placeholder-gray-400 focus:outline-none focus:border-amarelo focus:ring-2 focus:ring-amarelo/30 transition-all text-lg"
        />
      </div>

      {/* Código da sala */}
      <div>
        <label className="block font-corpo font-black text-white text-sm mb-2 uppercase tracking-wide">
          Código da sala
        </label>
        <input
          type="text"
          value={codigo}
          onChange={(e) => setCodigo(formatarCodigo(e.target.value))}
          placeholder="AJ-XXXX"
          maxLength={7}
          className="w-full px-4 py-3 rounded-xl border-2 border-roxo bg-white font-pixel text-roxo-escuro placeholder-gray-400 focus:outline-none focus:border-amarelo focus:ring-2 focus:ring-amarelo/30 transition-all text-xl text-center tracking-widest uppercase"
        />
      </div>

      {/* Erro */}
      {erro && (
        <div className="bg-vermelho/20 border border-vermelho rounded-xl px-4 py-3 text-white font-corpo font-bold text-sm">
          {erro}
        </div>
      )}

      <Button
        type="submit"
        variante="amarelo"
        tamanho="lg"
        larguraTotal
        carregando={carregando}
        icone={<span>🎮</span>}
      >
        Entrar na Sala
      </Button>
    </form>
  );
}
