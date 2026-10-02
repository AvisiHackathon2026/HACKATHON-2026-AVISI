"use client";

import React, { useState, useEffect } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { supabase } from "@/lib/supabaseClient";

const localizer = momentLocalizer(moment);

export default function CalendarFeature({ userId }: { userId: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");

  useEffect(() => {
    fetchEvents();
    fetchMatches();
  }, [userId]);

  const fetchEvents = async () => {
    const { data } = await supabase
      .from("meetings")
      .select("*")
      .or(`host_id.eq.${userId},guest_id.eq.${userId}`);

    if (data) {
      const formattedEvents = data.map((meeting) => ({
        ...meeting,
        title: `${meeting.title} (${meeting.status})`,
        start: new Date(meeting.start_time),
        end: new Date(meeting.end_time),
        resource: meeting
      }));
      setEvents(formattedEvents);
    }
  };

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
            id: otherUserId, // The ID of the person we are chatting/meeting with
            name: profile?.full_name || "Unknown User"
          };
        })
      );
      
      // Filter unique users in case of multiple matches with same person
      const uniqueMatches = Array.from(new Map(enrichedMatches.map(m => [m.id, m])).values());
      setMatches(uniqueMatches);
    }
  };

  const handleSelectSlot = (slotInfo: any) => {
    setSelectedSlot(slotInfo);
    setShowModal(true);
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatchId || !meetingTitle || !selectedSlot) return;

    const { error } = await supabase.from("meetings").insert({
      host_id: userId,
      guest_id: selectedMatchId,
      title: meetingTitle,
      start_time: selectedSlot.start.toISOString(),
      end_time: selectedSlot.end.toISOString(),
      status: "Pending"
    });

    if (error) {
      alert(`Error creating meeting: ${error.message}`);
    } else {
      alert("Meeting proposed successfully!");
      setShowModal(false);
      setMeetingTitle("");
      setSelectedMatchId("");
      fetchEvents();
    }
  };

  const handleSelectEvent = async (event: any) => {
    const meeting = event.resource;
    // If the logged in user is the GUEST and the meeting is PENDING
    if (meeting.guest_id === userId && meeting.status === "Pending") {
      const accept = window.confirm(`Do you want to ACCEPT the meeting: "${meeting.title}"? \nClick OK to Accept, or Cancel to Decline.`);
      if (accept) {
        await supabase.from("meetings").update({ status: "Accepted" }).eq("id", meeting.id);
        fetchEvents();
      } else {
        await supabase.from("meetings").update({ status: "Declined" }).eq("id", meeting.id);
        fetchEvents();
      }
    } else {
      alert(`Meeting: ${meeting.title}\nStatus: ${meeting.status}\nTime: ${moment(meeting.start_time).format('LLL')}`);
    }
  };

  return (
    <div style={{ height: "70vh", backgroundColor: "var(--glass-bg)", color: "#111", padding: "20px", borderRadius: "8px", position: "relative" }}>
      <h2 className="text-gradient" style={{ marginTop: 0, marginBottom: "20px" }}>Schedule Interviews (Click an empty slot to propose)</h2>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: "calc(100% - 60px)" }}
        selectable
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        eventPropGetter={(event) => {
          let backgroundColor = "#3174ad"; // Default Blue
          if (event.resource.status === "Pending") backgroundColor = "#f59e0b"; // Yellow/Orange
          if (event.resource.status === "Accepted") backgroundColor = "#10b981"; // Green
          if (event.resource.status === "Declined") backgroundColor = "#ef4444"; // Red
          return { style: { backgroundColor } };
        }}
      />

      {/* MODAL FOR NEW MEETING */}
      {showModal && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 10
        }}>
          <div style={{ backgroundColor: "var(--glass-bg)", padding: "30px", borderRadius: "8px", width: "400px" }}>
            <h3 style={{ marginTop: 0 }}>Propose Interview</h3>
            <p><strong>Time:</strong> {moment(selectedSlot.start).format("LLL")}</p>
            
            <form onSubmit={handleCreateMeeting} style={{ display: "flex", flexDirection: "column", gap: "15px", marginTop: "20px" }}>
              <label>
                Interview With:
                <select 
                  value={selectedMatchId} 
                  onChange={(e) => setSelectedMatchId(e.target.value)}
                  style={{ width: "100%", padding: "8px", marginTop: "5px", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "4px" }}
                  required
                >
                  <option value="">-- Select a Match --</option>
                  {matches.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </label>

              <label>
                Meeting Title:
                <input 
                  type="text" 
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  placeholder="e.g. Frontend Dev First Interview"
                  style={{ width: "100%", padding: "8px", marginTop: "5px", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "4px", boxSizing: "border-box" }}
                  required
                />
              </label>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: "8px 15px", backgroundColor: "#ccc", border: "none", borderRadius: "4px", cursor: "pointer" }}>Cancel</button>
                <button type="submit" style={{ padding: "8px 15px", backgroundColor: "#1976d2", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Propose Meeting</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
