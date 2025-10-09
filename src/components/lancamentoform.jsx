import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function LancamentoForm({ onNovoLancamento }) {
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [tipo, setTipo] = useState("entrada");

  async function salvarLancamento(e) {
    e.preventDefault();

    const { data, error } = await supabase
      .from("lancamento")
      .insert([{ descricao, valor: parseFloat(valor), tipo }]);

    if (error) {
      alert("Erro ao salvar lançamento: " + error.message);
    } else {
      alert("Lançamento salvo!");
      onNovoLancamento();
      setDescricao("");
      setValor("");
      setTipo("entrada");
    }
  }

  return (
    <form onSubmit={salvarLancamento} className="form-lancamento">
      <h2>Novo Lançamento</h2>

      <input
        type="text"
        placeholder="Descrição"
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        required
      />

      <input
        type="number"
        placeholder="Valor (R$)"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        required
      />

      <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
        <option value="entrada">Entrada</option>
        <option value="saida">Saída</option>
      </select>

      <button type="submit">Salvar</button>
    </form>
  );
}
