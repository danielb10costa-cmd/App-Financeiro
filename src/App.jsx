import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
// Se seu projeto já tem jsPDF/autotable/ html2canvas, mantenha os imports.
// Caso contrário, comente as duas linhas abaixo e use só CSV.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function App() {
  const [lancamentos, setLancamentos] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  // seleção / exclusão
  const [selecionados, setSelecionados] = useState(new Set());

  // filtros e busca
  const hoje = new Date();
  const [mesFiltro, setMesFiltro] = useState(String(hoje.getMonth() + 1)); // "1".."12"
  const [anoFiltro, setAnoFiltro] = useState(String(hoje.getFullYear()));  // "2025" etc.
  const [busca, setBusca] = useState("");

  // edição inline
  const [editandoId, setEditandoId] = useState(null);
  const [edit, setEdit] = useState({ descricao: "", valor: "", tipo: "saida", data: "" });

  // tema
  const [dark, setDark] = useState(false);

  // ---------- FETCH ----------
  async function carregarLancamentos() {
    try {
      setCarregando(true);
      setErro("");
      const { data, error } = await supabase
        .from("lancamentos")
        .select("id, descricao, valor, tipo, data")
        .order("data", { ascending: false })
        .order("id", { ascending: false });

      if (error) throw error;
      setLancamentos(data ?? []);
      setSelecionados(new Set());
    } catch (e) {
      setErro(e.message || "Erro ao carregar lançamentos.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarLancamentos();
  }, []);

  // ---------- DERIVADOS (filtros, busca) ----------
  const filtrados = useMemo(() => {
    const mes = Number(mesFiltro); // 1..12
    const ano = Number(anoFiltro);
    const texto = busca.trim().toLowerCase();

    return lancamentos.filter((l) => {
      const d = new Date(l.data);
      const condMesAno = (d.getMonth() + 1 === mes) && (d.getFullYear() === ano);
      const condBusca = !texto || (l.descricao?.toLowerCase().includes(texto));
      return condMesAno && condBusca;
    });
  }, [lancamentos, mesFiltro, anoFiltro, busca]);

  const { saldoMesAtual, saldoGeral } = useMemo(() => {
    // saldo do mês/ano do filtro
    let totalMes = 0;
    // saldo geral (independente do filtro)
    let totalGeral = 0;

    const mes = Number(mesFiltro) - 1; // 0..11
    const ano = Number(anoFiltro);

    for (const l of lancamentos) {
      const val = Number(l.valor) || 0;
      const s = l.tipo === "entrada" ? 1 : -1;
      totalGeral += val * s;

      const dt = new Date(l.data);
      if (dt.getMonth() === mes && dt.getFullYear() === ano) {
        totalMes += val * s;
      }
    }

    return { saldoMesAtual: totalMes, saldoGeral: totalGeral };
  }, [lancamentos, mesFiltro, anoFiltro]);

  // ---------- SELEÇÃO / EXCLUSÃO ----------
  function alternarSelecionado(id) {
    setSelecionados((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function excluirUm(id) {
    try {
      setCarregando(true);
      setErro("");
      const { error } = await supabase.from("lancamentos").delete().eq("id", id);
      if (error) throw error;
      setLancamentos((prev) => prev.filter((l) => l.id !== id));
      setSelecionados((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    } catch (e) {
      setErro(e.message || "Erro ao excluir.");
    } finally {
      setCarregando(false);
    }
  }

  async function excluirSelecionados() {
    if (selecionados.size === 0) return;
    try {
      setCarregando(true);
      setErro("");
      const ids = Array.from(selecionados);
      const { error } = await supabase.from("lancamentos").delete().in("id", ids);
      if (error) throw error;
      setLancamentos((prev) => prev.filter((l) => !selecionados.has(l.id)));
      setSelecionados(new Set());
    } catch (e) {
      setErro(e.message || "Erro ao excluir selecionados.");
    } finally {
      setCarregando(false);
    }
  }

  // ---------- EDIÇÃO ----------
  function iniciarEdicao(l) {
    setEditandoId(l.id);
    setEdit({
      descricao: l.descricao ?? "",
      valor: String(l.valor ?? ""),
      tipo: l.tipo ?? "saida",
      data: l.data ? String(l.data).slice(0, 10) : "",
    });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setEdit({ descricao: "", valor: "", tipo: "saida", data: "" });
  }

  async function salvarEdicao(id) {
    try {
      setCarregando(true);
      setErro("");

      const payload = {
        descricao: edit.descricao,
        valor: Number(edit.valor) || 0,
        tipo: edit.tipo,
        data: edit.data, // YYYY-MM-DD
      };

      const { error } = await supabase.from("lancamentos").update(payload).eq("id", id);
      if (error) throw error;

      setLancamentos((prev) =>
        prev.map((l) => (l.id === id ? { ...l, ...payload } : l))
      );
      cancelarEdicao();
    } catch (e) {
      setErro(e.message || "Erro ao salvar edição.");
    } finally {
      setCarregando(false);
    }
  }

  // ---------- EXPORTADORES ----------
  const fmtBRL = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  function exportarCSV() {
    const cols = ["Data", "Descrição", "Tipo", "Valor"];
    const linhas = filtrados.map((l) => [
      new Date(l.data).toLocaleDateString("pt-BR"),
      (l.descricao ?? "").replace(/\r?\n/g, " "),
      l.tipo,
      String(l.valor ?? ""),
    ]);
    const csv = [cols, ...linhas].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lancamentos_${anoFiltro}-${mesFiltro.padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportarPDF() {
    const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text(`Lançamentos ${mesFiltro.padStart(2, "0")}/${anoFiltro}`, 40, 40);
    autoTable(doc, {
      startY: 60,
      head: [["Data", "Descrição", "Tipo", "Valor"]],
      body: filtrados.map((l) => [
        new Date(l.data).toLocaleDateString("pt-BR"),
        l.descricao ?? "",
        l.tipo,
        fmtBRL(Number(l.valor) || 0),
      ]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [14, 165, 233] },
    });
    doc.save(`lancamentos_${anoFiltro}-${mesFiltro.padStart(2, "0")}.pdf`);
  }

  // ---------- UI ----------
  const bg = dark ? "#0b1220" : "#ffffff";
  const fg = dark ? "#e5e7eb" : "#111827";
  const border = dark ? "#243043" : "#e5e7eb";
  const muted = dark ? "#9ca3af" : "#6b7280";
  const card1 = dark ? "#164e63" : "#0ea5e9";
  const card2 = dark ? "#14532d" : "#10b981";

  return (
    <div style={{ maxWidth: 1080, margin: "24px auto", padding: 16, fontFamily: "Inter, system-ui, Segoe UI, Roboto, Arial", background: bg, color: fg, borderRadius: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>App Financeiro</h1>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input type="checkbox" checked={dark} onChange={() => setDark((v) => !v)} />
          Modo escuro
        </label>
      </div>

      {/* Cards de saldo */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={{ padding: 16, borderRadius: 12, background: card1, color: "white" }}>
          <div style={{ opacity: 0.9, fontSize: 13 }}>Saldo do mês (filtro)</div>
          <div style={{ fontWeight: 800, fontSize: 24 }}>{fmtBRL(saldoMesAtual)}</div>
        </div>
        <div style={{ padding: 16, borderRadius: 12, background: card2, color: "white" }}>
          <div style={{ opacity: 0.9, fontSize: 13 }}>Saldo geral</div>
          <div style={{ fontWeight: 800, fontSize: 24 }}>{fmtBRL(saldoGeral)}</div>
        </div>
      </div>

      {/* Filtros e ações */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <select value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)} style={selStyle(border, bg, fg)}>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={String(i + 1)}>
              {String(i + 1).padStart(2, "0")}
            </option>
          ))}
        </select>
        <select value={anoFiltro} onChange={(e) => setAnoFiltro(e.target.value)} style={selStyle(border, bg, fg)}>
          {Array.from({ length: 6 }, (_, k) => hoje.getFullYear() - 3 + k).map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>

        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar descrição…"
          style={inpStyle(border, bg, fg)}
        />

        <button onClick={carregarLancamentos} disabled={carregando} style={btnStyle(border, bg, fg)}>Recarregar</button>
        <button onClick={excluirSelecionados} disabled={carregando || selecionados.size === 0} style={btnDanger(border)}>
          Excluir selecionados ({selecionados.size})
        </button>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={exportarCSV} style={btnStyle(border, bg, fg)}>Exportar CSV</button>
          <button onClick={exportarPDF} style={btnStyle(border, bg, fg)}>Exportar PDF</button>
        </div>
      </div>

      {/* Erros */}
      {erro && (
        <div style={{ marginBottom: 12, padding: 12, background: dark ? "#3f1d1d" : "#fef2f2", color: dark ? "#fecaca" : "#991b1b", border: `1px solid ${dark ? "#7f1d1d" : "#fecaca"}`, borderRadius: 8 }}>
          {erro}
        </div>
      )}

      {/* Tabela */}
      <div style={{ border: `1px solid ${border}`, borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: dark ? "#0f172a" : "#f8fafc" }}>
            <tr>
              <th style={th(fg, border)}>Sel.</th>
              <th style={th(fg, border)}>Data</th>
              <th style={th(fg, border)}>Descrição</th>
              <th style={th(fg, border)}>Tipo</th>
              <th style={th(fg, border)}>Valor</th>
              <th style={th(fg, border)}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 16, textAlign: "center", color: muted }}>
                  Nenhum lançamento para os filtros/busca atuais
                </td>
              </tr>
            )}

            {filtrados.map((l) => {
              const marcado = selecionados.has(l.id);
              const dataIso = String(l.data).slice(0, 10);
              const dataFmt = new Date(l.data).toLocaleDateString("pt-BR");
              const corValor = l.tipo === "entrada" ? (dark ? "#86efac" : "#065f46") : (dark ? "#fecaca" : "#991b1b");
              const sinal = l.tipo === "entrada" ? "" : "-";

              const emEdicao = editandoId === l.id;

              return (
                <tr key={l.id} style={{ borderTop: `1px solid ${border}` }}>
                  <td style={tdCenter(fg)}>
                    <input type="checkbox" checked={marcado} onChange={() => alternarSelecionado(l.id)} />
                  </td>

                  <td style={td(fg)}>
                    {emEdicao ? (
                      <input
                        type="date"
                        value={edit.data}
                        onChange={(e) => setEdit((s) => ({ ...s, data: e.target.value }))}
                        style={inpStyle(border, bg, fg, "100%")}
                      />
                    ) : (
                      dataFmt
                    )}
                  </td>

                  <td style={td(fg)}>
                    {emEdicao ? (
                      <input
                        value={edit.descricao}
                        onChange={(e) => setEdit((s) => ({ ...s, descricao: e.target.value }))}
                        style={inpStyle(border, bg, fg, "100%")}
                      />
                    ) : (
                      l.descricao
                    )}
                  </td>

                  <td style={td(fg)}>
                    {emEdicao ? (
                      <select
                        value={edit.tipo}
                        onChange={(e) => setEdit((s) => ({ ...s, tipo: e.target.value }))}
                        style={selStyle(border, bg, fg, "100%")}
                      >
                        <option value="entrada">entrada</option>
                        <option value="saida">saida</option>
                      </select>
                    ) : (
                      l.tipo
                    )}
                  </td>

                  <td style={{ ...td(fg), color: corValor, fontWeight: 600 }}>
                    {emEdicao ? (
                      <input
                        type="number"
                        step="0.01"
                        value={edit.valor}
                        onChange={(e) => setEdit((s) => ({ ...s, valor: e.target.value }))}
                        style={inpStyle(border, bg, fg, 120)}
                      />
                    ) : (
                      <>
                        {sinal}
                        {fmtBRL(Number(l.valor) || 0)}
                      </>
                    )}
                  </td>

                  <td style={tdCenter(fg)}>
                    {!emEdicao ? (
                      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                        <button onClick={() => iniciarEdicao(l)} style={btnStyle(border, bg, fg)}>Editar</button>
                        <button onClick={() => excluirUm(l.id)} disabled={carregando} style={btnDanger(border)}>Excluir</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                        <button onClick={() => salvarEdicao(l.id)} disabled={carregando} style={btnOk()}>Salvar</button>
                        <button onClick={cancelarEdicao} disabled={carregando} style={btnStyle(border, bg, fg)}>Cancelar</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- estilos helpers ----
const th = (fg, border) => ({ textAlign: "left", padding: 12, fontSize: 14, color: fg, borderBottom: `1px solid ${border}` });
const td = (fg) => ({ padding: 12, fontSize: 14, color: fg });
const tdCenter = (fg) => ({ ...td(fg), textAlign: "center" });

const inpStyle = (border, bg, fg, w) => ({
  width: w || 240,
  padding: "8px 10px",
  borderRadius: 8,
  border: `1px solid ${border}`,
  background: bg,
  color: fg,
  outline: "none",
});

const selStyle = (border, bg, fg, w) => ({
  width: w || 120,
  padding: "8px 10px",
  borderRadius: 8,
  border: `1px solid ${border}`,
  background: bg,
  color: fg,
  outline: "none",
});

const btnStyle = (border, bg, fg) => ({
  padding: "8px 12px",
  borderRadius: 8,
  border: `1px solid ${border}`,
  background: bg,
  color: fg,
  cursor: "pointer",
});

const btnDanger = (border) => ({
  padding: "8px 12px",
  borderRadius: 8,
  border: `1px solid #ef4444`,
  background: "#fee2e2",
  color: "#b91c1c",
  cursor: "pointer",
});

const btnOk = () => ({
  padding: "8px 12px",
  borderRadius: 8,
  border: `1px solid #16a34a`,
  background: "#dcfce7",
  color: "#166534",
  cursor: "pointer",
});
