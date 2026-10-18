import React, { useState } from 'react';
import { UtilityBar } from './UtilityBar';
import { SequencePipeline } from './SequencePipeline';
import { HeroRadialDial } from '../timer/HeroRadialDial';
import { ControlIsland } from '../timer/ControlIsland';
import { Dock } from './Dock';
import { HistoryDrawer } from '../history/HistoryDrawer';
import { SessionSummaryModal } from '../history/SessionSummaryModal';
import { ModeSelectorModal } from '../modes/ModeSelectorModal';
import { AudioSettingsModal } from '../audio/AudioSettingsModal';

export const StudyWorkspace: React.FC = () => {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isModeSelectorOpen, setIsModeSelectorOpen] = useState(false);
  const [isAudioSettingsOpen, setIsAudioSettingsOpen] = useState(false);

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        paddingTop: '64px',
        paddingBottom: '88px',
        overflowX: 'hidden',
      }}
    >
      {/* Zone 1: Utility and Presence Bar */}
      <UtilityBar
        onOpenModeSelector={() => setIsModeSelectorOpen(true)}
        onOpenAudioSettings={() => setIsAudioSettingsOpen(true)}
      />

      {/* Main Focus Canvas: Zone 2, Zone 3, Zone 4 */}
      <main
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '28px',
          width: '100%',
          maxWidth: '800px',
          margin: 'auto',
          padding: '20px 16px',
        }}
      >
        {/* Zone 2: Context and Sequence Pipeline */}
        <SequencePipeline />

        {/* Zone 3: Hero Radial Focus Dial */}
        <HeroRadialDial />

        {/* Zone 4: Tactile Control Island */}
        <ControlIsland />
      </main>

      {/* Zone 5: Floating Bottom Dock */}
      <Dock
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenAudioSettings={() => setIsAudioSettingsOpen(true)}
      />

      {/* Overlay Modals & Drawers */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />

      <ModeSelectorModal
        isOpen={isModeSelectorOpen}
        onClose={() => setIsModeSelectorOpen(false)}
      />

      <AudioSettingsModal
        isOpen={isAudioSettingsOpen}
        onClose={() => setIsAudioSettingsOpen(false)}
      />

      <SessionSummaryModal />
    </div>
  );
};
