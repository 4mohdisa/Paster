

import { Button } from '@paster/ui/components/button';

function App() {
  const handleShowDashboard = () => {
    window.electron?.ipcRenderer.invoke('menubar:show-main-window');
  };

  const handleQuit = () => {
    window.electron?.ipcRenderer.invoke('menubar:quit-app');
  };

  return (
    <div className="p-2 bg-background">
      <Button
        variant="ghost"
        className="w-full justify-start"
        onClick={handleShowDashboard}
      >
        Dashboard
      </Button>
      <Button
        variant="ghost"
        className="w-full justify-start text-destructive hover:text-destructive"
        onClick={handleQuit}
      >
        Quit Paster
      </Button>
    </div>
  );
}

export default App;