"use client";

import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function App() {
  // --- AUTHENTICATION STATE ---
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // --- CALCULATOR STATE ---
  const [maxClientRate, setMaxClientRate] = useState<number>(120);
  const [desiredMargin, setDesiredMargin] = useState<number>(10);
  const [costFactor, setCostFactor] = useState<number>(2.0);
  const [hoursPerWeek, setHoursPerWeek] = useState<number>(40);

  // Check if user is logged in when the page loads
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- AUTHENTICATION LOGIC ---
  const handleLogin = async (e?: FormEvent) => {
    e?.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(`Login failed: ${error.message}`);
  };

  const handleSignUp = async () => {
    if (!email || !password) {
      alert("Please enter an email and a password to register.");
      return;
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    
    if (error) {
      alert(`Sign-up failed: ${error.message}`);
      return;
    }
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      alert("This email is already registered. Please log in instead.");
      return;
    }
    if (data.session) {
      alert("Account created! You are now logged in.");
    } else {
      alert("Sign-up successful! Please check your email for a confirmation link.");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // --- CALCULATOR MATH LOGIC ---
  const targetCostPrice = maxClientRate - desiredMargin;
  const grossHourlyWage = targetCostPrice / costFactor;
  const grossWeeklySalary = grossHourlyWage * hoursPerWeek;
  const grossMonthlySalary = (grossWeeklySalary * 13) / 3;

  // --- UI: NOT LOGGED IN ---
  if (!session) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <h1>Welcome to the Recruiter Platform</h1>
        <p>Please log in or register to access the calculator.</p>
        
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', maxWidth: '300px', gap: '10px', marginTop: '1rem' }}>
          <label>Email:</label>
          <input 
            type="email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required 
            style={{ padding: '8px' }}
          />
          
          <label>Password:</label>
          <input 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
            style={{ padding: '8px' }}
          />
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button type="submit" style={{ padding: '10px', flex: 1, cursor: 'pointer' }}>Log In</button>
            <button type="button" onClick={handleSignUp} style={{ padding: '10px', flex: 1, cursor: 'pointer' }}>Register</button>
          </div>
        </form>
      </main>
    );
  }

  // --- UI: LOGGED IN (CALCULATOR) ---
  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Recruiter Calculator</h1>
        <button onClick={handleSignOut} style={{ padding: '5px 10px', cursor: 'pointer' }}>Sign Out</button>
      </div>
      
      <section style={{ border: '1px solid #ccc', padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ marginTop: 0 }}>Inputs (Budget ➔ Salary)</h3>
        
        <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
          Max Client Budget/Rate (€):
          <input type="number" value={maxClientRate} onChange={(e) => setMaxClientRate(Number(e.target.value))} />
        </label>

        <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
          Desired Margin (€):
          <input type="number" value={desiredMargin} onChange={(e) => setDesiredMargin(Number(e.target.value))} />
        </label>

        <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
          Cost Price Factor:
          <input type="number" step="0.1" value={costFactor} onChange={(e) => setCostFactor(Number(e.target.value))} />
        </label>

        <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
          Workweek (Hours):
          <input type="number" value={hoursPerWeek} onChange={(e) => setHoursPerWeek(Number(e.target.value))} />
        </label>
      </section>

      <section style={{ background: '#f4f4f4', padding: '1.5rem', border: '1px solid #ddd' }}>
        <h3 style={{ marginTop: 0 }}>Transparent Breakdown</h3>
        <p><strong>1. Target Cost Price:</strong> €{maxClientRate} - €{desiredMargin} margin = €{targetCostPrice.toFixed(2)} / hour</p>
        <p><strong>2. Gross Hourly Wage:</strong> €{targetCostPrice.toFixed(2)} / {costFactor} factor = €{grossHourlyWage.toFixed(2)}</p>
        <p><strong>3. Gross Weekly Salary:</strong> €{grossHourlyWage.toFixed(2)} × {hoursPerWeek} hours = €{grossWeeklySalary.toFixed(2)}</p>
        <p><strong>4. Max Monthly Salary (13/3 Rule):</strong> (€{grossWeeklySalary.toFixed(2)} × 13) / 3 = <strong>€{grossMonthlySalary.toFixed(2)}</strong></p>
        
        <hr style={{ margin: '1.5rem 0' }} />
        <h2 style={{ color: 'green', margin: 0 }}>Indicative Max Monthly Salary: €{grossMonthlySalary.toFixed(2)}</h2>
        <p style={{ color: 'red', fontSize: '0.85rem', fontWeight: 'bold' }}>⚠️ Excludes travel costs until specific candidate details are known.</p>
      </section>
    </main>
  );
}