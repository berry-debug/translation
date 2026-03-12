import { config } from "./config.js";
import { InMemoryStore } from "./repositories/memory-store.js";

export const store = new InMemoryStore({
  stateFile: config.stateFile,
  exportRoot: config.exportRoot,
  defaultProject: {
    name: "KusaPics",
    sourceLanguage: "en",
    targetLanguages: ["ja", "fr", "es", "pt", "de", "ko", "zh-cn"],
    baseUrl: "https://kusa.pics"
  }
});
