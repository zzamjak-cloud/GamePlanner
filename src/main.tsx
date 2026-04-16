import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthGuard } from "./components/AuthGuard";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthGuard appName="Game Planner">
      <App />
    </AuthGuard>
  </React.StrictMode>,
);
