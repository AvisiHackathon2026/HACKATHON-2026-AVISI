"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

interface ChatFeatureProps {
  userId: string;
  onGoToCalculator?: (matchId: string) => void;
}

export default function ChatFeature({ userId, onGoToCalculator }: ChatFeatureProps) {
  const [matches, setMatches] = useState<any[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [myRole, setMyRole] = useState<string>("unemployed");
  const [myCompanyId, setMyCompanyId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("profiles").select("role, company_id").eq("id", userId).single().then(({ data }) => {
      if (data) {
        setMyRole(data.role);
        setMyCompanyId(data.company_id);
      }
    });
    fetchMatches();
  }, [userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!selectedMatch) return;

    const channel = supabase
      .channel(`chat_${selectedMatch.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${selectedMatch.id}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.find((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedMatch]);

  const fetchMatches = async () => {
    const { data: allMatches } = await supabase
      .from("matches")
      .select("*")
      .or(`unemployed_id.eq.${userId},recruiter_id.eq.${userId}`);

    if (allMatches) {
      const enrichedMatches = await Promise.all(
        allMatches.map(async (match) => {
          const otherUserId = match.unemployed_id === userId ? match.recruiter_id : match.unemployed_id;
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, full_name, role")
            .eq("id", otherUserId)
            .single();

          return { ...match, otherUser: profile || { id: otherUserId, full_name: "Unknown User" } };
        })
      );
      setMatches(enrichedMatches);
    }
  };

  const selectMatch = (match: any) => {
    setSelectedMatch(match);
    fetchMessages(match.id);
  };

  const fetchMessages = async (matchId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });
    
    if (data) setMessages(data);
  };

  const sendRawMessage = async (content: string) => {
    if (!selectedMatch) return;
    const { error } = await supabase.from("messages").insert({
      match_id: selectedMatch.id,
      sender_id: userId,
      receiver_id: selectedMatch.otherUser.id,
      content: content
    });
    if (error) alert("Failed to send message.");
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedMatch) return;
    const content = newMessage;
    setNewMessage("");
    await sendRawMessage(content);
  };

  const handleHireCandidate = async () => {
    if (!selectedMatch || !myCompanyId) return;
    const confirm = window.confirm("Are you sure you want to hire this candidate? This will assign them to your company.");
    if (!confirm) return;

    // The other user in this match is the unemployed candidate
    const candidateId = selectedMatch.otherUser.id;
    const { error } = await supabase.from("profiles").update({
      role: "employed",
      company_id: myCompanyId
    }).eq("id", candidateId);

    if (error) {
      alert("Error hiring candidate: " + error.message);
    } else {
      await sendRawMessage(`[SYSTEM_HIRED]`);
      alert("Candidate successfully hired! They are now part of your company.");
    }
  };

  // Negotiation State Checks
  const isSalaryAccepted = messages.some((m) => m.content.startsWith("[SALARY_ACCEPTED:"));
  const isMeetingAccepted = messages.some((m) => m.content === "[MEETING_ACCEPTED]");
  const isHired = messages.some((m) => m.content === "[SYSTEM_HIRED]");
  
  const canHire = isSalaryAccepted && isMeetingAccepted && myRole === "recruiter" && !isHired;

  return (
    <div style={{ display: "flex", height: "70vh", border: "1px solid #ccc", borderRadius: "8px", overflow: "hidden", backgroundColor: "#fff", color: "#111" }}>
      
      {/* MATCHES SIDEBAR */}
      <div style={{ width: "300px", borderRight: "1px solid #ccc", backgroundColor: "#f9f9f9", display: "flex", flexDirection: "column" }}>
        <h3 style={{ padding: "15px", margin: 0, borderBottom: "1px solid #eee", backgroundColor: "#f1f1f1" }}>Your Matches</h3>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {matches.length === 0 ? (
            <p style={{ padding: "15px", color: "#666" }}>No matches yet.</p>
          ) : (
            matches.map((match) => (
              <div 
                key={match.id}
                onClick={() => selectMatch(match)}
                style={{ 
                  padding: "15px", borderBottom: "1px solid #eee", cursor: "pointer",
                  backgroundColor: selectedMatch?.id === match.id ? "#e3f2fd" : "transparent"
                }}
              >
                <strong style={{ display: "block" }}>{match.otherUser.full_name || "Anonymous"}</strong>
                <span style={{ fontSize: "12px", color: "#666" }}>Role: {match.otherUser.role}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* CHAT AREA */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {!selectedMatch ? (
          <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", color: "#999" }}>
            Select a match to start chatting
          </div>
        ) : (
          <>
            {/* CHAT HEADER */}
            <div style={{ padding: "15px", borderBottom: "1px solid #ccc", backgroundColor: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: "bold" }}>Chatting with {selectedMatch.otherUser.full_name}</div>
              
              <div style={{ display: "flex", gap: "10px" }}>
                {myRole === "recruiter" && !isHired && (
                  <>
                    <button 
                      onClick={() => sendRawMessage("[MEETING_PROPOSED]")}
                      style={{ padding: "6px 12px", backgroundColor: "#f59e0b", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}
                    >
                      📅 Propose Meeting
                    </button>
                    {onGoToCalculator && (
                      <button 
                        onClick={() => onGoToCalculator(selectedMatch.id)}
                        style={{ padding: "6px 12px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}
                      >
                        💰 Propose Salary (Calc)
                      </button>
                    )}
                  </>
                )}
                
                {canHire && (
                  <button 
                    onClick={handleHireCandidate}
                    style={{ padding: "6px 16px", backgroundColor: "#10b981", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "14px", boxShadow: "0 0 10px rgba(16, 185, 129, 0.5)", animation: "pulse 2s infinite" }}
                  >
                    🎉 HIRE CANDIDATE
                  </button>
                )}
              </div>
            </div>

            {isHired && (
              <div style={{ backgroundColor: "#10b981", color: "#fff", padding: "10px", textAlign: "center", fontWeight: "bold" }}>
                ✅ This candidate has been officially hired!
              </div>
            )}

            {/* MESSAGES LIST */}
            <div style={{ flex: 1, overflowY: "auto", padding: "15px", backgroundColor: "#fcfcfc" }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: "center", color: "#aaa", marginTop: "20px" }}>No messages yet. Say hi!</div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_id === userId;
                  const content = msg.content;

                  // Render Protocol Messages
                  if (content.startsWith("[SALARY_PROPOSAL:")) {
                    const amount = content.split(":")[1].replace("]", "").trim();
                    return (
                      <div key={msg.id} style={{ margin: "15px 0", padding: "15px", border: "2px solid #3b82f6", borderRadius: "8px", backgroundColor: "#eff6ff", textAlign: "center" }}>
                        <div style={{ fontSize: "16px", fontWeight: "bold", color: "#1e3a8a", marginBottom: "10px" }}>
                          💰 Salary Proposal: €{amount} / hr
                        </div>
                        {myRole === "unemployed" && !isSalaryAccepted && !isHired && (
                          <button onClick={() => sendRawMessage(`[SALARY_ACCEPTED: ${amount}]`)} style={{ padding: "8px 16px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
                            Accept Offer
                          </button>
                        )}
                        {isSalaryAccepted && <div style={{ color: "#10b981", fontWeight: "bold" }}>✅ Accepted</div>}
                      </div>
                    );
                  }

                  if (content.startsWith("[SALARY_ACCEPTED:")) {
                    const amount = content.split(":")[1].replace("]", "").trim();
                    return (
                      <div key={msg.id} style={{ margin: "10px 0", textAlign: "center", color: "#10b981", fontWeight: "bold", fontSize: "14px" }}>
                        ✅ The candidate accepted the salary offer of €{amount}/hr.
                      </div>
                    );
                  }

                  if (content === "[MEETING_PROPOSED]") {
                    return (
                      <div key={msg.id} style={{ margin: "15px 0", padding: "15px", border: "2px solid #f59e0b", borderRadius: "8px", backgroundColor: "#fffbeb", textAlign: "center" }}>
                        <div style={{ fontSize: "16px", fontWeight: "bold", color: "#92400e", marginBottom: "10px" }}>
                          📅 A Meeting was proposed.
                        </div>
                        {myRole === "unemployed" && !isMeetingAccepted && !isHired && (
                          <button onClick={() => sendRawMessage(`[MEETING_ACCEPTED]`)} style={{ padding: "8px 16px", backgroundColor: "#f59e0b", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
                            Accept Meeting
                          </button>
                        )}
                        {isMeetingAccepted && <div style={{ color: "#10b981", fontWeight: "bold" }}>✅ Scheduled</div>}
                      </div>
                    );
                  }

                  if (content === "[MEETING_ACCEPTED]") {
                    return (
                      <div key={msg.id} style={{ margin: "10px 0", textAlign: "center", color: "#10b981", fontWeight: "bold", fontSize: "14px" }}>
                        ✅ The candidate agreed to meet.
                      </div>
                    );
                  }

                  if (content === "[SYSTEM_HIRED]") {
                    return (
                      <div key={msg.id} style={{ margin: "20px 0", textAlign: "center", fontSize: "18px", color: "#10b981", fontWeight: "bold", padding: "10px", borderTop: "2px dashed #10b981", borderBottom: "2px dashed #10b981" }}>
                        🎉 THE CANDIDATE WAS OFFICIALLY HIRED!
                      </div>
                    );
                  }

                  // Render Normal Messages
                  return (
                    <div key={msg.id} style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start", marginBottom: "10px" }}>
                      <div style={{ 
                        maxWidth: "70%", padding: "10px 15px", borderRadius: "15px", 
                        backgroundColor: isMine ? "#1976d2" : "#e0e0e0", color: isMine ? "#fff" : "#111"
                      }}>
                        {msg.content}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* MESSAGE INPUT */}
            <form onSubmit={sendMessage} style={{ display: "flex", padding: "15px", borderTop: "1px solid #ccc", backgroundColor: "#fff" }}>
              <input 
                type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                placeholder={isHired ? "Chat locked (Hired)" : "Type a message..."}
                disabled={isHired}
                style={{ flex: 1, padding: "10px", borderRadius: "20px", border: "1px solid #ccc", marginRight: "10px" }}
              />
              <button type="submit" disabled={isHired} style={{ padding: "10px 20px", backgroundColor: isHired ? "#ccc" : "#1976d2", color: "#fff", border: "none", borderRadius: "20px", cursor: isHired ? "not-allowed" : "pointer", fontWeight: "bold" }}>
                Send
              </button>
            </form>
          </>
        )}
      </div>

    </div>
  );
}
