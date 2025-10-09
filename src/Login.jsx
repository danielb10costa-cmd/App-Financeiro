import React, { useState } from "react";
import { supabase } from "./supabaseClient";
import "./index.css";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modoCadastro, setModoCadastro] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (modoCadastro) {
      const { error } = await supabase.auth.signUp({
        email,
        password: senha,
      });
      if (error) alert("Erro ao cadastrar: " + error.message);
      else alert("Conta criada com sucesso! Verifique seu e-mail.");
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });
      if (error) alert("Erro ao fazer login: " + error.message);
      else onLogin(data.user);
    }
  };

  return (
    <div className="container">
      <h1>🔐 {modoCadastro ? "Criar Conta" : "Login"}</h1>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Seu e-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Sua senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />
        <button type="submit">
          {modoCadastro ? "Cadastrar" : "Entrar"}
        </button>
      </form>
      <p
        style={{ textAlign: "center", marginTop: "15px", cursor: "pointer" }}
        onClick={() => setModoCadastro(!modoCadastro)}
      >
        {modoCadastro
          ? "Já tem conta? Faça login"
          : "Ainda não tem conta? Cadastre-se"}
      </p>
    </div>
  );
}
