import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import { RoomHeader } from '../components/study-room/RoomHeader.js';
import { RoomTimer } from '../components/study-room/RoomTimer.js';
import { ParticipantList } from '../components/study-room/ParticipantList.js';
import { RoomActivity } from '../components/study-room/RoomActivity.js';
import { getStudyRoom, joinStudyRoom, leaveStudyRoom, type StudyRoom } from '../api.js';

export function StudyRoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  
  const [room, setRoom] = useState<StudyRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadRoom = async () => {
    if (!roomId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getStudyRoom(roomId);
      setRoom(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load room');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoom();
  }, [roomId]);

  const handleJoin = async () => {
    if (!roomId) return;
    try {
      setIsJoining(true);
      setActionError(null);
      setActionSuccess(null);
      await joinStudyRoom(roomId);
      setActionSuccess('Successfully joined the room!');
      loadRoom(); // refresh member count
    } catch (err: any) {
      setActionError(err.message || 'Failed to join room');
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!roomId) return;
    try {
      setIsLeaving(true);
      setActionError(null);
      setActionSuccess(null);
      await leaveStudyRoom(roomId);
      navigate('/rooms');
    } catch (err: any) {
      setActionError(err.message || 'Failed to leave room');
      setIsLeaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-slate-50 md:h-[calc(100vh)] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="flex flex-col h-full bg-slate-50 md:h-[calc(100vh)] items-center justify-center p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg max-w-md text-center">
          <p className="font-medium">Error loading room</p>
          <p className="text-sm mt-1">{error || 'Room not found'}</p>
          <button 
            onClick={() => navigate('/rooms')}
            className="mt-4 px-4 py-2 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200 transition-colors"
          >
            Back to Rooms
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 md:h-[calc(100vh)] max-h-screen">
      <RoomHeader 
        roomName={room.name} 
        description={room.description || ''} 
        memberCount={room._count?.roomMembers || 0} 
        onJoin={handleJoin}
        onLeave={handleLeave}
        isJoining={isJoining}
        isLeaving={isLeaving}
        currentUserMembership={room.currentUserMembership}
      />
      
      {/* Action Messages Area */}
      {(actionError || actionSuccess) && (
        <div className="px-4 py-3 shrink-0">
          <div className="max-w-7xl mx-auto">
            {actionError && (
              <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-medium">
                {actionError}
              </div>
            )}
            {actionSuccess && (
              <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-lg text-sm font-medium">
                {actionSuccess}
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto w-full p-4 md:p-6 lg:p-8 flex flex-col lg:flex-row gap-6 h-full">
          
          {/* Main Study Area */}
          <div className="flex-1 flex flex-col gap-6 lg:min-w-[60%]">
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm mb-2 shadow-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">UI Preview Mode</p>
                <p>The timer and chat components below are frontend placeholders. They are not yet connected to the backend WebSocket engine.</p>
              </div>
            </div>
            <RoomTimer />
          </div>

          {/* Secondary Panel (Participants & Activity) */}
          <div className="w-full lg:w-[360px] flex flex-col gap-6 shrink-0 opacity-70 pointer-events-none grayscale-[0.3]">
            <ParticipantList />
            <RoomActivity />
          </div>

        </div>
      </div>
    </div>
  );
}
