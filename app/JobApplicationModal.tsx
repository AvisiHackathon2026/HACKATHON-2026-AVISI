"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface JobApplicationModalProps {
  userId: string;
  defaultCompany?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function JobApplicationModal({ userId, defaultCompany = "", onClose, onSuccess }: JobApplicationModalProps) {
  const [companyName, setCompanyName] = useState(defaultCompany);
  const [roleTitle, setRoleTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !roleTitle) {
      alert("Please enter both company name and role title.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("job_applications").insert([
      {
        applicant_id: userId,
        company_name: companyName,
        role_title: roleTitle,
        status: 'Submitted',
        notes: notes,
      },
    ]);

    setSubmitting(false);

    if (error) {
      alert("Failed to submit application: " + error.message);
    } else {
      alert("Job application submitted successfully!");
      onSuccess();
      onClose();
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--bg-color)', border: '1px solid var(--glass-border)', padding: '2rem', borderRadius: '12px', width: '400px', color: 'var(--text-color)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
        <h3 className="text-gradient" style={{ marginTop: 0, marginBottom: '20px' }}>Fill in Job Application</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', fontWeight: 'bold' }}>
            Company Name:
            <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} required className="vanguard-search" style={{ padding: '10px', borderRadius: '6px' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', fontWeight: 'bold' }}>
            Role Title:
            <input type="text" placeholder="e.g. Frontend Developer" value={roleTitle} onChange={e => setRoleTitle(e.target.value)} required className="vanguard-search" style={{ padding: '10px', borderRadius: '6px' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', fontWeight: 'bold' }}>
            Notes / Details:
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="vanguard-search" style={{ padding: '10px', borderRadius: '6px', resize: 'vertical' }} />
          </label>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button type="submit" disabled={submitting} className="primary-button" style={{ flex: 1, padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
            <button type="button" onClick={onClose} className="glass-button" style={{ flex: 1, padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
