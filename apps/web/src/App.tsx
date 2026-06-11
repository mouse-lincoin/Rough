import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DocumentListPage } from './routes/DocumentListPage';
import { EditorPage } from './routes/EditorPage';
import { SharePage } from './routes/SharePage';

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DocumentListPage />} />
        <Route path="/doc/:docId" element={<EditorPage />} />
        <Route path="/share/:token" element={<SharePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
