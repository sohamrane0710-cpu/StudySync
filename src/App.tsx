import React from 'react';
import { TimerProvider } from './context/TimerContext';
import { StudyWorkspace } from './components/workspace/StudyWorkspace';

export const App: React.FC = () => {
  return (
    <TimerProvider>
      <StudyWorkspace />
    </TimerProvider>
  );
};

export default App;
