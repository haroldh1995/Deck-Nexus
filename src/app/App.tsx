import { BrowserRouter } from "react-router-dom";
import { SettingsProvider } from "./SettingsContext";
import { AppShell } from "./AppShell";

const routerBase =
  import.meta.env.BASE_URL === "/"
    ? "/"
    : import.meta.env.BASE_URL.replace(/\/$/, "");

export function App() {
  return (
    <SettingsProvider>
      <BrowserRouter basename={routerBase}>
        <AppShell />
      </BrowserRouter>
    </SettingsProvider>
  );
}
