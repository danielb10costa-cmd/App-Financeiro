import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Login from "./Login";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./index.css";

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [assinaturaAtiva, setAssinaturaAtiva] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [tipo, setTipo] = useState("saida");
  const [data, setData] = useState("");
  const [lancamentos, setLancamentos] = useState([]);
  const [mesFiltro, setMesFiltro] = useState("");

  // 🧭 Verifica login
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUsuario(data.user);
      if (data.user) verificarAssinatura(data.user.id);
    });
  }, []);

  // 🔒 Verifica status da assinatura no Supabase
  const verificarAssinatura = async (id) => {
    const { data, error } = await supabase
      .from("usuarios_assinaturas")
      .select("ativo")
      .eq("usuario_id", id)
      .single();

    if (error) setAssinaturaAtiva(false);
    else setAssinaturaAtiva(data?.ativo);
  };

  // 🚪 Logout
  const logout = async () => {
    await supabase.auth.signOut();
    setUsuario(null);
  };

  // ❌ Cancelar assinatura
  const cancelarAssinatura = async () => {
    const confirmar = window.confirm("Tem certeza que deseja cancelar sua assinatura?");
    if (!confirmar) return;

    try {
      const { error } = await supabase
        .from("usuarios_assinaturas")
        .delete()
        .eq("usuario_id", usuario.id);

      if (error) throw error;

      await supabase.auth.signOut();
      setUsuario(null);
      alert("Assinatura cancelada com sucesso.");
    } catch (err) {
      console.error("Erro ao cancelar assinatura:", err.message);
      alert("Erro ao cancelar assinatura. Tente novamente.");
    }
  };

  // 🔍 Buscar lançamentos do usuário
  const buscarLancamentos = async () => {
    if (!usuario) return;
    let query = supabase
      .from("lancamento")
      .select("*")
      .eq("usuario_id", usuario.id)
      .order("data", { ascending: false });

    if (mesFiltro)
      query = query
        .gte("data", `${mesFiltro}-01`)
        .lte("data", `${mesFiltro}-31`);

    const { data, error } = await query;
    if (!error) setLancamentos(data || []);
  };

  // 💾 Salvar lançamento
  const salvarLancamento = async (e) => {
    e.preventDefault();
    if (!assinaturaAtiva)
      return alert("⚠️ Assinatura inativa. Assine para continuar.");

    const { error } = await supabase.from("lancamento").insert([
      { descricao, valor, tipo, data, usuario_id: usuario.id },
    ]);

    if (error) alert(error.message);
    else {
      setDescricao("");
      setValor("");
      buscarLancamentos();
    }
  };

  useEffect(() => {
    buscarLancamentos();
  }, [usuario, mesFiltro]);

  // 📄 Gerar PDF do extrato
  const gerarPDF = () => {
    const doc = new jsPDF();
    doc.text("💰 Extrato Financeiro", 14, 15);
    autoTable(doc, {
      head: [["Data", "Descrição", "Tipo", "Valor"]],
      body: lancamentos.map((l) => [
        l.data,
        l.descricao,
        l.tipo,
        `R$ ${Number(l.valor).toFixed(2)}`,
      ]),
      startY: 25,
    });
    doc.save(`Extrato_${mesFiltro || "geral"}.pdf`);
  };

  // 🪙 Redireciona para o checkout do Mercado Pago
  const iniciarAssinatura = () => {
    const linkMercadoPago =
      "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=6ce80fe3728942f2a9bfec61586c4b89";
    window.open(linkMercadoPago, "_blank"); // abre em nova aba
  };

  // 🔑 Se não estiver logado, mostra tela de login
  if (!usuario) return <Login onLogin={setUsuario} />;

  return (
    <div className="container">
      <h1>💰 Controle Financeiro</h1>
      <button className="logout" onClick={logout}>Sair</button>

      {/* 🔒 Bloqueio se a assinatura não estiver ativa */}
      {!assinaturaAtiva ? (
        <div className="assinatura-container">
          <h3>🔒 Acesso restrito</h3>
          <p>Assine o plano mensal por <b>R$ 15,00</b> para desbloquear o app.</p>
          <button onClick={iniciarAssinatura}>💳 Fazer Assinatura</button>
        </div>
      ) : (
        <>
          <form onSubmit={salvarLancamento}>
            <input
              type="text"
              placeholder="Descrição"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              required
            />
            <input
              type="number"
              placeholder="Valor"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              required
            />
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              required
            />
            <button type="submit">Salvar</button>
          </form>

          <h2>📅 Extrato</h2>
          <div className="filtro-container">
            <input
              type="month"
              value={mesFiltro}
              onChange={(e) => setMesFiltro(e.target.value)}
            />
            <button type="button" onClick={gerarPDF}>📄 Gerar PDF</button>
          </div>

          <div className="tabela-container">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Tipo</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {lancamentos.map((l) => (
                  <tr key={l.id}>
                    <td>{l.data}</td>
                    <td>{l.descricao}</td>
                    <td>{l.tipo}</td>
                    <td
                      style={{
                        color: l.tipo === "entrada" ? "green" : "red",
                        fontWeight: "bold",
                      }}
                    >
                      R$ {Number(l.valor).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Rodapé com botão de cancelar assinatura */}
      <footer className="rodape">
        <p>📞 Suporte: <a href="mailto:danielb10costa@gmail.com">danielb10costa@gmail.com</a></p>
        <button onClick={cancelarAssinatura} className="botao-cancelar">
          ❌ Cancelar Assinatura
        </button>
        <p>© {new Date().getFullYear()} - App Finanças. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
