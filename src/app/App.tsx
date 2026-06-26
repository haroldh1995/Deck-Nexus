import { BrowserRouter } from "react-router-dom";
import { SettingsProvider } from "./SettingsContext";
import { AppShell } from "./AppShell";

export function App() {
  return (
    <SettingsProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </SettingsProvider>
  );
}
