"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ChatFeature({ userId }: { userId: string }) {
  const [matches, setMatches] = useState<any[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMatches();
  }, [userId]);

  useEffect(() => {
    // Scroll to bottom when messages update
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!selectedMatch) return;

    // Listen for real-time inserts on the messages table for this match
    const channel = supabase
      .channel(`chat_${selectedMatch.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${selectedMatch.id}`,
        },
        (payload) => {
          // Add the new message to state if it wasn't sent by us (we already added it optimistically or we just let realtime handle it)
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

          return {
            ...match,
            otherUser: profile || { id: otherUserId, full_name: "Unknown User" }
          };
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

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedMatch) return;

    const content = newMessage;
    setNewMessage("");

    const { error } = await supabase.from("messages").insert({
      match_id: selectedMatch.id,
      sender_id: userId,
      receiver_id: selectedMatch.otherUser.id,
      content: content
    });

    if (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message.");
    }
  };

  return (
    <div style={{ display: "flex", height: "70vh", border: "1px solid #ccc", borderRadius: "8px", overflow: "hidden", backgroundColor: "#fff", color: "#111" }}>
      
      {/* MATCHES SIDEBAR */}
      <div style={{ width: "300px", borderRight: "1px solid #ccc", backgroundColor: "#f9f9f9", display: "flex", flexDirection: "column" }}>
        <h3 style={{ padding: "15px", margin: 0, borderBottom: "1px solid #eee", backgroundColor: "#f1f1f1" }}>Your Matches</h3>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {matches.length === 0 ? (
            <p style={{ padding: "15px", color: "#666" }}>No matches yet. Go swipe!</p>
          ) : (
            matches.map((match) => (
              <div 
                key={match.id}
                onClick={() => selectMatch(match)}
                style={{ 
                  padding: "15px", 
                  borderBottom: "1px solid #eee", 
                  cursor: "pointer",
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
            <div style={{ padding: "15px", borderBottom: "1px solid #ccc", backgroundColor: "#fff", fontWeight: "bold" }}>
              Chatting with {selectedMatch.otherUser.full_name}
            </div>

            {/* MESSAGES LIST */}
            <div style={{ flex: 1, overflowY: "auto", padding: "15px", backgroundColor: "#fcfcfc" }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: "center", color: "#aaa", marginTop: "20px" }}>No messages yet. Say hi!</div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_id === userId;
                  return (
                    <div key={msg.id} style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start", marginBottom: "10px" }}>
                      <div style={{ 
                        maxWidth: "70%", 
                        padding: "10px 15px", 
                        borderRadius: "15px", 
                        backgroundColor: isMine ? "#1976d2" : "#e0e0e0",
                        color: isMine ? "#fff" : "#111"
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
                type="text" 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                style={{ flex: 1, padding: "10px", borderRadius: "20px", border: "1px solid #ccc", marginRight: "10px" }}
              />
              <button type="submit" style={{ padding: "10px 20px", backgroundColor: "#1976d2", color: "#fff", border: "none", borderRadius: "20px", cursor: "pointer", fontWeight: "bold" }}>
                Send
              </button>
            </form>
          </>
        )}
      </div>

    </div>
  );
}
