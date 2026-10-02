"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface JobApplication {
  id: string;
  applicant_id: string;
  company_name: string;
  role_title: string;
  status: 'Submitted' | 'Under Review' | 'Interviewing' | 'Offer' | 'Rejected';
  created_at: string;
  notes?: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

export default function JobApplicationsManagement() {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    // Join with profiles to get applicant names
    const { data, error } = await supabase
      .from("job_applications")
      .select(`
        *,
        profiles:applicant_id (
          full_name,
          email
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching applications:", error);
    } else {
      setApplications(data || []);
    }
    setLoading(false);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from("job_applications")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) {
      alert("Failed to update status.");
    } else {
      setApplications(apps => apps.map(app => app.id === id ? { ...app, status: newStatus as any } : app));
    }
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

  if (loading) return <p style={{ color: 'var(--text-color)', padding: '20px' }}>Loading applications...</p>;

  return (
    <div style={{ padding: '20px', color: 'var(--text-color)', maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Manage Job Applications</h2>
      {applications.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No job applications found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {applications.map((app) => (
            <div key={app.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
              <div>
                <h3 style={{ margin: '0 0 5px 0' }}>{app.role_title}</h3>
                <p style={{ margin: '0 0 5px 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Company: <strong>{app.company_name}</strong>
                </p>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                  Applicant: <strong>{app.profiles?.full_name || 'Unknown'}</strong> ({app.profiles?.email || 'N/A'})
                </p>
                {app.notes && (
                  <p style={{ margin: '10px 0 0 0', fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                    "{app.notes}"
                  </p>
                )}
                <p style={{ margin: '5px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Submitted: {new Date(app.created_at).toLocaleDateString()}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                <span style={{ padding: '6px 12px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold', background: getStatusColor(app.status), color: '#fff' }}>
                  {app.status}
                </span>
                <select 
                  value={app.status}
                  onChange={(e) => handleStatusChange(app.id, e.target.value)}
                  style={{ padding: '6px', borderRadius: '4px', background: 'var(--glass-input-bg)', color: 'var(--text-color)', border: '1px solid var(--glass-border)', cursor: 'pointer' }}
                >
                  <option value="Submitted">Submitted</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Interviewing">Interviewing</option>
                  <option value="Offer">Offer</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
