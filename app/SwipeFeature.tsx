"use client";

import React, { useState, useEffect } from "react";
import TinderCard from "react-tinder-card";
import { supabase } from "@/lib/supabaseClient";

interface SwipeFeatureProps {
  userId: string;
}

export default function SwipeFeature({ userId }: SwipeFeatureProps) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Cards data
  const [jobCards, setJobCards] = useState<any[]>([]);
  const [candidateCards, setCandidateCards] = useState<any[]>([]);

  // Admin states
  const [companies, setCompanies] = useState<any[]>([]);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyDesc, setNewCompanyDesc] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [jobRate, setJobRate] = useState("");

  // Recruiter assignment state
  const [recruiterCompanyId, setRecruiterCompanyId] = useState("");

  // Match alert modal state
  const [matchedItem, setMatchedItem] = useState<any>(null);

  useEffect(() => {
    fetchProfileAndData();
  }, [userId]);

  const fetchProfileAndData = async () => {
    setLoading(true);

    // Fetch or create profile
    let { data: userProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (!userProfile) {
      const { data: newProfile } = await supabase
        .from("profiles")
        .insert({ id: userId, role: "unemployed" })
        .select()
        .single();
      userProfile = newProfile;
    }

    setProfile(userProfile);

    // Fetch existing companies
    const { data: companyList } = await supabase.from("companies").select("*");
    if (companyList) setCompanies(companyList);

    if (userProfile?.role === "unemployed") {
      await loadJobsForUnemployed(userProfile.id);
    } else if (userProfile?.role === "recruiter") {
      await loadCandidatesForRecruiter(userProfile.id);
    }

    setLoading(false);
  };

  const loadJobsForUnemployed = async (currentUserId: string) => {
    // Get list of target_ids already swiped by this user
    const { data: existingSwipes } = await supabase
      .from("swipes")
      .select("target_id")
      .eq("swiper_id", currentUserId);

    const swipedJobIds = existingSwipes?.map((s) => s.target_id) || [];

    // Fetch jobs along with company name
    const { data: jobs } = await supabase
      .from("jobs")
      .select("*, companies(name)");

    if (jobs) {
      const unswipedJobs = jobs.filter((j) => !swipedJobIds.includes(j.id));
      setJobCards(unswipedJobs);
    }
  };

  const loadCandidatesForRecruiter = async (currentUserId: string) => {
    const { data: existingSwipes } = await supabase
      .from("swipes")
      .select("target_id")
      .eq("swiper_id", currentUserId);

    const swipedUserIds = existingSwipes?.map((s) => s.target_id) || [];

    // Fetch unemployed candidates
    const { data: candidates } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "unemployed");

    if (candidates) {
      const unswiped = candidates.filter((c) => !swipedUserIds.includes(c.id));
      setCandidateCards(unswiped);
    }
  };

  // Role Switcher Handler
  const handleRoleChange = async (newRole: string) => {
    const updates: any = { role: newRole };
    if (newRole === "recruiter" && recruiterCompanyId) {
      updates.company_id = recruiterCompanyId;
    }
    await supabase.from("profiles").update(updates).eq("id", userId);
    fetchProfileAndData();
  };

  // Admin: Create Company
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName) return;
    const { data } = await supabase
      .from("companies")
      .insert({ name: newCompanyName, description: newCompanyDesc })
      .select()
      .single();

    if (data) {
      setCompanies([...companies, data]);
      setNewCompanyName("");
      setNewCompanyDesc("");
      alert("Company created successfully!");
    }
  };

  // Admin: Create Job
  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId || !jobTitle) return;

    await supabase.from("jobs").insert({
      company_id: selectedCompanyId,
      title: jobTitle,
      description: jobDesc,
      hourly_rate: jobRate,
    });

    setJobTitle("");
    setJobDesc("");
    setJobRate("");
    alert("Job created successfully!");
  };

  // Handle Swipe logic
  const handleSwipe = async (
    direction: string,
    targetId: string,
    cardData: any
  ) => {
    if (direction !== "left" && direction !== "right") return;

    // Record swipe in Supabase
    await supabase.from("swipes").insert({
      swiper_id: userId,
      swiper_role: profile.role,
      target_id: targetId,
      direction: direction,
    });

    // Match Check
    if (direction === "right") {
      if (profile.role === "unemployed") {
        // Target is a job (cardData = job)
        // Check if any recruiter of this job's company swiped right on this unemployed candidate
        const { data: recruiterSwipes } = await supabase
          .from("swipes")
          .select("swiper_id")
          .eq("target_id", userId)
          .eq("swiper_role", "recruiter")
          .eq("direction", "right");

        if (recruiterSwipes && recruiterSwipes.length > 0) {
          // Verify if recruiter belongs to cardData.company_id
          const recruiterIds = recruiterSwipes.map((s) => s.swiper_id);
          const { data: matchingRecruiters } = await supabase
            .from("profiles")
            .select("id")
            .in("id", recruiterIds)
            .eq("company_id", cardData.company_id);

          if (matchingRecruiters && matchingRecruiters.length > 0) {
            // MATCH FOUND!
            await supabase.from("matches").insert({
              unemployed_id: userId,
              recruiter_id: matchingRecruiters[0].id,
              job_id: cardData.id,
            });
            setMatchedItem(cardData);
          }
        }
      } else if (profile.role === "recruiter") {
        // Target is an unemployed profile (cardData = profile)
        // Check if candidate swiped right on any job from recruiter's company
        if (!profile.company_id) return;

        const { data: companyJobs } = await supabase
          .from("jobs")
          .select("id")
          .eq("company_id", profile.company_id);

        const companyJobIds = companyJobs?.map((j) => j.id) || [];

        if (companyJobIds.length > 0) {
          const { data: candidateSwipes } = await supabase
            .from("swipes")
            .select("target_id")
            .eq("swiper_id", targetId)
            .eq("swiper_role", "unemployed")
            .eq("direction", "right")
            .in("target_id", companyJobIds);

          if (candidateSwipes && candidateSwipes.length > 0) {
            // MATCH FOUND!
            await supabase.from("matches").insert({
              unemployed_id: targetId,
              recruiter_id: userId,
              job_id: candidateSwipes[0].target_id,
            });
            setMatchedItem(cardData);
          }
        }
      }
    }
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: "40px", fontFamily: "sans-serif" }}>Loading swipe engine...</div>;
  }

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif", color: "#111" }}>
      <style>{`
        .absolute-card { position: absolute; width: 100%; }
      `}</style>
      {/* Role Switcher Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", padding: "10px", backgroundColor: "#f3f4f6", borderRadius: "8px" }}>
        <span style={{ fontWeight: "bold" }}>Role: {profile?.role?.toUpperCase()}</span>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => handleRoleChange("unemployed")}
            style={{ padding: "6px 12px", borderRadius: "4px", border: "none", cursor: "pointer", backgroundColor: profile?.role === "unemployed" ? "#3b82f6" : "#e5e7eb", color: profile?.role === "unemployed" ? "#fff" : "#000" }}
          >
            Unemployed
          </button>
          <button
            onClick={() => handleRoleChange("recruiter")}
            style={{ padding: "6px 12px", borderRadius: "4px", border: "none", cursor: "pointer", backgroundColor: profile?.role === "recruiter" ? "#3b82f6" : "#e5e7eb", color: profile?.role === "recruiter" ? "#fff" : "#000" }}>
            Recruiter
          </button>
          <button
            onClick={() => handleRoleChange("admin")}
            style={{ padding: "6px 12px", borderRadius: "4px", border: "none", cursor: "pointer", backgroundColor: profile?.role === "admin" ? "#3b82f6" : "#e5e7eb", color: profile?.role === "admin" ? "#fff" : "#000" }}
          >
            Admin
          </button>
        </div>
      </div>

      {/* Recruiter Company Selection */}
      {profile?.role === "recruiter" && (
        <div style={{ marginBottom: "20px", padding: "12px", border: "1px solid #e5e7eb", borderRadius: "8px", backgroundColor: "#fff" }}>
          <label style={{ display: "block", marginBottom: "6px", fontWeight: "bold" }}>Select Your Company:</label>
          <select
            value={profile.company_id || recruiterCompanyId}
            onChange={(e) => {
              setRecruiterCompanyId(e.target.value);
              handleRoleChange("recruiter");
            }}
            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", background: "#fff", color: "#000" }}
          >
            <option value="">-- Choose Company --</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ADMIN PANEL VIEW */}
      {profile?.role === "admin" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Create Company Form */}
          <form onSubmit={handleCreateCompany} style={{ padding: "16px", border: "1px solid #e5e7eb", borderRadius: "8px", backgroundColor: "#fff" }}>
            <h3 style={{ marginTop: 0 }}>Admin: Add Company</h3>
            <input
              type="text"
              placeholder="Company Name"
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              style={{ width: "100%", padding: "8px", marginBottom: "10px", boxSizing: "border-box", background: "#fff", color: "#000", border: "1px solid #ccc" }}
              required
            />
            <textarea
              placeholder="Company Description"
              value={newCompanyDesc}
              onChange={(e) => setNewCompanyDesc(e.target.value)}
              style={{ width: "100%", padding: "8px", marginBottom: "10px", boxSizing: "border-box", background: "#fff", color: "#000", border: "1px solid #ccc" }}
            />
            <button type="submit" style={{ width: "100%", padding: "10px", backgroundColor: "#10b981", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
              Add Company
            </button>
          </form>

          {/* Create Job Form */}
          <form onSubmit={handleCreateJob} style={{ padding: "16px", border: "1px solid #e5e7eb", borderRadius: "8px", backgroundColor: "#fff" }}>
            <h3 style={{ marginTop: 0 }}>Admin: Add Job Post</h3>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              style={{ width: "100%", padding: "8px", marginBottom: "10px", boxSizing: "border-box", background: "#fff", color: "#000", border: "1px solid #ccc" }}
              required
            >
              <option value="">-- Select Company --</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Job Title (e.g. Senior Frontend Dev)"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              style={{ width: "100%", padding: "8px", marginBottom: "10px", boxSizing: "border-box", background: "#fff", color: "#000", border: "1px solid #ccc" }}
              required
            />
            <input
              type="text"
              placeholder="Hourly Rate / Salary (e.g. $45/hr)"
              value={jobRate}
              onChange={(e) => setJobRate(e.target.value)}
              style={{ width: "100%", padding: "8px", marginBottom: "10px", boxSizing: "border-box", background: "#fff", color: "#000", border: "1px solid #ccc" }}
            />
            <textarea
              placeholder="Job Description"
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
              style={{ width: "100%", padding: "8px", marginBottom: "10px", boxSizing: "border-box", background: "#fff", color: "#000", border: "1px solid #ccc" }}
            />
            <button type="submit" style={{ width: "100%", padding: "10px", backgroundColor: "#10b981", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
              Add Job Opening
            </button>
          </form>
        </div>
      )}

      {/* SWIPE DECK FOR UNEMPLOYED */}
      {profile?.role === "unemployed" && (
        <div style={{ textAlign: "center" }}>
          <h2 style={{ color: "#fff" }}>Find Your Next Job</h2>
          <div style={{ position: "relative", width: "100%", height: "420px", marginTop: "20px" }}>
            {jobCards.length === 0 ? (
              <div style={{ padding: "40px", backgroundColor: "#f9fafb", borderRadius: "12px", border: "1px dashed #ccc" }}>
                No more companies or jobs to swipe! Check back later.
              </div>
            ) : (
              jobCards.map((job) => (
                <TinderCard
                  key={job.id}
                  onSwipe={(dir) => handleSwipe(dir, job.id, job)}
                  preventSwipe={["up", "down"]}
                  className="absolute-card"
                >
                  <div
                    style={{
                      backgroundColor: "#ffffff",
                      borderRadius: "16px",
                      padding: "24px",
                      boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
                      border: "1px solid #e5e7eb",
                      height: "360px",
                      display: "flex",
                      flexDirection: "column",
                      justify: "space-between",
                      textAlign: "left",
                      userSelect: "none",
                      cursor: "grab",
                      color: "#111"
                    }}
                  >
                    <div>
                      <span style={{ fontSize: "12px", fontWeight: "bold", textTransform: "uppercase", color: "#6b7280", letterSpacing: "1px" }}>
                        {job.companies?.name || "Company"}
                      </span>
                      <h2 style={{ margin: "8px 0", fontSize: "24px", color: "#111827" }}>{job.title}</h2>
                      <p style={{ fontSize: "18px", color: "#059669", fontWeight: "bold", margin: "4px 0 16px 0" }}>
                        {job.hourly_rate ? job.hourly_rate : "Rate Negotiable"}
                      </p>
                      <p style={{ color: "#4b5563", fontSize: "14px", lineHeight: "1.5", maxHeight: "150px", overflow: "hidden" }}>
                        {job.description || "No description provided."}
                      </p>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#9ca3af", fontSize: "12px", borderTop: "1px solid #f3f4f6", paddingTop: "12px" }}>
                      <span>👈 Swipe Left to Skip</span>
                      <span>Swipe Right to Apply 👉</span>
                    </div>
                  </div>
                </TinderCard>
              ))
            )}
          </div>
        </div>
      )}

      {/* SWIPE DECK FOR RECRUITERS */}
      {profile?.role === "recruiter" && (
        <div style={{ textAlign: "center" }}>
          <h2 style={{ color: "#fff" }}>Find Candidates</h2>
          <div style={{ position: "relative", width: "100%", height: "420px", marginTop: "20px" }}>
            {candidateCards.length === 0 ? (
              <div style={{ padding: "40px", backgroundColor: "#f9fafb", borderRadius: "12px", border: "1px dashed #ccc" }}>
                No more candidates to swipe! Check back later.
              </div>
            ) : (
              candidateCards.map((candidate) => (
                <TinderCard
                  key={candidate.id}
                  onSwipe={(dir) => handleSwipe(dir, candidate.id, candidate)}
                  preventSwipe={["up", "down"]}
                  className="absolute-card"
                >
                  <div
                    style={{
                      backgroundColor: "#ffffff",
                      borderRadius: "16px",
                      padding: "24px",
                      boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
                      border: "1px solid #e5e7eb",
                      height: "360px",
                      display: "flex",
                      flexDirection: "column",
                      justify: "space-between",
                      textAlign: "left",
                      userSelect: "none",
                      cursor: "grab",
                      color: "#111"
                    }}
                  >
                    <div>
                      <h2 style={{ margin: "0 0 12px 0", fontSize: "24px", color: "#111827" }}>
                        {candidate.full_name || "Anonymous Candidate"}
                      </h2>
                      <div style={{ marginBottom: "12px" }}>
                        <strong style={{ fontSize: "14px", color: "#374151" }}>Skills: </strong>
                        <p style={{ margin: "4px 0", color: "#4b5563", fontSize: "14px" }}>
                          {candidate.skills || "Skills not listed yet"}
                        </p>
                      </div>
                      <div style={{ marginBottom: "12px" }}>
                        <strong style={{ fontSize: "14px", color: "#374151" }}>Desired Hours: </strong>
                        <span style={{ fontSize: "14px", color: "#4b5563" }}>
                          {candidate.desired_hours ? `${candidate.desired_hours} hrs/week` : "Not specified"}
                        </span>
                      </div>
                      {candidate.cv_url && (
                        <a
                          href={candidate.cv_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: "inline-block", marginTop: "8px", color: "#2563eb", textDecoration: "underline", fontSize: "14px", fontWeight: "bold" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          📄 View Candidate CV / Resume
                        </a>
                      )}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#9ca3af", fontSize: "12px", borderTop: "1px solid #f3f4f6", paddingTop: "12px" }}>
                      <span>👈 Swipe Left to Pass</span>
                      <span>Swipe Right to Hire 👉</span>
                    </div>
                  </div>
                </TinderCard>
              ))
            )}
          </div>
        </div>
      )}

      {/* MATCH POPUP MODAL */}
      {matchedItem && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.75)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              padding: "32px",
              borderRadius: "16px",
              textAlign: "center",
              maxWidth: "400px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              color: "#111"
            }}
          >
            <h1 style={{ color: "#10b981", fontSize: "36px", margin: "0 0 8px 0" }}>It's a Match! 🎉</h1>
            <p style={{ fontSize: "16px", color: "#374151", margin: "0 0 24px 0" }}>
              {profile.role === "unemployed"
                ? `You and ${matchedItem.companies?.name || "the company"} are mutually interested in the ${matchedItem.title} position!`
                : `You and ${matchedItem.full_name || "this candidate"} matched!`}
            </p>
            <button
              onClick={() => setMatchedItem(null)}
              style={{
                backgroundColor: "#10b981",
                color: "#fff",
                padding: "12px 24px",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Keep Swiping
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
