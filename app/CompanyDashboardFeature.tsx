"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CompanyDashboardFeature({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [jobTitle, setJobTitle] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [jobRate, setJobRate] = useState("");
  const [recommendedCandidates, setRecommendedCandidates] = useState<Record<string, any[]>>({});

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    // 1. Get recruiter profile
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (!userProfile || !userProfile.company_id) return;
    setProfile(userProfile);

    // 2. Fetch jobs for this company
    const { data: companyJobs } = await supabase
      .from("jobs")
      .select("*")
      .eq("company_id", userProfile.company_id);

    if (companyJobs) {
      setJobs(companyJobs);
      // 3. Fetch recommendations for each job
      const recs: Record<string, any[]> = {};
      const { data: candidates } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "unemployed");

      if (candidates) {
        for (const job of companyJobs) {
          // Simple recommendation algorithm: candidates expecting less than or equal to the job rate
          let matched = candidates;
          if (job.hourly_rate) {
            matched = candidates.filter(c => !c.expected_salary || Number(c.expected_salary) <= Number(job.hourly_rate));
          }
          // Sort by whoever has a CV uploaded first
          matched = matched.sort((a, b) => (a.cv_url ? -1 : 1));
          recs[job.id] = matched.slice(0, 3); // Top 3
        }
      }
      setRecommendedCandidates(recs);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.company_id) return;

    const { error } = await supabase.from("jobs").insert({
      title: jobTitle,
      description: jobDesc,
      company_id: profile.company_id,
      hourly_rate: jobRate ? Number(jobRate) : null
    });

    if (error) {
      alert("Error creating job: " + error.message);
    } else {
      setJobTitle("");
      setJobDesc("");
      setJobRate("");
      alert("Job posted successfully!");
      fetchData();
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!window.confirm("Are you sure you want to delete this job?")) return;
    await supabase.from("jobs").delete().eq("id", jobId);
    fetchData();
  };

  if (!profile?.company_id) {
    return <div style={{ padding: "20px" }}>You are not assigned to a company yet.</div>;
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "20px" }}>
      <h1 style={{ marginBottom: "5px" }}>🏢 Company Dashboard</h1>
      <p style={{ color: "#666", marginBottom: "30px" }}>Manage your job listings and view top candidate recommendations.</p>

      <div style={{ display: "flex", gap: "30px", alignItems: "flex-start", flexWrap: "wrap" }}>
        
        {/* LEFT COLUMN: ACTIVE JOBS */}
        <div style={{ flex: 2, minWidth: "400px" }}>
          <h2>Your Active Job Listings</h2>
          {jobs.length === 0 ? (
            <div style={{ padding: "20px", backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
              No active jobs. Post one below!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {jobs.map((job) => (
                <div key={job.id} style={{ padding: "20px", border: "1px solid #e5e7eb", borderRadius: "12px", backgroundColor: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "15px" }}>
                    <div>
                      <h3 style={{ margin: "0 0 5px 0", color: "#111827", fontSize: "20px" }}>{job.title}</h3>
                      <span style={{ color: "#059669", fontWeight: "bold", backgroundColor: "#d1fae5", padding: "4px 8px", borderRadius: "4px", fontSize: "14px" }}>
                        €{job.hourly_rate || "N/A"}/hr Budget
                      </span>
                    </div>
                    <button onClick={() => handleDeleteJob(job.id)} style={{ padding: "6px 12px", backgroundColor: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
                      Delete Job
                    </button>
                  </div>
                  <p style={{ color: "#4b5563", fontSize: "15px", lineHeight: "1.5" }}>{job.description}</p>
                  
                  {/* ALGORITHMIC RECOMMENDATIONS */}
                  <div style={{ marginTop: "20px", borderTop: "1px solid #f3f4f6", paddingTop: "15px" }}>
                    <h4 style={{ margin: "0 0 10px 0", color: "#374151" }}>✨ Top Recommended Candidates</h4>
                    {(!recommendedCandidates[job.id] || recommendedCandidates[job.id].length === 0) ? (
                      <p style={{ fontSize: "13px", color: "#9ca3af" }}>No immediate matches found in the pool.</p>
                    ) : (
                      <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "10px" }}>
                        {recommendedCandidates[job.id].map(candidate => (
                          <div key={candidate.id} style={{ minWidth: "200px", padding: "12px", backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
                            <div style={{ fontWeight: "bold", color: "#111827" }}>{candidate.full_name || "Anonymous"}</div>
                            <div style={{ fontSize: "12px", color: "#6b7280", margin: "4px 0" }}>Expected: €{candidate.expected_salary || "N/A"}/hr</div>
                            <div style={{ fontSize: "12px", color: "#3b82f6", fontWeight: "bold" }}>{candidate.skills ? candidate.skills.substring(0, 30) + '...' : 'No skills listed'}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: POST NEW JOB */}
        <div style={{ flex: 1, minWidth: "300px" }}>
          <form onSubmit={handleCreateJob} style={{ backgroundColor: "#f8fafc", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "16px", position: "sticky", top: "20px" }}>
            <h2 style={{ margin: 0, color: "#1e293b" }}>➕ Post New Job</h2>
            
            <div>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px", color: "#334155" }}>Job Title</label>
              <input type="text" placeholder="e.g. Senior React Developer" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box", color: "#0f172a" }} required />
            </div>

            <div>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px", color: "#334155" }}>Hourly Budget (€)</label>
              <input type="number" max="999" placeholder="e.g. 50" value={jobRate} onChange={(e) => setJobRate(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box", color: "#0f172a" }} />
            </div>

            <div>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px", color: "#334155" }}>Job Description</label>
              <textarea placeholder="Describe the role and requirements..." value={jobDesc} onChange={(e) => setJobDesc(e.target.value)} rows={5} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box", color: "#0f172a" }} required />
            </div>

            <button type="submit" style={{ padding: "12px", backgroundColor: "#10b981", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "16px", boxShadow: "0 4px 6px rgba(16, 185, 129, 0.2)" }}>
              Post Job Opening
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
