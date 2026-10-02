"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CompaniesDirectory() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    const { data } = await supabase.from("companies").select("*").order("name");
    if (data) setCompanies(data);
    setLoading(false);
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: "40px", color: "#9ca3af" }}>Loading companies...</div>;
  }

  const filtered = companies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif", color: "#111" }}>
      <h1 style={{ margin: "0 0 16px 0", color: "#111827" }}>🏢 Companies Directory</h1>
      <p style={{ color: "#4b5563", marginBottom: "24px" }}>
        Browse all the companies currently hiring on our platform.
      </p>

      <input 
        type="text" 
        placeholder="Search for a company..." 
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.1)", marginBottom: "20px", boxSizing: "border-box", fontSize: "16px" }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {filtered.length === 0 && <div style={{ padding: "20px", textAlign: "center", color: "#6b7280" }}>No companies found.</div>}
        {filtered.map(company => (
          <div key={company.id} style={{ padding: "20px", backgroundColor: "rgba(255, 255, 255, 0.03)", border: "1px solid #e5e7eb", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
            <h2 style={{ margin: "0 0 8px 0", color: "#10b981", fontSize: "20px" }}>{company.name}</h2>
            <p style={{ margin: 0, color: "#4b5563", lineHeight: "1.5", fontSize: "14px" }}>
              {company.description || "No description provided."}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
