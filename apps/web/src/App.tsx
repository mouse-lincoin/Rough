import { CanvasHost } from './components/CanvasHost';
import { Toolbar } from './components/Toolbar/Toolbar';

export function App(): JSX.Element {
  return (
    <div className="app">
      <header className="app-header">
        <span className="app-logo">Rough</span>
        <Toolbar />
      </header>
      <main className="app-main">
        <CanvasHost />
      </main>
    </div>
  );
}
