"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [calcInput, setCalcInput] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    else alert('Logged in!');
  };

  const handleCalculate = async () => {
    const res = await fetch('/api/calculator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: calcInput })
    });
    const data = await res.json();
    setResult(data.result);
    
    // Trigger email
    if (data.result) {
      await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, result: data.result })
      });
      alert('Calculated and Email Sent!');
    }
  };

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Hackathon App</h1>
      
      <section style={{ marginBottom: '2rem' }}>
        <h2>1. Account Login (Supabase)</h2>
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ display: 'block', margin: '0.5rem 0' }} />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ display: 'block', margin: '0.5rem 0' }} />
        <button onClick={handleLogin}>Log In</button>
      </section>

      <section>
        <h2>2. Calculator & Email (Vercel API)</h2>
        <input placeholder="Enter a number" value={calcInput} onChange={e => setCalcInput(e.target.value)} style={{ display: 'block', margin: '0.5rem 0' }} />
        <button onClick={handleCalculate}>Calculate & Send Email</button>
        {result && <p>Result: {result}</p>}
      </section>
    </main>
  );
}
