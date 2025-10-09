import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function ListaLancamentos() {
  const [lancamentos, setLancamentos] = useState([]);

  async function carregarLancamentos() {
    const { data, error } = await supabase
      .from("lancamentos")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error("Erro ao carregar:", error);
    } else {
      setLancamentos(data);
    }
  }

  useEffect(() => {
    carregarLancamentos();
  }, []);

  const total = lancamentos.reduce(
    (acc, item) => acc + (item.tipo === "entrada" ? item.valor : -item.valor),
    0
  );

  return (
    <div className="lista-lancamentos">
      <h2>Lançamentos</h2>
      {lancamentos.map((item) => (
        <div key={item.id} className="item-lancamento">
          <span>{item.descricao}</span>
          <span>
            {item.tipo === "entrada" ? "+" : "-"} R$ {item.valor.toFixed(2)}
          </span>
        </div>
      ))}

      <h3>Total: R$ {total.toFixed(2)}</h3>
    </div>
  );
}
