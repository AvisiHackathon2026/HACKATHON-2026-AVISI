"use client";

import { useState, useEffect, type FormEvent, type ChangeEvent } from "react";
import { supabase } from "@/lib/supabaseClient";
import SwipeFeature from "./SwipeFeature";
import ChatFeature from "./ChatFeature";
import CalendarFeature from "./CalendarFeature";
import CompaniesDirectory from "./CompaniesDirectory";
import JobApplicationTracker from "./JobApplicationTracker";
import CompanyDashboardFeature from "./CompanyDashboardFeature";

export default function App() {
  // --- AUTHENTICATION & ROUTING STATE ---
  const [session, setSession] = useState<any>(null);
  const [currentView, setCurrentView] = useState<'home' | 'calculator' | 'account' | 'my_profile' | 'swipe' | 'chat' | 'calendar' | 'companies' | 'company_dashboard' | 'applications'>('home');
  const [negotiationMatchId, setNegotiationMatchId] = useState<string | null>(null);

  
  // Auth Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // --- ACCOUNT & THEME STATE ---
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // --- CALCULATOR STATE ---
  const [calcMode, setCalcMode] = useState<1 | 2>(2);
  const [targetMonthlySalary, setTargetMonthlySalary] = useState<number>(3000);
  const [travelCostsHourly, setTravelCostsHourly] = useState<number>(0);
  const [maxClientRate, setMaxClientRate] = useState<number>(120);
  const [desiredMargin, setDesiredMargin] = useState<number>(10);
  const [costFactor, setCostFactor] = useState<number>(2.0);
  const [hoursPerWeek, setHoursPerWeek] = useState<number>(40);

  // --- CV UPLOAD STATE (NEW) ---
  const [candidateName, setCandidateName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  // --- INITIAL LOAD ---
  const [userRole, setUserRole] = useState<'admin' | 'recruiter' | 'unemployed' | 'employed' | null>(null);

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
      if (!session) setCurrentView('home'); 
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (user: any) => {
    if (user && user.user_metadata) {
      setFullName(user.user_metadata.full_name || "");
      setCompany(user.user_metadata.company || "");
      if (user.user_metadata.dark_mode === true) setIsDarkMode(true);

      // RBAC: Fetch User Role
      if (user.email === "sietsekarsai@gmail.com") {
        setUserRole("admin");
      } else {
        const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        if (data) {
          setUserRole(data.role);
        } else {
          setUserRole("unemployed");
        }
      }
    } else {
      setUserRole(null);
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

  // --- CV UPLOAD LOGIC (NEW) ---
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setUploadStatus({ type: null, message: '' });
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadStatus({ type: 'error', message: 'Please select a file to upload.' });
      return;
    }
    if (!candidateName) {
      setUploadStatus({ type: 'error', message: 'Please enter a candidate name.' });
      return;
    }

    setIsUploading(true);
    setUploadStatus({ type: null, message: '' });

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `my_profiles/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('candidate_my_profiles')
        .insert([
          {
            recruiter_id: session?.user?.id, 
            candidate_name: candidateName,
            original_filename: file.name,
            file_path: filePath,
            public_url: urlData.publicUrl
          }
        ]);

      if (dbError) throw dbError;

      setUploadStatus({ type: 'success', message: 'CV uploaded successfully!' });
      setFile(null); 
      setCandidateName(""); 
    } catch (error: any) {
      console.error("Upload error:", error);
      setUploadStatus({ type: 'error', message: `Upload failed: ${error.message}` });
    } finally {
      setIsUploading(false);
    }
  };

  // --- CALCULATOR MATH LOGIC ---
  const targetCostPrice = maxClientRate - desiredMargin;
  const grossHourlyWage = targetCostPrice / costFactor;
  const grossWeeklySalary = grossHourlyWage * hoursPerWeek;
  const grossMonthlySalary = (grossWeeklySalary * 13) / 3;

  // --- THEME STYLES ---
  const theme = {
    bg: '#000a1f',
    text: '#ffffff',
    sidebarBg: 'transparent',
    cardBg: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    inputBg: 'rgba(0, 0, 0, 0.2)',
    inputText: '#ffffff',
  };

  // --- UI: NOT LOGGED IN ---
  if (!session) {
    return (
      <main className="grid-background" style={{ position: 'relative', overflow: 'hidden', padding: '2rem', fontFamily: 'sans-serif', color: 'var(--text-color)', minHeight: '100vh' }}>
        
        <div style={{ position: 'relative', zIndex: 10 }}>
          <h1 className="text-gradient" style={{ fontSize: '3rem', fontWeight: '800' }}>Vanguard Engine</h1>
          <p>Please log in or register to access the platform.</p>
          
          <form className="glass-card" onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', maxWidth: '300px', gap: '15px', marginTop: '1rem', padding: '20px' }}>
            <input className="glass-input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={{ padding: '10px', borderRadius: '8px' }} />
            <input className="glass-input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ padding: '10px', borderRadius: '8px' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="primary-button" type="submit" style={{ padding: '10px', flex: 1, cursor: 'pointer', borderRadius: '8px', fontWeight: 'bold' }}>Log In</button>
              <button className="glass-button" type="button" onClick={handleSignUp} style={{ padding: '10px', flex: 1, cursor: 'pointer', borderRadius: '8px', fontWeight: 'bold' }}>Register</button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  // --- UI: LOGGED IN (APP LAYOUT) ---
  return (
    <div className={isDarkMode ? "grid-background" : "grid-background light-mode"} style={{ display: "flex", minHeight: "100vh", fontFamily: "sans-serif", position: "relative", overflow: "hidden", color: "var(--text-color)" }}>
      
      {/* SIDEBAR */}
      <nav className="glass-card" style={{ position: 'relative', zIndex: 10, width: '250px', borderRight: `1px solid ${'var(--glass-border)'}`, padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
        <h2 className="text-gradient" style={{ marginTop: 0, marginBottom: '2rem', fontSize: '1.5rem', fontWeight: '800' }}>Vanguard</h2>
        


        {/* SHARED: Dashboard */}
        <button className="glass-card glass-button" onClick={() => setCurrentView('home')} style={{ padding: '10px', marginBottom: '10px', textAlign: 'left', cursor: 'pointer', background: currentView === 'home' ? 'var(--glass-border)' : 'transparent', color: 'var(--text-color)', border: 'none', fontWeight: currentView === 'home' ? 'bold' : 'normal', borderRadius: '4px' }}>
          🏠 Dashboard
        </button>

        {/* ADMIN & RECRUITER ONLY: Calculator */}
        {(userRole === 'admin' || userRole === 'recruiter') && (
          <button className="glass-card glass-button" onClick={() => setCurrentView('calculator')} style={{ padding: '10px', marginBottom: '10px', textAlign: 'left', cursor: 'pointer', background: currentView === 'calculator' ? 'var(--glass-border)' : 'transparent', color: 'var(--text-color)', border: 'none', fontWeight: currentView === 'calculator' ? 'bold' : 'normal', borderRadius: '4px' }}>
            Calculator
          </button>
        )}

        {/* UNEMPLOYED ONLY: My Profile (Will be merged into My Profile later, keeping for compatibility now) */}
        {userRole === 'unemployed' && (
          <button className="glass-card glass-button" onClick={() => setCurrentView('my_profile')} style={{ padding: '10px', marginBottom: '10px', textAlign: 'left', cursor: 'pointer', background: currentView === 'my_profile' ? 'var(--glass-border)' : 'transparent', color: 'var(--text-color)', border: 'none', fontWeight: currentView === 'my_profile' ? 'bold' : 'normal', borderRadius: '4px' }}>
            📄 My Profile
          </button>
        )}

        {/* ADMIN: Admin Panel / EVERYONE ELSE: Find Matches */}
        <button className="glass-card glass-button" onClick={() => setCurrentView('swipe')} style={{ padding: '10px', marginBottom: '10px', textAlign: 'left', cursor: 'pointer', background: currentView === 'swipe' ? 'var(--glass-border)' : 'transparent', color: 'var(--text-color)', border: 'none', fontWeight: currentView === 'swipe' ? 'bold' : 'normal', borderRadius: '4px' }}>
          {userRole === 'admin' ? '⚙️ Admin Panel' : '🔥 Find Matches'}
        </button>

        {/* SHARED: Chat & Calendar */}
        <button className="glass-card glass-button" onClick={() => setCurrentView('chat')} style={{ padding: '10px', marginBottom: '10px', textAlign: 'left', cursor: 'pointer', background: currentView === 'chat' ? 'var(--glass-border)' : 'transparent', color: 'var(--text-color)', border: 'none', fontWeight: currentView === 'chat' ? 'bold' : 'normal', borderRadius: '4px' }}>
          💬 Chat
        </button>
        <button className="glass-card glass-button" onClick={() => setCurrentView('calendar')} style={{ padding: '10px', marginBottom: '10px', textAlign: 'left', cursor: 'pointer', background: currentView === 'calendar' ? 'var(--glass-border)' : 'transparent', color: 'var(--text-color)', border: 'none', fontWeight: currentView === 'calendar' ? 'bold' : 'normal', borderRadius: '4px' }}>
          📅 Calendar
        </button>

        {/* SHARED: Companies */}
        <button className="glass-card glass-button" onClick={() => setCurrentView('companies')} style={{ padding: '10px', marginBottom: 'auto', textAlign: 'left', cursor: 'pointer', background: currentView === 'companies' ? 'var(--glass-border)' : 'transparent', color: 'var(--text-color)', border: 'none', fontWeight: currentView === 'companies' ? 'bold' : 'normal', borderRadius: '4px' }}>
          🏢 Companies
        </button>
        
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "15px", marginTop: "15px" }}><span style={{ fontSize: "0.9rem", color: "var(--text-color)", fontWeight: "bold" }}>Dark Mode</span><div onClick={() => { const newMode = !isDarkMode; setIsDarkMode(newMode); supabase.auth.updateUser({ data: { dark_mode: newMode } }); }} style={{ width: "50px", height: "28px", background: isDarkMode ? "#10b981" : "var(--glass-border)", borderRadius: "30px", position: "relative", cursor: "pointer", transition: "background 0.3s" }}><div style={{ position: "absolute", top: "2px", left: isDarkMode ? "24px" : "2px", width: "24px", height: "24px", background: "white", borderRadius: "50%", transition: "left 0.3s", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }} /></div></div><button onClick={handleSignOut} style={{ padding: '10px', cursor: 'pointer', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
          Sign Out
        </button>
      </nav>

      {/* MAIN CONTENT AREA */}
      <main style={{ position: 'relative', zIndex: 10, flex: 1, padding: '2rem', overflowY: 'auto' }}>
        
        {/* VIEW: HOME / DASHBOARD */}
        {currentView === 'home' && (
          <div>
            <h1 className="text-gradient" style={{ fontSize: '2.5rem', fontWeight: '800' }}>Welcome back, {fullName || session.user.email}!</h1>
            <p style={{ color: '#9ca3af' }}>What would you like to do today?</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '2rem' }}>
              
              {/* ADMIN & RECRUITER ONLY */}
              {(userRole === 'admin' || userRole === 'recruiter') && (
                <button className="glass-card glass-button" onClick={() => setCurrentView('calculator')} style={{ padding: '2rem', fontSize: '1.2rem', cursor: 'pointer', border: `1px solid rgba(255,255,255,0.1)`, borderRadius: '8px' }}>
                  Calculator
                </button>
              )}

              {/* UNEMPLOYED ONLY */}
              {userRole === 'unemployed' && (
                <>
                  <button className="glass-card glass-button" onClick={() => setCurrentView('my_profile')} style={{ padding: '2rem', fontSize: '1.2rem', cursor: 'pointer', border: `1px solid rgba(255,255,255,0.1)`, borderRadius: '8px' }}>
                    📄 My Profile
                  </button>
                  <button className="glass-card glass-button" onClick={() => setCurrentView('swipe')} style={{ padding: '2rem', fontSize: '1.2rem', cursor: 'pointer', border: `1px solid rgba(255,255,255,0.1)`, borderRadius: '8px' }}>
                    🔥 Find Matches
                  </button>
                </>
              )}

              {/* SHARED */}
              <button className="glass-card glass-button" onClick={() => setCurrentView('chat')} style={{ padding: '2rem', fontSize: '1.2rem', cursor: 'pointer', border: `1px solid rgba(255,255,255,0.1)`, borderRadius: '8px' }}>
                💬 Chat
              </button>
              <button className="glass-card glass-button" onClick={() => setCurrentView('calendar')} style={{ padding: '2rem', fontSize: '1.2rem', cursor: 'pointer', border: `1px solid rgba(255,255,255,0.1)`, borderRadius: '8px' }}>
                📅 Calendar
              </button>
              
              {/* RECRUITER ONLY */}
              {userRole === 'recruiter' && (
                <>
                  <button className="glass-card glass-button" onClick={() => setCurrentView('company_dashboard')} style={{ padding: '2rem', fontSize: '1.2rem', cursor: 'pointer', border: `1px solid rgba(255,255,255,0.1)`, borderRadius: '8px' }}>
                    🏢 Company Dashboard
                  </button>
                  <button className="glass-card glass-button" onClick={() => setCurrentView('swipe')} style={{ padding: '2rem', fontSize: '1.2rem', cursor: 'pointer', border: `1px solid rgba(255,255,255,0.1)`, borderRadius: '8px' }}>
                    🔥 Swipe Deck
                  </button>
                </>
              )}

              {/* ADMIN ONLY */}
              {userRole === 'admin' && (
                <button className="glass-card glass-button" onClick={() => setCurrentView('swipe')} style={{ padding: '2rem', fontSize: '1.2rem', cursor: 'pointer', border: `1px solid rgba(255,255,255,0.1)`, borderRadius: '8px' }}>
                  ⚙️ Admin Panel
                </button>
              )}
            </div>
          </div>
        )}

        {/* VIEW: ACCOUNT */}
        {currentView === 'account' && (
          <div style={{ maxWidth: '500px' }}>
            <h1>Edit Account</h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', background: 'var(--glass-bg)', padding: '2rem', border: `1px solid ${'var(--glass-border)'}`, borderRadius: '8px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                Full Name:
                <input type="text" placeholder="John Doe" value={fullName} onChange={e => setFullName(e.target.value)} style={{ padding: '10px', background: 'var(--glass-input-bg)', color: 'var(--text-color)', border: `1px solid ${'var(--glass-border)'}` }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                Company Name:
                <input type="text" placeholder="Acme Corp" value={company} onChange={e => setCompany(e.target.value)} style={{ padding: '10px', background: 'var(--glass-input-bg)', color: 'var(--text-color)', border: `1px solid ${'var(--glass-border)'}` }} />
              </label>
              <hr style={{ borderColor: 'var(--glass-border)', margin: '10px 0' }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '1.1rem' }}>
                <input type="checkbox" checked={isDarkMode} onChange={e => setIsDarkMode(e.target.checked)} style={{ transform: 'scale(1.5)', cursor: 'pointer' }} />
                Enable Dark Mode
              </label>
              <button onClick={handleSaveAccount} disabled={isSaving} style={{ marginTop: '15px', padding: '12px', cursor: 'pointer', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* VIEW: CALCULATOR */}
        {currentView === 'calculator' && (
          <div style={{ maxWidth: '800px', color: 'var(--text-color)' }}>
            <h1>🧮 Recruiter Calculator</h1>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button 
                onClick={() => setCalcMode(1)}
                style={{ flex: 1, padding: '10px', background: calcMode === 1 ? '#3b82f6' : 'var(--glass-bg)', color: calcMode === 1 ? 'white' : 'var(--text-color)', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Mode 1: Target Salary ➔ Client Rate
              </button>
              <button 
                onClick={() => setCalcMode(2)}
                style={{ flex: 1, padding: '10px', background: calcMode === 2 ? '#3b82f6' : 'var(--glass-bg)', color: calcMode === 2 ? 'white' : 'var(--text-color)', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Mode 2: Client Budget ➔ Max Salary
              </button>
            </div>

            {calcMode === 1 ? (
              <>
                <section style={{ border: `1px solid ${'var(--glass-border)'}`, background: 'var(--glass-bg)', padding: '1.5rem', marginBottom: '2rem', borderRadius: '8px' }}>
                  <h3 style={{ marginTop: 0 }}>Inputs (Target Salary ➔ Client Rate)</h3>
                  <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
                    Target Monthly Salary (€):
                    <input type="number" value={targetMonthlySalary} onChange={(e) => setTargetMonthlySalary(Number(e.target.value))} style={{ background: 'var(--glass-input-bg)', color: 'var(--text-color)', border: `1px solid ${'var(--glass-border)'}`, padding: '4px', width: '120px' }} />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
                    Travel Costs (Hourly €):
                    <input type="number" value={travelCostsHourly} onChange={(e) => setTravelCostsHourly(Number(e.target.value))} style={{ background: 'var(--glass-input-bg)', color: 'var(--text-color)', border: `1px solid ${'var(--glass-border)'}`, padding: '4px', width: '120px' }} />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
                    Desired Margin (€):
                    <input type="number" value={desiredMargin} onChange={(e) => setDesiredMargin(Number(e.target.value))} style={{ background: 'var(--glass-input-bg)', color: 'var(--text-color)', border: `1px solid ${'var(--glass-border)'}`, padding: '4px', width: '120px' }} />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
                    Cost Price Factor:
                    <input type="number" step="0.1" value={costFactor} onChange={(e) => setCostFactor(Number(e.target.value))} style={{ background: 'var(--glass-input-bg)', color: 'var(--text-color)', border: `1px solid ${'var(--glass-border)'}`, padding: '4px', width: '120px' }} />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
                    Workweek (Hours):
                    <input type="number" value={hoursPerWeek} onChange={(e) => setHoursPerWeek(Number(e.target.value))} style={{ background: 'var(--glass-input-bg)', color: 'var(--text-color)', border: `1px solid ${'var(--glass-border)'}`, padding: '4px', width: '120px' }} />
                  </label>
                </section>
                <section style={{ background: 'var(--glass-header-bg)', padding: '1.5rem', border: `1px solid ${'var(--glass-border)'}`, borderRadius: '8px' }}>
                  <h3 style={{ marginTop: 0 }}>Transparent Breakdown</h3>
                  <p><strong>1. Gross Weekly Salary:</strong> (€{targetMonthlySalary} × 3) / 13 = €{((targetMonthlySalary * 3) / 13).toFixed(2)} / week</p>
                  <p><strong>2. Gross Hourly Wage:</strong> €{((targetMonthlySalary * 3) / 13).toFixed(2)} / {hoursPerWeek} hours = €{(((targetMonthlySalary * 3) / 13) / hoursPerWeek).toFixed(2)}</p>
                  <p><strong>3. Cost Price:</strong> €{(((targetMonthlySalary * 3) / 13) / hoursPerWeek).toFixed(2)} × {costFactor} factor = €{((((targetMonthlySalary * 3) / 13) / hoursPerWeek) * costFactor).toFixed(2)}</p>
                  <p><strong>4. All-in Cost:</strong> €{((((targetMonthlySalary * 3) / 13) / hoursPerWeek) * costFactor).toFixed(2)} + €{travelCostsHourly} travel = €{(((((targetMonthlySalary * 3) / 13) / hoursPerWeek) * costFactor) + travelCostsHourly).toFixed(2)}</p>
                  <p><strong>5. Final Client Rate:</strong> €{(((((targetMonthlySalary * 3) / 13) / hoursPerWeek) * costFactor) + travelCostsHourly).toFixed(2)} + €{desiredMargin} margin = <strong>€{((((((targetMonthlySalary * 3) / 13) / hoursPerWeek) * costFactor) + travelCostsHourly) + desiredMargin).toFixed(2)}</strong></p>
                </section>
              </>
            ) : (
              <>
                <section style={{ border: `1px solid ${'var(--glass-border)'}`, background: 'var(--glass-bg)', padding: '1.5rem', marginBottom: '2rem', borderRadius: '8px' }}>
                  <h3 style={{ marginTop: 0 }}>Inputs (Budget ➔ Salary)</h3>
                  <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
                    Max Client Budget/Rate (€):
                    <input type="number" value={maxClientRate} onChange={(e) => setMaxClientRate(Number(e.target.value))} style={{ background: 'var(--glass-input-bg)', color: 'var(--text-color)', border: `1px solid ${'var(--glass-border)'}`, padding: '4px', width: '120px' }} />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
                    Desired Margin (€):
                    <input type="number" value={desiredMargin} onChange={(e) => setDesiredMargin(Number(e.target.value))} style={{ background: 'var(--glass-input-bg)', color: 'var(--text-color)', border: `1px solid ${'var(--glass-border)'}`, padding: '4px', width: '120px' }} />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
                    Cost Price Factor:
                    <input type="number" step="0.1" value={costFactor} onChange={(e) => setCostFactor(Number(e.target.value))} style={{ background: 'var(--glass-input-bg)', color: 'var(--text-color)', border: `1px solid ${'var(--glass-border)'}`, padding: '4px', width: '120px' }} />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
                    Workweek (Hours):
                    <input type="number" value={hoursPerWeek} onChange={(e) => setHoursPerWeek(Number(e.target.value))} style={{ background: 'var(--glass-input-bg)', color: 'var(--text-color)', border: `1px solid ${'var(--glass-border)'}`, padding: '4px', width: '120px' }} />
                  </label>
                </section>
                <section style={{ background: 'var(--glass-header-bg)', padding: '1.5rem', border: `1px solid ${'var(--glass-border)'}`, borderRadius: '8px' }}>
                  <h3 style={{ marginTop: 0 }}>Transparent Breakdown</h3>
                  <p><strong>1. Target Cost Price:</strong> €{maxClientRate} - €{desiredMargin} margin = €{(maxClientRate - desiredMargin).toFixed(2)} / hour</p>
                  <p><strong>2. Gross Hourly Wage:</strong> €{(maxClientRate - desiredMargin).toFixed(2)} / {costFactor} factor = €{((maxClientRate - desiredMargin) / costFactor).toFixed(2)}</p>
                  <p><strong>3. Gross Weekly Salary:</strong> €{((maxClientRate - desiredMargin) / costFactor).toFixed(2)} / factor × {hoursPerWeek} hours = €{(((maxClientRate - desiredMargin) / costFactor) * hoursPerWeek).toFixed(2)}</p>
                  <p><strong>4. Max Monthly Salary:</strong> (€{(((maxClientRate - desiredMargin) / costFactor) * hoursPerWeek).toFixed(2)} × 13) / 3 = <strong>€{((((maxClientRate - desiredMargin) / costFactor) * hoursPerWeek) * 13 / 3).toFixed(2)}</strong></p>
                </section>
              </>
            )}

            {negotiationMatchId && (
              <button
                onClick={async () => {
                  const wage = calcMode === 1 
                    ? (((targetMonthlySalary * 3) / 13) / hoursPerWeek).toFixed(2)
                    : ((maxClientRate - desiredMargin) / costFactor).toFixed(2);
                    
                  await supabase.from("messages").insert({
                    match_id: negotiationMatchId,
                    sender_id: session.user.id,
                    text: `[SALARY_PROPOSAL: ${wage}]`
                  });
                  setNegotiationMatchId(null);
                  setCurrentView('chat');
                }}
                style={{
                  marginTop: '20px',
                  width: '100%',
                  padding: '16px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Send Proposal (€{calcMode === 1 ? (((targetMonthlySalary * 3) / 13) / hoursPerWeek).toFixed(2) : ((maxClientRate - desiredMargin) / costFactor).toFixed(2)}/hr) to Chat
              </button>
            )}
          </div>
        )}



        {/* VIEW: MY PROFILE */}
        {currentView === 'my_profile' && (
          <div style={{ width: '100%', height: '100%' }}>
            <SwipeFeature key="profile" userId={session.user.id} userEmail={session.user.email || ""} defaultTab="edit_profile" hideTabs={true} />
          </div>
        )}

        {/* VIEW: SWIPE (NEW) */}
        {currentView === 'swipe' && (
          <div style={{ width: '100%', height: '100%' }}>
            <SwipeFeature key="swipe" userId={session.user.id} userEmail={session.user.email || ""} defaultTab="swipe" hideTabs={true} />
          </div>
        )}

        {/* VIEW: CHAT (NEW) */}
        {currentView === 'chat' && (
          <div style={{ width: '100%', height: '100%' }}>
            <ChatFeature 
              userId={session.user.id} 
              onGoToCalculator={(matchId: string) => {
                setNegotiationMatchId(matchId);
                setCurrentView('calculator');
              }} 
            />
          </div>
        )}

        {/* VIEW: CALENDAR (NEW) */}
        {currentView === 'calendar' && (
          <div style={{ width: '100%', height: '100%' }}>
            <CalendarFeature userId={session.user.id} />
          </div>
        )}

                {/* VIEW: JOB APPLICATIONS */}
        {currentView === 'applications' && (
          <div style={{ width: '100%', height: '100%', maxWidth: '800px', margin: '0 auto' }}>
            <JobApplicationTracker userId={session.user.id} />
          </div>
        )}

        {/* VIEW: COMPANIES DIRECTORY */}
        {currentView === 'companies' && (
          <div style={{ width: '100%', height: '100%' }}>
            <CompaniesDirectory />
          </div>
        )}

        {/* VIEW: COMPANY DASHBOARD (RECRUITER) */}
        {currentView === 'company_dashboard' && (
          <div style={{ width: '100%', height: '100%' }}>
            <CompanyDashboardFeature userId={session.user.id} />
          </div>
        )}
      </main>
    </div>
  );
}
