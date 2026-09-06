import { useParams } from 'react-router-dom';
import { RoomHeader } from '../components/study-room/RoomHeader.js';
import { RoomTimer } from '../components/study-room/RoomTimer.js';
import { ParticipantList } from '../components/study-room/ParticipantList.js';
import { RoomActivity } from '../components/study-room/RoomActivity.js';

export function StudyRoomPage() {
  const { roomId } = useParams();
  
  // Use mock data for now based on roomId or fallback
  const mockRoomName = roomId === 'room-1' ? 'Deep Work: Computer Science' : 'Study Session';
  const mockDescription = roomId === 'room-1' 
    ? 'Silent focus room for CS students. Pomodoro 50/10.' 
    : 'Join the session and focus.';
  
  return (
    <div className="flex flex-col h-full bg-slate-50 md:h-[calc(100vh)] max-h-screen">
      <RoomHeader 
        roomName={mockRoomName} 
        description={mockDescription} 
        memberCount={3} 
      />
      
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto w-full p-4 md:p-6 lg:p-8 flex flex-col lg:flex-row gap-6 h-full">
          
          {/* Main Study Area */}
          <div className="flex-1 flex flex-col gap-6 lg:min-w-[60%]">
            <RoomTimer />
          </div>

          {/* Secondary Panel (Participants & Activity) */}
          <div className="w-full lg:w-[360px] flex flex-col gap-6 shrink-0">
            <ParticipantList />
            <RoomActivity />
          </div>

        </div>
      </div>
    </div>
  );
}
