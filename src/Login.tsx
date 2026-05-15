import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase'; 
import logo from './assets/logo-pitagoras.png'; // Puxando a sua logo!

export default function Login({ onLoginSucesso }: { onLoginSucesso: () => void }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const fazerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      await signInWithEmailAndPassword(auth, email, senha);
      onLoginSucesso(); 
    } catch (error) {
      console.error(error);
      setErro('E-mail ou senha incorretos. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
      <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        {/* A SUA LOGO AQUI */}
        <img src={logo} alt="Pitágoras Contabilidade" style={{ width: '220px', marginBottom: '24px' }} />

        <h2 style={{ textAlign: 'center', color: '#1f2937', marginBottom: '8px', fontSize: '24px', fontWeight: 'bold' }}>
          Portal do Cliente
        </h2>
        <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: '24px' }}>
          Acesso exclusivo
        </p>

        {erro && (
          <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '10px', borderRadius: '4px', marginBottom: '16px', fontSize: '14px', textAlign: 'center', width: '100%' }}>
            {erro}
          </div>
        )}

        <form onSubmit={fazerLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>E-mail</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #d1d5db', outline: 'none', boxSizing: 'border-box' }}
              placeholder="cliente@email.com"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>Senha</label>
            <input 
              type="password" 
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #d1d5db', outline: 'none', boxSizing: 'border-box' }}
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={carregando}
            style={{ 
              marginTop: '8px',
              padding: '12px', 
              backgroundColor: '#4f46e5', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              fontSize: '16px', 
              fontWeight: 'bold',
              cursor: carregando ? 'not-allowed' : 'pointer',
              opacity: carregando ? 0.7 : 1
            }}
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}