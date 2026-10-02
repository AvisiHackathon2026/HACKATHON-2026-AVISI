"use client";

import React, { useState, useEffect } from "react";
import TinderCard from "react-tinder-card";
import { supabase } from "@/lib/supabaseClient";

interface SwipeFeatureProps {
  userId: string;
  userEmail: string;
  defaultTab?: "swipe" | "edit_profile";
  hideTabs?: boolean;
}

export default function SwipeFeature({ userId, userEmail, defaultTab = "swipe", hideTabs = false }: SwipeFeatureProps) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Toggle for unemployed users to switch between profile editor and swiping
  const [activeTab, setActiveTab] = useState<"swipe" | "edit_profile">(defaultTab);

  // Candidate Profile Form State
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [expectedSalary, setExpectedSalary] = useState("");
  const [motivation, setMotivation] = useState("");
  const [profilePicUrl, setProfilePicUrl] = useState("");
  const [cvUrl, setCvUrl] = useState("");
  const [skills, setSkills] = useState("");
  const [education, setEducation] = useState("");
  const [experience, setExperience] = useState("");
  const [uploadingPic, setUploadingPic] = useState(false);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  
  // Recruiter Swipe Filter State
  const [filterCity, setFilterCity] = useState("");
  
  // Recruiter specific state
  const [recruiterJobs, setRecruiterJobs] = useState<any[]>([]);
  const [selectedJobContext, setSelectedJobContext] = useState<any>(null);

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
  
  // Admin User Management State
  const [searchQuery, setSearchQuery] = useState("");
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allJobs, setAllJobs] = useState<any[]>([]);

  // Admin Edit Override State
  const [adminEditUser, setAdminEditUser] = useState<any>(null);
  const [adminEditUsername, setAdminEditUsername] = useState("");
  const [adminEditFullName, setAdminEditFullName] = useState("");

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
      setUsername(userProfile.username || "");
      setFullName(userProfile.full_name || "");
      setHomeCity(userProfile.home_city || "");
      setExpectedSalary(userProfile.expected_salary || "");
      setMotivation(userProfile.motivation || "");
      setProfilePicUrl(userProfile.profile_picture_url || "");
      setCvUrl(userProfile.cv_url || "");
      setSkills(userProfile.skills || "");
      setEducation(userProfile.education || "");
      setExperience(userProfile.experience || "");
    }

    // Fetch companies list (used by both Admin and Recruiter systems)
    const { data: companyList } = await supabase.from("companies").select("*");
    if (companyList) setCompanies(companyList);

    // Load data based on role
    if (assignedRole === "unemployed") {
      await loadJobsForUnemployed(userProfile.id);
    } else if (assignedRole === "recruiter") {
      if (userProfile.company_id) {
        const { data: jobs } = await supabase.from("jobs").select("*").eq("company_id", userProfile.company_id);
        if (jobs) setRecruiterJobs(jobs);
      }
    } else if (assignedRole === "admin") {
      // Admin superpower: Fetch all users (except themselves) to manage them
      const { data: usersList } = await supabase.from("profiles").select("*").neq("id", userProfile.id);
      if (usersList) setAllUsers(usersList);

      const { data: jobsList } = await supabase.from("jobs").select("*, companies(name)");
      if (jobsList) setAllJobs(jobsList);
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
      let unswipedJobs = jobs.filter((j) => !swipedJobIds.includes(j.id));
      
      // ALGORITHM: Rank jobs based on expected salary match
      const userExpected = Number(profile?.expected_salary) || 0;
      
      unswipedJobs = unswipedJobs.sort((a, b) => {
        const rateA = Number(a.hourly_rate) || 0;
        const rateB = Number(b.hourly_rate) || 0;
        
        // Give higher priority (negative sort value) to jobs that pay AT LEAST what the user wants
        const aMeetsExpectation = rateA >= userExpected ? -1 : 1;
        const bMeetsExpectation = rateB >= userExpected ? -1 : 1;

        if (aMeetsExpectation !== bMeetsExpectation) {
          return aMeetsExpectation - bMeetsExpectation;
        }
        
        // If both meet or both fail, sort by highest paying first
        return rateB - rateA;
      });

      setJobCards(unswipedJobs);
    }
  };

  const loadCandidatesForRecruiter = async (currentUserId: string, jobId: string) => {
    const { data: existingSwipes } = await supabase
      .from("swipes")
      .select("target_id")
      .eq("swiper_id", currentUserId)
      .eq("job_context_id", jobId);

    const swipedUserIds = existingSwipes?.map((s) => s.target_id) || [];

    const { data: candidates } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "unemployed");

    if (candidates) {
      let unswiped = candidates.filter((c) => !swipedUserIds.includes(c.id));
      
      // ALGORITHM: Rank candidates for recruiters
      unswiped = unswiped.sort((a, b) => {
        // Priority 1: Did they upload a CV? (We want serious candidates first)
        const aHasCv = a.cv_url ? -1 : 1;
        const bHasCv = b.cv_url ? -1 : 1;
        if (aHasCv !== bHasCv) return aHasCv - bHasCv;

        // Priority 2: Sort by Expected Salary (Ascending - cheaper candidates first)
        const rateA = Number(a.expected_salary) || 999;
        const rateB = Number(b.expected_salary) || 999;
        return rateA - rateB;
      });

      setCandidateCards(unswiped);
    }
  };

  // Admin Action: Promote User to Recruiter
  const handlePromoteToRecruiter = async (userIdToPromote: string, companyId: string) => {
    const confirm = window.confirm("Are you sure you want to promote this user to a Recruiter?");
    if (!confirm) return;

    await supabase.from("profiles").update({ role: "recruiter", company_id: companyId }).eq("id", userIdToPromote);
    alert("User successfully promoted to Recruiter!");
    fetchProfileAndData(); // Refresh the list
  };

  // Admin Action: Demote User to Unemployed
  const handleDemoteToUnemployed = async (userIdToDemote: string) => {
    const confirm = window.confirm("Are you sure you want to demote this Recruiter back to Unemployed?");
    if (!confirm) return;

    await supabase.from("profiles").update({ role: "unemployed", company_id: null }).eq("id", userIdToDemote);
    alert("User successfully demoted!");
    fetchProfileAndData(); // Refresh the list
  };

  // Admin Action: Override Username / Full Name
  const handleAdminSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEditUser) return;

    const { error } = await supabase.from("profiles").update({
      username: adminEditUsername,
      full_name: adminEditFullName
    }).eq("id", adminEditUser.id);

    if (error) {
      if (error.message.includes("unique")) {
        alert("Error: That username is already taken by someone else.");
      } else {
        alert(`Error: ${error.message}`);
      }
    } else {
      alert("User details force-updated successfully!");
      setAdminEditUser(null);
      fetchProfileAndData();
    }
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

  // Mandatory Onboarding Complete Handler
  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !fullName.trim()) return;
    if (Number(expectedSalary) > 999) {
      alert("Expected salary cannot exceed 999");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        username: username,
        full_name: fullName,
        home_city: homeCity,
        expected_salary: expectedSalary,
        motivation: motivation,
        profile_picture_url: profilePicUrl,
        cv_url: cvUrl,
      })
      .eq("id", userId);

    if (error) {
      if (error.message.includes("unique")) {
        alert("This username is already taken! Please choose another.");
      } else {
        alert(`Failed to save: ${error.message}`);
      }
    } else {
      alert("Welcome to the platform!");
      fetchProfileAndData();
    }
  };

  // Unemployed Profile Save Handler (Existing Users)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(expectedSalary) > 999) {
      alert("Expected salary cannot exceed 999");
      return;
    }
    setSaveStatus("Saving...");

    // NOTE: username is purposely excluded here because they can't change it anymore.
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        home_city: homeCity,
        expected_salary: expectedSalary,
        motivation: motivation,
        profile_picture_url: profilePicUrl,
        cv_url: cvUrl,
        skills: skills,
        education: education,
        experience: experience,
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

  // Admin & Recruiter: Create Job
  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const targetCompanyId = profile?.role === "admin" ? selectedCompanyId : profile?.company_id;

    if (!targetCompanyId || !jobTitle) return;

    await supabase.from("jobs").insert({
      company_id: targetCompanyId,
      title: jobTitle,
      description: jobDesc,
      hourly_rate: jobRate,
    });

    setJobTitle("");
    setJobDesc("");
    setJobRate("");
    alert("Job opening posted!");
  };

  // Admin Action: Delete Job
  const handleDeleteJob = async (jobId: string) => {
    const confirm = window.confirm("Are you sure you want to delete this job posting? This cannot be undone.");
    if (!confirm) return;
    
    await supabase.from("jobs").delete().eq("id", jobId);
    alert("Job successfully deleted!");
    fetchProfileAndData(); // Refresh list
  };

  const createOrUpdateMatch = async (unemployedId: string, recruiterId: string, jobId: string, jobTitle: string) => {
    const { data: existing } = await supabase
      .from("matches")
      .select("id")
      .eq("unemployed_id", unemployedId)
      .eq("recruiter_id", recruiterId)
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase.from("messages").insert({
        match_id: existing[0].id,
        sender_id: unemployedId, 
        content: `[SYSTEM_MATCH: ${jobTitle}]`
      });
    } else {
      await supabase.from("matches").insert({
        unemployed_id: unemployedId,
        recruiter_id: recruiterId,
        job_id: jobId,
      });
    }
  };

  // Swipe logic (Optimistic / Non-blocking)
  const handleSwipe = (
    direction: string,
    targetId: string,
    cardData: any
  ) => {
    if (direction !== "left" && direction !== "right") return;

    // Fire and forget the swipe insert
    supabase.from("swipes").insert({
      swiper_id: userId,
      swiper_role: profile.role,
      target_id: targetId,
      direction: direction,
      job_context_id: profile.role === "recruiter" ? selectedJobContext?.id : null,
    }).then();

    if (direction === "right") {
      if (profile.role === "unemployed") {
        supabase
          .from("swipes")
          .select("swiper_id")
          .eq("target_id", userId)
          .eq("swiper_role", "recruiter")
          .eq("direction", "right")
          .eq("job_context_id", cardData.id)
          .then(({ data: recruiterSwipes }) => {
            if (recruiterSwipes && recruiterSwipes.length > 0) {
              const recruiterIds = recruiterSwipes.map((s) => s.swiper_id);
              supabase
                .from("profiles")
                .select("id")
                .in("id", recruiterIds)
                .eq("company_id", cardData.company_id)
                .then(({ data: matchingRecruiters }) => {
                  if (matchingRecruiters && matchingRecruiters.length > 0) {
                    createOrUpdateMatch(
                      userId,
                      matchingRecruiters[0].id,
                      cardData.id,
                      cardData.title
                    ).then(() => setMatchedItem(cardData));
                  }
                });
            }
          });
      } else if (profile.role === "recruiter") {
        if (!profile.company_id || !selectedJobContext) return;

        supabase
          .from("swipes")
          .select("target_id")
          .eq("swiper_id", targetId)
          .eq("swiper_role", "unemployed")
          .eq("direction", "right")
          .eq("target_id", selectedJobContext.id)
          .then(({ data: candidateSwipes }) => {
            if (candidateSwipes && candidateSwipes.length > 0) {
              createOrUpdateMatch(
                targetId,
                userId,
                selectedJobContext.id,
                selectedJobContext.title
              ).then(() => setMatchedItem(cardData));
            }
          });
      }
    }
  };

  // RECRUITER SUPERPOWER: Direct Message Bypass
  const handleDirectMessage = async (candidateId: string) => {
    if (!profile.company_id) {
      alert("You need to be assigned to a company to message candidates.");
      return;
    }

    // Check if they already matched
    const { data: existingMatch } = await supabase
      .from("matches")
      .select("id")
      .eq("unemployed_id", candidateId)
      .eq("recruiter_id", userId)
      .limit(1);

    if (existingMatch && existingMatch.length > 0) {
      alert("You already matched! Open your Chat tab to message them.");
      return;
    }

    // Get the first job belonging to the recruiter's company to fulfill the foreign key constraint
    const { data: companyJobs } = await supabase
      .from("jobs")
      .select("id")
      .eq("company_id", profile.company_id)
      .limit(1);

    if (!companyJobs || companyJobs.length === 0) {
      alert("Your company needs to post at least 1 job before you can start messaging candidates.");
      return;
    }

    const firstJobId = companyJobs[0].id;

    // Insert a forced match
    const { error } = await supabase.from("matches").insert({
      unemployed_id: candidateId,
      recruiter_id: userId,
      job_id: firstJobId,
    });

    if (error) {
      if (error.message.includes("duplicate key")) {
        alert("You already have an open chat with this candidate.");
      } else {
        alert(`Error starting chat: ${error.message}`);
      }
    } else {
      alert("Direct Message thread opened! Go to your Chat tab to start talking.");
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "40px", fontFamily: "sans-serif" }}>
        Loading platform...
      </div>
    );
  }

  // ==========================================
  // VIEW: MANDATORY ONBOARDING QUESTIONNAIRE
  // ==========================================
  const isNewUser = profile?.role !== "admin" && !profile?.username;
  
  if (isNewUser) {
    return (
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif", color: "var(--text-color)" }}>
        <form onSubmit={handleCompleteOnboarding} style={{ backgroundColor: "var(--glass-bg)", padding: "30px", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.1)", display: "flex", flexDirection: "column", gap: "16px", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }}>
          <h1 style={{ margin: 0, color: "var(--text-color)", fontSize: "24px" }}>Welcome to the Platform! 👋</h1>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>Before you can start swiping, please set up your account. Your username will be permanently locked after saving.</p>

          <div>
            <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Choose a Username *</label>
            <input
              type="text"
              placeholder="e.g. dev_ninja"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid rgba(255, 255, 255, 0.1)", boxSizing: "border-box", color: "var(--text-color)", backgroundColor: "var(--glass-bg)", fontSize: "16px" }}
              required
            />
            <span style={{ fontSize: "12px", color: "#ef4444", fontWeight: "bold" }}>Warning: This cannot be changed later.</span>
          </div>

          <div>
            <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Full Display Name *</label>
            <input
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid rgba(255, 255, 255, 0.1)", boxSizing: "border-box", color: "var(--text-color)", backgroundColor: "var(--glass-bg)", fontSize: "16px" }}
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
              style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid rgba(255, 255, 255, 0.1)", boxSizing: "border-box", color: "var(--text-color)", backgroundColor: "var(--glass-bg)" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Expected Salary / Hour</label>
            <input
              type="number"
              max="999"
              placeholder="e.g. 25"
              value={expectedSalary}
              onChange={(e) => setExpectedSalary(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid rgba(255, 255, 255, 0.1)", boxSizing: "border-box", color: "var(--text-color)", backgroundColor: "var(--glass-bg)" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Profile Picture</label>
            {profilePicUrl && <img src={profilePicUrl} alt="Preview" style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover", marginBottom: "8px" }} />}
            <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, "picture")} disabled={uploadingPic} />
            {uploadingPic && <span style={{ fontSize: "12px", color: "#6b7280" }}> Uploading...</span>}
          </div>

          <button
            type="submit"
            style={{ padding: "14px", backgroundColor: "#10b981", color: "var(--text-color)", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "16px", marginTop: "10px" }}
          >
            Complete Registration & Start Swiping 👉
          </button>
        </form>
      </div>
    );
  }

  // ==========================================
  // VIEW: MAIN PLATFORM
  // ==========================================
  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif", color: "var(--text-color)" }}>
      <style>{`
        .absolute-card { position: absolute; width: 100%; }
      `}</style>
      
      {/* Role Display Header (Self-Serve switching removed for security) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", padding: "12px", backgroundColor: "var(--glass-input-bg)", borderRadius: "8px" }}>
        <span style={{ fontWeight: "bold" }}>
          Current Role: {profile?.role?.toUpperCase()}
          {isAdminEmail && " (Permanent Admin)"}
        </span>
      </div>

      {/* UNEMPLOYED VIEW: Toggle between Profile Editor & Swipe Cards */}
      {profile?.role === "unemployed" && (
        <div>
          {!hideTabs && (
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              <button
                onClick={() => setActiveTab("swipe")}
                style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "none", cursor: "pointer", backgroundColor: activeTab === "swipe" ? "#111827" : "#e5e7eb", color: activeTab === "swipe" ? "var(--glass-bg)" : "#374151", fontWeight: "bold" }}
              >
                💼 Swipe Jobs
              </button>
              <button
                onClick={() => setActiveTab("edit_profile")}
                style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "none", cursor: "pointer", backgroundColor: activeTab === "edit_profile" ? "#111827" : "#e5e7eb", color: activeTab === "edit_profile" ? "var(--glass-bg)" : "#374151", fontWeight: "bold" }}
              >
                👤 Edit Applicant Profile
              </button>
            </div>
          )}

          {activeTab === "edit_profile" ? (
            <form onSubmit={handleSaveProfile} style={{ backgroundColor: "var(--glass-bg)", padding: "20px", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.1)", display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2 style={{ margin: 0 }}>Applicant Profile Setup</h2>

              {/* LOCKED USERNAME */}
              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Username</label>
                <input
                  type="text"
                  value={username}
                  disabled
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid rgba(255, 255, 255, 0.1)", boxSizing: "border-box", color: "#6b7280", backgroundColor: "var(--glass-input-bg)", cursor: "not-allowed" }}
                />
                <span style={{ fontSize: "12px", color: "#6b7280" }}>Usernames cannot be changed.</span>
              </div>

              {/* EDITABLE FULL NAME */}
              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Full Name</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid rgba(255, 255, 255, 0.1)", boxSizing: "border-box", color: "var(--text-color)", backgroundColor: "var(--glass-bg)" }}
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
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid rgba(255, 255, 255, 0.1)", boxSizing: "border-box", color: "var(--text-color)", backgroundColor: "var(--glass-bg)" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Expected Salary / Hour</label>
                <input
                  type="number"
                  max="999"
                  placeholder="e.g. 25"
                  value={expectedSalary}
                  onChange={(e) => setExpectedSalary(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid rgba(255, 255, 255, 0.1)", boxSizing: "border-box", color: "var(--text-color)", backgroundColor: "var(--glass-bg)" }}
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
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid rgba(255, 255, 255, 0.1)", boxSizing: "border-box", color: "var(--text-color)", backgroundColor: "var(--glass-bg)" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Skills (Comma Separated)</label>
                <input
                  type="text"
                  placeholder="React, Next.js, Node, Design"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid rgba(255, 255, 255, 0.1)", boxSizing: "border-box", color: "var(--text-color)", backgroundColor: "var(--glass-bg)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Education / Schooling</label>
                <input
                  type="text"
                  placeholder="BSc Computer Science, MIT"
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid rgba(255, 255, 255, 0.1)", boxSizing: "border-box", color: "var(--text-color)", backgroundColor: "var(--glass-bg)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Work Experience</label>
                <textarea
                  placeholder="Describe your previous work experience..."
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  rows={4}
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid rgba(255, 255, 255, 0.1)", boxSizing: "border-box", color: "var(--text-color)", backgroundColor: "var(--glass-bg)" }}
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
                style={{ padding: "12px", backgroundColor: "#10b981", color: "var(--text-color)", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
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
                  <div style={{ padding: "40px", backgroundColor: "var(--glass-input-bg)", borderRadius: "12px", border: "1px dashed #ccc" }}>
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
                          backgroundColor: "var(--glass-bg)",
                          borderRadius: "16px",
                          padding: "24px",
                          boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
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
                          <h2 style={{ margin: "8px 0", fontSize: "24px", color: "var(--text-color)" }}>{job.title}</h2>
                          <p style={{ fontSize: "18px", color: "#059669", fontWeight: "bold", margin: "4px 0 16px 0" }}>
                            {job.hourly_rate ? job.hourly_rate : "Rate Negotiable"}
                          </p>
                          <p style={{ color: "var(--text-muted)", fontSize: "14px", lineHeight: "1.5", maxHeight: "150px", overflow: "hidden" }}>
                            {job.description || "No description provided."}
                          </p>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "12px", borderTop: "1px solid #f3f4f6", paddingTop: "12px" }}>
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
          {!selectedJobContext ? (
            <div>
              <h2 style={{ color: "var(--text-color)", marginBottom: "20px" }}>Select a Job to find Candidates</h2>
              {recruiterJobs.length === 0 ? (
                <div style={{ padding: "40px", backgroundColor: "var(--glass-input-bg)", borderRadius: "12px", border: "1px dashed #ccc" }}>
                  You have not posted any jobs yet. Go to your Company Dashboard to create one!
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "15px" }}>
                  {recruiterJobs.map(job => (
                    <div 
                      key={job.id}
                      onClick={() => {
                        setSelectedJobContext(job);
                        loadCandidatesForRecruiter(userId, job.id);
                      }}
                      style={{ padding: "20px", backgroundColor: "var(--glass-bg)", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.1)", cursor: "pointer", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", textAlign: "left", transition: "transform 0.2s" }}
                    >
                      <h3 style={{ margin: "0 0 10px 0", color: "var(--text-color)" }}>{job.title}</h3>
                      <p style={{ margin: 0, color: "#6b7280", fontSize: "14px", textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden" }}>{job.description}</p>
                      <div style={{ marginTop: "15px", color: "#3b82f6", fontWeight: "bold" }}>👉 Find Candidates</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <button 
                  onClick={() => {
                    setSelectedJobContext(null);
                    setCandidateCards([]);
                  }} 
                  style={{ padding: "8px 16px", backgroundColor: "#e5e7eb", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
                >
                  🔙 Back to Jobs
                </button>
                <h3 style={{ margin: 0 }}>Hiring for: <span style={{ color: "#3b82f6" }}>{selectedJobContext.title}</span></h3>
              </div>

              <div style={{ display: "flex", gap: "10px", marginBottom: "20px", alignItems: "center" }}>
                <span style={{ fontWeight: "bold", color: "#e5e7eb" }}>Filters:</span>
                <input 
                  type="text" 
                  placeholder="Filter by Location (e.g. London)" 
                  value={filterCity}
                  onChange={(e) => setFilterCity(e.target.value)}
                  style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "1px solid rgba(255, 255, 255, 0.1)", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ position: "relative", width: "100%", height: "480px", marginTop: "20px" }}>
                {(() => {
                  const filteredCandidates = filterCity 
                    ? candidateCards.filter(c => c.home_city?.toLowerCase().includes(filterCity.toLowerCase())) 
                    : candidateCards;

                  if (candidateCards.length === 0) {
                    return (
                      <div style={{ padding: "40px", backgroundColor: "var(--glass-input-bg)", borderRadius: "12px", border: "1px dashed #ccc", display: "flex", flexDirection: "column", alignItems: "center", gap: "15px" }}>
                        <div style={{ fontSize: "16px", fontWeight: "bold" }}>You have viewed all available candidates.</div>
                        <button 
                          onClick={async () => {
                            await supabase.from("swipes").delete().eq("swiper_id", userId).eq("job_context_id", selectedJobContext.id).eq("direction", "left");
                            await loadCandidatesForRecruiter(userId, selectedJobContext.id);
                          }}
                          style={{ padding: "10px 20px", backgroundColor: "#10b981", color: "var(--text-color)", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
                        >
                          🔁 Refresh Candidate Pool
                        </button>
                      </div>
                    );
                  }

                  if (filteredCandidates.length === 0) {
                    return (
                      <div style={{ padding: "40px", backgroundColor: "var(--glass-input-bg)", borderRadius: "12px", border: "1px dashed #ccc" }}>
                        No candidates match your current location filter.
                      </div>
                    );
                  }
                  
                  return filteredCandidates.map((candidate) => (
                      <TinderCard
                        key={candidate.id}
                        onSwipe={(dir) => handleSwipe(dir, candidate.id, candidate)}
                        preventSwipe={["up", "down"]}
                    className="absolute-card"
                  >
                    <div
                      style={{
                        backgroundColor: "var(--glass-bg)",
                        borderRadius: "16px",
                        padding: "20px",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
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
                              justifyContent: "center",
                              fontSize: "24px",
                            }}
                          >
                            {!candidate.profile_picture_url && "👤"}
                          </div>
                          <div>
                            <h2 style={{ margin: 0, fontSize: "20px", color: "var(--text-color)" }}>
                              {candidate.full_name || "Unnamed Applicant"}
                            </h2>
                            <p style={{ margin: "2px 0 0 0", color: "#6b7280", fontSize: "14px" }}>
                              @{candidate.username || "unknown"} • 📍 {candidate.home_city || "Location unspecified"}
                            </p>
                          </div>
                        </div>

                        {/* Hourly Expectations */}
                        <div style={{ marginBottom: "10px" }}>
                          <span style={{ fontSize: "13px", fontWeight: "bold", color: "#e5e7eb" }}>Expected Salary: </span>
                          <span style={{ fontSize: "14px", color: "#059669", fontWeight: "bold" }}>
                            {candidate.expected_salary || "Negotiable"}
                          </span>
                        </div>

                        {/* Motivation */}
                        <div style={{ marginBottom: "8px" }}>
                          <span style={{ fontSize: "13px", fontWeight: "bold", color: "#e5e7eb", display: "block" }}>Motivation:</span>
                          <p style={{ margin: "2px 0", color: "var(--text-muted)", fontSize: "13px", lineHeight: "1.4", maxHeight: "60px", overflow: "hidden" }}>
                            "{candidate.motivation || "No motivation statement provided."}"
                          </p>
                        </div>

                        {/* Skills */}
                        <div style={{ marginBottom: "8px" }}>
                          <span style={{ fontSize: "13px", fontWeight: "bold", color: "#e5e7eb" }}>Skills: </span>
                          <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{candidate.skills || "None listed"}</span>
                        </div>

                        {/* Education */}
                        <div style={{ marginBottom: "8px" }}>
                          <span style={{ fontSize: "13px", fontWeight: "bold", color: "#e5e7eb" }}>Education: </span>
                          <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{candidate.education || "None listed"}</span>
                        </div>

                        {/* Experience */}
                        <div style={{ marginBottom: "12px" }}>
                          <span style={{ fontSize: "13px", fontWeight: "bold", color: "#e5e7eb", display: "block" }}>Experience:</span>
                          <p style={{ margin: "2px 0", color: "var(--text-muted)", fontSize: "12px", lineHeight: "1.4", maxHeight: "40px", overflow: "hidden" }}>
                            {candidate.experience || "None listed"}
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

                      <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "12px", borderTop: "1px solid #f3f4f6", paddingTop: "12px", alignItems: "center" }}>
                        <span>👈 Swipe Left to Pass</span>
                        
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDirectMessage(candidate.id);
                          }}
                          style={{ padding: "6px 12px", backgroundColor: "#3b82f6", color: "var(--text-color)", border: "none", borderRadius: "12px", cursor: "pointer", fontWeight: "bold" }}
                        >
                          💬 Direct Message
                        </button>

                        <span>Swipe Right to Connect 👉</span>
                      </div>
                    </div>
                  </TinderCard>
                ));
            })()}
          </div>
        </div>
        )}
        </div>
      )}

      {/* ADMIN PANEL VIEW */}
      {profile?.role === "admin" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Admin: Manage Users (Promote/Demote/Edit) */}
          <div style={{ padding: "16px", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "8px", backgroundColor: "var(--glass-bg)", color: "var(--text-color)" }}>
            <h3 style={{ marginTop: 0 }}>Admin: User Management</h3>
            <input 
              type="text" 
              placeholder="Search all users by name or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%", padding: "8px", marginBottom: "15px", boxSizing: "border-box", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "4px" }}
            />
            
            <div style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid #eee", borderRadius: "4px" }}>
              {allUsers.length === 0 && <div style={{ padding: "10px" }}>No users found.</div>}
              {allUsers
                .filter(u => 
                  (u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                   u.username?.toLowerCase().includes(searchQuery.toLowerCase()))
                )
                .map(user => (
                  <div key={user.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", borderBottom: "1px solid #eee" }}>
                    <div>
                      <strong>{user.full_name || "No Name Set"}</strong>
                      <span style={{ marginLeft: "8px", fontSize: "12px", color: "#6b7280" }}>
                        @{user.username || "no_username"}
                      </span>
                      <br/>
                      <span style={{ fontSize: "11px", fontWeight: "bold", color: user.role === 'recruiter' ? '#3b82f6' : '#6b7280', display: "inline-block", marginTop: "4px" }}>
                        ROLE: {user.role.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexDirection: "column", alignItems: "flex-end" }}>
                      
                      <button 
                        onClick={() => {
                          setAdminEditUser(user);
                          setAdminEditUsername(user.username || "");
                          setAdminEditFullName(user.full_name || "");
                        }}
                        style={{ padding: "4px 8px", backgroundColor: "var(--glass-input-bg)", color: "var(--text-color)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}
                      >
                        ✏️ Force Edit Profile
                      </button>

                      {user.role === "unemployed" && (
                        <select 
                          onChange={(e) => {
                            if (e.target.value) handlePromoteToRecruiter(user.id, e.target.value);
                            e.target.value = ""; 
                          }}
                          style={{ padding: "4px", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "4px", backgroundColor: "#10b981", color: "var(--text-color)", fontWeight: "bold", cursor: "pointer", fontSize: "12px" }}
                        >
                          <option value="">Promote to Recruiter ▾</option>
                          {companies.map(c => (
                            <option key={c.id} value={c.id}>Assign to {c.name}</option>
                          ))}
                        </select>
                      )}

                      {user.role === "recruiter" && (
                        <button 
                          onClick={() => handleDemoteToUnemployed(user.id)}
                          style={{ padding: "4px 8px", backgroundColor: "#ef4444", color: "var(--text-color)", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}
                        >
                          Demote to Unemployed
                        </button>
                      )}

                    </div>
                  </div>
              ))}
            </div>
          </div>

          {/* Admin: Manage Jobs */}
          <div style={{ padding: "16px", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "8px", backgroundColor: "var(--glass-bg)", color: "var(--text-color)" }}>
            <h3 style={{ marginTop: 0 }}>Admin: Manage Job Postings</h3>
            <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid #eee", borderRadius: "4px" }}>
              {allJobs.length === 0 && <div style={{ padding: "10px" }}>No job postings found.</div>}
              {allJobs.map(job => (
                <div key={job.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", borderBottom: "1px solid #eee" }}>
                  <div>
                    <strong>{job.title}</strong>
                    <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                      Company: {job.companies?.name || "Unknown"} | Rate: €{job.hourly_rate}/hr
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteJob(job.id)}
                    style={{ padding: "6px 12px", backgroundColor: "#ef4444", color: "var(--text-color)", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleCreateCompany} style={{ padding: "16px", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "8px", backgroundColor: "var(--glass-bg)" }}>
            <h3 style={{ marginTop: 0 }}>Admin: Add Company</h3>
            <input
              type="text"
              placeholder="Company Name"
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              style={{ width: "100%", padding: "8px", marginBottom: "10px", boxSizing: "border-box", color: "var(--text-color)", backgroundColor: "var(--glass-bg)", border: "1px solid rgba(255, 255, 255, 0.1)" }}
              required
            />
            <textarea
              placeholder="Company Description"
              value={newCompanyDesc}
              onChange={(e) => setNewCompanyDesc(e.target.value)}
              style={{ width: "100%", padding: "8px", marginBottom: "10px", boxSizing: "border-box", color: "var(--text-color)", backgroundColor: "var(--glass-bg)", border: "1px solid rgba(255, 255, 255, 0.1)" }}
            />
            <button type="submit" style={{ width: "100%", padding: "10px", backgroundColor: "#10b981", color: "var(--text-color)", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
              Add Company
            </button>
          </form>

          <form onSubmit={handleCreateJob} style={{ padding: "16px", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "8px", backgroundColor: "var(--glass-bg)" }}>
            <h3 style={{ marginTop: 0 }}>Admin: Add Job Post</h3>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              style={{ width: "100%", padding: "8px", marginBottom: "10px", boxSizing: "border-box", color: "var(--text-color)", backgroundColor: "var(--glass-bg)", border: "1px solid rgba(255, 255, 255, 0.1)" }}
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
              style={{ width: "100%", padding: "8px", marginBottom: "10px", boxSizing: "border-box", color: "var(--text-color)", backgroundColor: "var(--glass-bg)", border: "1px solid rgba(255, 255, 255, 0.1)" }}
              required
            />
            <input
              type="text"
              placeholder="Hourly Rate / Salary"
              value={jobRate}
              onChange={(e) => setJobRate(e.target.value)}
              style={{ width: "100%", padding: "8px", marginBottom: "10px", boxSizing: "border-box", color: "var(--text-color)", backgroundColor: "var(--glass-bg)", border: "1px solid rgba(255, 255, 255, 0.1)" }}
            />
            <textarea
              placeholder="Job Description"
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
              style={{ width: "100%", padding: "8px", marginBottom: "10px", boxSizing: "border-box", color: "var(--text-color)", backgroundColor: "var(--glass-bg)", border: "1px solid rgba(255, 255, 255, 0.1)" }}
            />
            <button type="submit" style={{ width: "100%", padding: "10px", backgroundColor: "#10b981", color: "var(--text-color)", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
              Add Job Opening
            </button>
          </form>
        </div>
      )}

      {/* ADMIN EDIT USER MODAL */}
      {adminEditUser && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.75)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <form onSubmit={handleAdminSaveOverride} style={{ backgroundColor: "var(--glass-bg)", padding: "32px", borderRadius: "16px", maxWidth: "400px", width: "100%" }}>
            <h2 style={{ marginTop: 0, color: "var(--text-color)" }}>Force Edit Profile</h2>
            <p style={{ fontSize: "14px", color: "#666" }}>You are overriding details for ID: {adminEditUser.id}</p>
            
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px", color: "var(--text-color)" }}>Username (Must be unique)</label>
              <input type="text" value={adminEditUsername} onChange={(e) => setAdminEditUsername(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid rgba(255, 255, 255, 0.1)", boxSizing: "border-box" }} required />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px", color: "var(--text-color)" }}>Full Name</label>
              <input type="text" value={adminEditFullName} onChange={(e) => setAdminEditFullName(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid rgba(255, 255, 255, 0.1)", boxSizing: "border-box" }} required />
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setAdminEditUser(null)} style={{ padding: "8px 16px", backgroundColor: "#e5e7eb", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Cancel</button>
              <button type="submit" style={{ padding: "8px 16px", backgroundColor: "#ef4444", color: "var(--text-color)", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Force Save</button>
            </div>
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
              backgroundColor: "var(--glass-bg)",
              padding: "32px",
              borderRadius: "16px",
              textAlign: "center",
              maxWidth: "400px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <h1 style={{ color: "#10b981", fontSize: "36px", margin: "0 0 8px 0" }}>It's a Match! 🎉</h1>
            <p style={{ fontSize: "16px", color: "#e5e7eb", margin: "0 0 24px 0" }}>
              {profile.role === "unemployed"
                ? `You and ${matchedItem.companies?.name || "the company"} matched on the ${matchedItem.title} position!`
                : `You and candidate ${matchedItem.full_name || "this applicant"} matched!`}
            </p>
            <button
              onClick={() => setMatchedItem(null)}
              style={{
                backgroundColor: "#10b981",
                color: "var(--text-color)",
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
