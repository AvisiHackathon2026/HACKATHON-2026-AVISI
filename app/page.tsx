"use client";

import { useState, useEffect, type FormEvent, type ChangeEvent } from "react";
import { supabase } from "@/lib/supabaseClient";
import SwipeFeature from "./SwipeFeature";
import ChatFeature from "./ChatFeature";
import CalendarFeature from "./CalendarFeature";
import CompaniesDirectory from "./CompaniesDirectory";

export default function App() {
  // --- AUTHENTICATION & ROUTING STATE ---
  const [session, setSession] = useState<any>(null);
  const [currentView, setCurrentView] = useState<'home' | 'calculator' | 'account' | 'cv' | 'swipe' | 'chat' | 'calendar' | 'companies'>('home');
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
      const filePath = `cvs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('candidate_cvs')
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
        <button onClick={() => setCurrentView('calculator')} style={{ padding: '10px', marginBottom: '10px', textAlign: 'left', cursor: 'pointer', background: currentView === 'calculator' ? theme.borderColor : 'transparent', color: theme.text, border: 'none', fontWeight: currentView === 'calculator' ? 'bold' : 'normal', borderRadius: '4px' }}>
          🧮 Calculator
        </button>
        <button onClick={() => setCurrentView('cv')} style={{ padding: '10px', marginBottom: '10px', textAlign: 'left', cursor: 'pointer', background: currentView === 'cv' ? theme.borderColor : 'transparent', color: theme.text, border: 'none', fontWeight: currentView === 'cv' ? 'bold' : 'normal', borderRadius: '4px' }}>
          📄 Upload CV
        </button>
        <button onClick={() => setCurrentView('swipe')} style={{ padding: '10px', marginBottom: '10px', textAlign: 'left', cursor: 'pointer', background: currentView === 'swipe' ? theme.borderColor : 'transparent', color: theme.text, border: 'none', fontWeight: currentView === 'swipe' ? 'bold' : 'normal', borderRadius: '4px' }}>
          🔥 Find Matches
        </button>
        <button onClick={() => setCurrentView('chat')} style={{ padding: '10px', marginBottom: '10px', textAlign: 'left', cursor: 'pointer', background: currentView === 'chat' ? theme.borderColor : 'transparent', color: theme.text, border: 'none', fontWeight: currentView === 'chat' ? 'bold' : 'normal', borderRadius: '4px' }}>
          💬 Chat
        </button>
        <button onClick={() => setCurrentView('calendar')} style={{ padding: '10px', marginBottom: '10px', textAlign: 'left', cursor: 'pointer', background: currentView === 'calendar' ? theme.borderColor : 'transparent', color: theme.text, border: 'none', fontWeight: currentView === 'calendar' ? 'bold' : 'normal', borderRadius: '4px' }}>
          📅 Calendar
        </button>
        <button onClick={() => setCurrentView('companies')} style={{ padding: '10px', marginBottom: 'auto', textAlign: 'left', cursor: 'pointer', background: currentView === 'companies' ? theme.borderColor : 'transparent', color: theme.text, border: 'none', fontWeight: currentView === 'companies' ? 'bold' : 'normal', borderRadius: '4px' }}>
          🏢 Companies
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
              <button onClick={() => setCurrentView('cv')} style={{ padding: '2rem', fontSize: '1.2rem', cursor: 'pointer', background: theme.cardBg, color: theme.text, border: `1px solid ${theme.borderColor}`, borderRadius: '8px', flex: 1 }}>
                📄 Upload Candidate CV
              </button>
              <button onClick={() => setCurrentView('swipe')} style={{ padding: '2rem', fontSize: '1.2rem', cursor: 'pointer', background: theme.cardBg, color: theme.text, border: `1px solid ${theme.borderColor}`, borderRadius: '8px', flex: 1 }}>
                🔥 Find Matches
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
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button 
                onClick={() => setCalcMode(1)}
                style={{ flex: 1, padding: '10px', background: calcMode === 1 ? '#3b82f6' : '#e5e7eb', color: calcMode === 1 ? '#fff' : '#111', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Mode 1: Target Salary ➔ Client Rate
              </button>
              <button 
                onClick={() => setCalcMode(2)}
                style={{ flex: 1, padding: '10px', background: calcMode === 2 ? '#3b82f6' : '#e5e7eb', color: calcMode === 2 ? '#fff' : '#111', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Mode 2: Client Budget ➔ Max Salary
              </button>
            </div>

            {calcMode === 1 ? (
              <>
                <section style={{ border: `1px solid ${theme.borderColor}`, background: theme.cardBg, padding: '1.5rem', marginBottom: '2rem', borderRadius: '8px' }}>
                  <h3 style={{ marginTop: 0 }}>Inputs (Target Salary ➔ Client Rate)</h3>
                  <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
                    Target Monthly Salary (€):
                    <input type="number" value={targetMonthlySalary} onChange={(e) => setTargetMonthlySalary(Number(e.target.value))} style={{ background: theme.inputBg, color: theme.inputText, border: `1px solid ${theme.borderColor}`, padding: '4px', width: '120px' }} />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
                    Travel Costs (Hourly €):
                    <input type="number" value={travelCostsHourly} onChange={(e) => setTravelCostsHourly(Number(e.target.value))} style={{ background: theme.inputBg, color: theme.inputText, border: `1px solid ${theme.borderColor}`, padding: '4px', width: '120px' }} />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
                    Desired Margin (€):
                    <input type="number" value={desiredMargin} onChange={(e) => setDesiredMargin(Number(e.target.value))} style={{ background: theme.inputBg, color: theme.inputText, border: `1px solid ${theme.borderColor}`, padding: '4px', width: '120px' }} />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
                    Cost Price Factor:
                    <input type="number" step="0.1" value={costFactor} onChange={(e) => setCostFactor(Number(e.target.value))} style={{ background: theme.inputBg, color: theme.inputText, border: `1px solid ${theme.borderColor}`, padding: '4px', width: '120px' }} />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
                    Workweek (Hours):
                    <input type="number" value={hoursPerWeek} onChange={(e) => setHoursPerWeek(Number(e.target.value))} style={{ background: theme.inputBg, color: theme.inputText, border: `1px solid ${theme.borderColor}`, padding: '4px', width: '120px' }} />
                  </label>
                </section>
                <section style={{ background: theme.sidebarBg, padding: '1.5rem', border: `1px solid ${theme.borderColor}`, borderRadius: '8px' }}>
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
                <section style={{ border: `1px solid ${theme.borderColor}`, background: theme.cardBg, padding: '1.5rem', marginBottom: '2rem', borderRadius: '8px' }}>
                  <h3 style={{ marginTop: 0 }}>Inputs (Budget ➔ Salary)</h3>
                  <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
                    Max Client Budget/Rate (€):
                    <input type="number" value={maxClientRate} onChange={(e) => setMaxClientRate(Number(e.target.value))} style={{ background: theme.inputBg, color: theme.inputText, border: `1px solid ${theme.borderColor}`, padding: '4px', width: '120px' }} />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
                    Desired Margin (€):
                    <input type="number" value={desiredMargin} onChange={(e) => setDesiredMargin(Number(e.target.value))} style={{ background: theme.inputBg, color: theme.inputText, border: `1px solid ${theme.borderColor}`, padding: '4px', width: '120px' }} />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
                    Cost Price Factor:
                    <input type="number" step="0.1" value={costFactor} onChange={(e) => setCostFactor(Number(e.target.value))} style={{ background: theme.inputBg, color: theme.inputText, border: `1px solid ${theme.borderColor}`, padding: '4px', width: '120px' }} />
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
                    Workweek (Hours):
                    <input type="number" value={hoursPerWeek} onChange={(e) => setHoursPerWeek(Number(e.target.value))} style={{ background: theme.inputBg, color: theme.inputText, border: `1px solid ${theme.borderColor}`, padding: '4px', width: '120px' }} />
                  </label>
                </section>
                <section style={{ background: theme.sidebarBg, padding: '1.5rem', border: `1px solid ${theme.borderColor}`, borderRadius: '8px' }}>
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
                  color: '#fff',
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

        {/* VIEW: CV UPLOAD (NEW) */}
        {currentView === 'cv' && (
          <div style={{ maxWidth: '500px' }}>
            <h1>Upload Candidate CV</h1>
            <div style={{ border: `1px solid ${theme.borderColor}`, background: theme.cardBg, padding: '2rem', borderRadius: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                
                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  Candidate Name:
                  <input type="text" placeholder="Jane Doe" value={candidateName} onChange={e => setCandidateName(e.target.value)} style={{ padding: '10px', background: theme.inputBg, color: theme.inputText, border: `1px solid ${theme.borderColor}` }} />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  CV File (.pdf, .doc):
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handleFileChange} style={{ padding: '10px', background: theme.inputBg, color: theme.inputText, border: `1px solid ${theme.borderColor}`, borderRadius: '4px' }} />
                </label>

                <button
                  onClick={handleUpload}
                  disabled={!file || !candidateName || isUploading}
                  style={{
                    padding: '12px',
                    background: isUploading || !file || !candidateName ? '#999' : '#1976d2',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isUploading || !file || !candidateName ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    marginTop: '10px'
                  }}
                >
                  {isUploading ? 'Uploading to Database...' : 'Upload CV'}
                </button>

                {uploadStatus.message && (
                  <div style={{
                    padding: '10px',
                    borderRadius: '4px',
                    background: uploadStatus.type === 'success' ? '#e8f5e9' : '#ffebee',
                    color: uploadStatus.type === 'success' ? '#2e7d32' : '#c62828',
                    border: `1px solid ${uploadStatus.type === 'success' ? '#a5d6a7' : '#ef9a9a'}`
                  }}>
                    {uploadStatus.message}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW: SWIPE (NEW) */}
        {currentView === 'swipe' && (
          <div style={{ width: '100%', height: '100%' }}>
            <SwipeFeature userId={session.user.id} userEmail={session.user.email || ""} />
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

        {/* VIEW: COMPANIES DIRECTORY */}
        {currentView === 'companies' && (
          <div style={{ width: '100%', height: '100%' }}>
            <CompaniesDirectory />
          </div>
        )}
      </main>
    </div>
  );
}