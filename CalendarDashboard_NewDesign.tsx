import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  CalendarPlus,
  Clock,
  MoreHorizontal,
  Settings2,
} from "lucide-react";

/**
 * MOCK API UTILS (Replace with your actual fetch logic / api wrappers)
 */
const API_BASE = "/api";

async function fetchEvents() {
  const res = await fetch(`${API_BASE}/calendar/events`);
  return res.json();
}
async function fetchScheduledMessages() {
  const res = await fetch(`${API_BASE}/scheduled-messages`);
  return res.json();
}

/**
 * CALENDAR DASHBOARD COMPONENT
 */
export function CalendarDashboard() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 8, 1)); // September 2026 based on image
  const [view, setView] = useState("Month");
  const [searchQuery, setSearchQuery] = useState("");
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load events and scheduled messages when component mounts
    async function loadData() {
      setLoading(true);
      try {
        const [eventsData, scheduledData] = await Promise.all([
          fetchEvents().catch(() => []),
          fetchScheduledMessages().catch(() => []),
        ]);
        // Combine and set your items here
        setEvents([...(eventsData || []), ...(scheduledData || [])]);
      } catch (err) {
        console.error("Failed to load calendar data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentDate]);

  // Calendar generation helpers
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  
  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const monthYearString = currentDate.toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] min-h-screen text-slate-800 font-sans">
      {/* HEADER */}
      <header className="flex items-center justify-between px-8 py-6 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Calendar</h1>
          <p className="text-sm text-gray-500 mt-1">
            Plan your work, meetings and stay in sync with your team.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-64 rounded-full border border-gray-300 text-sm focus:outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800 transition-all bg-white"
            />
          </div>
          <button className="p-2 border border-gray-300 rounded-full hover:bg-gray-50 transition-colors bg-white">
            <Settings2 className="h-4 w-4 text-gray-600" />
          </button>
          <button className="flex items-center gap-2 bg-[#9B2C4D] text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-[#80223D] transition-colors shadow-sm">
            <CalendarPlus className="h-4 w-4" />
            New event
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="flex flex-1 overflow-hidden p-6 gap-6 max-w-[1600px] mx-auto w-full">
        {/* LEFT PANE: CALENDAR GRID */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          {/* Grid Toolbar */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="flex items-center bg-gray-50 rounded-full border border-gray-200 p-1">
                <button onClick={handlePrevMonth} className="p-1.5 hover:bg-white rounded-full transition-colors text-gray-600">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={handleToday} className="px-3 text-sm font-medium text-gray-700 hover:text-black">
                  Today
                </button>
                <button onClick={handleNextMonth} className="p-1.5 hover:bg-white rounded-full transition-colors text-gray-600">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <h2 className="text-lg font-bold text-gray-900">{monthYearString}</h2>
            </div>
            
            <div className="flex items-center bg-gray-50 rounded-full border border-gray-200 p-1 text-sm font-medium">
              {["Month", "Week", "Day", "Agenda"].map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-4 py-1.5 rounded-full transition-all ${
                    view === v ? "bg-[#9B2C4D] text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Grid Body */}
          <div className="flex-1 flex flex-col min-h-0 bg-white">
            {/* Days of week header */}
            <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
              {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => (
                <div key={day} className="py-3 text-center text-xs font-semibold text-gray-500 tracking-wider">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar Cells */}
            <div className="flex-1 grid grid-cols-7 auto-rows-fr">
              {/* Empty cells for start of month */}
              {Array.from({ length: (firstDayOfMonth + 6) % 7 }).map((_, i) => (
                <div key={`empty-${i}`} className="border-r border-b border-gray-100 bg-gray-50/30 p-2" />
              ))}
              
              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const date = i + 1;
                // Mocking an event on the 24th and 25th for visual fidelity
                const isSelected = date === 24;
                const hasEvent = date === 25 || date === 27;

                return (
                  <div key={date} className={`border-r border-b border-gray-100 p-2 transition-colors relative min-h-[100px] ${isSelected ? 'bg-red-50/30' : 'hover:bg-gray-50/50'}`}>
                    <span className={`inline-flex items-center justify-center w-7 h-7 text-sm font-medium rounded-full ${isSelected ? 'bg-[#9B2C4D] text-white shadow-sm' : 'text-gray-700'}`}>
                      {date}
                    </span>
                    
                    {/* Mock Events rendering */}
                    {hasEvent && (
                      <div className="mt-1 px-2 py-1 text-xs rounded border border-red-200 bg-red-50 text-red-900 font-medium truncate flex items-center gap-1 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#9B2C4D]"></span>
                        Team activity
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT PANE: SIDEBAR */}
        <div className="w-[320px] flex flex-col gap-6 shrink-0">
          
          {/* Mini Calendar */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <button className="p-1 hover:bg-gray-100 rounded-full"><ChevronLeft className="w-4 h-4 text-gray-600" /></button>
              <h3 className="font-semibold text-sm text-gray-900">September 2026</h3>
              <button className="p-1 hover:bg-gray-100 rounded-full"><ChevronRight className="w-4 h-4 text-gray-600" /></button>
            </div>
            <div className="grid grid-cols-7 gap-y-2 text-center text-xs">
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(d => (
                <span key={d} className="font-medium text-gray-400">{d}</span>
              ))}
              {/* Mini Calendar Dates Mock */}
              <span className="text-gray-400 py-1">31</span>
              <span className="bg-red-50 text-red-900 rounded-full py-1 font-medium">1</span>
              <span className="py-1">2</span><span className="py-1">3</span><span className="py-1">4</span>
              <span className="py-1">5</span><span className="py-1">6</span>
              <span className="py-1">7</span><span className="py-1">8</span><span className="py-1">9</span>
              <span className="py-1">10</span><span className="py-1">11</span><span className="py-1">12</span>
              <span className="py-1">13</span><span className="py-1">14</span><span className="py-1">15</span>
              <span className="py-1">16</span><span className="py-1">17</span><span className="py-1">18</span>
              <span className="py-1">19</span><span className="py-1">20</span><span className="py-1">21</span>
              <span className="py-1">22</span><span className="py-1">23</span>
              <span className="bg-[#9B2C4D] text-white rounded-full py-1 font-medium shadow-sm">24</span>
              <span className="py-1 relative">25<span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-400 rounded-full"></span></span>
              <span className="py-1">26</span>
              <span className="py-1 relative">27<span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-400 rounded-full"></span></span>
              <span className="py-1">28</span><span className="py-1">29</span><span className="py-1">30</span>
            </div>
          </div>

          {/* Tomorrow Events */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Tomorrow</h3>
                <p className="text-xs text-gray-500">Fri 25 Sept</p>
              </div>
              <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-md">1 event</span>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 group cursor-pointer">
              <div className="mt-1 w-2 h-2 rounded-full bg-[#9B2C4D] shrink-0"></div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 truncate">Team activity</h4>
                <p className="text-xs text-gray-500 mt-0.5">17:00 • Private</p>
                <div className="flex -space-x-1 mt-2">
                  <div className="w-5 h-5 rounded-full bg-blue-100 border border-white flex items-center justify-center text-[8px]">👤</div>
                </div>
              </div>
              <button className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-all">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Upcoming this week */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Upcoming this week</h3>
                <p className="text-xs text-gray-500">Next 7 days</p>
              </div>
              <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-md">1 event</span>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 group cursor-pointer">
              <div className="mt-1 w-2 h-2 rounded-full bg-red-400 shrink-0"></div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 truncate">Project 1 Discussion</h4>
                <p className="text-xs text-gray-500 mt-0.5">17:00 • Private</p>
                <div className="flex -space-x-1 mt-2">
                  <div className="w-5 h-5 rounded-full bg-purple-100 border border-white flex items-center justify-center text-[8px]">👤</div>
                </div>
              </div>
              <button className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-all">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
