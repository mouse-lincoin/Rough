import { CanvasHost } from './components/CanvasHost';

export function App(): JSX.Element {
  return (
    <div className="app">
      <header className="app-header">
        <span className="app-logo">Rough</span>
      </header>
      <main className="app-main">
        <CanvasHost />
      </main>
    </div>
  );
}
