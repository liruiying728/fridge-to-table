import { Navigate, Route, Routes } from "react-router-dom";
import FavoritesPage from "./pages/FavoritesPage";
import Home from "./pages/Home";
import RecipePage from "./pages/RecipePage";
import ResultsPage from "./pages/ResultsPage";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/recipe" element={<RecipePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
