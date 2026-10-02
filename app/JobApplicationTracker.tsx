"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface JobApplication {
  id: string;
  company_name: string;
  role_title: string;
  status: 'Submitted' | 'Under Review' | 'Interviewing' | 'Offer' | 'Rejected';
  created_at: string;
  notes?: string;
}

export default function JobApplicationTracker({ userId }: { userId: string }) {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApplications();
  }, [userId]);

  const fetchApplications = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("job_applications")
      .select("*")
      .eq("applicant_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching applications:", error);
    } else {
      setApplications(data || []);
    }
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Submitted': return '#3b82f6';
      case 'Under Review': return '#f59e0b';
      case 'Interviewing': return '#8b5cf6';
      case 'Offer': return '#10b981';
      case 'Rejected': return '#ef4444';
      default: return '#6b7280';
    }
  };

  if (loading) return <p style={{ color: 'var(--text-color)' }}>Loading applications...</p>;

  return (
    <div style={{ padding: '1.5rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-color)' }}>
      <h2 className="text-gradient" style={{ marginTop: 0, marginBottom: '1rem' }}>My Job Applications</h2>
      {applications.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No job applications submitted yet. Use the chat feature to apply!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {applications.map((app) => (
            <div key={app.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--glass-input-bg)', border: '1px solid var(--glass-light)', borderRadius: '6px' }}>
              <div>
                <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-color)' }}>{app.role_title}</h4>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>{app.company_name}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold', background: getStatusColor(app.status), color: '#fff' }}>
                  {app.status}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {new Date(app.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
