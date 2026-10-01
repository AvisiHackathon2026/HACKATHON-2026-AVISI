"use client";

import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function App() {
  // --- AUTHENTICATION & ROUTING STATE ---
  const [session, setSession] = useState<any>(null);
  const [currentView, setCurrentView] = useState<'home' | 'calculator' | 'account'>('home');
  
  // Auth Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // --- ACCOUNT & THEME STATE ---
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // --- CALCULATOR STATE ---
  const [maxClientRate, setMaxClientRate] = useState<number>(120);
  const [desiredMargin, setDesiredMargin] = useState<number>(10);
  const [costFactor, setCostFactor] = useState<number>(2.0);
  const [hoursPerWeek, setHoursPerWeek] = useState<number>(40);

  // --- INITIAL LOAD ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      loadUserData(session?.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      loadUserData(session?.user);
      if (!session) setCurrentView('home'); // reset view on logout
    });

    return () => subscription.unsubscribe();
  }, []);

  // Hydrate user data from Supabase storage
  const loadUserData = (user: any) => {
    if (user && user.user_metadata) {
      setFullName(user.user_metadata.full_name || "");
      setCompany(user.user_metadata.company || "");
      if (user.user_metadata.dark_mode === true) setIsDarkMode(true);
    }
  };

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
    if (data.user?.identities?.length === 0) {
      alert("This email is already registered. Please log in instead.");
      return;
    }
    if (data.session) alert("Account created! You are now logged in.");
    else alert("Sign-up successful! Check your email for confirmation.");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // --- ACCOUNT UPDATE LOGIC ---
  const handleSaveAccount = async () => {
    setIsSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName, company: company, dark_mode: isDarkMode }
    });
    setIsSaving(false);
    if (error) alert(`Error saving: ${error.message}`);
    else alert("Account info saved successfully!");
  };

  // --- THEME STYLES ---
  const theme = {
    bg: isDarkMode ? '#121212' : '#ffffff',
    text: isDarkMode ? '#e0e0e0' : '#111111',
    sidebarBg: isDarkMode ? '#1e1e1e' : '#f4f4f4',
    cardBg: isDarkMode ? '#2d2d2d' : '#f9f9f9',
    borderColor: isDarkMode ? '#444' : '#ccc',
    inputBg: isDarkMode ? '#333' : '#fff',
    inputText: isDarkMode ? '#fff' : '#000',
  };

  // --- UI: NOT LOGGED IN ---
  if (!session) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'sans-serif', background: theme.bg, color: theme.text, minHeight: '100vh' }}>
        <h1>Welcome to the Recruiter Platform</h1>
        <p>Please log in or register to access the platform.</p>
        
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', maxWidth: '300px', gap: '10px', marginTop: '1rem' }}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={{ padding: '8px', background: theme.inputBg, color: theme.inputText, border: `1px solid ${theme.borderColor}` }} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ padding: '8px', background: theme.inputBg, color: theme.inputText, border: `1px solid ${theme.borderColor}` }} />
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" style={{ padding: '10px', flex: 1, cursor: 'pointer', background: theme.sidebarBg, color: theme.text, border: `1px solid ${theme.borderColor}` }}>Log In</button>
            <button type="button" onClick={handleSignUp} style={{ padding: '10px', flex: 1, cursor: 'pointer', background: theme.sidebarBg, color: theme.text, border: `1px solid ${theme.borderColor}` }}>Register</button>
          </div>
        </form>
      </main>
    );
  }

  // --- UI: LOGGED IN (APP LAYOUT) ---
  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif', background: theme.bg, color: theme.text }}>
      
      {/* SIDEBAR */}
      <nav style={{ width: '250px', background: theme.sidebarBg, borderRight: `1px solid ${theme.borderColor}`, padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ marginTop: 0, marginBottom: '2rem' }}>Recruiter App</h2>
        
        <button onClick={() => setCurrentView('account')} style={{ padding: '10px', marginBottom: '10px', textAlign: 'left', cursor: 'pointer', background: currentView === 'account' ? theme.borderColor : 'transparent', color: theme.text, border: 'none', fontWeight: currentView === 'account' ? 'bold' : 'normal', borderRadius: '4px' }}>
          ⚙️ Edit Account
        </button>
        <button onClick={() => setCurrentView('home')} style={{ padding: '10px', marginBottom: '10px', textAlign: 'left', cursor: 'pointer', background: currentView === 'home' ? theme.borderColor : 'transparent', color: theme.text, border: 'none', fontWeight: currentView === 'home' ? 'bold' : 'normal', borderRadius: '4px' }}>
          🏠 Dashboard
        </button>
        <button onClick={() => setCurrentView('calculator')} style={{ padding: '10px', marginBottom: 'auto', textAlign: 'left', cursor: 'pointer', background: currentView === 'calculator' ? theme.borderColor : 'transparent', color: theme.text, border: 'none', fontWeight: currentView === 'calculator' ? 'bold' : 'normal', borderRadius: '4px' }}>
          🧮 Calculator
        </button>
        
        <button onClick={handleSignOut} style={{ padding: '10px', cursor: 'pointer', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '4px' }}>
          Sign Out
        </button>
      </nav>

      {/* MAIN CONTENT AREA */}
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        
        {/* VIEW: HOME / DASHBOARD */}
        {currentView === 'home' && (
          <div>
            <h1>Welcome back, {fullName || session.user.email}!</h1>
            <p>What would you like to do today?</p>
            <div style={{ display: 'flex', gap: '20px', marginTop: '2rem' }}>
              <button onClick={() => setCurrentView('calculator')} style={{ padding: '2rem', fontSize: '1.2rem', cursor: 'pointer', background: theme.cardBg, color: theme.text, border: `1px solid ${theme.borderColor}`, borderRadius: '8px', flex: 1 }}>
                🧮 Open Calculator
              </button>
              <button onClick={() => setCurrentView('account')} style={{ padding: '2rem', fontSize: '1.2rem', cursor: 'pointer', background: theme.cardBg, color: theme.text, border: `1px solid ${theme.borderColor}`, borderRadius: '8px', flex: 1 }}>
                ⚙️ Edit Account Details
              </button>
            </div>
          </div>
        )}

        {/* VIEW: ACCOUNT */}
        {currentView === 'account' && (
          <div style={{ maxWidth: '500px' }}>
            <h1>Edit Account</h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', background: theme.cardBg, padding: '2rem', border: `1px solid ${theme.borderColor}`, borderRadius: '8px' }}>
              
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                Full Name:
                <input type="text" placeholder="John Doe" value={fullName} onChange={e => setFullName(e.target.value)} style={{ padding: '10px', background: theme.inputBg, color: theme.inputText, border: `1px solid ${theme.borderColor}` }} />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                Company Name:
                <input type="text" placeholder="Acme Corp" value={company} onChange={e => setCompany(e.target.value)} style={{ padding: '10px', background: theme.inputBg, color: theme.inputText, border: `1px solid ${theme.borderColor}` }} />
              </label>

              <hr style={{ borderColor: theme.borderColor, margin: '10px 0' }} />

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '1.1rem' }}>
                <input type="checkbox" checked={isDarkMode} onChange={e => setIsDarkMode(e.target.checked)} style={{ transform: 'scale(1.5)', cursor: 'pointer' }} />
                Enable Dark Mode
              </label>

              <button onClick={handleSaveAccount} disabled={isSaving} style={{ marginTop: '15px', padding: '12px', cursor: 'pointer', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* VIEW: CALCULATOR */}
        {currentView === 'calculator' && (
          <div style={{ maxWidth: '800px' }}>
            <h1>Recruiter Calculator</h1>
            
            <section style={{ border: `1px solid ${theme.borderColor}`, background: theme.cardBg, padding: '1.5rem', marginBottom: '2rem', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0 }}>Inputs (Budget ➔ Salary)</h3>
              <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
                Max Client Budget/Rate (€):
                <input type="number" value={maxClientRate} onChange={(e) => setMaxClientRate(Number(e.target.value))} style={{ background: theme.inputBg, color: theme.inputText, border: `1px solid ${theme.borderColor}`, padding: '4px' }} />
              </label>
              <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
                Desired Margin (€):
                <input type="number" value={desiredMargin} onChange={(e) => setDesiredMargin(Number(e.target.value))} style={{ background: theme.inputBg, color: theme.inputText, border: `1px solid ${theme.borderColor}`, padding: '4px' }} />
              </label>
              <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
                Cost Price Factor:
                <input type="number" step="0.1" value={costFactor} onChange={(e) => setCostFactor(Number(e.target.value))} style={{ background: theme.inputBg, color: theme.inputText, border: `1px solid ${theme.borderColor}`, padding: '4px' }} />
              </label>
              <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
                Workweek (Hours):
                <input type="number" value={hoursPerWeek} onChange={(e) => setHoursPerWeek(Number(e.target.value))} style={{ background: theme.inputBg, color: theme.inputText, border: `1px solid ${theme.borderColor}`, padding: '4px' }} />
              </label>
            </section>

            <section style={{ background: theme.sidebarBg, padding: '1.5rem', border: `1px solid ${theme.borderColor}`, borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0 }}>Transparent Breakdown</h3>
              <p><strong>1. Target Cost Price:</strong> €{maxClientRate} - €{desiredMargin} margin = €{(maxClientRate - desiredMargin).toFixed(2)} / hour</p>
              <p><strong>2. Gross Hourly Wage:</strong> €{(maxClientRate - desiredMargin).toFixed(2)} / {costFactor} factor = €{((maxClientRate - desiredMargin) / costFactor).toFixed(2)}</p>
              <p><strong>3. Gross Weekly Salary:</strong> €{((maxClientRate - desiredMargin) / costFactor).toFixed(2)} / factor × {hoursPerWeek} hours = €{(((maxClientRate - desiredMargin) / costFactor) * hoursPerWeek).toFixed(2)}</p>
              <p><strong>4. Max Monthly Salary:</strong> (€{(((maxClientRate - desiredMargin) / costFactor) * hoursPerWeek).toFixed(2)} × 13) / 3 = <strong>€{((((maxClientRate - desiredMargin) / costFactor) * hoursPerWeek) * 13 / 3).toFixed(2)}</strong></p>
              
              <hr style={{ borderColor: theme.borderColor, margin: '1.5rem 0' }} />
              <h2 style={{ color: '#2e7d32', margin: 0 }}>Indicative Max Monthly Salary: €{((((maxClientRate - desiredMargin) / costFactor) * hoursPerWeek) * 13 / 3).toFixed(2)}</h2>
              <p style={{ color: '#d32f2f', fontSize: '0.85rem', fontWeight: 'bold' }}>⚠️ Excludes travel costs until specific candidate details are known.</p>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}