import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { initialState, ViewerStore } from "./state/store.js";
import "./styles.css";

const snapshot = new URLSearchParams(location.search).has("snapshot");
if (snapshot) document.body.classList.add("snapshot");

const store = new ViewerStore(initialState);
createRoot(document.getElementById("root")!).render(<App store={store} />);
