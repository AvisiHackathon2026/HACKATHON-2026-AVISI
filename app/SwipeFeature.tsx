"use client";

import React, { useState, useEffect } from "react";
import TinderCard from "react-tinder-card";
import { supabase } from "@/lib/supabaseClient";

interface SwipeFeatureProps {
  userId: string;
  userEmail: string;
}

export default function SwipeFeature({ userId, userEmail }: SwipeFeatureProps) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Toggle for unemployed users to switch between profile editor and swiping
  const [activeTab, setActiveTab] = useState<"swipe" | "edit_profile">("swipe");

  // Candidate Profile Form State
  const [fullName, setFullName] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [expectedSalary, setExpectedSalary] = useState("");
  const [motivation, setMotivation] = useState("");
  const [profilePicUrl, setProfilePicUrl] = useState("");
  const [cvUrl, setCvUrl] = useState("");
  const [uploadingPic, setUploadingPic] = useState(false);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  // Swipe Cards Data
  const [jobCards, setJobCards] = useState<any[]>([]);
  const [candidateCards, setCandidateCards] = useState<any[]>([]);

  // Admin States
  const [companies, setCompanies] = useState<any[]>([]);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyDesc, setNewCompanyDesc] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [jobRate, setJobRate] = useState("");

  // Recruiter Company Selection
  const [recruiterCompanyId, setRecruiterCompanyId] = useState("");

  // Match Modal
  const [matchedItem, setMatchedItem] = useState<any>(null);

  const isAdminEmail = userEmail === "sietsekarsai@gmail.com";

  useEffect(() => {
    fetchProfileAndData();
  }, [userId, userEmail]);

  const fetchProfileAndData = async () => {
    setLoading(true);

    // Fetch existing profile
    let { data: userProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    // Force role to admin if logging in with the specific admin email
    const assignedRole = isAdminEmail ? "admin" : userProfile?.role || "unemployed";

    if (!userProfile) {
      const { data: newProfile } = await supabase
        .from("profiles")
        .insert({ id: userId, role: assignedRole })
        .select()
        .single();
      userProfile = newProfile;
    } else if (isAdminEmail && userProfile.role !== "admin") {
      await supabase.from("profiles").update({ role: "admin" }).eq("id", userId);
      userProfile.role = "admin";
    }

    setProfile(userProfile);

    // Populate profile form fields
    if (userProfile) {
      setFullName(userProfile.full_name || "");
      setHomeCity(userProfile.home_city || "");
      setExpectedSalary(userProfile.expected_salary || "");
      setMotivation(userProfile.motivation || "");
      setProfilePicUrl(userProfile.profile_picture_url || "");
      setCvUrl(userProfile.cv_url || "");
    }

    // Fetch companies list
    const { data: companyList } = await supabase.from("companies").select("*");
    if (companyList) setCompanies(companyList);

    if (assignedRole === "unemployed") {
      await loadJobsForUnemployed(userProfile.id);
    } else if (assignedRole === "recruiter") {
      await loadCandidatesForRecruiter(userProfile.id);
    }

    setLoading(false);
  };

  const loadJobsForUnemployed = async (currentUserId: string) => {
    const { data: existingSwipes } = await supabase
      .from("swipes")
      .select("target_id")
      .eq("swiper_id", currentUserId);

    const swipedJobIds = existingSwipes?.map((s) => s.target_id) || [];

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

    const { data: candidates } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "unemployed");

    if (candidates) {
      const unswiped = candidates.filter((c) => !swipedUserIds.includes(c.id));
      setCandidateCards(unswiped);
    }
  };

  // Role Switcher Handler (Blocked if user is admin email)
  const handleRoleChange = async (newRole: string) => {
    if (isAdminEmail) return;

    const updates: any = { role: newRole };
    if (newRole === "recruiter" && recruiterCompanyId) {
      updates.company_id = recruiterCompanyId;
    }

    await supabase.from("profiles").update(updates).eq("id", userId);
    fetchProfileAndData();
  };

  // File Upload Handler for Profile Picture & CV
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "picture" | "cv"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === "picture") setUploadingPic(true);
    if (type === "cv") setUploadingCv(true);

    const fileExt = file.name.split(".").pop();
    const filePath = `${userId}/${type}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("candidate_assets")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      alert(`Error uploading ${type}: ${uploadError.message}`);
    } else {
      const { data } = supabase.storage
        .from("candidate_assets")
        .getPublicUrl(filePath);

      if (type === "picture") setProfilePicUrl(data.publicUrl);
      if (type === "cv") setCvUrl(data.publicUrl);
    }

    if (type === "picture") setUploadingPic(false);
    if (type === "cv") setUploadingCv(false);
  };

  // Unemployed Profile Save Handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus("Saving...");

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        home_city: homeCity,
        expected_salary: expectedSalary,
        motivation: motivation,
        profile_picture_url: profilePicUrl,
        cv_url: cvUrl,
      })
      .eq("id", userId);

    if (error) {
      setSaveStatus(`Failed to save: ${error.message}`);
    } else {
      setSaveStatus("Profile updated successfully!");
      setTimeout(() => setSaveStatus(""), 3000);
      fetchProfileAndData();
    }
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
      alert("Company created!");
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
    alert("Job opening posted!");
  };

  // Swipe logic
  const handleSwipe = async (
    direction: string,
    targetId: string,
    cardData: any
  ) => {
    if (direction !== "left" && direction !== "right") return;

    await supabase.from("swipes").insert({
      swiper_id: userId,
      swiper_role: profile.role,
      target_id: targetId,
      direction: direction,
    });

    if (direction === "right") {
      if (profile.role === "unemployed") {
        const { data: recruiterSwipes } = await supabase
          .from("swipes")
          .select("swiper_id")
          .eq("target_id", userId)
          .eq("swiper_role", "recruiter")
          .eq("direction", "right");

        if (recruiterSwipes && recruiterSwipes.length > 0) {
          const recruiterIds = recruiterSwipes.map((s) => s.swiper_id);
          const { data: matchingRecruiters } = await supabase
            .from("profiles")
            .select("id")
            .in("id", recruiterIds)
            .eq("company_id", cardData.company_id);

          if (matchingRecruiters && matchingRecruiters.length > 0) {
            await supabase.from("matches").insert({
              unemployed_id: userId,
              recruiter_id: matchingRecruiters[0].id,
              job_id: cardData.id,
            });
            setMatchedItem(cardData);
          }
        }
      } else if (profile.role === "recruiter") {
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
    return (
      <div style={{ textAlign: "center", padding: "40px", fontFamily: "sans-serif" }}>
        Loading platform...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif", color: "#111" }}>
      <style>{`
        .absolute-card { position: absolute; width: 100%; }
      `}</style>
      
      {/* Role Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", padding: "12px", backgroundColor: "#f3f4f6", borderRadius: "8px" }}>
        <span style={{ fontWeight: "bold" }}>
          Role: {profile?.role?.toUpperCase()}
          {isAdminEmail && " (Permanent Admin)"}
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          {!isAdminEmail && (
            <>
              <button
                onClick={() => handleRoleChange("unemployed")}
                style={{ padding: "6px 12px", borderRadius: "4px", border: "none", cursor: "pointer", backgroundColor: profile?.role === "unemployed" ? "#3b82f6" : "#e5e7eb", color: profile?.role === "unemployed" ? "#fff" : "#000" }}
              >
                Unemployed
              </button>
              <button
                onClick={() => handleRoleChange("recruiter")}
                style={{ padding: "6px 12px", borderRadius: "4px", border: "none", cursor: "pointer", backgroundColor: profile?.role === "recruiter" ? "#3b82f6" : "#e5e7eb", color: profile?.role === "recruiter" ? "#fff" : "#000" }}
              >
                Recruiter
              </button>
            </>
          )}
          {isAdminEmail && (
            <span style={{ backgroundColor: "#10b981", color: "#fff", padding: "4px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "bold" }}>
              Admin Locked
            </span>
          )}
        </div>
      </div>

      {/* Recruiter Company Selection */}
      {profile?.role === "recruiter" && (
        <div style={{ marginBottom: "20px", padding: "12px", border: "1px solid #e5e7eb", borderRadius: "8px", backgroundColor: "#fff" }}>
          <label style={{ display: "block", marginBottom: "6px", fontWeight: "bold" }}>Assign Recruiter to Company:</label>
          <select
            value={profile.company_id || recruiterCompanyId}
            onChange={(e) => {
              setRecruiterCompanyId(e.target.value);
              handleRoleChange("recruiter");
            }}
            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", color: "#111", backgroundColor: "#fff" }}
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

      {/* UNEMPLOYED VIEW: Toggle between Profile Editor & Swipe Cards */}
      {profile?.role === "unemployed" && (
        <div>
          <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
            <button
              onClick={() => setActiveTab("swipe")}
              style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "none", cursor: "pointer", backgroundColor: activeTab === "swipe" ? "#111827" : "#e5e7eb", color: activeTab === "swipe" ? "#fff" : "#374151", fontWeight: "bold" }}
            >
              💼 Swipe Jobs
            </button>
            <button
              onClick={() => setActiveTab("edit_profile")}
              style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "none", cursor: "pointer", backgroundColor: activeTab === "edit_profile" ? "#111827" : "#e5e7eb", color: activeTab === "edit_profile" ? "#fff" : "#374151", fontWeight: "bold" }}
            >
              👤 Edit Applicant Profile
            </button>
          </div>

          {activeTab === "edit_profile" ? (
            <form onSubmit={handleSaveProfile} style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #e5e7eb", display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2 style={{ margin: 0 }}>Applicant Profile Setup</h2>

              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Full Name</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box", color: "#111", backgroundColor: "#fff" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Home City</label>
                <input
                  type="text"
                  placeholder="Amsterdam"
                  value={homeCity}
                  onChange={(e) => setHomeCity(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box", color: "#111", backgroundColor: "#fff" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Expected Salary / Hour</label>
                <input
                  type="text"
                  placeholder="€25 / hr"
                  value={expectedSalary}
                  onChange={(e) => setExpectedSalary(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box", color: "#111", backgroundColor: "#fff" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Motivation Statement</label>
                <textarea
                  placeholder="Explain why companies should hire you..."
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                  rows={4}
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box", color: "#111", backgroundColor: "#fff" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Profile Picture</label>
                {profilePicUrl && (
                  <img src={profilePicUrl} alt="Profile Preview" style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover", marginBottom: "8px" }} />
                )}
                <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, "picture")} disabled={uploadingPic} />
                {uploadingPic && <span style={{ fontSize: "12px", color: "#6b7280" }}> Uploading image...</span>}
              </div>

              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>CV Document (PDF / Doc)</label>
                {cvUrl && (
                  <a href={cvUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginBottom: "8px", color: "#2563eb", fontWeight: "bold", fontSize: "14px" }}>
                    📄 View Uploaded CV
                  </a>
                )}
                <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => handleFileUpload(e, "cv")} disabled={uploadingCv} />
                {uploadingCv && <span style={{ fontSize: "12px", color: "#6b7280" }}> Uploading CV...</span>}
              </div>

              <button
                type="submit"
                style={{ padding: "12px", backgroundColor: "#10b981", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
              >
                Save Profile
              </button>

              {saveStatus && <p style={{ textAlign: "center", color: saveStatus.includes("Failed") ? "#ef4444" : "#10b981", margin: 0 }}>{saveStatus}</p>}
            </form>
          ) : (
            <div style={{ textAlign: "center" }}>
              <h2>Available Job Openings</h2>
              <div style={{ position: "relative", width: "100%", height: "440px", marginTop: "20px" }}>
                {jobCards.length === 0 ? (
                  <div style={{ padding: "40px", backgroundColor: "#f9fafb", borderRadius: "12px", border: "1px dashed #ccc" }}>
                    No job cards available right now.
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
                          height: "380px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          textAlign: "left",
                          userSelect: "none",
                          cursor: "grab",
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
        </div>
      )}

      {/* RECRUITER VIEW: Candidate Cards */}
      {profile?.role === "recruiter" && (
        <div style={{ textAlign: "center" }}>
          <h2>Swipe Applicants</h2>
          <div style={{ position: "relative", width: "100%", height: "480px", marginTop: "20px" }}>
            {candidateCards.length === 0 ? (
              <div style={{ padding: "40px", backgroundColor: "#f9fafb", borderRadius: "12px", border: "1px dashed #ccc" }}>
                No candidate cards available to swipe right now.
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
                      padding: "20px",
                      boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
                      border: "1px solid #e5e7eb",
                      height: "420px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      textAlign: "left",
                      userSelect: "none",
                      cursor: "grab",
                    }}
                  >
                    <div>
                      {/* Header with Photo, Name & City */}
                      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "12px" }}>
                        <div
                          style={{
                            width: "64px",
                            height: "64px",
                            borderRadius: "50%",
                            backgroundColor: "#e5e7eb",
                            backgroundImage: candidate.profile_picture_url ? `url(${candidate.profile_picture_url})` : "none",
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            justify: "center",
                            fontSize: "24px",
                          }}
                        >
                          {!candidate.profile_picture_url && "👤"}
                        </div>
                        <div>
                          <h2 style={{ margin: 0, fontSize: "20px", color: "#111827" }}>
                            {candidate.full_name || "Unnamed Applicant"}
                          </h2>
                          <p style={{ margin: "2px 0 0 0", color: "#6b7280", fontSize: "14px" }}>
                            📍 {candidate.home_city || "Location unspecified"}
                          </p>
                        </div>
                      </div>

                      {/* Hourly Expectations */}
                      <div style={{ marginBottom: "10px" }}>
                        <span style={{ fontSize: "13px", fontWeight: "bold", color: "#374151" }}>Expected Salary: </span>
                        <span style={{ fontSize: "14px", color: "#059669", fontWeight: "bold" }}>
                          {candidate.expected_salary || "Negotiable"}
                        </span>
                      </div>

                      {/* Motivation */}
                      <div style={{ marginBottom: "12px" }}>
                        <span style={{ fontSize: "13px", fontWeight: "bold", color: "#374151", display: "block" }}>Motivation:</span>
                        <p style={{ margin: "4px 0", color: "#4b5563", fontSize: "13px", lineHeight: "1.4", maxHeight: "110px", overflow: "hidden" }}>
                          "{candidate.motivation || "No motivation statement provided."}"
                        </p>
                      </div>

                      {/* CV Link */}
                      {candidate.cv_url && (
                        <a
                          href={candidate.cv_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: "inline-block", color: "#2563eb", textDecoration: "underline", fontSize: "14px", fontWeight: "bold" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          📄 View Candidate CV Document
                        </a>
                      )}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", color: "#9ca3af", fontSize: "12px", borderTop: "1px solid #f3f4f6", paddingTop: "12px" }}>
                      <span>👈 Swipe Left to Pass</span>
                      <span>Swipe Right to Connect 👉</span>
                    </div>
                  </div>
                </TinderCard>
              ))
            )}
          </div>
        </div>
      )}

      {/* ADMIN PANEL VIEW */}
      {profile?.role === "admin" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <form onSubmit={handleCreateCompany} style={{ padding: "16px", border: "1px solid #e5e7eb", borderRadius: "8px", backgroundColor: "#fff" }}>
            <h3 style={{ marginTop: 0 }}>Admin: Add Company</h3>
            <input
              type="text"
              placeholder="Company Name"
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              style={{ width: "100%", padding: "8px", marginBottom: "10px", boxSizing: "border-box", color: "#111", backgroundColor: "#fff", border: "1px solid #ccc" }}
              required
            />
            <textarea
              placeholder="Company Description"
              value={newCompanyDesc}
              onChange={(e) => setNewCompanyDesc(e.target.value)}
              style={{ width: "100%", padding: "8px", marginBottom: "10px", boxSizing: "border-box", color: "#111", backgroundColor: "#fff", border: "1px solid #ccc" }}
            />
            <button type="submit" style={{ width: "100%", padding: "10px", backgroundColor: "#10b981", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
              Add Company
            </button>
          </form>

          <form onSubmit={handleCreateJob} style={{ padding: "16px", border: "1px solid #e5e7eb", borderRadius: "8px", backgroundColor: "#fff" }}>
            <h3 style={{ marginTop: 0 }}>Admin: Add Job Post</h3>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              style={{ width: "100%", padding: "8px", marginBottom: "10px", boxSizing: "border-box", color: "#111", backgroundColor: "#fff", border: "1px solid #ccc" }}
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
              placeholder="Job Title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              style={{ width: "100%", padding: "8px", marginBottom: "10px", boxSizing: "border-box", color: "#111", backgroundColor: "#fff", border: "1px solid #ccc" }}
              required
            />
            <input
              type="text"
              placeholder="Hourly Rate / Salary"
              value={jobRate}
              onChange={(e) => setJobRate(e.target.value)}
              style={{ width: "100%", padding: "8px", marginBottom: "10px", boxSizing: "border-box", color: "#111", backgroundColor: "#fff", border: "1px solid #ccc" }}
            />
            <textarea
              placeholder="Job Description"
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
              style={{ width: "100%", padding: "8px", marginBottom: "10px", boxSizing: "border-box", color: "#111", backgroundColor: "#fff", border: "1px solid #ccc" }}
            />
            <button type="submit" style={{ width: "100%", padding: "10px", backgroundColor: "#10b981", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
              Add Job Opening
            </button>
          </form>
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
            }}
          >
            <h1 style={{ color: "#10b981", fontSize: "36px", margin: "0 0 8px 0" }}>It's a Match! 🎉</h1>
            <p style={{ fontSize: "16px", color: "#374151", margin: "0 0 24px 0" }}>
              {profile.role === "unemployed"
                ? `You and ${matchedItem.companies?.name || "the company"} matched on the ${matchedItem.title} position!`
                : `You and candidate ${matchedItem.full_name || "this applicant"} matched!`}
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
