import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import "./i18n.config";
import { ThemeProvider } from "./contexts/theme/ThemeProvider.tsx";
import { ModalProvider } from "./contexts/modal/ModalProvider.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
);
